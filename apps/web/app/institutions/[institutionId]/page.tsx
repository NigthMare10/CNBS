import { Card, EmptyState, KeyValueList, SectionHeading } from "@cnbs/ui";
import { publicApi } from "../../../lib/api";

export const dynamic = "force-dynamic";

function currency(value: number) {
  return new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL", maximumFractionDigits: 0 }).format(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function InstitutionPage({ params }: { params: Promise<{ institutionId: string }> }) {
  const { institutionId } = await params;
  const payload = await publicApi.institution(institutionId);

  const institution = payload.institution as Record<string, unknown>;
  const premiumSummary = payload.premiumSummary as Record<string, unknown> | undefined;
  const financialSummary = payload.financialSummary as Record<string, unknown> | undefined;
  const premiumFacts = (payload.premiumFactsPreview as Array<Record<string, unknown>> | undefined) ?? [];
  const financialFactsCount = Number(payload.financialFactsCount ?? 0);

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <SectionHeading eyebrow="Institución" title={stringValue(institution.displayName, stringValue(institution.canonicalName, institutionId))} description="Ficha detallada por aseguradora." />
      <div className="page-grid-3">
        <Card title="Primas totales">
          <p style={{ margin: 0, color: "#0f172a", fontSize: 34, fontWeight: 760 }}>{currency(Number(premiumSummary?.premiumAmount ?? 0))}</p>
        </Card>
        <Card title="Activos totales">
          <p style={{ margin: 0, color: "#0f172a", fontSize: 34, fontWeight: 760 }}>{currency(Number(financialSummary?.totalAssets ?? 0))}</p>
        </Card>
        <Card title="Patrimonio">
          <p style={{ margin: 0, color: "#0f172a", fontSize: 34, fontWeight: 760 }}>{currency(Number(financialSummary?.equity ?? 0))}</p>
        </Card>
      </div>

      <div className="page-grid-2">
        <Card title="Distribución de primas por ramo" subtitle="Detalle resumido de la composición reportada para la institución.">
          {premiumFacts.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              {premiumFacts.slice(0, 20).map((fact, index) => (
                <div key={`${String(fact.ramoId)}-${index}`} className="flow-list__item">
                  <span style={{ color: "#334155" }}>
                    {stringValue(fact.ramoName, typeof fact.ramoId === "string" ? fact.ramoId : "")}
                  </span>
                  <strong style={{ color: "#0f172a" }}>{currency(Number(fact.amount ?? 0))}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin detalle de primas" description="No hay hechos de primas disponibles para esta institución en la versión activa." />
          )}
        </Card>

        <Card title="Resumen financiero" subtitle="Valores principales del estado de situación financiera institucional.">
          {financialSummary ? (
            <KeyValueList
              columns={1}
              items={[
                {
                  key: "assets",
                  label: "Activos totales",
                  value: currency(Number(financialSummary.totalAssets ?? 0))
                },
                {
                  key: "reserves",
                  label: "Reservas técnicas",
                  value: currency(Number(financialSummary.totalReserves ?? 0))
                },
                {
                  key: "equity",
                  label: "Patrimonio",
                  value: currency(Number(financialSummary.equity ?? 0))
                },
                {
                  key: "facts",
                  label: "Filas financieras disponibles",
                  value: new Intl.NumberFormat("es-HN").format(financialFactsCount)
                }
              ]}
            />
          ) : (
            <EmptyState title="Sin resumen financiero" description="La versión activa no contiene agregados financieros visibles para esta institución." />
          )}
        </Card>
      </div>
    </div>
  );
}
