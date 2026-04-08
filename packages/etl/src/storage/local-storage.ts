import { copyFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { storagePaths } from "@cnbs/config";
import type {
  AliasResolutionExample,
  AuditEvent,
  DatasetVersionRecord,
  MappingDomainSummary,
  SourceFileRecord,
  TopAliasRepair
} from "@cnbs/domain";
import { datasetVersionRecordSchema } from "@cnbs/schemas";
import type { z } from "zod";
import type { CanonicalDatasetArtifacts, StagedIngestionRun, UploadedWorkbookInput } from "../types";
import { sha256File } from "../security/hash";
import {
  deleteStorageTree,
  ensureStorageDirectory,
  getStoragePersistenceInfo,
  readStorageJson,
  seedStorageIfNeeded,
  storageListEntries,
  storagePathExists,
  writeStorageJson
} from "./persistence";

async function writeJson(path: string, data: unknown): Promise<void> {
  await writeStorageJson(path, data);
}

async function listPublishedDatasetIds(): Promise<string[]> {
  try {
    return (await storageListEntries(storagePaths.published)).sort().reverse();
  } catch {
    return [];
  }
}

async function readJson<T>(path: string): Promise<T> {
  return await readStorageJson<T>(path);
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

function sanitizeOriginalFilename(input: string): string {
  return basename(input).replace(/[^a-zA-Z0-9._-]/g, "_");
}

interface ActiveDatasetPointer {
  datasetVersionId: string | null;
  updatedAt: string | null;
}

interface CacheNamespaceState {
  namespace: string;
  activeDatasetVersionId: string | null;
  updatedAt: string | null;
}

interface RepositoryCacheStats {
  pointerHits: number;
  pointerMisses: number;
  versionHits: number;
  versionMisses: number;
  artifactHits: number;
  artifactMisses: number;
  invalidations: number;
  namespaceSyncs: number;
  lastInvalidationReason: string | null;
  lastInvalidatedAt: string | null;
}

type ParsedDatasetVersionRecord = z.infer<typeof datasetVersionRecordSchema>;

interface ActivePointerFile {
  datasetVersionId: string | null;
  updatedAt: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalNullableString(record: Record<string, unknown>, key: string): string | null | undefined {
  const value = record[key];

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return undefined;
}

function createBootstrapCacheNamespaceState(): CacheNamespaceState {
  return {
    namespace: "bootstrap",
    activeDatasetVersionId: null,
    updatedAt: null
  };
}

function createActivePointerFile(datasetVersionId: string | null, updatedAt: string | null): ActivePointerFile {
  return {
    datasetVersionId,
    updatedAt
  };
}

function normalizeCacheNamespaceState(value: unknown): CacheNamespaceState {
  if (!isRecord(value)) {
    return createBootstrapCacheNamespaceState();
  }

  const activeDatasetVersionId = readOptionalNullableString(value, "activeDatasetVersionId");
  const updatedAt = readOptionalNullableString(value, "updatedAt");

  return {
    namespace: typeof value.namespace === "string" && value.namespace.trim().length > 0 ? value.namespace : "bootstrap",
    activeDatasetVersionId: activeDatasetVersionId === undefined ? null : activeDatasetVersionId,
    updatedAt: updatedAt === undefined ? null : updatedAt
  };
}

function normalizeActiveDatasetPointer(value: unknown, fallbackState: CacheNamespaceState | null): ActiveDatasetPointer {
  const fallbackPointer: ActiveDatasetPointer = {
    datasetVersionId: fallbackState?.activeDatasetVersionId ?? null,
    updatedAt: fallbackState?.updatedAt ?? null
  };

  if (!isRecord(value)) {
    return fallbackPointer;
  }

  const datasetVersionId = readOptionalNullableString(value, "datasetVersionId");
  const updatedAt = readOptionalNullableString(value, "updatedAt");

  return {
    datasetVersionId: datasetVersionId === undefined ? fallbackPointer.datasetVersionId : datasetVersionId,
    updatedAt: updatedAt === undefined ? fallbackPointer.updatedAt : updatedAt
  };
}

function mapBusinessPeriod(
  value: ParsedDatasetVersionRecord["businessPeriods"][keyof ParsedDatasetVersionRecord["businessPeriods"]]
): DatasetVersionRecord["businessPeriods"][keyof DatasetVersionRecord["businessPeriods"]] {
  if (value === undefined) {
    return undefined;
  }

  return {
    reportDate: value.reportDate,
    year: value.year,
    month: value.month,
    yearMonth: value.yearMonth,
    excelSerial: value.excelSerial
  };
}

function mapDomainAvailabilityEntry(
  value: ParsedDatasetVersionRecord["domainAvailability"][keyof ParsedDatasetVersionRecord["domainAvailability"]]
): DatasetVersionRecord["domainAvailability"][keyof DatasetVersionRecord["domainAvailability"]] {
  return {
    sourceProvided: value.sourceProvided,
    records: value.records,
    publishable: value.publishable,
    missingReason: value.missingReason
  };
}

function mapMappingDomainSummary(value: MappingDomainSummary): MappingDomainSummary {
  return {
    totalAttempts: value.totalAttempts ?? 0,
    repairedByNormalization: value.repairedByNormalization ?? 0,
    aliasesMatched: value.aliasesMatched ?? 0,
    fallbackByLineNumber: value.fallbackByLineNumber ?? 0,
    ambiguousAliases: value.ambiguousAliases ?? 0,
    unresolvedAliases: value.unresolvedAliases ?? 0,
    textsRequiringMojibakeRepair: value.textsRequiringMojibakeRepair ?? 0,
    aliasesResolvedAfterNormalization: value.aliasesResolvedAfterNormalization ?? 0,
    aliasesResolvedByDirectAlias: value.aliasesResolvedByDirectAlias ?? 0
  };
}

function mapTopAliasRepair(value: TopAliasRepair): TopAliasRepair {
  return {
    domain: value.domain,
    originalValue: value.originalValue ?? "",
    repairedValue: value.repairedValue ?? "",
    normalizedValue: value.normalizedValue ?? "",
    canonicalId: value.canonicalId ?? "",
    canonicalName: value.canonicalName ?? "",
    strategy: value.strategy,
    count: value.count ?? 0
  };
}

function mapAliasResolutionExample(value: AliasResolutionExample): AliasResolutionExample {
  return {
    domain: value.domain,
    scope: value.scope ?? "",
    originalValue: value.originalValue ?? "",
    repairedValue: value.repairedValue ?? "",
    normalizedValue: value.normalizedValue ?? "",
    canonicalId: value.canonicalId ?? null,
    canonicalName: value.canonicalName ?? null,
    strategy: value.strategy,
    lineNumber: value.lineNumber ?? null,
    usedMojibakeRepair: value.usedMojibakeRepair ?? false,
    requiredNormalization: value.requiredNormalization ?? false,
    candidateIds: value.candidateIds ?? [],
    candidateNames: value.candidateNames ?? [],
    ambiguityReason: value.ambiguityReason ?? null
  };
}

function mapSourceFileRecord(value: SourceFileRecord): SourceFileRecord {
  return {
    sourceFileId: value.sourceFileId ?? "",
    kind: value.kind,
    originalFilename: value.originalFilename ?? "",
    storedFilename: value.storedFilename ?? "",
    sha256: value.sha256 ?? "",
    sizeBytes: value.sizeBytes ?? 0,
    mimeType: value.mimeType ?? "",
    detectedSignature: value.detectedSignature ?? "",
    uploadedAt: value.uploadedAt ?? ""
  };
}

function mapValidationSummary(value: ParsedDatasetVersionRecord["validationSummary"]): DatasetVersionRecord["validationSummary"] {
  return {
    publishability: value.publishability,
    issues: value.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      status: issue.status,
      scope: issue.scope,
      message: issue.message,
      ...(issue.details === undefined ? {} : { details: issue.details })
    }))
  };
}

