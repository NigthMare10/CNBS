import { premiumRowSchema } from "@cnbs/schemas";
import type { ParsedPremiumRow } from "../types";
import { readWorkbook, worksheetToRecords } from "./excel";

export async function parsePremiumWorkbook(filePath: string): Promise<ParsedPremiumRow[]> {
  const workbook = await readWorkbook(filePath);
  const worksheet = workbook.getWorksheet("Datos");

  if (!worksheet) {
    throw new Error("Premium workbook missing Datos sheet.");
  }

  return worksheetToRecords(worksheet).map((record) => {
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
