import ExcelJS from "exceljs";

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

export function worksheetToRecords(worksheet: ExcelJS.Worksheet): Array<Record<string, unknown>> {
  const headerRow = worksheet.getRow(1);
  const rawValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
  const headers = rawValues.map((value: ExcelJS.CellValue) => cellValueToText(value).trim());
  const records: Array<Record<string, unknown>> = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const record: Record<string, unknown> = { __rowNumber: rowNumber };

    headers.forEach((header: string, index: number) => {
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
