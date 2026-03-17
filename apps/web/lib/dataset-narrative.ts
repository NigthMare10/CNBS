function isPublishable(domainAvailability: Record<string, Record<string, unknown>>, domain: string): boolean {
  return domainAvailability[domain]?.publishable === true;
}

export function getCoverageSummary(domainAvailability: Record<string, Record<string, unknown>>): string {
  const labels = [
    isPublishable(domainAvailability, "premiums") ? "primas" : null,
    isPublishable(domainAvailability, "financialPosition") ? "estado de situación financiera" : null
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(" + ") : "sin dominios disponibles";
}

export function getHomeHeroCopy(input: {
  datasetScope: string;
  domainAvailability: Record<string, Record<string, unknown>>;
}): { title: string; description: string } {
  const coverage = getCoverageSummary(input.domainAvailability);

  switch (input.datasetScope) {
    case "premiums-only":
      return {
        title: "Publicación institucional centrada en primas y participación de mercado.",
        description: `La versión activa cubre ${coverage}. El sistema mantiene visibles solo los dominios realmente provistos y deja el resto en estado seguro de dato no disponible.`
      };
    case "financial-only":
      return {
        title: "Publicación institucional centrada en balance y highlights financieros.",
        description: `La versión activa cubre ${coverage}. No se muestran métricas de primas ni comparativos no soportados por las fuentes cargadas.`
      };
    case "premiums-financial":
      return {
        title: "Publicación institucional de primas y estado de situación financiera.",
        description: `La versión activa cubre ${coverage}. El runtime público consume solo agregados publicados y oculta dominios ausentes sin reemplazarlos por cero.`
      };
    default:
      return {
        title: "Publicación institucional validada, versionada y preparada para alto tráfico.",
        description: `La versión activa cubre ${coverage}. El sistema se construye únicamente con primas y estado de situación financiera como fuentes operativas, manteniendo trazabilidad y publicación versionada.`
      };
  }
}
