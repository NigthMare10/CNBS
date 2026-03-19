import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageRepository } from "../storage/local-storage";
import { IngestionService } from "./ingestion-service";

const workbookFixtures = {
  premiums: resolve(process.cwd(), "..", "testing", "fixtures", "workbooks", "primas.xlsx"),
  financialPosition: resolve(
    process.cwd(),
    "..",
    "testing",
    "fixtures",
    "workbooks",
    "estado_situacion_financiera.xlsx"
  ),
  reference: resolve(
    process.cwd(),
    "..",
    "testing",
    "fixtures",
    "workbooks",
    "informe_financiero_referencia.xlsx"
  )
};

const realWorkbookVariants = {
  premiums3: resolve(process.cwd(), "..", "..", "Primas (3).xlsx"),
  financialPosition2: resolve(process.cwd(), "..", "..", "EstadoSituacionFinanciera (2).xlsx")
};

describe("IngestionService", () => {
  const storage = new LocalStorageRepository();
  const service = new IngestionService(storage);

  const fixtureFile = (key: keyof typeof workbookFixtures, originalFilename: string, sizeBytes: number, mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") => ({
    filePath: workbookFixtures[key],
    originalFilename,
    mimeType,
    sizeBytes
  });

  async function createIncomeStatementWorkbook() {
    const directory = await mkdtemp(join(tmpdir(), "cnbs-income-statement-"));
    const workbookPath = join(directory, "EstadoResultado.xlsx");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Estado de Resultados");
    worksheet.addRow(["Tipo", "Inst", "Logo", "FechaReporte", "Linea", "Cuenta", "MonedaNacional", "MonedaExtranjera"]);
    worksheet.addRow([1, 601, "SEGUROS DAVIVIENDA", 46053, 1, "Primas Retenidas", 100, 0]);
    worksheet.addRow([1, 601, "SEGUROS DAVIVIENDA", 46053, 2, "Ingresos Financieros", 25, 0]);
    worksheet.addRow([1, 601, "SEGUROS DAVIVIENDA", 46053, 3, "Resultado Neto del Ejercicio", 10, 0]);
    await workbook.xlsx.writeFile(workbookPath);
    return workbookPath;
  }

  async function createFinancialPositionWorkbook(
    rows: Array<[string | number, string, string | number, string | number]>
  ) {
    const directory = await mkdtemp(join(tmpdir(), "cnbs-financial-position-"));
    const workbookPath = join(directory, "EstadoSituacionFinanciera.xlsx");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Balance");
    worksheet.addRow(["Tipo", "Inst", "Logo", "FechaReporte", "Linea", "Cuenta", "MonedaNacional", "MonedaExtranjera"]);
    for (const [linea, cuenta, monedaNacional, monedaExtranjera] of rows) {
      worksheet.addRow([1, 601, "SEGUROS DAVIVIENDA", 46053, linea, cuenta, monedaNacional, monedaExtranjera]);
    }
    await workbook.xlsx.writeFile(workbookPath);
    return workbookPath;
  }

  beforeEach(async () => {
    await storage.clearStorage();
  });

  it("stages and publishes the fixture workbook set without breaking active availability", async () => {
    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [
        fixtureFile("premiums", "primas.xlsx", 12979),
        fixtureFile("financialPosition", "estado_situacion_financiera.xlsx", 21236),
        fixtureFile("reference", "informe_financiero_referencia.xlsx", 453545)
      ]
    });

    expect(run.validationSummary.publishability).not.toBe("blocked");
    const published = await service.publishStagedRun(run.ingestionRunId, "tester");
    const active = await service.getActiveDataset();

    expect(published.status).toBe("published");
    expect(active?.datasetVersionId).toBe(published.datasetVersionId);
  });

  it("supports rollback to a prior published version", async () => {
    const files = [
      fixtureFile("premiums", "primas.xlsx", 12979),
      fixtureFile("financialPosition", "estado_situacion_financiera.xlsx", 21236),
      fixtureFile("reference", "informe_financiero_referencia.xlsx", 453545)
    ];

    const first = await service.ingestWorkbookSet({ uploadedBy: "tester", files });
    const firstPublished = await service.publishStagedRun(first.ingestionRunId, "tester");
    const second = await service.ingestWorkbookSet({ uploadedBy: "tester", files });
    const secondPublished = await service.publishStagedRun(second.ingestionRunId, "tester");

    expect(secondPublished.datasetVersionId).not.toBe(firstPublished.datasetVersionId);

    await service.rollbackToVersion(firstPublished.datasetVersionId, "tester");
    const active = await service.getActiveDataset();

    expect(active?.datasetVersionId).toBe(firstPublished.datasetVersionId);
  });

  it("blocks publication when a workbook is malformed", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cnbs-invalid-"));
    const workbookPath = join(directory, "broken-premiums.xlsx");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Datos");
    worksheet.addRow(["Fecha Reporte", "CodInstitucion", "Institucion", "RamoPadre", "Ramo", "Saldo"]);
    worksheet.addRow([46053, 601, "SEGUROS DAVIVIENDA", "Seguro de Vida", "Vida Individual", 100]);
    await workbook.xlsx.writeFile(workbookPath);

    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [
        {
          filePath: workbookPath,
          originalFilename: "broken-premiums.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 1
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

    expect(run.validationSummary.publishability).toBe("blocked");
    await expect(service.publishStagedRun(run.ingestionRunId, "tester")).rejects.toThrow();
  });

  it("rejects corrupt workbook payloads before publication", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cnbs-corrupt-"));
    const corruptPath = join(directory, "corrupt.xlsx");
    await writeFile(corruptPath, "not-a-zip", "utf8");

    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [
        {
          filePath: corruptPath,
          originalFilename: "corrupt.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 9
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

    expect(run.validationSummary.publishability).toBe("blocked");
    expect(run.validationSummary.issues.some((issue) => issue.code === "SECURITY_MAGIC_BYTES")).toBe(true);
  });

  it("publishes a premiums-only dataset with partial metadata", async () => {
    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [fixtureFile("premiums", "Primas (2).xlsx", 12979)]
    });

    expect(run.validationSummary.publishability).toBe("warningOnly");
    const published = await service.publishStagedRun(run.ingestionRunId, "tester");

    expect(run.sourceFiles).toHaveLength(1);
    expect(run.sourceFiles[0]?.kind).toBe("premiums");
    expect(published.datasetScope).toBe("premiums-only");
    expect(published.domainAvailability.premiums.publishable).toBe(true);
    expect(published.domainAvailability.financialPosition.publishable).toBe(false);

    const overview = await service.getPublicOverview();
    expect(Array.isArray(overview.premiumsByInstitution)).toBe(true);
    expect(Array.isArray(overview.financialHighlights)).toBe(true);
    expect(Array.isArray(overview.incomeStatementHighlights)).toBe(true);
  });

  it("publishes a financial-only dataset with partial metadata", async () => {
    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [fixtureFile("financialPosition", "balance_aseguradoras_enero.xlsx", 21236)]
    });

    expect(run.validationSummary.publishability).toBe("warningOnly");
    const published = await service.publishStagedRun(run.ingestionRunId, "tester");

    expect(run.sourceFiles).toHaveLength(1);
    expect(run.sourceFiles[0]?.kind).toBe("financialPosition");
    expect(published.datasetScope).toBe("financial-only");
    expect(published.domainAvailability.premiums.publishable).toBe(false);
    expect(published.domainAvailability.financialPosition.publishable).toBe(true);
  });

  it("accepts both primary workbooks plus optional reference workbook", async () => {
    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [
        fixtureFile("premiums", "primas.xlsx", 12979),
        fixtureFile("financialPosition", "estado_situacion_financiera.xlsx", 21236),
        fixtureFile("reference", "INFORME_FINANCIERO_PRELIMINAR.xlsx", 453545)
      ]
    });

    const published = await service.publishStagedRun(run.ingestionRunId, "tester");
    expect(run.sourceFiles).toHaveLength(3);
    expect(run.sourceFiles.map((file) => file.kind).sort()).toEqual(["financialPosition", "premiums", "reference"]);
    expect(published.datasetScope).toBe("premiums-financial");
    expect(published.domainAvailability.reference.sourceProvided).toBe(true);
  });

  it("publishes correctly when both primary workbooks are provided without the optional reference", async () => {
    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [
        fixtureFile("premiums", "primas.xlsx", 12979),
        fixtureFile("financialPosition", "estado_situacion_financiera.xlsx", 21236)
      ]
    });

    const published = await service.publishStagedRun(run.ingestionRunId, "tester");
    expect(run.sourceFiles).toHaveLength(2);
    expect(run.sourceFiles.map((file) => file.kind).sort()).toEqual(["financialPosition", "premiums"]);
    expect(published.datasetScope).toBe("premiums-financial");
    expect(published.domainAvailability.financialPosition.sourceProvided).toBe(true);
    expect(published.domainAvailability.reference.sourceProvided).toBe(false);

    const overview = await service.getPublicOverview();
    expect((overview.executiveKpis as Array<{ key: string }>).some((kpi) => kpi.key === "total-reserves")).toBe(true);
    expect((overview.executiveKpis as Array<{ key: string }>).some((kpi) => kpi.key === "total-net-income")).toBe(false);
  });

  it("blocks a reference-only upload because no primary source is present", async () => {
    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [fixtureFile("reference", "informe_financiero_referencia.xlsx", 453545)]
    });

    expect(run.validationSummary.publishability).toBe("blocked");
    expect(run.validationSummary.issues.some((issue) => issue.code === "NO_PRIMARY_SOURCE_PROVIDED")).toBe(true);
  });

  it("blocks unexpected MIME types even when the workbook structure is valid", async () => {
    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [fixtureFile("premiums", "primas.xlsx", 12979, "text/plain")]
    });

    expect(run.validationSummary.publishability).toBe("blocked");
    expect(run.validationSummary.issues.some((issue) => issue.code === "SECURITY_MIME_REJECTED")).toBe(true);
  });

  it("blocks an incomeStatement-only dataset because only premiums and financial position are operational sources", async () => {
    const incomeStatementPath = await createIncomeStatementWorkbook();
    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [
        {
          filePath: incomeStatementPath,
          originalFilename: "EstadoResultado.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 4096
        }
      ]
    });

    expect(run.sourceFiles).toHaveLength(1);
    expect(run.sourceFiles[0]?.kind).toBe("incomeStatement");
    expect(run.validationSummary.publishability).toBe("blocked");
    expect(run.validationSummary.issues.some((issue) => issue.code === "NO_PRIMARY_SOURCE_PROVIDED")).toBe(true);
  });

  it("publishes a premiums plus incomeStatement upload as premiums-only operational dataset without faking financialPosition", async () => {
    const incomeStatementPath = await createIncomeStatementWorkbook();
    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [
        fixtureFile("premiums", "primas_marzo_2026.xlsx", 12979),
        {
          filePath: incomeStatementPath,
          originalFilename: "EstadoResultado.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 4096
        }
      ]
    });

    const published = await service.publishStagedRun(run.ingestionRunId, "tester");
    expect(published.datasetScope).toBe("premiums-only");
    expect(published.domainAvailability.incomeStatement.sourceProvided).toBe(true);
    expect(published.domainAvailability.incomeStatement.publishable).toBe(false);
    expect(published.domainAvailability.financialPosition.publishable).toBe(false);

    const overview = await service.getPublicOverview();
    expect(Array.isArray(overview.incomeStatementHighlights)).toBe(true);
    expect((overview.incomeStatementHighlights as unknown[]).length).toBe(0);
  });

  it("publishes a financial plus incomeStatement upload as financial-only operational dataset", async () => {
    const incomeStatementPath = await createIncomeStatementWorkbook();
    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [
        fixtureFile("financialPosition", "EstadoSituacionFinanciera (1).xlsx", 21236),
        {
          filePath: incomeStatementPath,
          originalFilename: "EstadoResultado.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 4096
        }
      ]
    });

    const published = await service.publishStagedRun(run.ingestionRunId, "tester");
    expect(published.datasetScope).toBe("financial-only");
    expect(published.domainAvailability.incomeStatement.sourceProvided).toBe(true);
    expect(published.domainAvailability.incomeStatement.publishable).toBe(false);
    expect(published.domainAvailability.financialPosition.publishable).toBe(true);
  });

  it("persists text quality telemetry and alias repair matrix for the real 2025 files", async () => {
    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [
        {
          filePath: realWorkbookVariants.premiums3,
          originalFilename: "Primas (3).xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 100000
        },
        {
          filePath: realWorkbookVariants.financialPosition2,
          originalFilename: "EstadoSituacionFinanciera (2).xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 100000
        }
      ]
    });

    expect(run.sourceFiles).toHaveLength(2);
    expect(run.sourceFiles.map((file) => file.kind).sort()).toEqual(["financialPosition", "premiums"]);
    expect(run.validationSummary.publishability).not.toBe("blocked");
    expect(run.validationSummary.issues.some((issue) => issue.code === "FINANCIAL_ACCOUNT_ALIAS_UNRESOLVED")).toBe(false);
    expect(run.validationSummary.issues.some((issue) => issue.code === "INSURANCE_LINE_ALIAS_UNRESOLVED")).toBe(false);
    expect(run.mappingSummary.unresolvedAliases).toBe(0);
    expect(run.mappingSummary.ambiguousAliases).toBe(0);
    expect(run.mappingSummary.textQuality.textsRequiringMojibakeRepair).toBeGreaterThan(0);
    expect(run.mappingSummary.topAliasRepairs.length).toBeGreaterThan(0);
    expect(run.draftDatasetVersion.domainAvailability.financialPosition.sourceProvided).toBe(true);
    expect(run.draftDatasetVersion.datasetScope).toBe("premiums-financial");

    const published = await service.publishStagedRun(run.ingestionRunId, "tester");
    const publishedMetadata = await storage.readPublishedDatasetVersion(published.datasetVersionId);
    const status = await service.getOperationalStatus();

    expect(publishedMetadata.mappingSummary?.unresolvedAliases).toBe(0);
    expect(publishedMetadata.mappingSummary?.ambiguousAliases).toBe(0);
    expect(publishedMetadata.mappingSummary?.topAliasRepairs.length).toBeGreaterThan(0);
    expect(status.latestTextQuality?.mappingSummary?.unresolvedAliases).toBe(0);
    expect(status.activeTextQuality?.mappingSummary?.unresolvedAliases).toBe(0);
  });

  it("blocks ambiguous financial aliases instead of accepting permissive matches", async () => {
    const financialWorkbookPath = await createFinancialPositionWorkbook([
      [1, "ACTIVOS", 0, 0],
      [14, "TOTAL ACTIVOS", 100, 0],
      [15, "PASIVOS", 80, 0],
      ["xx", "TOTAL", 20, 0],
      [27, "PATRIMONIO", 20, 0],
      [34, "CUENTAS DE ORDEN Y REGISTRO", 0, 0]
    ]);

    const run = await service.ingestWorkbookSet({
      uploadedBy: "tester",
      files: [
        {
          filePath: financialWorkbookPath,
          originalFilename: "EstadoSituacionFinanciera.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 4096
        }
      ]
    });

    const ambiguousIssue = run.validationSummary.issues.find((issue) => issue.code === "FINANCIAL_ACCOUNT_ALIAS_AMBIGUOUS");

    expect(run.validationSummary.publishability).toBe("blocked");
    expect(ambiguousIssue).toBeTruthy();
    expect(run.mappingSummary.ambiguousAliases).toBeGreaterThan(0);
    expect(run.mappingSummary.unresolvedAliases).toBe(0);
    expect(run.mappingSummary.ambiguousExamples[0]?.candidateNames.length).toBeGreaterThan(1);
    await expect(service.publishStagedRun(run.ingestionRunId, "tester")).rejects.toThrow();
  });
});
