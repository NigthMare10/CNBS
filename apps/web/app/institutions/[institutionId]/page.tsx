import { Card, EmptyState, KeyValueList, SectionHeading } from "@cnbs/ui";
import { notFound } from "next/navigation";
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
  if (!payload) {
    notFound();
  }

  const institution = payload.institution as Record<string, unknown>;
  const premiumSummary = payload.premiumSummary as Record<string, unknown> | undefined;
  const financialSummary = payload.financialSummary as Record<string, unknown> | undefined;
  const domainAvailability = (payload.domainAvailability as Record<string, Record<string, unknown>> | undefined) ?? {};
  const premiumFacts = (payload.premiumFactsPreview as Array<Record<string, unknown>> | undefined) ?? [];
  const financialFactsCount = Number(payload.financialFactsCount ?? 0);
  const financialAvailable = domainAvailability.financialPosition?.publishable === true;

  function moneyOrUnavailable(value: unknown, available: boolean): string {
    return available ? currency(Number(value ?? 0)) : "Dato no disponible";
  }

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <SectionHeading eyebrow="Institución" title={stringValue(institution.displayName, stringValue(institution.canonicalName, institutionId))} description="Ficha detallada por aseguradora." />
      <div className="page-grid-3">
        <Card title="Primas totales">
          <p style={{ margin: 0, color: "#0f172a", fontSize: 34, fontWeight: 760 }}>
            {premiumSummary ? currency(Number(premiumSummary.premiumAmount ?? 0)) : "Dato no disponible"}
          </p>
        </Card>
        <Card title="Activos totales">
          <p style={{ margin: 0, color: "#0f172a", fontSize: 34, fontWeight: 760 }}>{moneyOrUnavailable(financialSummary?.totalAssets, financialAvailable && Boolean(financialSummary))}</p>
        </Card>
        <Card title="Patrimonio">
          <p style={{ margin: 0, color: "#0f172a", fontSize: 34, fontWeight: 760 }}>{moneyOrUnavailable(financialSummary?.equity, financialAvailable && Boolean(financialSummary))}</p>
        </Card>
      </div>

      <div className="page-grid-2">
        <Card title="Bloque de primas" subtitle="Detalle resumido de la composición reportada para la institución.">
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

        <Card title="Bloque de balance" subtitle="Estado de situación financiera cuando el dominio está presente.">
          {financialAvailable && financialSummary ? (
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
            <EmptyState title="Sin resumen de balance" description="La versión activa no contiene estado de situación financiera para esta institución. Ausente no significa cero." />
          )}
        </Card>
      </div>
    </div>
  );
}
