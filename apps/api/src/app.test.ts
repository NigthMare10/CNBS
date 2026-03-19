import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorageRepository } from "@cnbs/etl";
import { IngestionService } from "@cnbs/etl";
import { buildApp } from "./app";

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

const storage = new LocalStorageRepository();
const service = new IngestionService(storage);

vi.mock("./services/container", () => ({
  getIngestionService: () => Promise.resolve(service)
}));

describe("API integration", () => {
  beforeEach(async () => {
    await storage.clearStorage();
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

  it("serves admin system status with text quality telemetry", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/system/status",
      headers: {
        "x-cnbs-admin-secret": "local-dev-secret",
        "x-cnbs-admin-role": "admin",
        "x-cnbs-admin-user": "tester"
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
});
