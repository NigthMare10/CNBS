import { financialPositionRowSchema } from "@cnbs/schemas";
import type { ParsedFinancialPositionRow } from "../types";
import { readWorkbook, worksheetToRecords } from "./excel";

export async function parseFinancialPositionWorkbook(
  filePath: string
): Promise<ParsedFinancialPositionRow[]> {
  const workbook = await readWorkbook(filePath);
  const worksheet = workbook.getWorksheet("Datos");

  if (!worksheet) {
    throw new Error("Financial position workbook missing Datos sheet.");
  }

  return worksheetToRecords(worksheet).map((record) => {
    const parsed = financialPositionRowSchema.parse(record);

    return {
      rowNumber: Number(record.__rowNumber),
      reportDateRaw: parsed.FechaReporte,
      typeRaw: String(parsed.Tipo),
      institutionCodeRaw: String(parsed.Inst),
      institutionNameRaw: parsed.Logo,
      lineNumberRaw: parsed.Linea,
      accountRaw: parsed.Cuenta,
      amountNationalRaw: parsed.MonedaNacional,
      amountForeignRaw: parsed.MonedaExtranjera
    } satisfies ParsedFinancialPositionRow;
  });
}
