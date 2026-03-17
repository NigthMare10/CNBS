import { normalizeText } from "@cnbs/domain";
import type { BusinessPeriod, ReconciliationIssue, ReconciliationSummary } from "@cnbs/domain";
import type { FinancialPositionFact, PremiumFact } from "@cnbs/domain";
import type { ParsedReferenceWorkbook } from "../types";

function summarizePublishability(issues: ReconciliationIssue[]): ReconciliationSummary["publishability"] {
  if (issues.some((issue) => issue.severity === "critical")) {
    return "blocked";
  }

  if (issues.some((issue) => issue.severity === "high" || issue.severity === "medium")) {
    return "warningOnly";
  }

  return "publishable";
}

function addIssue(
  issues: ReconciliationIssue[],
  issue: ReconciliationIssue
): void {
  issues.push(issue);
}

function sumByInstitutionPremiums(facts: PremiumFact[]): Record<string, number> {
  return facts.reduce<Record<string, number>>((accumulator, fact) => {
    accumulator[fact.institutionId] = (accumulator[fact.institutionId] ?? 0) + fact.amount;
    return accumulator;
  }, {});
}

function totalAssetsByInstitution(facts: FinancialPositionFact[]): Record<string, number> {
  return facts
    .filter((fact) => fact.accountId === "total-activos")
    .reduce<Record<string, number>>((accumulator, fact) => {
      accumulator[fact.institutionId] = fact.amountCombined;
      return accumulator;
    }, {});
}

export function reconcileAgainstReference(input: {
  premiumFacts: PremiumFact[];
  financialPositionFacts: FinancialPositionFact[];
  premiumPeriod: BusinessPeriod | undefined;
  financialPeriod: BusinessPeriod | undefined;
  reference: ParsedReferenceWorkbook | null;
  institutionNameById: Record<string, string>;
}): ReconciliationSummary {
  const issues: ReconciliationIssue[] = [];

  if (!input.reference) {
    addIssue(issues, {
      ruleId: "REFERENCE_NOT_PROVIDED",
      severity: "low",
      scope: "reference",
      status: "warning",
      expectedValue: null,
      actualValue: null,
      differenceAbsolute: null,
      differenceRelative: null,
      toleranceAbsolute: null,
      toleranceRelative: null,
      message: "Reference workbook not provided; reconciliation was skipped."
    });

    return {
      publishability: summarizePublishability(issues),
      issues
    };
  }

  if (input.premiumFacts.length === 0 && input.financialPositionFacts.length === 0) {
    return {
      publishability: summarizePublishability(issues),
      issues
    };
  }

  if (input.reference.periodYearMonth && input.premiumPeriod && input.reference.periodYearMonth !== input.premiumPeriod.yearMonth) {
    addIssue(issues, {
      ruleId: "PERIOD_MISMATCH_PREMIUM_REFERENCE",
      severity: "medium",
      scope: "premiums",
      status: "warning",
      expectedValue: input.reference.periodYearMonth,
      actualValue: input.premiumPeriod.yearMonth,
      differenceAbsolute: null,
      differenceRelative: null,
      toleranceAbsolute: null,
      toleranceRelative: null,
      message: "Premium raw period does not match reference workbook period; exact reconciliations are informational only."
    });
  }

  const rawPremiums = sumByInstitutionPremiums(input.premiumFacts);
  for (const [institutionId, actualValue] of Object.entries(rawPremiums)) {
    const displayName = input.institutionNameById[institutionId] ?? institutionId;
    const expectedValue = input.reference.premiumTotalsByInstitution[normalizeText(displayName)] ?? null;

    if (expectedValue == null) {
      addIssue(issues, {
        ruleId: "REFERENCE_PREMIUM_INSTITUTION_MISSING",
        severity: "medium",
        scope: `premiums:${institutionId}`,
        status: "warning",
        expectedValue: null,
        actualValue,
        differenceAbsolute: null,
        differenceRelative: null,
        toleranceAbsolute: null,
        toleranceRelative: null,
        message: `Reference premium value for ${displayName} is not available.`
      });
      continue;
    }

    const differenceAbsolute = actualValue - expectedValue;
    const differenceRelative = expectedValue === 0 ? 0 : differenceAbsolute / expectedValue;

    addIssue(issues, {
      ruleId: "PREMIUM_TOTAL_BY_INSTITUTION",
      severity:
        input.premiumPeriod && input.reference.periodYearMonth === input.premiumPeriod.yearMonth && Math.abs(differenceRelative) > 0.001
          ? "high"
          : "low",
      scope: `premiums:${institutionId}`,
      status: Math.abs(differenceRelative) > 0.001 ? "warning" : "passed",
      expectedValue,
      actualValue,
      differenceAbsolute,
      differenceRelative,
      toleranceAbsolute: 0.01,
      toleranceRelative: 0.001,
      message: `Premium total comparison for ${displayName}.`
    });
  }

  const rawAssets = totalAssetsByInstitution(input.financialPositionFacts);
  for (const [institutionId, actualValue] of Object.entries(rawAssets)) {
    const displayName = input.institutionNameById[institutionId] ?? institutionId;
    const expectedValue = input.reference.assetsByInstitution[normalizeText(displayName)] ?? null;

    if (expectedValue == null) {
      continue;
    }

    const differenceAbsolute = actualValue - expectedValue;
    const differenceRelative = expectedValue === 0 ? 0 : differenceAbsolute / expectedValue;

    addIssue(issues, {
      ruleId: "ASSETS_TOTAL_BY_INSTITUTION",
      severity:
        input.financialPeriod && input.reference.periodYearMonth === input.financialPeriod.yearMonth && Math.abs(differenceRelative) > 0.001
          ? "high"
          : "low",
      scope: `financialPosition:${institutionId}`,
      status: Math.abs(differenceRelative) > 0.001 ? "warning" : "passed",
      expectedValue,
      actualValue,
      differenceAbsolute,
      differenceRelative,
      toleranceAbsolute: 0.01,
      toleranceRelative: 0.001,
      message: `Assets total comparison for ${displayName}.`
    });
  }

  return {
    publishability: summarizePublishability(issues),
    issues
  };
}
