import { mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { detectWorkbookKind, WorkbookClassificationError } from "./signatures";

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

async function createIncomeStatementWorkbook(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Estado de Resultados 2026");
  worksheet.addRow(["Tipo", "Inst", "Logo", "FechaReporte", "Linea", "Cuenta", "MonedaNacional", "MonedaExtranjera"]);
  worksheet.addRow([1, 601, "SEGUROS DAVIVIENDA", 46053, 1, "Primas Retenidas", 1000, 0]);
  worksheet.addRow([1, 601, "SEGUROS DAVIVIENDA", 46053, 2, "Ingresos Financieros", 250, 0]);
  worksheet.addRow([1, 601, "SEGUROS DAVIVIENDA", 46053, 3, "Gastos de Intermediación", 120, 0]);
  worksheet.addRow([1, 601, "SEGUROS DAVIVIENDA", 46053, 4, "Resultado Neto del Ejercicio", 80, 0]);
  await workbook.xlsx.writeFile(filePath);
}

async function createUnknownWorkbook(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Hoja1");
  worksheet.addRow(["Columna A", "Columna B", "Columna C"]);
  worksheet.addRow(["valor 1", "valor 2", "valor 3"]);
  await workbook.xlsx.writeFile(filePath);
}

describe("detectWorkbookKind", () => {
  it("detects the premiums workbook by structure regardless of filename", async () => {
    await expect(detectWorkbookKind(workbookFixtures.premiums)).resolves.toMatchObject({ kind: "premiums" });
  });

  it("detects the financial position workbook by structure regardless of filename", async () => {
    await expect(detectWorkbookKind(workbookFixtures.financialPosition)).resolves.toMatchObject({ kind: "financialPosition" });
  });

  it("detects the reference workbook by schema", async () => {
    await expect(detectWorkbookKind(workbookFixtures.reference)).resolves.toMatchObject({ kind: "reference" });
  });

  it("detects income statement workbooks using semantic account signals", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cnbs-er-"));
    const filePath = join(dir, "EstadoResultado.xlsx");
    await createIncomeStatementWorkbook(filePath);

    await expect(detectWorkbookKind(filePath)).resolves.toMatchObject({ kind: "incomeStatement" });
  });

  it("does not silently misclassify an unknown but safe workbook", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cnbs-unknown-"));
    const filePath = join(dir, "archivo_historico.xlsx");
    await createUnknownWorkbook(filePath);

    await expect(detectWorkbookKind(filePath)).rejects.toBeInstanceOf(WorkbookClassificationError);
  });
});