function mapReconciliationSummary(
  value: ParsedDatasetVersionRecord["reconciliationSummary"]
): DatasetVersionRecord["reconciliationSummary"] {
  return {
    publishability: value.publishability,
    issues: value.issues.map((issue) => ({
      ruleId: issue.ruleId,
      severity: issue.severity,
      scope: issue.scope,
      status: issue.status,
      expectedValue: issue.expectedValue,
      actualValue: issue.actualValue,
      differenceAbsolute: issue.differenceAbsolute,
      differenceRelative: issue.differenceRelative,
      toleranceAbsolute: issue.toleranceAbsolute,
      toleranceRelative: issue.toleranceRelative,
      message: issue.message
    }))
  };
}

function mapMappingSummary(value: ParsedDatasetVersionRecord["mappingSummary"]): DatasetVersionRecord["mappingSummary"] {
  if (value === undefined) {
    return undefined;
  }

  const institutionDomain: MappingDomainSummary = {
    totalAttempts: value.domains.institution.totalAttempts ?? 0,
    repairedByNormalization: value.domains.institution.repairedByNormalization ?? 0,
    aliasesMatched: value.domains.institution.aliasesMatched ?? 0,
    fallbackByLineNumber: value.domains.institution.fallbackByLineNumber ?? 0,
    ambiguousAliases: value.domains.institution.ambiguousAliases ?? 0,
    unresolvedAliases: value.domains.institution.unresolvedAliases ?? 0,
    textsRequiringMojibakeRepair: value.domains.institution.textsRequiringMojibakeRepair ?? 0,
    aliasesResolvedAfterNormalization: value.domains.institution.aliasesResolvedAfterNormalization ?? 0,
    aliasesResolvedByDirectAlias: value.domains.institution.aliasesResolvedByDirectAlias ?? 0
  };

  const insuranceLineDomain: MappingDomainSummary = {
    totalAttempts: value.domains.insuranceLine.totalAttempts ?? 0,
    repairedByNormalization: value.domains.insuranceLine.repairedByNormalization ?? 0,
    aliasesMatched: value.domains.insuranceLine.aliasesMatched ?? 0,
    fallbackByLineNumber: value.domains.insuranceLine.fallbackByLineNumber ?? 0,
    ambiguousAliases: value.domains.insuranceLine.ambiguousAliases ?? 0,
    unresolvedAliases: value.domains.insuranceLine.unresolvedAliases ?? 0,
    textsRequiringMojibakeRepair: value.domains.insuranceLine.textsRequiringMojibakeRepair ?? 0,
    aliasesResolvedAfterNormalization: value.domains.insuranceLine.aliasesResolvedAfterNormalization ?? 0,
    aliasesResolvedByDirectAlias: value.domains.insuranceLine.aliasesResolvedByDirectAlias ?? 0
  };

  const financialAccountDomain: MappingDomainSummary = {
    totalAttempts: value.domains.financialAccount.totalAttempts ?? 0,
    repairedByNormalization: value.domains.financialAccount.repairedByNormalization ?? 0,
    aliasesMatched: value.domains.financialAccount.aliasesMatched ?? 0,
    fallbackByLineNumber: value.domains.financialAccount.fallbackByLineNumber ?? 0,
    ambiguousAliases: value.domains.financialAccount.ambiguousAliases ?? 0,
    unresolvedAliases: value.domains.financialAccount.unresolvedAliases ?? 0,
    textsRequiringMojibakeRepair: value.domains.financialAccount.textsRequiringMojibakeRepair ?? 0,
    aliasesResolvedAfterNormalization: value.domains.financialAccount.aliasesResolvedAfterNormalization ?? 0,
    aliasesResolvedByDirectAlias: value.domains.financialAccount.aliasesResolvedByDirectAlias ?? 0
  };

  const topAliasRepairs = value.topAliasRepairs.map((item) =>
    mapTopAliasRepair({
      domain: item.domain ?? "institution",
      originalValue: item.originalValue ?? "",
      repairedValue: item.repairedValue ?? "",
      normalizedValue: item.normalizedValue ?? "",
      canonicalId: item.canonicalId ?? "",
      canonicalName: item.canonicalName ?? "",
      strategy: item.strategy ?? "normalized-alias",
      count: item.count ?? 0
    })
  );

  const resolvedExamples = value.resolvedExamples.map((item) =>
    mapAliasResolutionExample({
      domain: item.domain ?? "institution",
      scope: item.scope ?? "",
      originalValue: item.originalValue ?? "",
      repairedValue: item.repairedValue ?? "",
      normalizedValue: item.normalizedValue ?? "",
      canonicalId: item.canonicalId ?? null,
      canonicalName: item.canonicalName ?? null,
      strategy: item.strategy ?? "unresolved",
      lineNumber: item.lineNumber ?? null,
      usedMojibakeRepair: item.usedMojibakeRepair ?? false,
      requiredNormalization: item.requiredNormalization ?? false,
      candidateIds: item.candidateIds ?? [],
      candidateNames: item.candidateNames ?? [],
      ambiguityReason: item.ambiguityReason ?? null
    })
  );

  const ambiguousExamples = value.ambiguousExamples.map((item) =>
    mapAliasResolutionExample({
      domain: item.domain ?? "institution",
      scope: item.scope ?? "",
      originalValue: item.originalValue ?? "",
      repairedValue: item.repairedValue ?? "",
      normalizedValue: item.normalizedValue ?? "",
      canonicalId: item.canonicalId ?? null,
      canonicalName: item.canonicalName ?? null,
      strategy: item.strategy ?? "ambiguous",
      lineNumber: item.lineNumber ?? null,
      usedMojibakeRepair: item.usedMojibakeRepair ?? false,
      requiredNormalization: item.requiredNormalization ?? false,
      candidateIds: item.candidateIds ?? [],
      candidateNames: item.candidateNames ?? [],
      ambiguityReason: item.ambiguityReason ?? null
    })
  );

  const unresolvedExamples = value.unresolvedExamples.map((item) =>
    mapAliasResolutionExample({
      domain: item.domain ?? "institution",
      scope: item.scope ?? "",
      originalValue: item.originalValue ?? "",
      repairedValue: item.repairedValue ?? "",
      normalizedValue: item.normalizedValue ?? "",
      canonicalId: item.canonicalId ?? null,
      canonicalName: item.canonicalName ?? null,
      strategy: item.strategy ?? "unresolved",
      lineNumber: item.lineNumber ?? null,
      usedMojibakeRepair: item.usedMojibakeRepair ?? false,
      requiredNormalization: item.requiredNormalization ?? false,
      candidateIds: item.candidateIds ?? [],
      candidateNames: item.candidateNames ?? [],
      ambiguityReason: item.ambiguityReason ?? null
    })
  );

  return {
    repairedByNormalization: value.repairedByNormalization,
    aliasesMatched: value.aliasesMatched,
    lineNumberFallback: value.lineNumberFallback,
    fallbackByLineNumber: value.fallbackByLineNumber,
    unresolved: value.unresolved,
    unresolvedAliases: value.unresolvedAliases,
    ambiguousAliases: value.ambiguousAliases,
    totalAttempts: value.totalAttempts,
    textQuality: {
      textsRequiringMojibakeRepair: value.textQuality.textsRequiringMojibakeRepair,
      aliasesResolvedAfterNormalization: value.textQuality.aliasesResolvedAfterNormalization,
      aliasesResolvedByDirectAlias: value.textQuality.aliasesResolvedByDirectAlias,
      aliasesResolvedByLineNumberFallback: value.textQuality.aliasesResolvedByLineNumberFallback,
      ambiguousAliases: value.textQuality.ambiguousAliases,
      unresolvedAliases: value.textQuality.unresolvedAliases
    },
    domains: {
      institution: mapMappingDomainSummary(institutionDomain),
      insuranceLine: mapMappingDomainSummary(insuranceLineDomain),
      financialAccount: mapMappingDomainSummary(financialAccountDomain)
    },
    topAliasRepairs,
    resolvedExamples,
    ambiguousExamples,
    unresolvedExamples
  };
}

