import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSignedToken } from "@cnbs/domain";

const workbookFixtures = {
  premiums: resolve(process.cwd(), "..", "..", "packages", "testing", "fixtures", "workbooks", "primas.xlsx"),
  financialPosition: resolve(
    process.cwd(),
    "..",
    "..",
    "packages",
    "testing",
    "fixtures",
    "workbooks",
    "estado_situacion_financiera.xlsx"
  ),
  reference: resolve(
    process.cwd(),
    "..",
    "..",
    "packages",
    "testing",
    "fixtures",
    "workbooks",
    "informe_financiero_referencia.xlsx"
  )
};

let storage: import("@cnbs/etl").LocalStorageRepository;
let service: import("@cnbs/etl").IngestionService;
let buildApp: typeof import("./app.js").buildApp;
let testStorageRoot: string;

vi.mock("./services/container", () => ({
  getIngestionService: () => Promise.resolve(service)
}));

describe.sequential("API integration", () => {
  beforeEach(async () => {
    testStorageRoot = await mkdtemp(join(tmpdir(), "cnbs-api-test-"));
    process.env.CNBS_STORAGE_ROOT = testStorageRoot;
    vi.resetModules();

    const [{ LocalStorageRepository, IngestionService }, appModule] = await Promise.all([import("@cnbs/etl"), import("./app.js")]);
    storage = new LocalStorageRepository();
    service = new IngestionService(storage);
    buildApp = appModule.buildApp;
    await service.initialize();

    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [
        {
          filePath: workbookFixtures.premiums,
          originalFilename: "primas.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 12979
        },
        {
          filePath: workbookFixtures.financialPosition,
          originalFilename: "estado_situacion_financiera.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 21236
        },
        {
          filePath: workbookFixtures.reference,
          originalFilename: "informe_financiero_referencia.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 453545
        }
      ]
    });
    await service.publishStagedRun(run.ingestionRunId, "tester");
  }, 20000);

  afterEach(async () => {
    delete process.env.CNBS_STORAGE_ROOT;
    await rm(testStorageRoot, { recursive: true, force: true });
  });

  it("serves active version metadata from the public API", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/api/public/version" });
    const payload: { activeDataset?: { datasetVersionId?: string } } = response.json();

    expect(response.statusCode).toBe(200);
    expect(payload.activeDataset?.datasetVersionId).toBeTruthy();
    await app.close();
  }, 20000);

  it("serves optimized institution detail payloads without full facts arrays", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/api/public/institutions/davivienda" });
    const payload: { premiumFactsPreview?: unknown[]; financialFactsCount?: number } = response.json();

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(payload.premiumFactsPreview)).toBe(true);
    expect(typeof payload.financialFactsCount).toBe("number");
    await app.close();
  }, 20000);

  it("serves rankings from the active dataset with deterministic groups", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/api/public/rankings" });
    const payload: {
      activeDataset?: { datasetVersionId?: string };
      rankings?: { premiums?: unknown[]; assets?: unknown[]; equity?: unknown[]; reserves?: unknown[] };
    } = response.json();

    expect(response.statusCode).toBe(200);
    expect(payload.activeDataset?.datasetVersionId).toBeTruthy();
    expect(Array.isArray(payload.rankings?.premiums)).toBe(true);
    expect(Array.isArray(payload.rankings?.assets)).toBe(true);
    expect(Array.isArray(payload.rankings?.equity)).toBe(true);
    expect(Array.isArray(payload.rankings?.reserves)).toBe(true);
    await app.close();
  }, 20000);

  it("resolves institution detail by canonical id, alias, and slug", async () => {
    const app = buildApp();
    const [idResponse, aliasResponse, slugResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/api/public/institutions/davivienda" }),
      app.inject({ method: "GET", url: "/api/public/institutions/DAVIVIENDA" }),
      app.inject({ method: "GET", url: "/api/public/institutions/seguros-davivienda" })
    ]);

    expect(idResponse.statusCode).toBe(200);
    expect(aliasResponse.statusCode).toBe(200);
    expect(slugResponse.statusCode).toBe(200);
    expect((idResponse.json() as { institution?: { institutionId?: string } }).institution?.institutionId).toBe("davivienda");
    expect((aliasResponse.json() as { institution?: { institutionId?: string } }).institution?.institutionId).toBe("davivienda");
    expect((slugResponse.json() as { institution?: { institutionId?: string } }).institution?.institutionId).toBe("davivienda");
    await app.close();
  }, 20000);

  it("serves admin system status with text quality telemetry", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/system/status",
      headers: {
        "x-cnbs-admin-secret": "local-dev-secret",
        "x-cnbs-admin-auth": createSignedToken(
          {
            user: "tester",
            role: "admin",
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 300
          },
          "local-dev-secret:service"
        )
      }
    });
    const payload: {
      latestTextQuality?: { mappingSummary?: { unresolvedAliases?: number } };
      activeTextQuality?: { mappingSummary?: { unresolvedAliases?: number } };
    } = response.json();

    expect(response.statusCode).toBe(200);
    expect(payload.latestTextQuality?.mappingSummary?.unresolvedAliases).toBe(0);
    expect(payload.activeTextQuality?.mappingSummary?.unresolvedAliases).toBe(0);
    await app.close();
  }, 20000);

  it("lists staged ingestions with pagination metadata", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/ingestions?page=1&pageSize=1",
      headers: {
        "x-cnbs-admin-secret": "local-dev-secret",
        "x-cnbs-admin-auth": createSignedToken(
          {
            user: "tester",
            role: "admin",
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 300
          },
          "local-dev-secret:service"
        )
      }
    });
    const payload: { items?: unknown[]; page?: number; pageSize?: number; total?: number; totalPages?: number } = response.json();

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items).toHaveLength(1);
    expect(payload.page).toBe(1);
    expect(payload.pageSize).toBe(1);
    expect(payload.total).toBeGreaterThanOrEqual(1);
    expect(payload.totalPages).toBeGreaterThanOrEqual(1);
    await app.close();
  }, 20000);

  it("lists audit events after publish", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/audit?page=1&pageSize=5",
      headers: {
        "x-cnbs-admin-secret": "local-dev-secret",
        "x-cnbs-admin-auth": createSignedToken(
          {
            user: "tester",
            role: "admin",
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 300
          },
          "local-dev-secret:service"
        )
      }
    });
    const payload: { items?: Array<{ action?: string }>; total?: number } = response.json();

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.total).toBeGreaterThanOrEqual(1);
    expect(payload.items?.some((item) => item.action === "DATASET_PUBLISHED")).toBe(true);
    await app.close();
  }, 20000);

  it("rejects admin requests without a valid signed identity token", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/system/status",
      headers: {
        "x-cnbs-admin-secret": "local-dev-secret"
      }
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  }, 20000);

  it("returns 404 for missing staged runs instead of 500", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/ingestions/run-missing",
      headers: {
        "x-cnbs-admin-secret": "local-dev-secret",
        "x-cnbs-admin-auth": createSignedToken(
          {
            user: "tester",
            role: "admin",
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 300
          },
          "local-dev-secret:service"
        )
      }
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  }, 20000);

  it("degrades safely when the active pointer references a missing published version", async () => {
    await storage.activateDataset("dataset-missing");
    const app = buildApp();

    const [overviewResponse, statusResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/api/public/overview" }),
      app.inject({
        method: "GET",
        url: "/api/admin/system/status",
        headers: {
          "x-cnbs-admin-secret": "local-dev-secret",
          "x-cnbs-admin-auth": createSignedToken(
            {
              user: "tester",
              role: "admin",
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 300
            },
            "local-dev-secret:service"
          )
        }
      })
    ]);

    const overviewPayload: { metadata: unknown } = overviewResponse.json();
    const statusPayload: { activeDataset: unknown } = statusResponse.json();

    expect(overviewResponse.statusCode).toBe(200);
    expect(overviewPayload.metadata).toBeNull();
    expect(statusResponse.statusCode).toBe(200);
    expect(statusPayload.activeDataset).toBeNull();
    await app.close();
  }, 20000);
});
