import { financialAccountsCatalog, institutionsCatalog, insuranceLinesCatalog } from "@cnbs/domain";
import type { ExecutiveKpi, FinancialPositionFact, IncomeStatementFact, PremiumFact } from "@cnbs/domain";
import type { CanonicalDatasetArtifacts } from "../types";

export function buildDatasetArtifacts(input: {
  premiumFacts: PremiumFact[];
  financialPositionFacts: FinancialPositionFact[];
  incomeStatementFacts: IncomeStatementFact[];
  datasetVersionId: string;
}): CanonicalDatasetArtifacts {
  function sortByMetric<T extends { institutionId: string; institutionName: string }>(
    entries: T[],
    getMetric: (entry: T) => number
  ): T[] {
    return [...entries].sort((left, right) => {
      const metricDifference = getMetric(right) - getMetric(left);
      if (metricDifference !== 0) {
        return metricDifference;
      }

      const nameDifference = left.institutionName.localeCompare(right.institutionName, "es");
      if (nameDifference !== 0) {
        return nameDifference;
      }

      return left.institutionId.localeCompare(right.institutionId, "es");
    });
  }

  const institutionNameById = Object.fromEntries(
    institutionsCatalog.map((institution) => [institution.institutionId, institution.displayName])
  );
  const lineNameById = Object.fromEntries(insuranceLinesCatalog.map((line) => [line.lineId, line.displayName]));

  const totalPremiums = input.premiumFacts.reduce((sum, fact) => sum + fact.amount, 0);
  const totalAssets = input.financialPositionFacts
    .filter((fact) => fact.accountId === "total-activos")
    .reduce((sum, fact) => sum + fact.amountCombined, 0);
  const totalReserves = input.financialPositionFacts
    .filter((fact) => fact.accountId === "reservas-tecnicas")
    .reduce((sum, fact) => sum + fact.amountCombined, 0);

  const executiveKpis: ExecutiveKpi[] = [];
  if (input.premiumFacts.length > 0) {
    executiveKpis.push({ key: "total-premiums", label: "Primas Totales", value: totalPremiums, unit: "currency" });
  }
  if (input.financialPositionFacts.length > 0) {
    executiveKpis.push({ key: "total-assets", label: "Activos Totales", value: totalAssets, unit: "currency" });
    executiveKpis.push({ key: "total-reserves", label: "Reservas Técnicas", value: totalReserves, unit: "currency" });
  }
  executiveKpis.push({
    key: "institutions-covered",
    label: "Instituciones Cubiertas",
    value: new Set([...input.premiumFacts, ...input.financialPositionFacts, ...input.incomeStatementFacts].map((fact) => fact.institutionId)).size,
    unit: "count"
  });

  const premiumsByInstitution = Object.values(
    input.premiumFacts.reduce<Record<string, { institutionId: string; premiumAmount: number }>>((accumulator, fact) => {
      const current = accumulator[fact.institutionId] ?? { institutionId: fact.institutionId, premiumAmount: 0 };
      current.premiumAmount += fact.amount;
      accumulator[fact.institutionId] = current;
      return accumulator;
    }, {})
  )
    .map((entry) => ({
      ...entry,
      institutionName: institutionNameById[entry.institutionId] ?? entry.institutionId,
      marketShare: totalPremiums === 0 ? 0 : entry.premiumAmount / totalPremiums
    }))
    .sort((left, right) => right.premiumAmount - left.premiumAmount);

  const premiumsByLine = Object.values(
    input.premiumFacts.reduce<Record<string, { lineId: string; premiumAmount: number }>>((accumulator, fact) => {
      const current = accumulator[fact.ramoId] ?? { lineId: fact.ramoId, premiumAmount: 0 };
      current.premiumAmount += fact.amount;
      accumulator[fact.ramoId] = current;
      return accumulator;
    }, {})
  )
    .map((entry) => ({
      ...entry,
      lineName: lineNameById[entry.lineId] ?? entry.lineId,
      marketShare: totalPremiums === 0 ? 0 : entry.premiumAmount / totalPremiums
    }))
    .sort((left, right) => right.premiumAmount - left.premiumAmount);

  const financialHighlightsByInstitution = Object.values(
    input.financialPositionFacts.reduce<
      Record<string, { institutionId: string; totalAssets: number; totalReserves: number; equity: number }>
    >((accumulator, fact) => {
      const current = accumulator[fact.institutionId] ?? {
        institutionId: fact.institutionId,
        totalAssets: 0,
        totalReserves: 0,
        equity: 0
      };

      if (fact.accountId === "total-activos") {
        current.totalAssets += fact.amountCombined;
      }
      if (fact.accountId === "reservas-tecnicas") {
        current.totalReserves += fact.amountCombined;
      }
      if (fact.accountId === "patrimonio") {
        current.equity += fact.amountCombined;
      }

      accumulator[fact.institutionId] = current;
      return accumulator;
    }, {})
  )
    .map((entry) => ({
      ...entry,
      institutionName: institutionNameById[entry.institutionId] ?? entry.institutionId
    }))
    .sort((left, right) => right.totalAssets - left.totalAssets);

  const incomeStatementHighlightsByInstitution: Array<Record<string, unknown>> = [];

  const financialHighlightsByInstitutionMap = Object.fromEntries(
    financialHighlightsByInstitution.map((entry) => [String(entry.institutionId), entry])
  );
  const premiumsByInstitutionMap = Object.fromEntries(
    premiumsByInstitution.map((entry) => [String(entry.institutionId), entry])
  );
  const rankings = {
    premiums: sortByMetric(premiumsByInstitution, (entry) => entry.premiumAmount).slice(0, 12),
    assets: sortByMetric(financialHighlightsByInstitution, (entry) => entry.totalAssets).slice(0, 12),
    equity: sortByMetric(financialHighlightsByInstitution, (entry) => entry.equity).slice(0, 12),
    reserves: sortByMetric(financialHighlightsByInstitution, (entry) => entry.totalReserves).slice(0, 12)
  };

  const institutionDetails = Object.fromEntries(
    institutionsCatalog.map((institution) => {
      const premiumFactsPreview = input.premiumFacts
        .filter((fact) => fact.institutionId === institution.institutionId)
        .sort((left, right) => right.amount - left.amount)
        .slice(0, 20)
        .map((fact) => ({
          ramoId: fact.ramoId,
          ramoName: lineNameById[fact.ramoId] ?? fact.ramoId,
          ramoParentId: fact.ramoParentId,
          amount: fact.amount,
          currencyCode: fact.currencyCode,
          period: fact.period
        }));

      const financialFactsCount = input.financialPositionFacts.filter(
        (fact) => fact.institutionId === institution.institutionId
      ).length;

      return [
        institution.institutionId,
        {
          institution,
          premiumSummary: premiumsByInstitutionMap[institution.institutionId] ?? null,
          financialSummary: financialHighlightsByInstitutionMap[institution.institutionId] ?? null,
          premiumFactsPreview,
          financialFactsCount
        }
      ];
    })
  );

  return {
    institutions: institutionsCatalog,
    insuranceLines: insuranceLinesCatalog,
    financialAccounts: financialAccountsCatalog,
    premiumFacts: input.premiumFacts,
    financialPositionFacts: input.financialPositionFacts,
    incomeStatementFacts: [],
    executiveKpis,
    premiumsByInstitution,
    premiumsByLine,
    financialHighlightsByInstitution,
    incomeStatementHighlightsByInstitution,
    rankings,
    institutionDetails
  };
}
