function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function getOperationalLabel(input: {
  datasetScope?: unknown;
  businessPeriods?: unknown;
  status?: unknown;
}): string {
  const scope = stringValue(input.datasetScope, "scope-desconocido");
  const periods = typeof input.businessPeriods === "object" && input.businessPeriods !== null
    ? (input.businessPeriods as Record<string, { reportDate?: string }> )
    : {};
  const reportDate = periods.premiums?.reportDate ?? periods.financialPosition?.reportDate ?? periods.incomeStatement?.reportDate ?? "sin-fecha";
  const status = stringValue(input.status, "sin-estado");
  return `${scope} | ${reportDate} | ${status}`;
}
