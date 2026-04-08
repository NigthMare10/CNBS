import { randomUUID } from "node:crypto";
import {
  createDatasetVersionId,
  type DatasetScope,
  fingerprintSourceFiles,
  institutionsCatalog,
  mergePublishability,
  resolveInstitution,
  slugKey,
  type AuditEvent,
  type DatasetVersionRecord,
  type MappingSummary,
  type ReconciliationSummary,
  type SourceFileRecord,
  type ValidationIssue,
  type ValidationSummary
} from "@cnbs/domain";
import type {
  AuditEventListItem,
  DatasetVersionListItem,
  StagedIngestionRun,
  StagedIngestionRunListItem,
  UploadedWorkbookInput,
  WorkbookDetectionResult
} from "../types";
import { inspectWorkbookSecurity } from "../security/workbook-security";
import { detectWorkbookKind, WorkbookClassificationError } from "../workbooks/signatures";
import { parsePremiumWorkbook } from "../parsers/premiums";
import { parseFinancialPositionWorkbook } from "../parsers/financial-position";
import { parseIncomeStatementWorkbook } from "../parsers/income-statement";
import { parseReferenceWorkbook } from "../parsers/reference";
import { validateParsedWorkbooks } from "./validation";
import { canonicalCatalogs, normalizeFinancialPositionFacts, normalizeIncomeStatementRows, normalizePremiumFacts } from "./normalization";
import { buildMappingSummary, createEmptyMappingSummary, createMappingSummaryBuilder } from "./mapping-summary";
import { reconcileAgainstReference } from "../reconciliation/rules";
import { buildDatasetArtifacts } from "../publish/dataset-builder";
import { LocalStorageRepository } from "../storage/local-storage";
import { getStoragePersistenceInfo } from "../storage/persistence";

function emitOperationalLog(event: string, payload: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      event,
      time: new Date().toISOString(),
      vercel: Boolean(process.env.VERCEL),
      ...payload
    })
  );
}

type RankingEntry = Record<string, unknown> & {
  institutionId?: string;
  institutionName?: string;
  premiumAmount?: number;
  totalAssets?: number;
  equity?: number;
  totalReserves?: number;
};

function rankingMetricValue(entry: RankingEntry, key: "premiums" | "assets" | "equity" | "reserves"): number {
  switch (key) {
    case "premiums":
      return Number(entry.premiumAmount ?? 0);
    case "assets":
      return Number(entry.totalAssets ?? 0);
    case "equity":
      return Number(entry.equity ?? 0);
    case "reserves":
      return Number(entry.totalReserves ?? 0);
    default:
      return 0;
  }
}

function stableSortRankings(entries: RankingEntry[], key: "premiums" | "assets" | "equity" | "reserves"): RankingEntry[] {
  return [...entries].sort((left, right) => {
    const byMetric = rankingMetricValue(right, key) - rankingMetricValue(left, key);
    if (byMetric !== 0) {
      return byMetric;
    }

    const leftName = String(left.institutionName ?? left.institutionId ?? "");
    const rightName = String(right.institutionName ?? right.institutionId ?? "");
    const byName = leftName.localeCompare(rightName, "es");
    if (byName !== 0) {
      return byName;
    }

    return String(left.institutionId ?? "").localeCompare(String(right.institutionId ?? ""), "es");
  });
}

function buildRankingsFromAggregates(input: { premiums: RankingEntry[]; financialHighlights: RankingEntry[] }) {
  return {
    premiums: stableSortRankings(input.premiums, "premiums").slice(0, 12),
    assets: stableSortRankings(input.financialHighlights, "assets").slice(0, 12),
    equity: stableSortRankings(input.financialHighlights, "equity").slice(0, 12),
    reserves: stableSortRankings(input.financialHighlights, "reserves").slice(0, 12)
  };
}

function resolveInstitutionRouteInput(value: string): string | null {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  const exact = institutionsCatalog.find(
    (institution) => institution.institutionId === trimmedValue || institution.canonicalCode === trimmedValue
  );
  if (exact) {
    return exact.institutionId;
  }

  const aliasMatch = resolveInstitution(trimmedValue);
  if (aliasMatch) {
    return aliasMatch.institutionId;
  }

  const normalizedSlug = slugKey(trimmedValue);
  const slugMatch = institutionsCatalog.find((institution) => {
    return [institution.institutionId, institution.displayName, institution.canonicalName, institution.shortName].some(
      (candidate) => slugKey(candidate) === normalizedSlug
    );
  });

  return slugMatch?.institutionId ?? null;
}

function datasetScopeFromPrimarySources(input: {
  hasPremiums: boolean;
  hasFinancialPosition: boolean;
  hasIncomeStatement: boolean;
}): DatasetScope {
  if (input.hasPremiums && input.hasFinancialPosition) {
    return "premiums-financial";
  }
  if (input.hasPremiums) {
    return "premiums-only";
  }
  if (input.hasFinancialPosition) {
    return "financial-only";
  }
  return "empty";
}

