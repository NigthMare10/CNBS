import { z } from "zod";

export const institutionSchema = z.object({
  institutionId: z.string(),
  canonicalCode: z.string(),
  canonicalName: z.string(),
  displayName: z.string(),
  shortName: z.string(),
  active: z.boolean()
});

export const insuranceLineSchema = z.object({
  lineId: z.string(),
  canonicalName: z.string(),
  displayName: z.string(),
  parentLineId: z.string().nullable(),
  sortOrder: z.number().int()
});

export const financialAccountSchema = z.object({
  accountId: z.string(),
  lineNumber: z.number().int(),
  canonicalName: z.string(),
  statementType: z.literal("financialPosition"),
  sortOrder: z.number().int()
});

export const currencySchema = z.object({
  currencyId: z.string(),
  code: z.string(),
  name: z.string(),
  kind: z.enum(["national", "foreign", "mixed"])
});

export const metricDefinitionSchema = z.object({
  metricId: z.string(),
  name: z.string(),
  domain: z.enum(["premiums", "financialPosition", "dataset"]),
  unit: z.enum(["currency", "count", "ratio"]),
  publicationPolicy: z.enum(["official", "derived", "blocked"])
});

export const premiumFactSchema = z.object({
  datasetVersionId: z.string(),
  period: z.string(),
  institutionId: z.string(),
  institutionCode: z.string(),
  ramoParentId: z.string(),
  ramoId: z.string(),
  currencyCode: z.string(),
  amount: z.number(),
  sourceFileId: z.string(),
  sourceRowNumber: z.number().int()
});

export const financialPositionFactSchema = z.object({
  datasetVersionId: z.string(),
  period: z.string(),
  institutionId: z.string(),
  institutionCode: z.string(),
  accountId: z.string(),
  lineNumber: z.number().int(),
  amountNational: z.number(),
  amountForeign: z.number(),
  amountCombined: z.number(),
  sourceFileId: z.string(),
  sourceRowNumber: z.number().int()
});

export const executiveKpiSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  unit: z.enum(["currency", "count", "ratio"])
});
