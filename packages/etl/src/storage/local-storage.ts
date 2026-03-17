import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { storagePaths } from "@cnbs/config";
import type { AuditEvent, DatasetVersionRecord, SourceFileRecord } from "@cnbs/domain";
import { activeDatasetPointerSchema, datasetVersionRecordSchema } from "@cnbs/schemas";
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

function sanitizeOriginalFilename(input: string): string {
  return basename(input).replace(/[^a-zA-Z0-9._-]/g, "_");
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

export class LocalStorageRepository {
  private activePointerCache: { datasetVersionId: string | null; updatedAt: string | null } | null = null;
  private datasetVersionCache = new Map<string, DatasetVersionRecord>();
  private artifactCache = new Map<string, unknown>();
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
      const initialState: CacheNamespaceState = {
        namespace: "bootstrap",
        activeDatasetVersionId: null,
        updatedAt: null
      };
      await writeJson(this.cacheStatePath(), initialState);
      this.namespaceState = initialState;
    }
  }

  private invalidateProcessCaches(reason: string, nextNamespaceState?: CacheNamespaceState): void {
    this.activePointerCache = null;
    this.datasetVersionCache.clear();
    this.artifactCache.clear();
    this.namespaceState = nextNamespaceState ?? this.namespaceState;
    this.cacheStats.invalidations += 1;
    this.cacheStats.lastInvalidationReason = reason;
    this.cacheStats.lastInvalidatedAt = new Date().toISOString();
  }

  private async readCacheNamespaceState(): Promise<CacheNamespaceState> {
    await this.ensureCacheStateFile();
    return await readJson<CacheNamespaceState>(this.cacheStatePath());
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
      kind: "premiums",
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
  }

  async readStagingRun(ingestionRunId: string): Promise<StagedIngestionRun> {
    return await readJson<StagedIngestionRun>(join(storagePaths.staging, `${ingestionRunId}.json`));
  }

  async listStagingRuns(): Promise<StagedIngestionRun[]> {
    const entries = await readdir(storagePaths.staging);
    return await Promise.all(
      entries.filter((entry) => entry.endsWith(".json")).map(async (entry) => await readJson<StagedIngestionRun>(join(storagePaths.staging, entry)))
    );
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
        "aggregates/executive-kpis.json",
        "aggregates/premiums-by-institution.json",
        "aggregates/premiums-by-line.json",
        "aggregates/financial-highlights.json",
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
      writeJson(join(versionPath, "aggregates", "executive-kpis.json"), input.artifacts.executiveKpis),
      writeJson(join(versionPath, "aggregates", "premiums-by-institution.json"), input.artifacts.premiumsByInstitution),
      writeJson(join(versionPath, "aggregates", "premiums-by-line.json"), input.artifacts.premiumsByLine),
      writeJson(join(versionPath, "aggregates", "financial-highlights.json"), input.artifacts.financialHighlightsByInstitution),
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

  async getActiveDatasetPointer(): Promise<{ datasetVersionId: string | null; updatedAt: string | null }> {
    await this.syncCacheNamespace();

    if (this.activePointerCache) {
      this.cacheStats.pointerHits += 1;
      return this.activePointerCache;
    }

    this.cacheStats.pointerMisses += 1;

    const pointer = await readJson<{ datasetVersionId: string | null; updatedAt: string | null }>(
      join(storagePaths.active, "active-dataset.json")
    );

    this.activePointerCache = activeDatasetPointerSchema.parse(pointer);
    return this.activePointerCache;
  }

  async getActiveDatasetVersion(): Promise<DatasetVersionRecord | null> {
    const pointer = await this.getActiveDatasetPointer();
    if (!pointer.datasetVersionId) {
      return null;
    }

    return await this.readPublishedDatasetVersion(pointer.datasetVersionId);
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

    const parsed = datasetVersionRecordSchema.parse(dataset) as DatasetVersionRecord;
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
  }

  async listAuditEvents(): Promise<AuditEvent[]> {
    const entries = await readdir(storagePaths.audit);
    return await Promise.all(
      entries.filter((entry) => entry.endsWith(".json")).map(async (entry) => await readJson<AuditEvent>(join(storagePaths.audit, entry)))
    );
  }

  async clearStorage(): Promise<void> {
    await rm(storagePaths.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    this.invalidateProcessCaches("storage-cleared", {
      namespace: "bootstrap",
      activeDatasetVersionId: null,
      updatedAt: null
    });
    await this.initialize();
    await writeJson(join(storagePaths.active, "active-dataset.json"), {
      datasetVersionId: null,
      updatedAt: null
    });
    await writeJson(this.cacheStatePath(), {
      namespace: "bootstrap",
      activeDatasetVersionId: null,
      updatedAt: null
    } satisfies CacheNamespaceState);
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
        stagingCount: stagingEntries.length,
        publishedCount: publishedEntries.length,
        auditCount: auditEntries.length
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
