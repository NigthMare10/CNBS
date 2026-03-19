import {
  financialAccountsCatalog,
  insuranceLinesCatalog,
  institutionsCatalog,
  resolveFinancialAccountWithFallback,
  resolveInstitutionDetailed,
  resolveInsuranceLineDetailed,
  type AliasResolutionResult
} from "@cnbs/domain";
import type {
  BusinessPeriod,
  FinancialAccount,
  FinancialPositionFact,
  IncomeStatementFact,
  Institution,
  InsuranceLine,
  PremiumFact,
  SourceFileRecord,
  ValidationIssue
} from "@cnbs/domain";
import type { ParsedFinancialPositionRow, ParsedIncomeStatementRow, ParsedPremiumRow } from "../types";
import type { MappingResolutionEvent, MappingSummaryBuilder } from "./mapping-summary";
import { recordAliasResolution } from "./mapping-summary";

function parseExcelSerialDate(value: string | number | Date): BusinessPeriod {
  const date = value instanceof Date ? value : new Date(Math.round(((typeof value === "number" ? value : Number(value)) - 25569) * 86400 * 1000));
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  return {
    reportDate: date.toISOString().slice(0, 10),
    year,
    month,
    yearMonth: `${year}-${String(month).padStart(2, "0")}`,
    excelSerial: typeof value === "number" ? value : undefined
  };
}

function numberValue(input: string | number): number {
  return typeof input === "number" ? input : Number(input);
}

