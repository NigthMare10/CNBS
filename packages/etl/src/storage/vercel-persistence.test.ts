import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blobStore = new Map<string, { body: Uint8Array; uploadedAt: Date; contentType: string }>();

function notFoundError(): Error {
  const error = new Error("Blob not found");
  error.name = "BlobNotFoundError";
  return error;
}

function toBytes(value: string | ArrayBuffer | Uint8Array): Uint8Array {
  if (typeof value === "string") {
    return new TextEncoder().encode(value);
  }

  if (value instanceof Uint8Array) {
    return value;
  }

  return new Uint8Array(value);
}

function toStream(value: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(value);
      controller.close();
    }
  });
}

vi.mock("@vercel/blob", () => ({
  put: async (pathname: string, body: string | ArrayBuffer | Uint8Array, options: { contentType?: string }) => {
    const bytes = toBytes(body);
    blobStore.set(pathname, {
      body: bytes,
      uploadedAt: new Date(),
      contentType: options.contentType ?? "application/octet-stream"
    });

    return {
      pathname,
      contentType: options.contentType ?? "application/octet-stream",
      contentDisposition: "inline",
      url: `https://blob.test/${pathname}`,
      downloadUrl: `https://blob.test/${pathname}?download=1`,
      etag: `etag-${pathname}`
    };
  },
  get: async (pathname: string) => {
    const item = blobStore.get(pathname);
    if (!item) {
      return null;
    }

    return {
      statusCode: 200,
      stream: toStream(item.body),
      headers: new Headers(),
      blob: {
        pathname,
        url: `https://blob.test/${pathname}`,
        downloadUrl: `https://blob.test/${pathname}?download=1`,
        contentDisposition: "inline",
        cacheControl: "max-age=0",
        uploadedAt: item.uploadedAt,
        etag: `etag-${pathname}`,
        contentType: item.contentType,
        size: item.body.byteLength
      }
    };
  },
  head: async (pathname: string) => {
    const item = blobStore.get(pathname);
    if (!item) {
      throw notFoundError();
    }

    return {
      pathname,
      url: `https://blob.test/${pathname}`,
      downloadUrl: `https://blob.test/${pathname}?download=1`,
      contentDisposition: "inline",
      cacheControl: "max-age=0",
      uploadedAt: item.uploadedAt,
      etag: `etag-${pathname}`,
      contentType: item.contentType,
      size: item.body.byteLength
    };
  },
  list: async (options?: { prefix?: string }) => {
    const prefix = options?.prefix ?? "";
    const blobs = Array.from(blobStore.entries())
      .filter(([pathname]) => pathname.startsWith(prefix))
      .map(([pathname, item]) => ({
        pathname,
        url: `https://blob.test/${pathname}`,
        downloadUrl: `https://blob.test/${pathname}?download=1`,
        size: item.body.byteLength,
        uploadedAt: item.uploadedAt,
        etag: `etag-${pathname}`
      }));

    return {
      blobs,
      hasMore: false
    };
  },
  del: async (urlOrPathname: string | string[]) => {
    for (const pathname of Array.isArray(urlOrPathname) ? urlOrPathname : [urlOrPathname]) {
      blobStore.delete(pathname);
    }
  }
}));

const fixturesRoot = join(process.cwd(), "..", "testing", "fixtures", "workbooks");
const originalEnv = { ...process.env };

function fixtureFile(filename: string, sizeBytes: number) {
  return {
    filePath: join(fixturesRoot, filename),
    originalFilename: filename,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes
  };
}

async function loadService(storageRoot: string, blobEnabled: boolean) {
  vi.resetModules();

  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "cnbs-api.vercel.app";
  process.env.VERCEL_URL = "cnbs-api.vercel.app";
  process.env.CNBS_PUBLIC_API_BASE_URL = "https://cnbs-api.vercel.app";
  process.env.CNBS_STORAGE_ROOT = storageRoot;

  if (blobEnabled) {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  } else {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  }

  const { IngestionService } = await import("../pipeline/ingestion-service");
  const service = new IngestionService();
  await service.initialize();
  return service;
}

describe("Vercel persistence behavior", () => {
  beforeEach(() => {
    blobStore.clear();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("loses staged and active state across isolated roots without durable storage", async () => {
    const firstRoot = await mkdtemp(join(tmpdir(), "cnbs-no-blob-a-"));
    const secondRoot = await mkdtemp(join(tmpdir(), "cnbs-no-blob-b-"));

    try {
      const first = await loadService(firstRoot, false);
      const run = await first.ingestWorkbookSet({
        uploadedBy: "tester",
        files: [
          fixtureFile("primas.xlsx", 12979),
          fixtureFile("estado_situacion_financiera.xlsx", 21236),
          fixtureFile("informe_financiero_referencia.xlsx", 453545)
        ]
      });
      const published = await first.publishStagedRun(run.ingestionRunId, "tester");

      const second = await loadService(secondRoot, false);
      const stagedRuns = await second.listStagedRunSummaries();
      const active = await second.getActiveDataset();

      expect(stagedRuns.some((entry) => entry.ingestionRunId === run.ingestionRunId)).toBe(false);
      expect(active?.datasetVersionId).not.toBe(published.datasetVersionId);
    } finally {
      await rm(firstRoot, { recursive: true, force: true });
      await rm(secondRoot, { recursive: true, force: true });
    }
  }, 30000);

  it("shares staged and active state across isolated roots when blob persistence is enabled", async () => {
    const firstRoot = await mkdtemp(join(tmpdir(), "cnbs-blob-a-"));
    const secondRoot = await mkdtemp(join(tmpdir(), "cnbs-blob-b-"));

    try {
      const first = await loadService(firstRoot, true);
      const run = await first.ingestWorkbookSet({
        uploadedBy: "tester",
        files: [
          fixtureFile("primas.xlsx", 12979),
          fixtureFile("estado_situacion_financiera.xlsx", 21236),
          fixtureFile("informe_financiero_referencia.xlsx", 453545)
        ]
      });
      const published = await first.publishStagedRun(run.ingestionRunId, "tester");

      const second = await loadService(secondRoot, true);
      const stagedRuns = await second.listStagedRunSummaries();
      const active = await second.getActiveDataset();

      expect(stagedRuns.some((entry) => entry.ingestionRunId === run.ingestionRunId)).toBe(true);
      expect(active?.datasetVersionId).toBe(published.datasetVersionId);
    } finally {
      await rm(firstRoot, { recursive: true, force: true });
      await rm(secondRoot, { recursive: true, force: true });
    }
  }, 30000);
});