function mapDatasetVersionRecord(value: ParsedDatasetVersionRecord): DatasetVersionRecord {
  const mappingSummary = mapMappingSummary(value.mappingSummary);
  const sourceFiles = value.sourceFiles.map((sourceFile) =>
    mapSourceFileRecord({
      sourceFileId: sourceFile.sourceFileId ?? "",
      kind: sourceFile.kind ?? "unknown",
      originalFilename: sourceFile.originalFilename ?? "",
      storedFilename: sourceFile.storedFilename ?? "",
      sha256: sourceFile.sha256 ?? "",
      sizeBytes: sourceFile.sizeBytes ?? 0,
      mimeType: sourceFile.mimeType ?? "",
      detectedSignature: sourceFile.detectedSignature ?? "",
      uploadedAt: sourceFile.uploadedAt ?? ""
    })
  );

  return {
    datasetVersionId: value.datasetVersionId,
    ingestionRunId: value.ingestionRunId,
    status: value.status,
    createdAt: value.createdAt,
    publishedAt: value.publishedAt,
    uploadedBy: value.uploadedBy,
    sourceFiles,
    businessPeriods: {
      premiums: mapBusinessPeriod(value.businessPeriods.premiums),
      financialPosition: mapBusinessPeriod(value.businessPeriods.financialPosition),
      incomeStatement: mapBusinessPeriod(value.businessPeriods.incomeStatement),
      reference: mapBusinessPeriod(value.businessPeriods.reference)
    },
    datasetScope: value.datasetScope,
    domainAvailability: {
      premiums: mapDomainAvailabilityEntry(value.domainAvailability.premiums),
      financialPosition: mapDomainAvailabilityEntry(value.domainAvailability.financialPosition),
      claims: mapDomainAvailabilityEntry(value.domainAvailability.claims),
      incomeStatement: mapDomainAvailabilityEntry(value.domainAvailability.incomeStatement),
      reference: mapDomainAvailabilityEntry(value.domainAvailability.reference)
    },
    fingerprint: value.fingerprint,
    validationSummary: mapValidationSummary(value.validationSummary),
    reconciliationSummary: mapReconciliationSummary(value.reconciliationSummary),
    ...(mappingSummary === undefined ? {} : { mappingSummary })
  };
}

