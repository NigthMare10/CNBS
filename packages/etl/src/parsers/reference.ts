import { normalizeText } from "@cnbs/domain";
import type ExcelJS from "exceljs";
import type { ParsedReferenceWorkbook } from "../types";
import { readWorkbook } from "./excel";

function getCellText(worksheet: ExcelJS.Worksheet, cellAddress: string): string | null {
  const value = worksheet.getCell(cellAddress).value;
  if (value == null) {
    return null;
  }

  if (typeof value === "object" && value !== null && "result" in value) {
    const result = value.result;
    if (typeof result === "string" || typeof result === "number" || typeof result === "boolean") {
      return String(result).trim() || null;
    }
    if (result instanceof Date) {
      return result.toISOString().trim() || null;
    }
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim() || null;
  }
  if (value instanceof Date) {
    return value.toISOString().trim() || null;
  }

  return null;
}

function getNumericValue(cell: ExcelJS.Cell): number | null {
  const value = cell.value;

  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "object" && value !== null && "result" in value) {
    return typeof value.result === "number" ? value.result : Number(value.result ?? NaN);
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function parseReferenceWorkbook(filePath: string): Promise<ParsedReferenceWorkbook> {
  const workbook = await readWorkbook(filePath);
  const referencePeriod = getCellText(workbook.getWorksheet("descarga app P&S")!, "B1");
  const premiumsSheet = workbook.getWorksheet("Primas Diciembre 2025");
  const balanceSheet = workbook.getWorksheet("Balance Diciembre 2025");

  const premiumTotalsByInstitution: Record<string, number> = {};
  const assetsByInstitution: Record<string, number> = {};

  if (premiumsSheet) {
    const totalRow = premiumsSheet.getRow(61);

    for (let column = 3; column <= 14; column += 1) {
      const header = getCellText(premiumsSheet, `${String.fromCharCode(64 + column)}11`) ?? "";
      const value = getNumericValue(totalRow.getCell(column));

      if (header && value != null) {
        premiumTotalsByInstitution[normalizeText(header)] = value * 1000;
      }
    }
  }

  if (balanceSheet) {
    const assetsRow = balanceSheet.getRow(10);

    for (let column = 5; column <= 16; column += 1) {
      const header = getCellText(balanceSheet, `${String.fromCharCode(64 + column)}9`) ?? "";
      const value = getNumericValue(assetsRow.getCell(column));

      if (header && value != null) {
        assetsByInstitution[normalizeText(header)] = value * 1000;
      }
    }
  }

  return {
    periodYearMonth: referencePeriod,
    premiumTotalsByInstitution,
    assetsByInstitution,
    sheetNames: workbook.worksheets.map((worksheet) => worksheet.name)
  };
}
