import { z } from "zod";

export const premiumRowSchema = z.object({
  "Fecha Reporte": z.union([z.string(), z.number(), z.date()]),
  CodInstitucion: z.union([z.string(), z.number()]),
  Institucion: z.string(),
  RamoPadre: z.string(),
  Ramo: z.string(),
  CodMoneda: z.union([z.string(), z.number()]),
  Moneda: z.string(),
  Saldo: z.union([z.string(), z.number()])
});

export const financialPositionRowSchema = z.object({
  Tipo: z.union([z.string(), z.number()]),
  Inst: z.union([z.string(), z.number()]),
  Logo: z.string(),
  FechaReporte: z.union([z.string(), z.number(), z.date()]),
  Linea: z.union([z.string(), z.number()]),
  Cuenta: z.string(),
  MonedaNacional: z.union([z.string(), z.number()]),
  MonedaExtranjera: z.union([z.string(), z.number()])
});