export class LocalStorageRepository {
  private activePointerCache: ActiveDatasetPointer | null = null;
  private datasetVersionCache = new Map<string, DatasetVersionRecord>();
  private artifactCache = new Map<string, unknown>();
  private stagingRunCache = new Map<string, StagedIngestionRun>();
  private auditEventCache = new Map<string, AuditEvent>();
  private stagingRunsCacheLoaded = false;
  private auditEventsCacheLoaded = false;
  private namespaceState: CacheNamespaceState | null = null;
  private readonly cacheCheckIntervalMs = 1000;
  private lastCacheCheckAt = 0;
  private readonly cacheStats: RepositoryCacheStats = {
    pointerHits: 0,
    pointerMisses: 0,
    versionHits: 0,
    versionMisses: 0,
    artifactHits: 0,
    artifactMisses: 0,
    invalidations: 0,
    namespaceSyncs: 0,
    lastInvalidationReason: null,
    lastInvalidatedAt: null
  };

  private cacheStatePath(): string {
    return join(storagePaths.active, "cache-state.json");
  }

  private async ensureCacheStateFile(): Promise<void> {
    if (!(await this.fileExists(this.cacheStatePath()))) {
      const initialState = createBootstrapCacheNamespaceState();
      await writeJson(this.cacheStatePath(), initialState);
      this.namespaceState = initialState;
    }
  }

