import { financialPositionRowSchema } from "@cnbs/schemas";
import type { ParsedIncomeStatementRow } from "../types";
import { findWorksheetByHeaders, readWorkbook, worksheetToRecords } from "./excel";
import { tabularFinancialHeaderConfig } from "../workbooks/signatures";

export async function parseIncomeStatementWorkbook(filePath: string): Promise<ParsedIncomeStatementRow[]> {
  const workbook = await readWorkbook(filePath);
  const worksheet = findWorksheetByHeaders(workbook, tabularFinancialHeaderConfig);

  if (!worksheet) {
    throw new Error("Income statement workbook does not expose a recognizable tabular sheet.");
  }

  return worksheetToRecords(worksheet, { aliases: tabularFinancialHeaderConfig.aliases }).map((record) => {
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
    } satisfies ParsedIncomeStatementRow;
  });
}
