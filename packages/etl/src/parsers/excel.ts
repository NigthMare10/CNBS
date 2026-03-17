import ExcelJS from "exceljs";
import { normalizeText } from "@cnbs/domain";

export interface HeaderAliasConfig {
  requiredColumns: string[];
  aliases: Record<string, string[]>;
  preferredSheetNames?: string[];
}

function normalizeKey(value: string): string {
  return normalizeText(value)
    .replace(/[.,;:()\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAliasIndex(aliases: Record<string, string[]>) {
  const index = new Map<string, string>();
  for (const [canonical, values] of Object.entries(aliases)) {
    index.set(normalizeKey(canonical), canonical);
    for (const value of values) {
      index.set(normalizeKey(value), canonical);
    }
  }
  return index;
}

function cellValueToText(value: ExcelJS.CellValue): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && "result" in value) {
    const result = value.result;
    return typeof result === "string" || typeof result === "number" || typeof result === "boolean"
      ? String(result)
      : result instanceof Date
        ? result.toISOString()
        : "";
  }

  return "";
}

export async function readWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

export function sheetNameMatches(sheetName: string, expectedNames: string[]): boolean {
  const normalized = normalizeKey(sheetName);
  return expectedNames.some((expected) => normalized.includes(normalizeKey(expected)));
}

export function canonicalHeadersForWorksheet(
  worksheet: ExcelJS.Worksheet,
  config: HeaderAliasConfig
): { headers: string[]; canonicalHeaders: string[] } {
  const headerRow = worksheet.getRow(1);
  const rawValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
  const headers = rawValues.map((value: ExcelJS.CellValue) => cellValueToText(value).trim());
  const aliasIndex = buildAliasIndex(config.aliases);
  const canonicalHeaders = headers.map((header) => aliasIndex.get(normalizeKey(header)) ?? header);

  return { headers, canonicalHeaders };
}

export function findWorksheetByHeaders(
  workbook: ExcelJS.Workbook,
  config: HeaderAliasConfig
): ExcelJS.Worksheet | null {
  const preferred = config.preferredSheetNames ?? [];
  const worksheets = [...workbook.worksheets].sort((left, right) => {
    const leftPreferred = preferred.length > 0 && sheetNameMatches(left.name, preferred);
    const rightPreferred = preferred.length > 0 && sheetNameMatches(right.name, preferred);
    return Number(rightPreferred) - Number(leftPreferred);
  });

  for (const worksheet of worksheets) {
    const { canonicalHeaders } = canonicalHeadersForWorksheet(worksheet, config);
    const headerSet = new Set(canonicalHeaders);
    const allRequired = config.requiredColumns.every((column) => headerSet.has(column));
    if (allRequired) {
      return worksheet;
    }
  }

  return null;
}

export function worksheetToRecords(
  worksheet: ExcelJS.Worksheet,
  config?: Pick<HeaderAliasConfig, "aliases">
): Array<Record<string, unknown>> {
  const headerRow = worksheet.getRow(1);
  const rawValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
  const headers = rawValues.map((value: ExcelJS.CellValue) => cellValueToText(value).trim());
  const aliasIndex = config ? buildAliasIndex(config.aliases) : null;
  const effectiveHeaders = headers.map((header) => aliasIndex?.get(normalizeKey(header)) ?? header);
  const records: Array<Record<string, unknown>> = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const record: Record<string, unknown> = { __rowNumber: rowNumber };

    effectiveHeaders.forEach((header: string, index: number) => {
      if (!header) {
        return;
      }

      const cellValue = row.getCell(index + 1).value;
      const normalizedCellValue = typeof cellValue === "object" && cellValue !== null && "result" in cellValue
        ? cellValue.result
        : cellValue;

      record[header] = normalizedCellValue ?? null;
    });

    const hasData = Object.entries(record)
      .filter(([key]) => key !== "__rowNumber")
      .some(([, value]) => value !== null && value !== "");

    if (hasData) {
      records.push(record);
    }
  });

  return records;
}
