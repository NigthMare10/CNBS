import { premiumRowSchema } from "@cnbs/schemas";
import type { ParsedPremiumRow } from "../types";
import { findWorksheetByHeaders, readWorkbook, worksheetToRecords } from "./excel";
import { premiumHeaderConfig } from "../workbooks/signatures";

export async function parsePremiumWorkbook(filePath: string): Promise<ParsedPremiumRow[]> {
  const workbook = await readWorkbook(filePath);
  const worksheet = findWorksheetByHeaders(workbook, premiumHeaderConfig);

  if (!worksheet) {
    throw new Error("Premium workbook does not expose a recognizable tabular sheet.");
  }

  return worksheetToRecords(worksheet, { aliases: premiumHeaderConfig.aliases }).map((record) => {
    const parsed = premiumRowSchema.parse(record);

    return {
      rowNumber: Number(record.__rowNumber),
      reportDateRaw: parsed["Fecha Reporte"],
      institutionCodeRaw: String(parsed.CodInstitucion),
      institutionNameRaw: parsed.Institucion,
      ramoParentRaw: parsed.RamoPadre,
      ramoRaw: parsed.Ramo,
      currencyCodeRaw: String(parsed.CodMoneda),
      currencyNameRaw: parsed.Moneda,
      amountRaw: parsed.Saldo
    } satisfies ParsedPremiumRow;
  });
}
