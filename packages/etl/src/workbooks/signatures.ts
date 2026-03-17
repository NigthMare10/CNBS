import ExcelJS from "exceljs";
import type { WorkbookDetectionResult } from "../types";

const PREMIUM_REQUIRED_COLUMNS = [
  "Fecha Reporte",
  "CodInstitucion",
  "Institucion",
  "RamoPadre",
  "Ramo",
  "CodMoneda",
  "Moneda",
  "Saldo"
];

const FINANCIAL_POSITION_REQUIRED_COLUMNS = [
  "Tipo",
  "Inst",
  "Logo",
  "FechaReporte",
  "Linea",
  "Cuenta",
  "MonedaNacional",
  "MonedaExtranjera"
];

function normalizeHeader(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (value instanceof Date) {
    return value.toISOString().trim();
  }

  if (typeof value === "object" && value !== null && "result" in value) {
    const result = (value as { result?: unknown }).result;
    return typeof result === "string" || typeof result === "number" || typeof result === "boolean"
      ? String(result).trim()
      : result instanceof Date
        ? result.toISOString().trim()
        : "";
  }

  return "";
}

async function getWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

function worksheetHeaders(worksheet: ExcelJS.Worksheet): string[] {
  const firstRow = worksheet.getRow(1);
  const values = Array.isArray(firstRow.values) ? firstRow.values.slice(1) : [];
  return values
    .map((value: ExcelJS.CellValue) => normalizeHeader(value))
    .filter(Boolean);
}

function containsAllHeaders(headers: string[], expected: string[]): boolean {
  const set = new Set(headers);
  return expected.every((header) => set.has(header));
}

export async function detectWorkbookKind(filePath: string): Promise<WorkbookDetectionResult> {
  const workbook = await getWorkbook(filePath);
  const sheetNames = workbook.worksheets.map((worksheet) => worksheet.name);

  const datosSheet = workbook.getWorksheet("Datos");
  if (datosSheet) {
    const headers = worksheetHeaders(datosSheet);

    if (containsAllHeaders(headers, PREMIUM_REQUIRED_COLUMNS)) {
      return { kind: "premiums", signature: "datos-premiums-v1", sheetNames };
    }

    if (containsAllHeaders(headers, FINANCIAL_POSITION_REQUIRED_COLUMNS)) {
      return { kind: "financialPosition", signature: "datos-financial-position-v1", sheetNames };
    }
  }

  const referenceSheets = [
    "1. Ramos Totales",
    "8. Primas y Siniestros Totales",
    "Ranking del Sistema",
    "descarga app P&S",
    "descarga BG"
  ];

  if (referenceSheets.every((sheetName) => sheetNames.includes(sheetName))) {
    return { kind: "reference", signature: "reference-workbook-v1", sheetNames };
  }

  throw new Error(`Unable to classify workbook by schema: ${filePath}`);
}
