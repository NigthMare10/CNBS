import { randomUUID } from "node:crypto";
import {
  createDatasetVersionId,
  type DatasetScope,
  fingerprintSourceFiles,
  institutionsCatalog,
  mergePublishability,
  type AuditEvent,
  type DatasetVersionRecord,
  type ReconciliationSummary,
  type SourceFileRecord,
  type ValidationIssue,
  type ValidationSummary
} from "@cnbs/domain";
import type { UploadedWorkbookInput, StagedIngestionRun, WorkbookDetectionResult } from "../types";
import { inspectWorkbookSecurity } from "../security/workbook-security";
import { detectWorkbookKind, WorkbookClassificationError } from "../workbooks/signatures";
import { parsePremiumWorkbook } from "../parsers/premiums";
import { parseFinancialPositionWorkbook } from "../parsers/financial-position";
import { parseIncomeStatementWorkbook } from "../parsers/income-statement";
import { parseReferenceWorkbook } from "../parsers/reference";
import { validateParsedWorkbooks } from "./validation";
import { canonicalCatalogs, normalizeFinancialPositionFacts, normalizeIncomeStatementRows, normalizePremiumFacts } from "./normalization";
import { reconcileAgainstReference } from "../reconciliation/rules";
import { buildDatasetArtifacts } from "../publish/dataset-builder";
import { LocalStorageRepository } from "../storage/local-storage";

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
  constructor(private readonly storage = new LocalStorageRepository()) {}

  private toPublicDatasetMetadata(dataset: DatasetVersionRecord) {
    return {
      datasetVersionId: dataset.datasetVersionId,
      ingestionRunId: dataset.ingestionRunId,
      status: dataset.status,
      createdAt: dataset.createdAt,
      publishedAt: dataset.publishedAt,
      uploadedBy: dataset.uploadedBy,
      businessPeriods: dataset.businessPeriods,
      datasetScope: dataset.datasetScope,
      domainAvailability: dataset.domainAvailability,
      fingerprint: dataset.fingerprint,
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
    const storedFiles: SourceFileRecord[] = [];
    const validationIssues: ValidationIssue[] = [];

    for (const file of input.files) {
      const storedFile = await this.storage.storeUploadedWorkbook(file);
      const storedPath = this.storage.quarantineFilePath(storedFile.storedFilename);
      const securityIssues = await inspectWorkbookSecurity(storedPath, file.mimeType, file.sizeBytes);

      validationIssues.push(...securityIssues);
      storedFiles.push(storedFile);
    }

    if (validationIssues.some((issue) => issue.severity === "critical")) {
      return this.failFastRun(input.uploadedBy, storedFiles, validationIssues);
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
      return this.failFastRun(input.uploadedBy, storedFiles, validationIssues);
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
      return this.failFastRun(input.uploadedBy, storedFiles, validationIssues);
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
    const normalizedPremiums = premiumsFile
      ? normalizePremiumFacts({
          datasetVersionId,
          sourceFile: premiumsFile,
          rows: premiumRows
        })
      : { facts: [], period: undefined, issues: [], stats: { repairedByNormalization: 0, aliasesMatched: 0, unresolved: 0 } };
    const normalizedFinancials = financialFile
      ? normalizeFinancialPositionFacts({
          datasetVersionId,
          sourceFile: financialFile,
          rows: financialRows
        })
      : { facts: [], period: undefined, issues: [], stats: { repairedByNormalization: 0, aliasesMatched: 0, lineNumberFallback: 0, unresolved: 0 } };
    const normalizedIncomeStatement = incomeStatementFile
      ? normalizeIncomeStatementRows({
          datasetVersionId,
          sourceFile: incomeStatementFile,
          rows: incomeStatementRows
        })
      : { facts: [], records: 0, period: undefined, issues: [] };

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
      mappingSummary: {
        repairedByNormalization:
          normalizedPremiums.stats.repairedByNormalization + normalizedFinancials.stats.repairedByNormalization,
        aliasesMatched: normalizedPremiums.stats.aliasesMatched + normalizedFinancials.stats.aliasesMatched,
        lineNumberFallback: normalizedFinancials.stats.lineNumberFallback,
        unresolved: normalizedPremiums.stats.unresolved + normalizedFinancials.stats.unresolved
      },
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
        reconciliationIssues: reconciliationSummary.issues.length
      }
    }));

    return run;
  }

  async publishStagedRun(ingestionRunId: string, actor: string): Promise<DatasetVersionRecord> {
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
        publishability
      }
    }));

    return datasetVersion;
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
    return { activeDataset: active ? this.toPublicDatasetMetadata(active) : null };
  }

  async getPublicOverview() {
    const active = await this.storage.getActiveDatasetVersion();

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

    const [executiveKpis, premiumsByInstitution, premiumsByLine, financialHighlights, incomeStatementHighlights] = await Promise.all([
      this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/executive-kpis.json"),
      this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/premiums-by-institution.json"),
      this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/premiums-by-line.json"),
      this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/financial-highlights.json"),
      this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/income-statement-highlights.json")
    ]);

    return {
      metadata: this.toPublicDatasetMetadata(active),
      executiveKpis,
      premiumsByInstitution: Array.isArray(premiumsByInstitution) ? premiumsByInstitution.slice(0, 12) : [],
      premiumsByLine: Array.isArray(premiumsByLine) ? premiumsByLine.slice(0, 12) : [],
      financialHighlights: Array.isArray(financialHighlights) ? financialHighlights.slice(0, 12) : [],
      incomeStatementHighlights: Array.isArray(incomeStatementHighlights) ? incomeStatementHighlights.slice(0, 12) : []
    };
  }

  async getPublicRankings() {
    const active = await this.storage.getActiveDatasetVersion();
    if (!active) {
      return { premiums: [], assets: [], equity: [], netIncome: [] };
    }

    return await this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/rankings.json");
  }

  async getPublicPremiumsByInstitution() {
    const active = await this.storage.getActiveDatasetVersion();
    if (!active) {
      return [];
    }

    return await this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/premiums-by-institution.json");
  }

  async getPublicPremiumsByLine() {
    const active = await this.storage.getActiveDatasetVersion();
    if (!active) {
      return [];
    }

    return await this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/premiums-by-line.json");
  }

  async getPublicFinancialHighlights() {
    const active = await this.storage.getActiveDatasetVersion();
    if (!active) {
      return [];
    }

    return await this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/financial-highlights.json");
  }

  async getPublicIncomeStatementHighlights() {
    const active = await this.storage.getActiveDatasetVersion();
    if (!active) {
      return [];
    }

    return await this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/income-statement-highlights.json");
  }

  async getPublicInstitutionDetail(institutionId: string) {
    const active = await this.storage.getActiveDatasetVersion();
    if (!active) {
      return null;
    }

    const institutions = await this.storage.readPublishedArtifact<Array<{ institutionId: string }>>(
      active.datasetVersionId,
      "catalogs/institutions.json"
    );
    const institution = institutions.find((entry) => entry.institutionId === institutionId);

    if (!institution) {
      return null;
    }

    try {
      const detail = await this.storage.readPublishedArtifact<Record<string, unknown>>(
        active.datasetVersionId,
        `aggregates/institutions/${institutionId}.json`
      );
      return {
        ...detail,
        domainAvailability: active.domainAvailability,
        datasetScope: active.datasetScope
      };
    } catch {
      const [premiumFacts, financialFacts, premiumsByInstitution, financialHighlights, incomeStatementHighlights] = await Promise.all([
        this.storage.readPublishedArtifact(active.datasetVersionId, "facts/premiums.json"),
        this.storage.readPublishedArtifact(active.datasetVersionId, "facts/financial-position.json"),
        this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/premiums-by-institution.json"),
        this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/financial-highlights.json"),
        this.storage.readPublishedArtifact(active.datasetVersionId, "aggregates/income-statement-highlights.json")
      ]);

      const institutionPremiumFacts = (premiumFacts as Array<Record<string, unknown>>)
        .filter((fact) => fact.institutionId === institutionId)
        .slice(0, 20);

      return {
        institution,
        premiumSummary: (premiumsByInstitution as Array<Record<string, unknown>>).find(
          (item) => item.institutionId === institutionId
        ),
        financialSummary: (financialHighlights as Array<Record<string, unknown>>).find(
          (item) => item.institutionId === institutionId
        ),
        incomeStatementSummary: (incomeStatementHighlights as Array<Record<string, unknown>>).find(
          (item) => item.institutionId === institutionId
        ),
        premiumFactsPreview: institutionPremiumFacts,
        financialFactsCount: (financialFacts as Array<Record<string, unknown>>).filter(
          (fact) => fact.institutionId === institutionId
        ).length,
        domainAvailability: active.domainAvailability,
        datasetScope: active.datasetScope
      };
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

  async listStagedRuns() {
    return await this.storage.listStagingRuns();
  }

  async listAuditEvents() {
    return await this.storage.listAuditEvents();
  }

  async getOperationalStatus() {
    const [activeDataset, stagedRuns, publishedDatasets, auditEvents, storageMetrics] = await Promise.all([
      this.storage.getActiveDatasetVersion(),
      this.storage.listStagingRuns(),
      this.storage.listPublishedDatasetVersions(),
      this.storage.listAuditEvents(),
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
        reconciliationPublishability: run.reconciliationSummary.publishability
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

    return {
      activeDataset: activeDataset ? this.toPublicDatasetMetadata(activeDataset) : null,
      counts: {
        stagedRuns: stagedRuns.length,
        publishedVersions: publishedDatasets.length,
        auditEvents: auditEvents.length
      },
      latestStagedRuns,
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
    issues: ValidationIssue[]
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
      mappingSummary: {
        repairedByNormalization: 0,
        aliasesMatched: 0,
        lineNumberFallback: 0,
        unresolved: 0
      },
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
    return run;
  }
}