function domainAvailabilityFromInput(input: {
  hasPremiums: boolean;
  premiumRecords: number;
  hasFinancialPosition: boolean;
  financialRecords: number;
  hasIncomeStatement: boolean;
  incomeStatementRecords: number;
  hasReference: boolean;
}) {
  return {
    premiums: {
      sourceProvided: input.hasPremiums,
      records: input.premiumRecords,
      publishable: input.hasPremiums,
      missingReason: input.hasPremiums ? undefined : "Premium workbook not provided in this publication."
    },
    financialPosition: {
      sourceProvided: input.hasFinancialPosition,
      records: input.financialRecords,
      publishable: input.hasFinancialPosition,
      missingReason: input.hasFinancialPosition ? undefined : "Financial position workbook not provided in this publication."
    },
    claims: {
      sourceProvided: false,
      records: 0,
      publishable: false,
      missingReason: "Claims raw source is not available in phase 1."
    },
    incomeStatement: {
      sourceProvided: input.hasIncomeStatement,
      records: input.incomeStatementRecords,
      publishable: false,
      missingReason: input.hasIncomeStatement
        ? "Income statement workbook was detected, but current publication policy only operationalizes premiums and financial position."
        : "Income statement is not part of the current operational publication policy."
    },
    reference: {
      sourceProvided: input.hasReference,
      records: input.hasReference ? 1 : 0,
      publishable: false,
      missingReason: input.hasReference ? undefined : "Reference workbook was not supplied; reconciliation is limited or skipped."
    }
  };
}

export class IngestionService {
  private publicOverviewCache = new Map<string, Record<string, unknown>>();
  private publicRankingsCache = new Map<string, Record<string, unknown>>();
  private publicInstitutionDetailCache = new Map<string, Record<string, unknown>>();

  constructor(private readonly storage = new LocalStorageRepository()) {}

  private compactMappingSummary(mappingSummary: MappingSummary | undefined) {
    if (!mappingSummary) {
      return null;
    }

    return {
      repairedByNormalization: mappingSummary.repairedByNormalization,
      aliasesMatched: mappingSummary.aliasesMatched,
      fallbackByLineNumber: mappingSummary.fallbackByLineNumber,
      ambiguousAliases: mappingSummary.ambiguousAliases,
      unresolvedAliases: mappingSummary.unresolvedAliases,
      totalAttempts: mappingSummary.totalAttempts,
      textQuality: mappingSummary.textQuality,
      domains: mappingSummary.domains,
      topAliasRepairs: mappingSummary.topAliasRepairs.slice(0, 5)
    };
  }

  private classificationIssues(summary: ValidationSummary): ValidationIssue[] {
    return summary.issues.filter((issue) => issue.code === "WORKBOOK_SCHEMA_UNRECOGNIZED");
  }

  private toStagedRunListItem(run: StagedIngestionRun): StagedIngestionRunListItem {
    return {
      ingestionRunId: run.ingestionRunId,
      createdAt: run.createdAt,
      uploadedBy: run.uploadedBy,
      publicationState: run.publicationState,
      publishedDatasetVersionId: run.publishedDatasetVersionId,
      publishedAt: run.publishedAt,
      sourceFiles: run.sourceFiles,
      mappingSummary: {
        ...createEmptyMappingSummary(),
        ...this.compactMappingSummary(run.mappingSummary)
      },
      validationSummary: {
        publishability: run.validationSummary.publishability,
        issues: this.classificationIssues(run.validationSummary)
      },
      reconciliationSummary: {
        publishability: run.reconciliationSummary.publishability,
        issues: []
      },
      draftDatasetVersion: {
        datasetVersionId: run.draftDatasetVersion.datasetVersionId,
        ingestionRunId: run.draftDatasetVersion.ingestionRunId,
        status: run.draftDatasetVersion.status,
        createdAt: run.draftDatasetVersion.createdAt,
        publishedAt: run.draftDatasetVersion.publishedAt,
        uploadedBy: run.draftDatasetVersion.uploadedBy,
        sourceFiles: run.draftDatasetVersion.sourceFiles,
        businessPeriods: run.draftDatasetVersion.businessPeriods,
        datasetScope: run.draftDatasetVersion.datasetScope,
        domainAvailability: run.draftDatasetVersion.domainAvailability,
        fingerprint: run.draftDatasetVersion.fingerprint,
        ...(run.draftDatasetVersion.mappingSummary ? { mappingSummary: run.draftDatasetVersion.mappingSummary } : {}),
        validationSummary: {
          publishability: run.draftDatasetVersion.validationSummary.publishability,
          issues: []
        },
        reconciliationSummary: {
          publishability: run.draftDatasetVersion.reconciliationSummary.publishability,
          issues: []
        }
      }
    };
  }

  private toDatasetVersionListItem(dataset: DatasetVersionRecord): DatasetVersionListItem {
    return {
      datasetVersionId: dataset.datasetVersionId,
      ingestionRunId: dataset.ingestionRunId,
      status: dataset.status,
      createdAt: dataset.createdAt,
      publishedAt: dataset.publishedAt,
      uploadedBy: dataset.uploadedBy,
      businessPeriods: dataset.businessPeriods,
      datasetScope: dataset.datasetScope,
      domainAvailability: dataset.domainAvailability
    };
  }