  private invalidateProcessCaches(reason: string, nextNamespaceState?: CacheNamespaceState): void {
    this.activePointerCache = null;
    this.datasetVersionCache.clear();
    this.artifactCache.clear();
    this.stagingRunCache.clear();
    this.auditEventCache.clear();
    this.stagingRunsCacheLoaded = false;
    this.auditEventsCacheLoaded = false;
    this.namespaceState = nextNamespaceState ?? this.namespaceState;
    this.cacheStats.invalidations += 1;
    this.cacheStats.lastInvalidationReason = reason;
    this.cacheStats.lastInvalidatedAt = new Date().toISOString();
  }

  private async readCacheNamespaceState(): Promise<CacheNamespaceState> {
    await this.ensureCacheStateFile();

    const state = await readJson<unknown>(this.cacheStatePath());
    return normalizeCacheNamespaceState(state);
  }

  private async syncCacheNamespace(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastCacheCheckAt < this.cacheCheckIntervalMs) {
      return;
    }

    this.lastCacheCheckAt = now;
    const nextState = await this.readCacheNamespaceState();
    this.cacheStats.namespaceSyncs += 1;

    if (!this.namespaceState) {
      this.namespaceState = nextState;
      return;
    }

    if (this.namespaceState.namespace !== nextState.namespace) {
      this.invalidateProcessCaches("namespace-changed", nextState);
    } else {
      this.namespaceState = nextState;
    }
  }

  private async writeCacheNamespaceState(activeDatasetVersionId: string | null): Promise<void> {
    const nextState: CacheNamespaceState = {
      namespace: `${Date.now()}-${randomUUID().slice(0, 8)}`,
      activeDatasetVersionId,
      updatedAt: new Date().toISOString()
    };

    await writeJson(this.cacheStatePath(), nextState);
    this.invalidateProcessCaches("active-version-updated", nextState);
    this.lastCacheCheckAt = Date.now();
  }

  private async ensureActivePointerConsistency(): Promise<void> {
    const publishedDatasetIds = await listPublishedDatasetIds();
    if (publishedDatasetIds.length === 0) {
      return;
    }

    const selectedDatasetVersionId = publishedDatasetIds[0] ?? null;
    const activePointerPath = join(storagePaths.active, "active-dataset.json");
    const currentPointer = await readJson<unknown>(activePointerPath).catch(() => null);
    const normalizedPointer = normalizeActiveDatasetPointer(currentPointer, this.namespaceState);

    if (normalizedPointer.datasetVersionId && publishedDatasetIds.includes(normalizedPointer.datasetVersionId)) {
      return;
    }

    const updatedAt = new Date().toISOString();
    const nextNamespaceState: CacheNamespaceState = {
      namespace: `${Date.now()}-${randomUUID().slice(0, 8)}`,
      activeDatasetVersionId: selectedDatasetVersionId,
      updatedAt
    };

    await writeJson(activePointerPath, createActivePointerFile(selectedDatasetVersionId, updatedAt));
    await writeJson(this.cacheStatePath(), nextNamespaceState);
    this.invalidateProcessCaches("active-pointer-repaired", nextNamespaceState);
  }

  async initialize(): Promise<void> {
    await seedStorageIfNeeded();
    await Promise.all(Object.values(storagePaths).map((directoryPath) => ensureStorageDirectory(directoryPath)));
    await this.ensureCacheStateFile();
    await this.ensureActivePointerConsistency();

    const persistence = getStoragePersistenceInfo();
    console.info(
      JSON.stringify({
        event: "storage_backend_ready",
        root: storagePaths.root,
        ...persistence
      })
    );

    if (process.env.VERCEL && !persistence.durable) {
      console.warn(
        JSON.stringify({
          event: "storage_backend_ephemeral",
          root: storagePaths.root,
          ...persistence,
          message: "Vercel runtime is using ephemeral filesystem storage; configure BLOB_READ_WRITE_TOKEN for durable staging and publish state."
        })
      );
    }
  }

  async storeUploadedWorkbook(input: UploadedWorkbookInput): Promise<SourceFileRecord> {
    const sourceFileId = randomUUID();
    const storedFilename = `${sourceFileId}.xlsx`;
    const targetPath = join(storagePaths.quarantine, storedFilename);
    await copyFile(input.filePath, targetPath);

    const storedFile: SourceFileRecord = {
      sourceFileId,
      kind: "unknown",
      originalFilename: sanitizeOriginalFilename(input.originalFilename),
      storedFilename,
      sha256: await sha256File(targetPath),
      sizeBytes: input.sizeBytes,
      mimeType: input.mimeType,
      detectedSignature: "pending",
      uploadedAt: new Date().toISOString()
    };

    console.info(
      JSON.stringify({
        event: "upload_stored",
        sourceFileId,
        storedFilename,
        originalFilename: storedFile.originalFilename,
        sizeBytes: storedFile.sizeBytes,
        storage: getStoragePersistenceInfo()
      })
    );

    return storedFile;
  }

  quarantineFilePath(storedFilename: string): string {
    return join(storagePaths.quarantine, storedFilename);
  }

  async writeStagingRun(run: StagedIngestionRun): Promise<void> {
    const runPath = join(storagePaths.staging, `${run.ingestionRunId}.json`);
    await writeJson(runPath, run);
    this.stagingRunCache.set(run.ingestionRunId, run);
  }

  async readStagingRun(ingestionRunId: string): Promise<StagedIngestionRun> {
    const cached = this.stagingRunCache.get(ingestionRunId);
    if (cached) {
      return cached;
    }

    const run = await readJson<StagedIngestionRun>(join(storagePaths.staging, `${ingestionRunId}.json`));
    this.stagingRunCache.set(ingestionRunId, run);
    return run;
  }

  async listStagingRuns(): Promise<StagedIngestionRun[]> {
    if (this.stagingRunsCacheLoaded) {
      return Array.from(this.stagingRunCache.values());
    }

    const entries = await storageListEntries(storagePaths.staging);
    const runs = await Promise.all(
      entries.filter((entry) => entry.endsWith(".json")).map(async (entry) => await readJson<StagedIngestionRun>(join(storagePaths.staging, entry)))
    );
    this.stagingRunCache = new Map(runs.map((run) => [run.ingestionRunId, run]));
    this.stagingRunsCacheLoaded = true;
    return runs;
  }

  async publishDataset(input: {
    datasetVersion: DatasetVersionRecord;
    artifacts: CanonicalDatasetArtifacts;
  }): Promise<void> {
    const versionPath = join(storagePaths.published, input.datasetVersion.datasetVersionId);
    await ensureStorageDirectory(versionPath);

    const metadata = input.datasetVersion;
    const manifest = {
      datasetVersionId: input.datasetVersion.datasetVersionId,
      publishedAt: input.datasetVersion.publishedAt,
      fingerprint: input.datasetVersion.fingerprint,
      artifacts: [
        "metadata.json",
        "catalogs/institutions.json",
        "catalogs/insurance-lines.json",
        "catalogs/financial-accounts.json",
        "facts/premiums.json",
        "facts/financial-position.json",
        "facts/income-statement.json",
        "aggregates/executive-kpis.json",
        "aggregates/premiums-by-institution.json",
        "aggregates/premiums-by-line.json",
        "aggregates/financial-highlights.json",
        "aggregates/income-statement-highlights.json",
        "aggregates/rankings.json",
        "aggregates/institutions/<institutionId>.json",
        "reports/validation-report.json",
        "reports/reconciliation-report.json"
      ]
    };

    const institutionDetailWrites = Object.entries(input.artifacts.institutionDetails).map(([institutionId, payload]) =>
      writeJson(join(versionPath, "aggregates", "institutions", `${institutionId}.json`), payload)
    );

    await Promise.all([
      writeJson(join(versionPath, "manifest.json"), manifest),
      writeJson(join(versionPath, "metadata.json"), metadata),
      writeJson(join(versionPath, "catalogs", "institutions.json"), input.artifacts.institutions),
      writeJson(join(versionPath, "catalogs", "insurance-lines.json"), input.artifacts.insuranceLines),
      writeJson(join(versionPath, "catalogs", "financial-accounts.json"), input.artifacts.financialAccounts),
      writeJson(join(versionPath, "facts", "premiums.json"), input.artifacts.premiumFacts),
      writeJson(join(versionPath, "facts", "financial-position.json"), input.artifacts.financialPositionFacts),
      writeJson(join(versionPath, "facts", "income-statement.json"), input.artifacts.incomeStatementFacts),
      writeJson(join(versionPath, "aggregates", "executive-kpis.json"), input.artifacts.executiveKpis),
      writeJson(join(versionPath, "aggregates", "premiums-by-institution.json"), input.artifacts.premiumsByInstitution),
      writeJson(join(versionPath, "aggregates", "premiums-by-line.json"), input.artifacts.premiumsByLine),
      writeJson(join(versionPath, "aggregates", "financial-highlights.json"), input.artifacts.financialHighlightsByInstitution),
      writeJson(join(versionPath, "aggregates", "income-statement-highlights.json"), input.artifacts.incomeStatementHighlightsByInstitution),
      writeJson(join(versionPath, "aggregates", "rankings.json"), input.artifacts.rankings),
      writeJson(join(versionPath, "reports", "validation-report.json"), input.datasetVersion.validationSummary),
      writeJson(join(versionPath, "reports", "reconciliation-report.json"), input.datasetVersion.reconciliationSummary),
      ...institutionDetailWrites
    ]);

    this.datasetVersionCache.set(input.datasetVersion.datasetVersionId, input.datasetVersion);
  }

  async activateDataset(datasetVersionId: string): Promise<void> {
    const pointer = {
      datasetVersionId,
      updatedAt: new Date().toISOString()
    };

    await writeJson(join(storagePaths.active, "active-dataset.json"), pointer);
    await this.writeCacheNamespaceState(datasetVersionId);
    console.info(
      JSON.stringify({
        event: "active_dataset_updated",
        datasetVersionId,
        updatedAt: pointer.updatedAt,
        storage: getStoragePersistenceInfo()
      })
    );
  }

  async getActiveDatasetPointer(): Promise<ActiveDatasetPointer> {
    await this.syncCacheNamespace();

    if (this.activePointerCache) {
      this.cacheStats.pointerHits += 1;
      return this.activePointerCache;
    }

    this.cacheStats.pointerMisses += 1;

    let pointer: unknown = null;

    try {
      pointer = await readJson<unknown>(join(storagePaths.active, "active-dataset.json"));
    } catch (error) {
      if (!isFileNotFound(error)) {
        throw error;
      }
    }

    this.activePointerCache = normalizeActiveDatasetPointer(pointer, this.namespaceState);
    return this.activePointerCache;
  }

  async getActiveDatasetVersion(): Promise<DatasetVersionRecord | null> {
    const pointer = await this.getActiveDatasetPointer();
    if (!pointer.datasetVersionId) {
      return null;
    }

    try {
      return await this.readPublishedDatasetVersion(pointer.datasetVersionId);
    } catch (error) {
      if (isFileNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  async readPublishedDatasetVersion(datasetVersionId: string): Promise<DatasetVersionRecord> {
    await this.syncCacheNamespace();

    const cached = this.datasetVersionCache.get(datasetVersionId);
    if (cached) {
      this.cacheStats.versionHits += 1;
      return cached;
    }

    this.cacheStats.versionMisses += 1;

    const dataset = await readJson<DatasetVersionRecord>(
      join(storagePaths.published, datasetVersionId, "metadata.json")
    );

    const parsed = mapDatasetVersionRecord(datasetVersionRecordSchema.parse(dataset));
    this.datasetVersionCache.set(datasetVersionId, parsed);
    return parsed;
  }

  async readPublishedArtifact<T>(datasetVersionId: string, relativePath: string): Promise<T> {
    await this.syncCacheNamespace();

    const cacheKey = `${datasetVersionId}:${relativePath}`;
    if (this.artifactCache.has(cacheKey)) {
      this.cacheStats.artifactHits += 1;
      return this.artifactCache.get(cacheKey) as T;
    }

    this.cacheStats.artifactMisses += 1;

    const value = await readJson<T>(join(storagePaths.published, datasetVersionId, relativePath));
    this.artifactCache.set(cacheKey, value);
    return value;
  }

  async readPublishedArtifactIfExists<T>(datasetVersionId: string, relativePath: string): Promise<T | null> {
    try {
      return await this.readPublishedArtifact<T>(datasetVersionId, relativePath);
    } catch (error) {
      if (isFileNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  async listPublishedDatasetVersions(): Promise<DatasetVersionRecord[]> {
    const entries = await storageListEntries(storagePaths.published);
    const versions = await Promise.all(
      entries.map(async (entry) => {
        try {
          return await this.readPublishedDatasetVersion(entry);
        } catch {
          return null;
        }
      })
    );

    return versions.filter((value): value is DatasetVersionRecord => value !== null);
  }

  async writeAuditEvent(event: AuditEvent): Promise<void> {
    const auditPath = join(storagePaths.audit, `${event.timestamp.replaceAll(":", "-")}-${event.auditEventId}.json`);
    await writeJson(auditPath, event);
    this.auditEventCache.set(event.auditEventId, event);
  }

  async listAuditEvents(): Promise<AuditEvent[]> {
    if (this.auditEventsCacheLoaded) {
      return Array.from(this.auditEventCache.values());
    }

    const entries = await storageListEntries(storagePaths.audit);
    const events = await Promise.all(
      entries.filter((entry) => entry.endsWith(".json")).map(async (entry) => await readJson<AuditEvent>(join(storagePaths.audit, entry)))
    );
    this.auditEventCache = new Map(events.map((event) => [event.auditEventId, event]));
    this.auditEventsCacheLoaded = true;
    return events;
  }

  async clearStorage(): Promise<void> {
    await deleteStorageTree(storagePaths.root);
    this.invalidateProcessCaches("storage-cleared", createBootstrapCacheNamespaceState());
    await this.initialize();
    await writeJson(join(storagePaths.active, "active-dataset.json"), {
      datasetVersionId: null,
      updatedAt: null
    });
    await writeJson(this.cacheStatePath(), createBootstrapCacheNamespaceState());
  }

  async getOperationalMetrics() {
    await this.syncCacheNamespace(true);
    const [quarantineEntries, stagingEntries, publishedEntries, auditEntries] = await Promise.all([
      storageListEntries(storagePaths.quarantine),
      storageListEntries(storagePaths.staging),
      storageListEntries(storagePaths.published),
      storageListEntries(storagePaths.audit)
    ]);

    return {
      cache: {
        ...this.cacheStats,
        activeNamespace: this.namespaceState?.namespace ?? null,
        activeNamespaceVersion: this.namespaceState?.activeDatasetVersionId ?? null,
        pointerCacheLoaded: this.activePointerCache !== null,
        versionCacheEntries: this.datasetVersionCache.size,
        artifactCacheEntries: this.artifactCache.size
      },
      storage: {
        ...getStoragePersistenceInfo(),
        quarantineCount: quarantineEntries.length,
        stagingCount: stagingEntries.filter((entry) => entry.endsWith(".json")).length,
        publishedCount: publishedEntries.length,
        auditCount: auditEntries.filter((entry) => entry.endsWith(".json")).length
      }
    };
  }

  async fileExists(path: string): Promise<boolean> {
    return await storagePathExists(path);
  }
}
