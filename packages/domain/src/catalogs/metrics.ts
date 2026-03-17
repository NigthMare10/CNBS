import type { MetricDefinition } from "../entities/canonical";

export const metricDefinitions: MetricDefinition[] = [
  {
    metricId: "total-premiums",
    name: "Primas Totales",
    domain: "premiums",
    unit: "currency",
    publicationPolicy: "official"
  },
  {
    metricId: "total-assets",
    name: "Activos Totales",
    domain: "financialPosition",
    unit: "currency",
    publicationPolicy: "official"
  },
  {
    metricId: "institutions-covered",
    name: "Instituciones Cubiertas",
    domain: "dataset",
    unit: "count",
    publicationPolicy: "derived"
  }
];
