export type WorkbookKind = "premiums" | "financialPosition" | "incomeStatement" | "reference" | "unknown";

export type ValidationSeverity = "critical" | "high" | "medium" | "low";

export type ValidationStatus = "passed" | "warning" | "failed";

export type DatasetStatus = "staged" | "published" | "failed" | "rolledBack";

export type Publishability = "publishable" | "blocked" | "warningOnly";
export type DatasetScope =
  | "premiums-only"
  | "financial-only"
  | "income-statement-only"
  | "premiums-financial"
  | "premiums-income-statement"
  | "financial-income-statement"
  | "full-core"
  | "empty";

export interface BusinessPeriod {
  reportDate: string;
  year: number;
  month: number;
  yearMonth: string;
  excelSerial: number | undefined;
}

export interface SourceFileRecord {
  sourceFileId: string;
  kind: WorkbookKind;
  originalFilename: string;
  storedFilename: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  detectedSignature: string;
  uploadedAt: string;
}

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  status: ValidationStatus;
  scope: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationSummary {
  publishability: Publishability;
  issues: ValidationIssue[];
}

export interface ReconciliationIssue {
  ruleId: string;
  severity: ValidationSeverity;
  scope: string;
  status: ValidationStatus;
  expectedValue: number | string | null;
  actualValue: number | string | null;
  differenceAbsolute: number | null;
  differenceRelative: number | null;
  toleranceAbsolute: number | null;
  toleranceRelative: number | null;
  message: string;
}

export interface ReconciliationSummary {
  publishability: Publishability;
  issues: ReconciliationIssue[];
}

export type AliasResolutionDomain = "institution" | "insuranceLine" | "financialAccount";

export type AliasResolutionStrategy =
  | "direct-alias"
  | "direct-canonical"
  | "normalized-alias"
  | "normalized-canonical"
  | "line-number-fallback"
  | "unresolved"
  | "ambiguous";

export interface MappingDomainSummary {
  totalAttempts: number;
  repairedByNormalization: number;
  aliasesMatched: number;
  fallbackByLineNumber: number;
  ambiguousAliases: number;
  unresolvedAliases: number;
  textsRequiringMojibakeRepair: number;
  aliasesResolvedAfterNormalization: number;
  aliasesResolvedByDirectAlias: number;
}

export interface TextQualitySummary {
  textsRequiringMojibakeRepair: number;
  aliasesResolvedAfterNormalization: number;
  aliasesResolvedByDirectAlias: number;
  aliasesResolvedByLineNumberFallback: number;
  ambiguousAliases: number;
  unresolvedAliases: number;
}

export interface TopAliasRepair {
  domain: AliasResolutionDomain;
  originalValue: string;
  repairedValue: string;
  normalizedValue: string;
  canonicalId: string;
  canonicalName: string;
  strategy: Extract<AliasResolutionStrategy, "normalized-alias" | "normalized-canonical">;
  count: number;
}

export interface AliasResolutionExample {
  domain: AliasResolutionDomain;
  scope: string;
  originalValue: string;
  repairedValue: string;
  normalizedValue: string;
  canonicalId: string | null;
  canonicalName: string | null;
  strategy: AliasResolutionStrategy;
  lineNumber: number | null;
  usedMojibakeRepair: boolean;
  requiredNormalization: boolean;
  candidateIds: string[];
  candidateNames: string[];
  ambiguityReason: string | null;
}

export interface MappingSummary {
  repairedByNormalization: number;
  aliasesMatched: number;
  lineNumberFallback: number;
  fallbackByLineNumber: number;
  unresolved: number;
  unresolvedAliases: number;
  ambiguousAliases: number;
  totalAttempts: number;
  textQuality: TextQualitySummary;
  domains: Record<AliasResolutionDomain, MappingDomainSummary>;
  topAliasRepairs: TopAliasRepair[];
  resolvedExamples: AliasResolutionExample[];
  ambiguousExamples: AliasResolutionExample[];
  unresolvedExamples: AliasResolutionExample[];
}

export interface DatasetVersionRecord {
  datasetVersionId: string;
  ingestionRunId: string | null;
  status: DatasetStatus;
  createdAt: string;
  publishedAt: string | null;
  uploadedBy: string;
  sourceFiles: SourceFileRecord[];
  businessPeriods: {
    premiums: BusinessPeriod | undefined;
    financialPosition: BusinessPeriod | undefined;
    incomeStatement: BusinessPeriod | undefined;
    reference: BusinessPeriod | undefined;
  };
  datasetScope: DatasetScope;
  domainAvailability: {
    premiums: { sourceProvided: boolean; records: number; publishable: boolean; missingReason: string | undefined };
    financialPosition: { sourceProvided: boolean; records: number; publishable: boolean; missingReason: string | undefined };
    claims: { sourceProvided: boolean; records: number; publishable: boolean; missingReason: string | undefined };
    incomeStatement: { sourceProvided: boolean; records: number; publishable: boolean; missingReason: string | undefined };
    reference: { sourceProvided: boolean; records: number; publishable: boolean; missingReason: string | undefined };
  };
  fingerprint: string;
  mappingSummary?: MappingSummary;
  validationSummary: ValidationSummary;
  reconciliationSummary: ReconciliationSummary;
}

export interface AuditEvent {
  auditEventId: string;
  datasetVersionId: string | null;
  ingestionRunId: string | null;
  actor: string;
  action: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
