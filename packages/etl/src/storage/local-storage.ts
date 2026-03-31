import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { storagePaths } from "@cnbs/config";
import type { AuditEvent, DatasetVersionRecord, SourceFileRecord } from "@cnbs/domain";
import { datasetVersionRecordSchema } from "@cnbs/schemas";
import type { z } from "zod";
import type { CanonicalDatasetArtifacts, StagedIngestionRun, UploadedWorkbookInput } from "../types";
import { sha256File } from "../security/hash";

async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await ensureDirectory(dirname(path));
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readJson<T>(path: string): Promise<T> {
  const value = JSON.parse(await readFile(path, "utf8")) as T;
  return value;
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
      institution: { ...value.domains.institution },
      insuranceLine: { ...value.domains.insuranceLine },
      financialAccount: { ...value.domains.financialAccount }
    },
    topAliasRepairs: value.topAliasRepairs.map((item) => ({ ...item })),
    resolvedExamples: value.resolvedExamples.map((item) => ({ ...item })),
    ambiguousExamples: value.ambiguousExamples.map((item) => ({ ...item })),
    unresolvedExamples: value.unresolvedExamples.map((item) => ({ ...item }))
  };
}

function mapDatasetVersionRecord(value: ParsedDatasetVersionRecord): DatasetVersionRecord {
  const mappingSummary = mapMappingSummary(value.mappingSummary);

  return {
    datasetVersionId: value.datasetVersionId,
    ingestionRunId: value.ingestionRunId,
    status: value.status,
    createdAt: value.createdAt,
    publishedAt: value.publishedAt,
    uploadedBy: value.uploadedBy,
    sourceFiles: value.sourceFiles.map((sourceFile): SourceFileRecord => ({ ...sourceFile })),
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

  async initialize(): Promise<void> {
    await Promise.all(Object.values(storagePaths).map((directoryPath) => ensureDirectory(directoryPath)));
    await this.ensureCacheStateFile();
  }

  async storeUploadedWorkbook(input: UploadedWorkbookInput): Promise<SourceFileRecord> {
    const sourceFileId = randomUUID();
    const storedFilename = `${sourceFileId}.xlsx`;
    const targetPath = join(storagePaths.quarantine, storedFilename);
    await copyFile(input.filePath, targetPath);

    return {
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

    const entries = await readdir(storagePaths.staging);
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
    await ensureDirectory(versionPath);

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
    const entries = await readdir(storagePaths.published);
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

    const entries = await readdir(storagePaths.audit);
    const events = await Promise.all(
      entries.filter((entry) => entry.endsWith(".json")).map(async (entry) => await readJson<AuditEvent>(join(storagePaths.audit, entry)))
    );
    this.auditEventCache = new Map(events.map((event) => [event.auditEventId, event]));
    this.auditEventsCacheLoaded = true;
    return events;
  }

  async clearStorage(): Promise<void> {
    await rm(storagePaths.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
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
      readdir(storagePaths.quarantine),
      readdir(storagePaths.staging),
      readdir(storagePaths.published),
      readdir(storagePaths.audit)
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
        quarantineCount: quarantineEntries.length,
        stagingCount: stagingEntries.filter((entry) => entry.endsWith(".json")).length,
        publishedCount: publishedEntries.length,
        auditCount: auditEntries.filter((entry) => entry.endsWith(".json")).length
      }
    };
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await stat(resolve(path));
      return true;
    } catch {
      return false;
    }
  }
}
