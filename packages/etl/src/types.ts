import type {
  DatasetVersionRecord,
  FinancialPositionFact,
  Institution,
  InsuranceLine,
  PremiumFact,
  ReconciliationSummary,
  SourceFileRecord,
  ValidationSummary,
  WorkbookKind
} from "@cnbs/domain";

export interface UploadedWorkbookInput {
  filePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface WorkbookDetectionResult {
  kind: WorkbookKind;
  signature: string;
  sheetNames: string[];
}

export interface ParsedPremiumRow {
  rowNumber: number;
  reportDateRaw: string | number | Date;
  institutionCodeRaw: string;
  institutionNameRaw: string;
  ramoParentRaw: string;
  ramoRaw: string;
  currencyCodeRaw: string;
  currencyNameRaw: string;
  amountRaw: string | number;
}

export interface ParsedFinancialPositionRow {
  rowNumber: number;
  reportDateRaw: string | number | Date;
  typeRaw: string;
  institutionCodeRaw: string;
  institutionNameRaw: string;
  lineNumberRaw: string | number;
  accountRaw: string;
  amountNationalRaw: string | number;
  amountForeignRaw: string | number;
}

export interface ParsedReferenceWorkbook {
  periodYearMonth: string | null;
  premiumTotalsByInstitution: Record<string, number>;
  assetsByInstitution: Record<string, number>;
  sheetNames: string[];
}

export interface CanonicalDatasetArtifacts {
  institutions: Institution[];
  insuranceLines: InsuranceLine[];
  financialAccounts: Array<{ accountId: string; lineNumber: number; canonicalName: string; statementType: "financialPosition"; sortOrder: number }>;
  premiumFacts: PremiumFact[];
  financialPositionFacts: FinancialPositionFact[];
  executiveKpis: Array<{ key: string; label: string; value: number; unit: "currency" | "count" | "ratio" }>;
  premiumsByInstitution: Array<Record<string, unknown>>;
  premiumsByLine: Array<Record<string, unknown>>;
  financialHighlightsByInstitution: Array<Record<string, unknown>>;
  rankings: Record<string, unknown>;
  institutionDetails: Record<string, Record<string, unknown>>;
}

export interface StagedIngestionRun {
  ingestionRunId: string;
  createdAt: string;
  uploadedBy: string;
  sourceFiles: SourceFileRecord[];
  validationSummary: ValidationSummary;
  reconciliationSummary: ReconciliationSummary;
  draftDatasetVersion: DatasetVersionRecord;
  artifacts: CanonicalDatasetArtifacts;
}
