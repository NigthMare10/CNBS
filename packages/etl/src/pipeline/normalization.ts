import {
  financialAccountsCatalog,
  insuranceLinesCatalog,
  institutionsCatalog,
  resolveFinancialAccount,
  resolveInstitution,
  resolveInsuranceLine
} from "@cnbs/domain";
import type {
  BusinessPeriod,
  FinancialPositionFact,
  PremiumFact,
  SourceFileRecord,
  ValidationIssue
} from "@cnbs/domain";
import type { ParsedFinancialPositionRow, ParsedPremiumRow } from "../types";

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

export function normalizePremiumFacts(input: {
  datasetVersionId: string;
  sourceFile: SourceFileRecord;
  rows: ParsedPremiumRow[];
}): { facts: PremiumFact[]; period: BusinessPeriod | undefined; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const period = input.rows[0] ? parseExcelSerialDate(input.rows[0].reportDateRaw) : undefined;
  const facts: PremiumFact[] = [];

  for (const row of input.rows) {
    const institution = resolveInstitution(row.institutionNameRaw);
    const ramoParent = resolveInsuranceLine(row.ramoParentRaw);
    const ramo = resolveInsuranceLine(row.ramoRaw);

    if (!institution) {
      issues.push({
        code: "INSTITUTION_ALIAS_UNRESOLVED",
        severity: "high",
        status: "failed",
        scope: `premiums:row:${row.rowNumber}`,
        message: `Unable to resolve institution ${row.institutionNameRaw}.`
      });
      continue;
    }

    if (!ramoParent || !ramo) {
      issues.push({
        code: "INSURANCE_LINE_ALIAS_UNRESOLVED",
        severity: "high",
        status: "failed",
        scope: `premiums:row:${row.rowNumber}`,
        message: `Unable to resolve ramo mapping for ${row.ramoParentRaw} / ${row.ramoRaw}.`
      });
      continue;
    }

    facts.push({
      datasetVersionId: input.datasetVersionId,
      period: period?.reportDate ?? "",
      institutionId: institution.institutionId,
      institutionCode: institution.canonicalCode,
      ramoParentId: ramoParent.lineId,
      ramoId: ramo.lineId,
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
}): { facts: FinancialPositionFact[]; period: BusinessPeriod | undefined; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const period = input.rows[0] ? parseExcelSerialDate(input.rows[0].reportDateRaw) : undefined;
  const facts: FinancialPositionFact[] = [];

  for (const row of input.rows) {
    const institution = resolveInstitution(row.institutionNameRaw);
    const account = resolveFinancialAccount(row.accountRaw);

    if (!institution) {
      issues.push({
        code: "FINANCIAL_INSTITUTION_ALIAS_UNRESOLVED",
        severity: "high",
        status: "failed",
        scope: `financialPosition:row:${row.rowNumber}`,
        message: `Unable to resolve institution ${row.institutionNameRaw}.`
      });
      continue;
    }

    if (!account) {
      issues.push({
        code: "FINANCIAL_ACCOUNT_ALIAS_UNRESOLVED",
        severity: "high",
        status: "failed",
        scope: `financialPosition:row:${row.rowNumber}`,
        message: `Unable to resolve account ${row.accountRaw}.`
      });
      continue;
    }

    const amountNational = numberValue(row.amountNationalRaw);
    const amountForeign = numberValue(row.amountForeignRaw);

    facts.push({
      datasetVersionId: input.datasetVersionId,
      period: period?.reportDate ?? "",
      institutionId: institution.institutionId,
      institutionCode: institution.canonicalCode,
      accountId: account.accountId,
      lineNumber: account.lineNumber,
      amountNational,
      amountForeign,
      amountCombined: amountNational + amountForeign,
      sourceFileId: input.sourceFile.sourceFileId,
      sourceRowNumber: row.rowNumber
    });
  }

  return { facts, period, issues };
}

export function canonicalCatalogs() {
  return {
    institutions: institutionsCatalog,
    insuranceLines: insuranceLinesCatalog,
    financialAccounts: financialAccountsCatalog
  };
}