  private toAuditEventListItem(event: AuditEvent): AuditEventListItem {
    const details = event.details ?? {};
    const publishability = typeof details.publishability === "string" ? details.publishability : undefined;
    const textQualitySummary =
      typeof details.textQualitySummary === "object" && details.textQualitySummary !== null
        ? (details.textQualitySummary as Record<string, unknown>)
        : undefined;
    const mappingSummary =
      typeof details.mappingSummary === "object" && details.mappingSummary !== null
        ? (this.compactMappingSummary(details.mappingSummary as MappingSummary) ?? undefined)
        : undefined;

    return {
      auditEventId: event.auditEventId,
      datasetVersionId: event.datasetVersionId,
      ingestionRunId: event.ingestionRunId,
      actor: event.actor,
      action: event.action,
      timestamp: event.timestamp,
      details: {
        ...(publishability ? { publishability } : {}),
        ...(textQualitySummary ? { textQualitySummary } : {}),
        ...(mappingSummary ? { mappingSummary } : {})
      }
    };
  }

  private async readPublishedArrayArtifact(datasetVersionId: string, relativePath: string, limit?: number): Promise<Record<string, unknown>[]> {
    const value = await this.storage.readPublishedArtifactIfExists<unknown>(datasetVersionId, relativePath);
    if (!Array.isArray(value)) {
      return [];
    }

    const items = value.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null);
    return typeof limit === "number" ? items.slice(0, limit) : items;
  }

  private async readPublishedRecordArtifact(datasetVersionId: string, relativePath: string): Promise<Record<string, unknown>> {
    const value = await this.storage.readPublishedArtifactIfExists<unknown>(datasetVersionId, relativePath);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  }

  private toPublicDatasetMetadata(dataset: DatasetVersionRecord) {
    return {
      datasetVersionId: dataset.datasetVersionId,
      ingestionRunId: dataset.ingestionRunId,
      status: dataset.status,
      createdAt: dataset.createdAt,
      publishedAt: dataset.publishedAt,
      businessPeriods: dataset.businessPeriods,
      datasetScope: dataset.datasetScope,
      domainAvailability: dataset.domainAvailability,
      validationSummary: {
        publishability: dataset.validationSummary.publishability,
        issuesCount: dataset.validationSummary.issues.length
      },
      reconciliationSummary: {
        publishability: dataset.reconciliationSummary.publishability,
        issuesCount: dataset.reconciliationSummary.issues.length
      }
    };
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  async ingestWorkbookSet(input: {
    uploadedBy: string;
    files: UploadedWorkbookInput[];
  }): Promise<StagedIngestionRun> {
    await this.storage.initialize();
    emitOperationalLog("ingestion_started", {
      uploadedBy: input.uploadedBy,
      fileCount: input.files.length,
      storage: getStoragePersistenceInfo()
    });

    const storedFiles: SourceFileRecord[] = [];
    const validationIssues: ValidationIssue[] = [];

    try {
      for (const file of input.files) {
        const storedFile = await this.storage.storeUploadedWorkbook(file);
        const storedPath = this.storage.quarantineFilePath(storedFile.storedFilename);
        const securityIssues = await inspectWorkbookSecurity(storedPath, file.mimeType, file.sizeBytes);

        validationIssues.push(...securityIssues);
        storedFiles.push(storedFile);
      }

      if (validationIssues.some((issue) => issue.severity === "critical")) {
        return await this.failFastRun(input.uploadedBy, storedFiles, validationIssues, "security-gate");
      }

      const detections = await Promise.all(
        storedFiles.map(async (storedFile) => {
          try {
            const detection = await detectWorkbookKind(this.storage.quarantineFilePath(storedFile.storedFilename));
            storedFile.kind = detection.kind;
            storedFile.detectedSignature = detection.signature;
            return detection;
          } catch (error) {
            const details = error instanceof WorkbookClassificationError ? error.details : undefined;
            validationIssues.push({
              code: "WORKBOOK_SCHEMA_UNRECOGNIZED",
              severity: "critical",
              status: "failed",
              scope: storedFile.originalFilename,
              message: error instanceof Error ? error.message : "Workbook schema could not be recognized.",
              ...(details ? { details } : {})
            });

            return null;
          }
        })
      );

      if (validationIssues.some((issue) => issue.severity === "critical")) {
        return await this.failFastRun(input.uploadedBy, storedFiles, validationIssues, "classification-gate");
      }

      const duplicateRoles = detections
        .filter((detection): detection is WorkbookDetectionResult => detection !== null)
        .map((detection) => detection.kind)
        .filter((kind, index, collection) => collection.indexOf(kind) !== index);

      if (duplicateRoles.length > 0) {
        validationIssues.push({
          code: "WORKBOOK_ROLE_DUPLICATED",
          severity: "critical",
          status: "failed",
          scope: "ingestion",
          message: `Duplicate workbook roles detected: ${duplicateRoles.join(", ")}`
        });
      }

      if (validationIssues.some((issue) => issue.severity === "critical")) {
        return await this.failFastRun(input.uploadedBy, storedFiles, validationIssues, "duplicate-role-gate");
      }

      const premiumsFile = storedFiles.find((file) => file.kind === "premiums");
      const financialFile = storedFiles.find((file) => file.kind === "financialPosition");
      const incomeStatementFile = storedFiles.find((file) => file.kind === "incomeStatement");
      const referenceFile = storedFiles.find((file) => file.kind === "reference");

      const premiumRows = premiumsFile
        ? await parsePremiumWorkbook(this.storage.quarantineFilePath(premiumsFile.storedFilename))
        : [];
      const financialRows = financialFile
        ? await parseFinancialPositionWorkbook(this.storage.quarantineFilePath(financialFile.storedFilename))
        : [];
      const incomeStatementRows = incomeStatementFile
        ? await parseIncomeStatementWorkbook(this.storage.quarantineFilePath(incomeStatementFile.storedFilename))
        : [];
      const referenceWorkbook = referenceFile
        ? await parseReferenceWorkbook(this.storage.quarantineFilePath(referenceFile.storedFilename))
        : null;

      const parsedValidation = validateParsedWorkbooks({
        premiumRows,
        financialPositionRows: financialRows,
        incomeStatementRows,
        referenceWorkbook
      });

      const datasetVersionId = createDatasetVersionId();
      const mappingSummaryBuilder = createMappingSummaryBuilder();
      const normalizedPremiums = premiumsFile
        ? normalizePremiumFacts({
            datasetVersionId,
            sourceFile: premiumsFile,
            rows: premiumRows,
            mappingSummaryBuilder
          })
        : { facts: [], period: undefined, issues: [] };
      const normalizedFinancials = financialFile
        ? normalizeFinancialPositionFacts({
            datasetVersionId,
            sourceFile: financialFile,
            rows: financialRows,
            mappingSummaryBuilder
          })
        : { facts: [], period: undefined, issues: [] };
      const normalizedIncomeStatement = incomeStatementFile
        ? normalizeIncomeStatementRows({
            datasetVersionId,
            sourceFile: incomeStatementFile,
            rows: incomeStatementRows
          })
        : { facts: [], records: 0, period: undefined, issues: [] };
      const mappingSummary = buildMappingSummary(mappingSummaryBuilder);

      const normalizationSummary: ValidationSummary = {
        publishability: [...validationIssues, ...parsedValidation.issues, ...normalizedPremiums.issues, ...normalizedFinancials.issues, ...normalizedIncomeStatement.issues].some(
          (issue) => issue.severity === "critical" || issue.severity === "high"
        )
          ? "blocked"
          : [...validationIssues, ...parsedValidation.issues, ...normalizedPremiums.issues, ...normalizedFinancials.issues, ...normalizedIncomeStatement.issues].some(
                (issue) => issue.severity === "medium"
              )
            ? "warningOnly"
            : "publishable",
        issues: [...validationIssues, ...parsedValidation.issues, ...normalizedPremiums.issues, ...normalizedFinancials.issues, ...normalizedIncomeStatement.issues]
      };

      if (normalizationSummary.publishability === "blocked") {
        emitOperationalLog("ingestion_validation_failed", {
          uploadedBy: input.uploadedBy,
          issueCount: normalizationSummary.issues.length,
          criticalIssueCount: normalizationSummary.issues.filter((issue) => issue.severity === "critical" || issue.severity === "high").length
        });
      } else {
        emitOperationalLog("ingestion_validation_passed", {
          uploadedBy: input.uploadedBy,
          publishability: normalizationSummary.publishability,
          issueCount: normalizationSummary.issues.length
        });
      }

      const reconciliationSummary = reconcileAgainstReference({
        premiumFacts: normalizedPremiums.facts,
        financialPositionFacts: normalizedFinancials.facts,
        premiumPeriod: normalizedPremiums.period,
        financialPeriod: normalizedFinancials.period,
        reference: referenceWorkbook,
        institutionNameById: Object.fromEntries(institutionsCatalog.map((institution) => [institution.institutionId, institution.canonicalName]))
      });

      const artifacts = buildDatasetArtifacts({
        premiumFacts: normalizedPremiums.facts,
        financialPositionFacts: normalizedFinancials.facts,
        incomeStatementFacts: [],
        datasetVersionId
      });

      const datasetScope = datasetScopeFromPrimarySources({
        hasPremiums: Boolean(premiumsFile),
        hasFinancialPosition: Boolean(financialFile),
        hasIncomeStatement: Boolean(incomeStatementFile)
      });

      const ingestionRunId = randomUUID();
      const draftDatasetVersion: DatasetVersionRecord = {
        datasetVersionId,
        ingestionRunId,
        status: "staged",
        createdAt: new Date().toISOString(),
        publishedAt: null,
        uploadedBy: input.uploadedBy,
        sourceFiles: storedFiles,
        businessPeriods: {
          premiums: normalizedPremiums.period,
          financialPosition: normalizedFinancials.period,
          incomeStatement: normalizedIncomeStatement.period,
          reference: referenceWorkbook?.periodYearMonth
            ? {
                reportDate: `${referenceWorkbook.periodYearMonth}-01`,
                year: Number(referenceWorkbook.periodYearMonth.slice(0, 4)),
                month: Number(referenceWorkbook.periodYearMonth.slice(5, 7)),
                yearMonth: referenceWorkbook.periodYearMonth,
                excelSerial: undefined
              }
            : undefined
        },
        datasetScope,
        domainAvailability: domainAvailabilityFromInput({
          hasPremiums: Boolean(premiumsFile),
          premiumRecords: normalizedPremiums.facts.length,
          hasFinancialPosition: Boolean(financialFile),
          financialRecords: normalizedFinancials.facts.length,
          hasIncomeStatement: Boolean(incomeStatementFile),
          incomeStatementRecords: normalizedIncomeStatement.records,
          hasReference: Boolean(referenceFile)
        }),
        fingerprint: fingerprintSourceFiles(storedFiles),
        mappingSummary,
        validationSummary: normalizationSummary,
        reconciliationSummary
      };

      const run: StagedIngestionRun = {
        ingestionRunId,
        createdAt: new Date().toISOString(),
        uploadedBy: input.uploadedBy,
        publicationState: "staged",
        publishedDatasetVersionId: null,
        publishedAt: null,
        sourceFiles: storedFiles,
        mappingSummary,
        validationSummary: normalizationSummary,
        reconciliationSummary,
        draftDatasetVersion,
        artifacts
      };

      await this.storage.writeStagingRun(run);
      await this.storage.writeAuditEvent(this.auditEvent({
        actor: input.uploadedBy,
        action: "INGESTION_STAGED",
        ingestionRunId: run.ingestionRunId,
        datasetVersionId,
        details: {
          publishability: mergePublishability(normalizationSummary, reconciliationSummary),
          validationIssues: normalizationSummary.issues.length,
          reconciliationIssues: reconciliationSummary.issues.length,
          mappingSummary,
          textQualitySummary: mappingSummary.textQuality
        }
      }));

      emitOperationalLog("ingestion_staged", {
        ingestionRunId,
        datasetVersionId,
        uploadedBy: input.uploadedBy,
        publishability: mergePublishability(normalizationSummary, reconciliationSummary)
      });

      return run;
    } catch (error) {
      emitOperationalLog("ingestion_failed", {
        uploadedBy: input.uploadedBy,
        fileCount: input.files.length,
        storedFileCount: storedFiles.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async publishStagedRun(ingestionRunId: string, actor: string): Promise<DatasetVersionRecord> {
    emitOperationalLog("publish_started", {
      ingestionRunId,
      actor
    });

    try {
      const run = await this.storage.readStagingRun(ingestionRunId);
      const publishability = mergePublishability(run.validationSummary, run.reconciliationSummary);

      if (publishability === "blocked") {
        throw new Error(`Staged run ${ingestionRunId} is blocked from publication.`);
      }

      const datasetVersion: DatasetVersionRecord = {
        ...run.draftDatasetVersion,
        status: "published",
        publishedAt: new Date().toISOString()
      };

      const updatedRun: StagedIngestionRun = {
        ...run,
        publicationState: "published",
        publishedDatasetVersionId: datasetVersion.datasetVersionId,
        publishedAt: datasetVersion.publishedAt
      };

      await this.storage.publishDataset({ datasetVersion, artifacts: run.artifacts });
      await this.storage.activateDataset(datasetVersion.datasetVersionId);
      await this.storage.writeStagingRun(updatedRun);
      await this.storage.writeAuditEvent(this.auditEvent({
        actor,
        action: "DATASET_PUBLISHED",
        ingestionRunId,
        datasetVersionId: datasetVersion.datasetVersionId,
        details: {
          publishability,
          mappingSummary: run.mappingSummary,
          textQualitySummary: run.mappingSummary.textQuality
        }
      }));

      emitOperationalLog("publish_completed", {
        ingestionRunId,
        datasetVersionId: datasetVersion.datasetVersionId,
        actor,
        publishability
      });

      return datasetVersion;
    } catch (error) {
      emitOperationalLog("publish_failed", {
        ingestionRunId,
        actor,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async rollbackToVersion(datasetVersionId: string, actor: string): Promise<DatasetVersionRecord> {
    const target = await this.storage.readPublishedDatasetVersion(datasetVersionId);
    await this.storage.activateDataset(datasetVersionId);
    await this.storage.writeAuditEvent(this.auditEvent({
      actor,
      action: "DATASET_ROLLED_BACK",
      ingestionRunId: null,
      datasetVersionId,
      details: {}
    }));

    return target;
  }

  async getActiveDataset() {
    return await this.storage.getActiveDatasetVersion();
  }

  async getPublicVersionPayload() {
    const active = await this.storage.getActiveDatasetVersion();
    emitOperationalLog("public_version_requested", {
      activeDatasetVersionId: active?.datasetVersionId ?? null
    });
    return { activeDataset: active ? this.toPublicDatasetMetadata(active) : null };
  }

  async getPublicOverview() {
    const active = await this.storage.getActiveDatasetVersion();
    emitOperationalLog("public_overview_requested", {
      activeDatasetVersionId: active?.datasetVersionId ?? null
    });

    if (!active) {
      return {
        metadata: null,
        executiveKpis: [],
        premiumsByInstitution: [],
        premiumsByLine: [],
        financialHighlights: [],
        incomeStatementHighlights: []
      };
    }

    const cached = this.publicOverviewCache.get(active.datasetVersionId);
    if (cached) {
      return cached;
    }

    const [executiveKpis, premiumsByInstitution, premiumsByLine, financialHighlights, incomeStatementHighlights] = await Promise.all([
      this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/executive-kpis.json", 12),
      this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/premiums-by-institution.json", 12),
      this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/premiums-by-line.json", 12),
      this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/financial-highlights.json", 12),
      this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/income-statement-highlights.json", 12)
    ]);

    const payload = {
      metadata: this.toPublicDatasetMetadata(active),
      executiveKpis,
      premiumsByInstitution,
      premiumsByLine,
      financialHighlights,
      incomeStatementHighlights
    };

    this.publicOverviewCache.set(active.datasetVersionId, payload);
    return payload;
  }

  async getPublicRankings() {
    const active = await this.storage.getActiveDatasetVersion();
    if (!active) {
      emitOperationalLog("rankings_source_resolved", {
        activeDatasetVersionId: null,
        source: "no-active-dataset"
      });

      return {
        activeDataset: null,
        domainAvailability: null,
        rankings: { premiums: [], assets: [], equity: [], reserves: [] }
      };
    }

    const cached = this.publicRankingsCache.get(active.datasetVersionId);
    if (cached) {
      emitOperationalLog("rankings_source_resolved", {
        activeDatasetVersionId: active.datasetVersionId,
        source: "cache"
      });
      return cached;
    }

    const [artifactRankings, premiumsByInstitution, financialHighlights] = await Promise.all([
      this.storage.readPublishedArtifactIfExists<Record<string, unknown>>(active.datasetVersionId, "aggregates/rankings.json"),
      this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/premiums-by-institution.json"),
      this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/financial-highlights.json")
    ]);

    const derivedRankings = buildRankingsFromAggregates({
      premiums: premiumsByInstitution,
      financialHighlights
    });

    const rankings = {
      premiums:
        Array.isArray(artifactRankings?.premiums) && artifactRankings.premiums.length > 0
          ? stableSortRankings(artifactRankings.premiums as RankingEntry[], "premiums").slice(0, 12)
          : derivedRankings.premiums,
      assets:
        Array.isArray(artifactRankings?.assets) && artifactRankings.assets.length > 0
          ? stableSortRankings(artifactRankings.assets as RankingEntry[], "assets").slice(0, 12)
          : derivedRankings.assets,
      equity:
        Array.isArray(artifactRankings?.equity) && artifactRankings.equity.length > 0
          ? stableSortRankings(artifactRankings.equity as RankingEntry[], "equity").slice(0, 12)
          : derivedRankings.equity,
      reserves:
        Array.isArray(artifactRankings?.reserves) && artifactRankings.reserves.length > 0
          ? stableSortRankings(artifactRankings.reserves as RankingEntry[], "reserves").slice(0, 12)
          : derivedRankings.reserves
    };

    const payload = {
      activeDataset: this.toPublicDatasetMetadata(active),
      domainAvailability: active.domainAvailability,
      rankings
    };

    emitOperationalLog("rankings_source_resolved", {
      activeDatasetVersionId: active.datasetVersionId,
      source:
        artifactRankings &&
        [artifactRankings.premiums, artifactRankings.assets, artifactRankings.equity, artifactRankings.reserves].some(
          (value) => Array.isArray(value) && value.length > 0
        )
          ? "published-artifact"
          : "derived-aggregates"
    });

    this.publicRankingsCache.set(active.datasetVersionId, payload);
    return payload;
  }

  async getPublicPremiumsByInstitution() {
    const active = await this.storage.getActiveDatasetVersion();
    if (!active) {
      return [];
    }

    return await this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/premiums-by-institution.json");
  }

  async getPublicPremiumsByLine() {
    const active = await this.storage.getActiveDatasetVersion();
    if (!active) {
      return [];
    }

    return await this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/premiums-by-line.json");
  }

  async getPublicFinancialHighlights() {
    const active = await this.storage.getActiveDatasetVersion();
    if (!active) {
      return [];
    }

    return await this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/financial-highlights.json");
  }

  async getPublicIncomeStatementHighlights() {
    const active = await this.storage.getActiveDatasetVersion();
    if (!active) {
      return [];
    }

    return await this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/income-statement-highlights.json");
  }

  async getPublicInstitutionDetail(institutionId: string) {
    const active = await this.storage.getActiveDatasetVersion();
    if (!active) {
      emitOperationalLog("institution_detail_resolved", {
        requestedInstitution: institutionId,
        resolvedInstitutionId: null,
        activeDatasetVersionId: null,
        result: "no-active-dataset"
      });
      return null;
    }

    const resolvedInstitutionId = resolveInstitutionRouteInput(institutionId);
    if (!resolvedInstitutionId) {
      emitOperationalLog("institution_detail_resolved", {
        requestedInstitution: institutionId,
        resolvedInstitutionId: null,
        activeDatasetVersionId: active.datasetVersionId,
        result: "institution-not-found"
      });
      return null;
    }

    const cacheKey = `${active.datasetVersionId}:${resolvedInstitutionId}`;
    const cached = this.publicInstitutionDetailCache.get(cacheKey);
    if (cached) {
      emitOperationalLog("institution_detail_resolved", {
        requestedInstitution: institutionId,
        resolvedInstitutionId,
        activeDatasetVersionId: active.datasetVersionId,
        result: "cache"
      });
      return cached;
    }

    const institutions = await this.readPublishedArrayArtifact(
      active.datasetVersionId,
      "catalogs/institutions.json"
    );
    const institution = institutions.find((entry) => entry.institutionId === resolvedInstitutionId);

    if (!institution) {
      emitOperationalLog("institution_detail_resolved", {
        requestedInstitution: institutionId,
        resolvedInstitutionId,
        activeDatasetVersionId: active.datasetVersionId,
        result: "catalog-miss"
      });
      return null;
    }

    try {
        const detail = await this.storage.readPublishedArtifactIfExists<Record<string, unknown>>(
          active.datasetVersionId,
          `aggregates/institutions/${resolvedInstitutionId}.json`
        );
      if (!detail) {
        throw new Error("institution-detail-missing");
      }
      const payload = {
        ...detail,
        domainAvailability: active.domainAvailability,
        datasetScope: active.datasetScope
      };
      this.publicInstitutionDetailCache.set(cacheKey, payload);
      emitOperationalLog("institution_detail_resolved", {
        requestedInstitution: institutionId,
        resolvedInstitutionId,
        activeDatasetVersionId: active.datasetVersionId,
        result: "published-artifact"
      });
      return payload;
    } catch {
      const [premiumFacts, financialFacts, premiumsByInstitution, financialHighlights, incomeStatementHighlights] = await Promise.all([
        this.readPublishedArrayArtifact(active.datasetVersionId, "facts/premiums.json"),
        this.readPublishedArrayArtifact(active.datasetVersionId, "facts/financial-position.json"),
        this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/premiums-by-institution.json"),
        this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/financial-highlights.json"),
        this.readPublishedArrayArtifact(active.datasetVersionId, "aggregates/income-statement-highlights.json")
      ]);

      const institutionPremiumFacts = premiumFacts
        .filter((fact) => fact.institutionId === resolvedInstitutionId)
        .slice(0, 20);

      const payload = {
        institution,
        premiumSummary: premiumsByInstitution.find(
          (item) => item.institutionId === resolvedInstitutionId
        ),
        financialSummary: financialHighlights.find(
          (item) => item.institutionId === resolvedInstitutionId
        ),
        incomeStatementSummary: incomeStatementHighlights.find(
          (item) => item.institutionId === resolvedInstitutionId
        ),
        premiumFactsPreview: institutionPremiumFacts,
        financialFactsCount: financialFacts.filter(
          (fact) => fact.institutionId === resolvedInstitutionId
        ).length,
        domainAvailability: active.domainAvailability,
        datasetScope: active.datasetScope
      };
      this.publicInstitutionDetailCache.set(cacheKey, payload);
      emitOperationalLog("institution_detail_resolved", {
        requestedInstitution: institutionId,
        resolvedInstitutionId,
        activeDatasetVersionId: active.datasetVersionId,
        result: "fallback-derived"
      });
      return payload;
    }
  }

  async getActiveArtifacts() {
    const active = await this.storage.getActiveDatasetVersion();

    if (!active) {
      return null;
    }

    return {
      metadata: active,
      executiveKpis: await this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/executive-kpis.json"),
      premiumsByInstitution: await this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/premiums-by-institution.json"),
      premiumsByLine: await this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/premiums-by-line.json"),
      financialHighlights: await this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/financial-highlights.json"),
      incomeStatementHighlights: await this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/income-statement-highlights.json"),
      rankings: await this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/rankings.json"),
      institutions: await this.storage.readPublishedArtifact(active.datasetVersionId, "catalogs/institutions.json"),
      insuranceLines: await this.storage.readPublishedArtifact(active.datasetVersionId, "catalogs/insurance-lines.json"),
      premiumFacts: await this.storage.readPublishedArtifact(active.datasetVersionId, "facts/premiums.json"),
      financialPositionFacts: await this.storage.readPublishedArtifact(active.datasetVersionId, "facts/financial-position.json"),
      validationReport: await this.storage.readPublishedArtifact(active.datasetVersionId, "reports/validation-report.json"),
      reconciliationReport: await this.storage.readPublishedArtifact(active.datasetVersionId, "reports/reconciliation-report.json")
    };
  }

  async listPublishedDatasets() {
    return await this.storage.listPublishedDatasetVersions();
  }

  async listPublishedDatasetSummaries(): Promise<DatasetVersionListItem[]> {
    return (await this.storage.listPublishedDatasetVersions()).map((dataset) => this.toDatasetVersionListItem(dataset));
  }

  async listStagedRuns() {
    return await this.storage.listStagingRuns();
  }

  async getStagedRun(ingestionRunId: string) {
    return await this.storage.readStagingRun(ingestionRunId);
  }

  async listStagedRunSummaries(): Promise<StagedIngestionRunListItem[]> {
    return (await this.storage.listStagingRuns()).map((run) => this.toStagedRunListItem(run));
  }

  async listAuditEvents() {
    return await this.storage.listAuditEvents();
  }

  async listAuditEventSummaries(): Promise<AuditEventListItem[]> {
    return (await this.storage.listAuditEvents()).map((event) => this.toAuditEventListItem(event));
  }

  async getOperationalStatus() {
    const [activeDataset, stagedRuns, publishedDatasets, auditEvents, storageMetrics] = await Promise.all([
      this.storage.getActiveDatasetVersion(),
      this.listStagedRunSummaries(),
      this.listPublishedDatasetSummaries(),
      this.listAuditEventSummaries(),
      this.storage.getOperationalMetrics()
    ]);

    const latestStagedRuns = stagedRuns
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 3)
      .map((run) => ({
        ingestionRunId: run.ingestionRunId,
        createdAt: run.createdAt,
        uploadedBy: run.uploadedBy,
        publicationState: run.publicationState,
        publishedDatasetVersionId: run.publishedDatasetVersionId,
        publishedAt: run.publishedAt,
        datasetScope: run.draftDatasetVersion.datasetScope,
        validationPublishability: run.validationSummary.publishability,
        reconciliationPublishability: run.reconciliationSummary.publishability,
         mappingSummary: this.compactMappingSummary(run.mappingSummary)
      }));

    const latestPublishedVersions = publishedDatasets
      .slice()
      .sort((left, right) => String(right.publishedAt ?? right.createdAt).localeCompare(String(left.publishedAt ?? left.createdAt)))
      .slice(0, 3)
      .map((dataset) => ({
        datasetVersionId: dataset.datasetVersionId,
        ingestionRunId: dataset.ingestionRunId,
        publishedAt: dataset.publishedAt,
        uploadedBy: dataset.uploadedBy,
        datasetScope: dataset.datasetScope,
        status: dataset.status
      }));

    const latestStagedRun = stagedRuns
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

    return {
      activeDataset: activeDataset ? this.toPublicDatasetMetadata(activeDataset) : null,
      activeTextQuality: activeDataset?.mappingSummary
        ? {
            datasetVersionId: activeDataset.datasetVersionId,
            publishedAt: activeDataset.publishedAt,
            mappingSummary: this.compactMappingSummary(activeDataset.mappingSummary)
          }
        : null,
      counts: {
        stagedRuns: stagedRuns.length,
        publishedVersions: publishedDatasets.length,
        auditEvents: auditEvents.length
      },
      latestStagedRuns,
      latestTextQuality: latestStagedRun
        ? {
            ingestionRunId: latestStagedRun.ingestionRunId,
            createdAt: latestStagedRun.createdAt,
            publicationState: latestStagedRun.publicationState,
            publishability: mergePublishability(latestStagedRun.validationSummary, latestStagedRun.reconciliationSummary),
            mappingSummary: this.compactMappingSummary(latestStagedRun.mappingSummary)
          }
        : null,
      latestPublishedVersions,
      storageMetrics
    };
  }

  private auditEvent(input: {
    actor: string;
    action: string;
    ingestionRunId: string | null;
    datasetVersionId: string | null;
    details: Record<string, unknown>;
  }): AuditEvent {
    return {
      auditEventId: randomUUID(),
      datasetVersionId: input.datasetVersionId,
      ingestionRunId: input.ingestionRunId,
      actor: input.actor,
      action: input.action,
      timestamp: new Date().toISOString(),
      details: input.details
    };
  }

  private async failFastRun(
    uploadedBy: string,
    sourceFiles: SourceFileRecord[],
    issues: ValidationIssue[],
    reason: string
  ): Promise<StagedIngestionRun> {
    const ingestionRunId = randomUUID();
    const datasetVersionId = `failed-${randomUUID().slice(0, 8)}`;
    const validationSummary: ValidationSummary = {
      publishability: "blocked",
      issues
    };
    const reconciliationSummary: ReconciliationSummary = {
      publishability: "warningOnly",
      issues: []
    };
    const run: StagedIngestionRun = {
      ingestionRunId,
      createdAt: new Date().toISOString(),
      uploadedBy,
      publicationState: "failed",
      publishedDatasetVersionId: null,
      publishedAt: null,
      sourceFiles,
      mappingSummary: createEmptyMappingSummary(),
      validationSummary,
      reconciliationSummary,
      draftDatasetVersion: {
        datasetVersionId,
        ingestionRunId,
        status: "failed",
        createdAt: new Date().toISOString(),
        publishedAt: null,
        uploadedBy,
        sourceFiles,
        businessPeriods: {
          premiums: undefined,
          financialPosition: undefined,
          incomeStatement: undefined,
          reference: undefined
        },
        datasetScope: datasetScopeFromPrimarySources({
          hasPremiums: sourceFiles.some((file) => file.kind === "premiums"),
          hasFinancialPosition: sourceFiles.some((file) => file.kind === "financialPosition"),
          hasIncomeStatement: sourceFiles.some((file) => file.kind === "incomeStatement")
        }),
        domainAvailability: domainAvailabilityFromInput({
          hasPremiums: sourceFiles.some((file) => file.kind === "premiums"),
          premiumRecords: 0,
          hasFinancialPosition: sourceFiles.some((file) => file.kind === "financialPosition"),
          financialRecords: 0,
          hasIncomeStatement: sourceFiles.some((file) => file.kind === "incomeStatement"),
          incomeStatementRecords: 0,
          hasReference: sourceFiles.some((file) => file.kind === "reference")
        }),
        fingerprint: fingerprintSourceFiles(sourceFiles),
        mappingSummary: createEmptyMappingSummary(),
        validationSummary,
        reconciliationSummary
      },
      artifacts: {
        ...canonicalCatalogs(),
        premiumFacts: [],
        financialPositionFacts: [],
        incomeStatementFacts: [],
        executiveKpis: [],
        premiumsByInstitution: [],
        premiumsByLine: [],
        financialHighlightsByInstitution: [],
        incomeStatementHighlightsByInstitution: [],
        rankings: {},
        institutionDetails: {}
      }
    };

    await this.storage.writeStagingRun(run);
    emitOperationalLog("ingestion_validation_failed", {
      ingestionRunId,
      datasetVersionId,
      uploadedBy,
      reason,
      issueCount: issues.length
    });
    return run;
  }
}
