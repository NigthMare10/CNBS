export function getDerivedArtifactsSummary(domainAvailability: Record<string, Record<string, unknown>> | undefined): string[] {
  const availability = domainAvailability ?? {};
  const items: string[] = [];

  if (availability.premiums?.publishable === true) {
    items.push("KPIs de primas");
    items.push("participación de mercado");
    items.push("rankings de primas");
    items.push("primas por ramo");
  }

  if (availability.financialPosition?.publishable === true) {
    items.push("activos totales");
    items.push("patrimonio");
    items.push("reservas técnicas");
    items.push("rankings de activos, patrimonio y reservas");
  }

  return items;
}
