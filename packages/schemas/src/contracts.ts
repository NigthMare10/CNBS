import { z } from "zod";

export const workbookKindSchema = z.enum(["premiums", "financialPosition", "incomeStatement", "reference", "unknown"]);
export const validationSeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export const validationStatusSchema = z.enum(["passed", "warning", "failed"]);
export const publishabilitySchema = z.enum(["publishable", "blocked", "warningOnly"]);
export const datasetScopeSchema = z.enum([
  "premiums-only",
  "financial-only",
  "income-statement-only",
  "premiums-financial",
  "premiums-income-statement",
  "financial-income-statement",
  "full-core",
  "empty"
]);

export const businessPeriodSchema = z.object({
  reportDate: z.string(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  yearMonth: z.string(),
  excelSerial: z.union([z.number(), z.undefined()])
});

export const sourceFileRecordSchema = z.object({
  sourceFileId: z.string(),
  kind: workbookKindSchema,
  originalFilename: z.string(),
  storedFilename: z.string(),
  sha256: z.string(),
  sizeBytes: z.number().nonnegative(),
  mimeType: z.string(),
  detectedSignature: z.string(),
  uploadedAt: z.string()
});

export const validationIssueSchema = z.object({
  code: z.string(),
  severity: validationSeveritySchema,
  status: validationStatusSchema,
  scope: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional()
});

export const validationSummarySchema = z.object({
  publishability: publishabilitySchema,
  issues: z.array(validationIssueSchema)
});

export const reconciliationIssueSchema = z.object({
  ruleId: z.string(),
  severity: validationSeveritySchema,
  scope: z.string(),
  status: validationStatusSchema,
  expectedValue: z.union([z.string(), z.number(), z.null()]),
  actualValue: z.union([z.string(), z.number(), z.null()]),
  differenceAbsolute: z.number().nullable(),
  differenceRelative: z.number().nullable(),
  toleranceAbsolute: z.number().nullable(),
  toleranceRelative: z.number().nullable(),
  message: z.string()
});

export const reconciliationSummarySchema = z.object({
  publishability: publishabilitySchema,
  issues: z.array(reconciliationIssueSchema)
});

export const datasetVersionRecordSchema = z.object({
  datasetVersionId: z.string(),
  ingestionRunId: z.string().nullable(),
  status: z.enum(["staged", "published", "failed", "rolledBack"]),
  createdAt: z.string(),
  publishedAt: z.string().nullable(),
  uploadedBy: z.string(),
  sourceFiles: z.array(sourceFileRecordSchema),
  businessPeriods: z.object({
    premiums: z.union([businessPeriodSchema, z.undefined()]),
    financialPosition: z.union([businessPeriodSchema, z.undefined()]),
    incomeStatement: z.union([businessPeriodSchema, z.undefined()]),
    reference: z.union([businessPeriodSchema, z.undefined()])
  }),
  datasetScope: datasetScopeSchema,
  domainAvailability: z.object({
    premiums: z.object({
      sourceProvided: z.boolean(),
      records: z.number().int().nonnegative(),
      publishable: z.boolean(),
      missingReason: z.union([z.string(), z.undefined()])
    }),
    financialPosition: z.object({
      sourceProvided: z.boolean(),
      records: z.number().int().nonnegative(),
      publishable: z.boolean(),
      missingReason: z.union([z.string(), z.undefined()])
    }),
    claims: z.object({
      sourceProvided: z.boolean(),
      records: z.number().int().nonnegative(),
      publishable: z.boolean(),
      missingReason: z.union([z.string(), z.undefined()])
    }),
    incomeStatement: z.object({
      sourceProvided: z.boolean(),
      records: z.number().int().nonnegative(),
      publishable: z.boolean(),
      missingReason: z.union([z.string(), z.undefined()])
    }),
    reference: z.object({
      sourceProvided: z.boolean(),
      records: z.number().int().nonnegative(),
      publishable: z.boolean(),
      missingReason: z.union([z.string(), z.undefined()])
    })
  }),
  fingerprint: z.string(),
  validationSummary: validationSummarySchema,
  reconciliationSummary: reconciliationSummarySchema
});

export const activeDatasetPointerSchema = z.object({
  datasetVersionId: z.string().nullable(),
  updatedAt: z.string().nullable()
});
