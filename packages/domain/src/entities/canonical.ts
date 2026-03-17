import type { WorkbookKind } from "./core";

export interface Institution {
  institutionId: string;
  canonicalCode: string;
  canonicalName: string;
  displayName: string;
  shortName: string;
  active: boolean;
}

export interface InstitutionAlias {
  alias: string;
  institutionId: string;
  source: WorkbookKind | "dictionary";
}

export interface InsuranceLine {
  lineId: string;
  canonicalName: string;
  displayName: string;
  parentLineId: string | null;
  sortOrder: number;
}

export interface InsuranceLineAlias {
  alias: string;
  lineId: string;
  source: WorkbookKind | "dictionary";
}

export interface FinancialAccount {
  accountId: string;
  lineNumber: number;
  canonicalName: string;
  statementType: "financialPosition";
  sortOrder: number;
}

export interface FinancialAccountAlias {
  alias: string;
  accountId: string;
  source: WorkbookKind | "dictionary";
}

export interface MetricDefinition {
  metricId: string;
  name: string;
  domain: "premiums" | "financialPosition" | "dataset";
  unit: "currency" | "count" | "ratio";
  publicationPolicy: "official" | "derived" | "blocked";
}

export interface PremiumFact {
  datasetVersionId: string;
  period: string;
  institutionId: string;
  institutionCode: string;
  ramoParentId: string;
  ramoId: string;
  currencyCode: string;
  amount: number;
  sourceFileId: string;
  sourceRowNumber: number;
}

export interface FinancialPositionFact {
  datasetVersionId: string;
  period: string;
  institutionId: string;
  institutionCode: string;
  accountId: string;
  lineNumber: number;
  amountNational: number;
  amountForeign: number;
  amountCombined: number;
  sourceFileId: string;
  sourceRowNumber: number;
}

export interface ExecutiveKpi {
  key: string;
  label: string;
  value: number;
  unit: "currency" | "count" | "ratio";
}
