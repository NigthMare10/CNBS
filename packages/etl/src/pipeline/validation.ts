import { normalizeText } from "@cnbs/domain";
import type {
  ParsedFinancialPositionRow,
  ParsedIncomeStatementRow,
  ParsedPremiumRow,
  ParsedReferenceWorkbook
} from "../types";
import type { ValidationIssue, ValidationSummary } from "@cnbs/domain";

function summarizePublishability(issues: ValidationIssue[]): ValidationSummary["publishability"] {
  if (issues.some((issue) => issue.severity === "critical" || issue.severity === "high")) {
    return "blocked";
  }

  if (issues.some((issue) => issue.severity === "medium")) {
    return "warningOnly";
  }

  return "publishable";
}

export function validateParsedWorkbooks(input: {
  premiumRows?: ParsedPremiumRow[];
  financialPositionRows?: ParsedFinancialPositionRow[];
  incomeStatementRows?: ParsedIncomeStatementRow[];
  referenceWorkbook?: ParsedReferenceWorkbook | null;
}): ValidationSummary {
  const issues: ValidationIssue[] = [];
  const premiumRows = input.premiumRows ?? [];
  const financialRows = input.financialPositionRows ?? [];
  const incomeStatementRows = input.incomeStatementRows ?? [];
  const referenceWorkbook = input.referenceWorkbook ?? null;

  if (premiumRows.length === 0 && financialRows.length === 0) {
    issues.push({
      code: "NO_PRIMARY_SOURCE_PROVIDED",
      severity: "critical",
      status: "failed",
      scope: "ingestion",
      message: "At least one primary workbook must be provided: premiums or financial position."
    });
  }

  if (premiumRows.length === 0) {
    issues.push({
      code: "PREMIUM_SOURCE_NOT_PROVIDED",
      severity: "medium",
      status: "warning",
      scope: "premiums",
      message: "Premium workbook not provided; premium-dependent views will be unavailable."
    });
  }

  if (financialRows.length === 0) {
    issues.push({
      code: "FINANCIAL_SOURCE_NOT_PROVIDED",
      severity: "medium",
      status: "warning",
      scope: "financialPosition",
      message: "Financial position workbook not provided; financial views will be unavailable."
    });
  }

  if (incomeStatementRows.length === 0) {
    issues.push({
      code: "INCOME_STATEMENT_SOURCE_NOT_PROVIDED",
      severity: "low",
      status: "warning",
      scope: "incomeStatement",
      message: "Income statement workbook not provided; this non-operational domain remains unavailable in public publication."
    });
  } else {
    issues.push({
      code: "INCOME_STATEMENT_DETECTED_NON_OPERATIONAL",
      severity: "low",
      status: "warning",
      scope: "incomeStatement",
      message: "Income statement workbook was detected, but current public publication policy only uses premiums and financial position as operational sources."
    });
  }

  const premiumPeriods = new Set(premiumRows.map((row) => String(row.reportDateRaw)));
  if (premiumPeriods.size > 1) {
    issues.push({
      code: "PREMIUM_MULTIPLE_PERIODS",
      severity: "high",
      status: "failed",
      scope: "premiums",
      message: "Premium workbook contains more than one report period."
    });
  }

  const financialPeriods = new Set(financialRows.map((row) => String(row.reportDateRaw)));
  if (financialPeriods.size > 1) {
    issues.push({
      code: "FINANCIAL_MULTIPLE_PERIODS",
      severity: "high",
      status: "failed",
      scope: "financialPosition",
      message: "Financial position workbook contains more than one report period."
    });
  }

  const incomePeriods = new Set(incomeStatementRows.map((row) => String(row.reportDateRaw)));
  if (incomePeriods.size > 1) {
    issues.push({
      code: "INCOME_STATEMENT_MULTIPLE_PERIODS",
      severity: "high",
      status: "failed",
      scope: "incomeStatement",
      message: "Income statement workbook contains more than one report period."
    });
  }

  const naturalKeys = new Set<string>();
  for (const row of premiumRows) {
    const naturalKey = [
      row.reportDateRaw,
      normalizeText(row.institutionCodeRaw),
      normalizeText(row.institutionNameRaw),
      normalizeText(row.ramoParentRaw),
      normalizeText(row.ramoRaw),
      normalizeText(row.currencyCodeRaw),
      normalizeText(row.currencyNameRaw)
    ].join("|");

    if (naturalKeys.has(naturalKey)) {
      issues.push({
        code: "PREMIUM_DUPLICATE_NATURAL_KEY",
        severity: "critical",
        status: "failed",
        scope: `premiums:row:${row.rowNumber}`,
        message: "Duplicate natural key detected in premium workbook."
      });
    }

    naturalKeys.add(naturalKey);
  }

  const hasTotalAssets = financialRows.some(
    (row) => normalizeText(row.accountRaw) === "TOTAL ACTIVOS"
  );

  if (financialRows.length > 0 && !hasTotalAssets) {
    issues.push({
      code: "FINANCIAL_TOTAL_ASSETS_MISSING",
      severity: "critical",
      status: "failed",
      scope: "financialPosition",
      message: "Financial position workbook does not contain TOTAL ACTIVOS."
    });
  }

  const incomeStatementSignals = ["UTILIDAD", "RESULTADO NETO", "INGRESOS FINANCIEROS", "GASTOS", "PRIMAS"];
  const hasIncomeStatementMarkers = incomeStatementRows.some((row) =>
    incomeStatementSignals.some((signal) => normalizeText(row.accountRaw).includes(signal))
  );

  if (incomeStatementRows.length > 0 && !hasIncomeStatementMarkers) {
    issues.push({
      code: "INCOME_STATEMENT_MARKERS_MISSING",
      severity: "high",
      status: "failed",
      scope: "incomeStatement",
      message: "Income statement workbook does not contain expected income statement accounts."
    });
  }

  if (!referenceWorkbook) {
    issues.push({
      code: "REFERENCE_WORKBOOK_NOT_PROVIDED",
      severity: "low",
      status: "warning",
      scope: "reference",
      message: "Reference workbook not provided; reconciliations will be skipped or reduced."
    });
  } else if (!referenceWorkbook.sheetNames.includes("Ranking del Sistema")) {
    issues.push({
      code: "REFERENCE_RANKING_MISSING",
      severity: "medium",
      status: "warning",
      scope: "reference",
      message: "Reference workbook is missing Ranking del Sistema sheet."
    });
  }

  return {
    publishability: summarizePublishability(issues),
    issues
  };
}