function lineNumberValue(input: string | number): number | undefined {
  const parsed = typeof input === "number" ? input : Number(input);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function recordResolution<T extends { canonicalName: string }>(
  builder: MappingSummaryBuilder | undefined,
  input: {
    domain: MappingResolutionEvent["domain"];
    scope: string;
    originalValue: string;
    resolution: AliasResolutionResult<T>;
    canonicalId: string | null;
    canonicalName: string | null;
    lineNumber?: number;
  }
): void {
  if (!builder) {
    return;
  }

  recordAliasResolution(builder, {
    domain: input.domain,
    scope: input.scope,
    originalValue: input.originalValue,
    repairedValue: input.resolution.repairedValue,
    normalizedValue: input.resolution.normalizedValue,
    canonicalId: input.canonicalId,
    canonicalName: input.canonicalName,
    strategy: input.resolution.strategy,
    lineNumber: input.lineNumber ?? null,
    usedMojibakeRepair: input.resolution.usedMojibakeRepair,
    requiredNormalization: input.resolution.requiredNormalization,
    candidateIds: input.resolution.candidateIds,
    candidateNames: input.resolution.candidateNames,
    ambiguityReason: input.resolution.ambiguityReason
  });
}

function aliasDetails<T extends { canonicalName: string }>(input: {
  originalKey: string;
  normalizedKey: string;
  repairedKey: string;
  originalValue: string;
  resolution: AliasResolutionResult<T>;
  lineNumber?: string | number;
  field?: string;
}): Record<string, unknown> {
  const details: Record<string, unknown> = {
    [input.originalKey]: input.originalValue,
    [input.repairedKey]: input.resolution.repairedValue,
    [input.normalizedKey]: input.resolution.normalizedValue,
    candidateCanonical: input.resolution.candidateNames[0] ?? null,
    candidateCanonicals: input.resolution.candidateNames,
    candidateIds: input.resolution.candidateIds,
    resolutionStrategy: input.resolution.strategy,
    ambiguity: input.resolution.ambiguityReason ?? (input.resolution.candidateNames.length > 0 ? "candidate-found-but-no-safe-resolution" : "no-candidate"),
    usedMojibakeRepair: input.resolution.usedMojibakeRepair,
    requiredNormalization: input.resolution.requiredNormalization
  };

  if (typeof input.lineNumber !== "undefined") {
    details.lineNumber = input.lineNumber;
  }
  if (input.field) {
    details.field = input.field;
  }

  return details;
}

function institutionIssue(scope: string, originalValue: string, resolution: AliasResolutionResult<Institution>, context: string): ValidationIssue {
  return {
    code: resolution.strategy === "ambiguous" ? `${context}_ALIAS_AMBIGUOUS` : `${context}_ALIAS_UNRESOLVED`,
    severity: "high",
    status: "failed",
    scope,
    message:
      resolution.strategy === "ambiguous"
        ? `Institution alias ${originalValue} is ambiguous.`
        : `Unable to resolve institution ${originalValue}.`,
    details: aliasDetails({
      originalKey: "originalInstitution",
      repairedKey: "repairedInstitution",
      normalizedKey: "normalizedInstitution",
      originalValue,
      resolution
    })
  };
}

function insuranceLineIssue(scope: string, originalValue: string, resolution: AliasResolutionResult<InsuranceLine>, field: "ramoParent" | "ramo"): ValidationIssue {
  return {
    code: resolution.strategy === "ambiguous" ? "INSURANCE_LINE_ALIAS_AMBIGUOUS" : "INSURANCE_LINE_ALIAS_UNRESOLVED",
    severity: "high",
    status: "failed",
    scope,
    message:
      resolution.strategy === "ambiguous"
        ? `Insurance line alias ${originalValue} is ambiguous.`
        : `Unable to resolve insurance line ${originalValue}.`,
    details: aliasDetails({
      originalKey: field === "ramoParent" ? "originalRamoParent" : "originalRamo",
      repairedKey: field === "ramoParent" ? "repairedRamoParent" : "repairedRamo",
      normalizedKey: field === "ramoParent" ? "normalizedRamoParent" : "normalizedRamo",
      originalValue,
      resolution,
      field
    })
  };
}

function financialAccountIssue(scope: string, originalValue: string, resolution: AliasResolutionResult<FinancialAccount>, lineNumberRaw: string | number): ValidationIssue {
  return {
    code: resolution.strategy === "ambiguous" ? "FINANCIAL_ACCOUNT_ALIAS_AMBIGUOUS" : "FINANCIAL_ACCOUNT_ALIAS_UNRESOLVED",
    severity: "high",
    status: "failed",
    scope,
    message:
      resolution.strategy === "ambiguous"
        ? `Financial account alias ${originalValue} is ambiguous.`
        : `Unable to resolve account ${originalValue}.`,
    details: aliasDetails({
      originalKey: "originalAccount",
      repairedKey: "repairedAccount",
      normalizedKey: "normalizedAccount",
      originalValue,
      resolution,
      lineNumber: lineNumberRaw
    })
  };
}

export function normalizePremiumFacts(input: {
  datasetVersionId: string;
  sourceFile: SourceFileRecord;
  rows: ParsedPremiumRow[];
  mappingSummaryBuilder?: MappingSummaryBuilder;
}): { facts: PremiumFact[]; period: BusinessPeriod | undefined; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const period = input.rows[0] ? parseExcelSerialDate(input.rows[0].reportDateRaw) : undefined;
  const facts: PremiumFact[] = [];

  for (const row of input.rows) {
    const institutionResolution = resolveInstitutionDetailed(row.institutionNameRaw);
    const ramoParentResolution = resolveInsuranceLineDetailed(row.ramoParentRaw);
    const ramoResolution = resolveInsuranceLineDetailed(row.ramoRaw);

    recordResolution(input.mappingSummaryBuilder, {
      domain: "institution",
      scope: `premiums:row:${row.rowNumber}:institution`,
      originalValue: row.institutionNameRaw,
      resolution: institutionResolution,
      canonicalId: institutionResolution.entity?.institutionId ?? null,
      canonicalName: institutionResolution.entity?.canonicalName ?? null
    });
    recordResolution(input.mappingSummaryBuilder, {
      domain: "insuranceLine",
      scope: `premiums:row:${row.rowNumber}:ramoParent`,
      originalValue: row.ramoParentRaw,
      resolution: ramoParentResolution,
      canonicalId: ramoParentResolution.entity?.lineId ?? null,
      canonicalName: ramoParentResolution.entity?.canonicalName ?? null
    });
    recordResolution(input.mappingSummaryBuilder, {
      domain: "insuranceLine",
      scope: `premiums:row:${row.rowNumber}:ramo`,
      originalValue: row.ramoRaw,
      resolution: ramoResolution,
      canonicalId: ramoResolution.entity?.lineId ?? null,
      canonicalName: ramoResolution.entity?.canonicalName ?? null
    });

    let rowFailed = false;
    if (!institutionResolution.entity) {
      issues.push(institutionIssue(`premiums:row:${row.rowNumber}:institution`, row.institutionNameRaw, institutionResolution, "INSTITUTION"));
      rowFailed = true;
    }

    if (!ramoParentResolution.entity) {
      issues.push(insuranceLineIssue(`premiums:row:${row.rowNumber}:ramoParent`, row.ramoParentRaw, ramoParentResolution, "ramoParent"));
      rowFailed = true;
    }

    if (!ramoResolution.entity) {
      issues.push(insuranceLineIssue(`premiums:row:${row.rowNumber}:ramo`, row.ramoRaw, ramoResolution, "ramo"));
      rowFailed = true;
    }

    if (rowFailed) {
      continue;
    }

    const institution = institutionResolution.entity;
    const ramoParent = ramoParentResolution.entity;
    const ramo = ramoResolution.entity;

    facts.push({
      datasetVersionId: input.datasetVersionId,
      period: period?.reportDate ?? "",
      institutionId: institution!.institutionId,
      institutionCode: institution!.canonicalCode,
      ramoParentId: ramoParent!.lineId,
      ramoId: ramo!.lineId,
      currencyCode: String(row.currencyCodeRaw),
      amount: numberValue(row.amountRaw),
      sourceFileId: input.sourceFile.sourceFileId,
      sourceRowNumber: row.rowNumber
    });
  }

  return { facts, period, issues };
}

export function normalizeFinancialPositionFacts(input: {
  datasetVersionId: string;
  sourceFile: SourceFileRecord;
  rows: ParsedFinancialPositionRow[];
  mappingSummaryBuilder?: MappingSummaryBuilder;
}): {
  facts: FinancialPositionFact[];
  period: BusinessPeriod | undefined;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const period = input.rows[0] ? parseExcelSerialDate(input.rows[0].reportDateRaw) : undefined;
  const facts: FinancialPositionFact[] = [];

  for (const row of input.rows) {
    const institutionResolution = resolveInstitutionDetailed(row.institutionNameRaw);
    const parsedLineNumber = lineNumberValue(row.lineNumberRaw);
    const accountResolution = resolveFinancialAccountWithFallback(row.accountRaw, parsedLineNumber);

    recordResolution(input.mappingSummaryBuilder, {
      domain: "institution",
      scope: `financialPosition:row:${row.rowNumber}:institution`,
      originalValue: row.institutionNameRaw,
      resolution: institutionResolution,
      canonicalId: institutionResolution.entity?.institutionId ?? null,
      canonicalName: institutionResolution.entity?.canonicalName ?? null
    });
    recordResolution(input.mappingSummaryBuilder, {
      domain: "financialAccount",
      scope: `financialPosition:row:${row.rowNumber}:account`,
      originalValue: row.accountRaw,
      resolution: accountResolution,
      canonicalId: accountResolution.entity?.accountId ?? null,
      canonicalName: accountResolution.entity?.canonicalName ?? null,
      ...(typeof parsedLineNumber === "number" ? { lineNumber: parsedLineNumber } : {})
    });

    let rowFailed = false;
    if (!institutionResolution.entity) {
      issues.push(institutionIssue(`financialPosition:row:${row.rowNumber}:institution`, row.institutionNameRaw, institutionResolution, "FINANCIAL_INSTITUTION"));
      rowFailed = true;
    }

    if (!accountResolution.entity) {
      issues.push(financialAccountIssue(`financialPosition:row:${row.rowNumber}:account`, row.accountRaw, accountResolution, row.lineNumberRaw));
      rowFailed = true;
    }

    if (rowFailed) {
      continue;
    }

    const institution = institutionResolution.entity;
    const account = accountResolution.entity;

    const amountNational = numberValue(row.amountNationalRaw);
    const amountForeign = numberValue(row.amountForeignRaw);

    facts.push({
      datasetVersionId: input.datasetVersionId,
      period: period?.reportDate ?? "",
      institutionId: institution!.institutionId,
      institutionCode: institution!.canonicalCode,
      accountId: account!.accountId,
      lineNumber: account!.lineNumber,
      amountNational,
      amountForeign,
      amountCombined: amountNational + amountForeign,
      sourceFileId: input.sourceFile.sourceFileId,
      sourceRowNumber: row.rowNumber
    });
  }

  return { facts, period, issues };
}

export function normalizeIncomeStatementRows(input: {
  datasetVersionId: string;
  sourceFile: SourceFileRecord;
  rows: ParsedIncomeStatementRow[];
}): { facts: IncomeStatementFact[]; period: BusinessPeriod | undefined; issues: ValidationIssue[]; records: number } {
  const issues: ValidationIssue[] = [];
  const period = input.rows[0] ? parseExcelSerialDate(input.rows[0].reportDateRaw) : undefined;
  const facts: IncomeStatementFact[] = [];

  function semanticCategory(accountRaw: string): IncomeStatementFact["semanticCategory"] {
    const account = accountRaw.toUpperCase();
    if (account.includes("RESULTADO NETO") || account.includes("UTILIDAD")) {
      return "netIncome";
    }
    if (account.includes("PRIMAS RETENIDAS")) {
      return "retainedPremiums";
    }
    if (account.includes("INGRESOS FINANCIEROS")) {
      return "financialIncome";
    }
    if (account.includes("GASTO") || account.includes("EGRESO")) {
      return "expenses";
    }
    return "other";
  }

  for (const row of input.rows) {
    const institutionResolution = resolveInstitutionDetailed(row.institutionNameRaw);
    if (!institutionResolution.entity) {
      issues.push(institutionIssue(`incomeStatement:row:${row.rowNumber}:institution`, row.institutionNameRaw, institutionResolution, "INCOME_STATEMENT_INSTITUTION"));
      continue;
    }

    const amountNational = numberValue(row.amountNationalRaw);
    const amountForeign = numberValue(row.amountForeignRaw);
    facts.push({
      datasetVersionId: input.datasetVersionId,
      period: period?.reportDate ?? "",
      institutionId: institutionResolution.entity.institutionId,
      institutionCode: institutionResolution.entity.canonicalCode,
      accountName: row.accountRaw,
      semanticCategory: semanticCategory(row.accountRaw),
      amountNational,
      amountForeign,
      amountCombined: amountNational + amountForeign,
      sourceFileId: input.sourceFile.sourceFileId,
      sourceRowNumber: row.rowNumber
    });
  }

  return { facts, period, issues, records: input.rows.length };
}

export function canonicalCatalogs() {
  return {
    institutions: institutionsCatalog,
    insuranceLines: insuranceLinesCatalog,
    financialAccounts: financialAccountsCatalog
  };
}
