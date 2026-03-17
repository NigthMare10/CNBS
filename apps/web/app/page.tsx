import Link from "next/link";
import { Badge, Card, EmptyState, KeyValueList, MetricGrid, SectionHeading } from "@cnbs/ui";
import { LazyBarChart } from "../components/lazy-bar-chart";
import { publicApi } from "../lib/api";

export const dynamic = "force-dynamic";

function currency(value: number) {
  return new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL", maximumFractionDigits: 0 }).format(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function HomePage() {
  const overview = await publicApi.overview();
  const metadata = overview.metadata as Record<string, unknown> | undefined;
  const domainAvailability = (metadata?.domainAvailability as Record<string, Record<string, unknown>> | undefined) ?? {};
  const executiveKpis = (overview.executiveKpis as Array<Record<string, unknown>> | undefined) ?? [];
  const premiumsByInstitution = (overview.premiumsByInstitution as Array<Record<string, unknown>> | undefined) ?? [];
  const premiumsByLine = (overview.premiumsByLine as Array<Record<string, unknown>> | undefined) ?? [];
  const financialHighlights = (overview.financialHighlights as Array<Record<string, unknown>> | undefined) ?? [];
  const premiumsAvailable = domainAvailability.premiums?.publishable === true;
  const financialAvailable = domainAvailability.financialPosition?.publishable === true;
  const quickInstitutionCards = financialHighlights.length > 0 ? financialHighlights : premiumsByInstitution;
  const datasetId = stringValue(metadata?.datasetVersionId, "Sin versión activa");
  const premiumPeriod = stringValue(
    (metadata?.businessPeriods as Record<string, Record<string, string>> | undefined)?.premiums?.reportDate,
    "n/d"
  );
  const financialPeriod = stringValue(
    (metadata?.businessPeriods as Record<string, Record<string, string>> | undefined)?.financialPosition?.reportDate,
    "n/d"
  );

  return (
    <div style={{ display: "grid", gap: 40 }}>
      <section className="hero-panel">
        <div className="hero-panel__grid">
          <div>
            <p className="hero-panel__eyebrow">Vista Ejecutiva</p>
            <h2 className="hero-panel__title">Publicación institucional validada, versionada y preparada para alto tráfico.</h2>
            <p className="hero-panel__copy">
              El runtime público consume solo datasets canónicos publicados. La carga administrativa permanece aislada y la
              versión activa se mantiene aunque falle una nueva ingesta.
            </p>
          </div>
          <Card title="Estado de la versión" subtitle="Versión activa utilizada por el runtime público.">
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span style={{ color: "#475569", fontSize: 14 }}>Dataset oficial activo</span>
                <Badge>{stringValue(metadata?.status, "staged")}</Badge>
              </div>
              <KeyValueList
                columns={1}
                items={[
                  { key: "dataset", label: "Versión", value: datasetId },
                  { key: "premium-period", label: "Período primas", value: premiumPeriod },
                  { key: "financial-period", label: "Período balance", value: financialPeriod }
                ]}
              />
            </div>
          </Card>
        </div>
      </section>

      <MetricGrid
        items={executiveKpis.map((item) => ({
          key: String(item.key),
          label: String(item.label),
          value:
            String(item.unit) === "currency"
              ? currency(Number(item.value ?? 0))
              : new Intl.NumberFormat("es-HN").format(Number(item.value ?? 0)),
          hint:
            String(item.key) === "total-premiums"
              ? "Total oficial derivado de la última versión publicada."
              : String(item.key) === "total-assets"
                ? "Suma consolidada del estado de situación financiera publicado."
                : "Cobertura efectiva de la versión institucional activa."
        }))}
      />

      <section style={{ display: "grid", gap: 20 }}>
        <SectionHeading
          eyebrow="Gráficos"
          title="Cuadros institucionales derivados de fuentes operativas"
          description="Especificaciones reinterpretadas desde las dos fuentes primarias reales. Cuando un gráfico no es derivable con integridad, se muestra como no disponible."
        />
        <div className="page-grid-2">
          <Card title="Primas y Siniestros por Ramo a Diciembre" subtitle="Con las fuentes actuales solo es posible derivar la serie oficial de primas por ramo.">
            {premiumsAvailable && premiumsByLine.length > 0 ? (
              <div style={{ display: "grid", gap: 14 }}>
                <p className="meta-note">La serie de siniestros no está disponible en fase 1 porque no existe un feed raw autoritativo de siniestros.</p>
                <LazyBarChart
                  title="Primas por ramo a diciembre"
                  data={premiumsByLine.slice(0, 8).map((item) => ({ label: stringValue(item.lineName), value: Number(item.premiumAmount ?? 0) }))}
                />
              </div>
            ) : (
              <EmptyState title="Dato no disponible con fuentes actuales" description="Este gráfico requiere al menos la fuente primaria de primas. La serie de siniestros seguirá deshabilitada hasta contar con feed raw autoritativo." />
            )}
          </Card>

          <Card title="Relación de Siniestros / Primas por Ramo" subtitle="Comparativa interanual 2025 vs 2024 según referencia institucional.">
            <EmptyState title="Dato no disponible con fuentes actuales" description="No existe un feed raw oficial de siniestros ni una serie histórica 2024 publicada en esta fase, por lo que la relación interanual no se calcula ni se inventa." />
          </Card>

          <Card title="Participación de Mercado a Diciembre por Compañía" subtitle="Derivable con la fuente primaria de primas y participación relativa del total publicado.">
            {premiumsAvailable && premiumsByInstitution.length > 0 ? (
              <LazyBarChart
                title="Participación de mercado (%)"
                color="#0f766e"
                data={premiumsByInstitution.slice(0, 8).map((item) => ({
                  label: stringValue(item.institutionName),
                  value: Number((item.marketShare ?? 0)) * 100
                }))}
              />
            ) : (
              <EmptyState title="Dato no disponible con fuentes actuales" description="Se requiere el workbook de primas para derivar participación de mercado por compañía." />
            )}
          </Card>

          <Card title="Primas y Siniestros Totales por Compañía" subtitle="Con las fuentes actuales solo es posible derivar las primas totales por compañía.">
            {premiumsAvailable && premiumsByInstitution.length > 0 ? (
              <div style={{ display: "grid", gap: 14 }}>
                <p className="meta-note">La serie de siniestros queda en estado no disponible hasta contar con fuente raw oficial de siniestros.</p>
                <LazyBarChart
                  title="Primas totales por compañía"
                  color="#1d4ed8"
                  data={premiumsByInstitution.slice(0, 8).map((item) => ({
                    label: stringValue(item.institutionName),
                    value: Number(item.premiumAmount ?? 0)
                  }))}
                />
              </div>
            ) : (
              <EmptyState title="Dato no disponible con fuentes actuales" description="Se requiere el workbook de primas para derivar este cuadro por compañía." />
            )}
          </Card>
        </div>
      </section>

      <section className="page-grid-2">
        <Card>
          <SectionHeading
            eyebrow="Análisis"
            title="Top instituciones por primas"
            description="Ranking derivado del dataset canónico publicado; no se consulta Excel en tiempo de respuesta."
          />
          <div style={{ marginTop: 20 }}>
            {premiumsByInstitution.length > 0 ? (
              <LazyBarChart
                title="Primas por institución"
                data={premiumsByInstitution.slice(0, 8).map((item) => ({
                  label: stringValue(item.institutionName),
                  value: Number(item.premiumAmount ?? 0)
                }))}
              />
            ) : (
              <EmptyState title="Sin ranking disponible" description="No hay primas publicadas en la versión activa para construir este gráfico." />
            )}
          </div>
        </Card>
        <Card>
          <SectionHeading eyebrow="Ramos" title="Concentración por ramo" description="Participación relativa de primas por ramo homologado." />
          <div style={{ marginTop: 20 }}>
            {premiumsByLine.length > 0 ? (
              <LazyBarChart
                title="Primas por ramo"
                color="#1d4ed8"
                data={premiumsByLine.slice(0, 8).map((item) => ({
                  label: stringValue(item.lineName),
                  value: Number(item.premiumAmount ?? 0)
                }))}
              />
            ) : (
              <EmptyState title="Sin ramos publicados" description="La versión activa no contiene una agregación visible por ramo." />
            )}
          </div>
        </Card>
      </section>

      <section style={{ display: "grid", gap: 20 }}>
        <SectionHeading
          eyebrow="Instituciones"
          title="Ficha rápida por aseguradora"
          description="Acceso directo a la vista institucional con hechos de primas y estado de situación financiera."
        />
        {quickInstitutionCards.length > 0 ? (
          <div className="page-grid-3">
            {quickInstitutionCards.slice(0, 12).map((entry) => (
              <Card
                key={String(entry.institutionId)}
                title={stringValue(entry.institutionName)}
                subtitle={
                  financialAvailable
                    ? currency(Number(entry.totalAssets ?? 0))
                    : premiumsAvailable
                      ? currency(Number(entry.premiumAmount ?? 0))
                      : "Sin datos disponibles"
                }
              >
                <div style={{ display: "grid", gap: 10, color: "#475569", fontSize: 14 }}>
                  {financialAvailable ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span>Reservas</span>
                        <strong style={{ color: "#0f172a" }}>{currency(Number(entry.totalReserves ?? 0))}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span>Patrimonio</span>
                        <strong style={{ color: "#0f172a" }}>{currency(Number(entry.equity ?? 0))}</strong>
                      </div>
                    </>
                  ) : premiumsAvailable ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span>Primas</span>
                        <strong style={{ color: "#0f172a" }}>{currency(Number(entry.premiumAmount ?? 0))}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span>Participación</span>
                        <strong style={{ color: "#0f172a" }}>{(Number(entry.marketShare ?? 0) * 100).toFixed(2)}%</strong>
                      </div>
                    </>
                  ) : (
                    <div className="meta-note">No hay datos institucionales disponibles para esta versión.</div>
                  )}
                </div>
                <div style={{ marginTop: 18 }}>
                  <Link
                    href={`/institutions/${String(entry.institutionId)}`}
                    style={{ color: "#0f766e", fontSize: 14, fontWeight: 700 }}
                  >
                    Ver ficha institucional
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin instituciones disponibles" description="La versión activa aún no expone fichas institucionales para mostrar en esta vista." />
        )}
      </section>
    </div>
  );
}
