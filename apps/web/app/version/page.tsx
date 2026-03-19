import { Badge, Card, EmptyState, KeyValueList, SectionHeading } from "@cnbs/ui";
import { formatPublicDateTime, publicTimeZoneLabel } from "../../lib/date-time";
import { publicApi } from "../../lib/api";

export const dynamic = "force-dynamic";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function VersionPage() {
  const version = (await publicApi.version()) as { activeDataset?: Record<string, unknown> };
  const activeDataset = version.activeDataset;
  const validationSummary =
    (activeDataset?.validationSummary as { issuesCount?: number; publishability?: string } | undefined) ?? {};
  const reconciliationSummary =
    (activeDataset?.reconciliationSummary as { issuesCount?: number; publishability?: string } | undefined) ?? {};
  const businessPeriods = (activeDataset?.businessPeriods as Record<string, Record<string, string>> | undefined) ?? {};
  const domainAvailability = (activeDataset?.domainAvailability as Record<string, Record<string, unknown>> | undefined) ?? {};
  const financialAvailable = domainAvailability.financialPosition?.publishable === true;
  const premiumsAvailable = domainAvailability.premiums?.publishable === true;
  const supportedDomains = [
    premiumsAvailable ? "Primas" : null,
    financialAvailable ? "Estado de situación financiera" : null
  ].filter(Boolean).join(" + ");

  if (!activeDataset) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <SectionHeading eyebrow="Versión" title="Estado de publicación" description="Metadata de la versión activa publicada al sitio público." />
        <EmptyState title="No existe una versión activa" description="Cuando una corrida validada sea publicada, esta pantalla mostrará su metadata institucional y los resultados de validación." />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <SectionHeading eyebrow="Versión" title="Estado de publicación" description="Metadata de la versión activa publicada al sitio público." />
      <div className="page-grid-2">
        <Card title={stringValue(activeDataset.datasetVersionId, "Sin versión activa")} subtitle="Versión inmutable expuesta por el sitio público. ">
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <span style={{ color: "#64748b", fontSize: 14 }}>Estado de activación</span>
              <Badge>{stringValue(activeDataset.status, "staged")}</Badge>
            </div>
            <KeyValueList
              columns={1}
              items={[
                { key: "published-at", label: "Fecha de publicación", value: formatPublicDateTime(stringValue(activeDataset.publishedAt, "")) },
                { key: "scope", label: "Cobertura operativa", value: stringValue(activeDataset.datasetScope, "n/d") },
                { key: "sources", label: "Fuentes operativas", value: "Primas + estado de situación financiera según disponibilidad" }
              ]}
            />
          </div>
        </Card>
        <Card title="Estado de controles" subtitle="Resumen de la validación y reconciliación de la versión activa.">
          <KeyValueList
            columns={1}
            items={[
              {
                key: "validation-issues",
                label: "Issues de validación",
                value: String(validationSummary.issuesCount ?? 0)
              },
              {
                key: "reconciliation-issues",
                label: "Issues de reconciliación",
                value: String(reconciliationSummary.issuesCount ?? 0)
              },
              {
                key: "period-premiums",
                label: "Período primas",
                value: stringValue(businessPeriods.premiums?.reportDate, "n/d")
              },
              {
                key: "period-financial",
                label: "Período balance",
                value: stringValue(businessPeriods.financialPosition?.reportDate, financialAvailable ? "n/d" : "Dato no disponible")
              },
              {
                key: "dataset-scope",
                label: "Alcance del dataset",
                value: stringValue(activeDataset.datasetScope, "n/d")
              }
            ]}
          />
        </Card>
      </div>

      <Card title="Cobertura por dominio" subtitle="Transparencia sobre qué dominios quedaron realmente soportados en la publicación activa.">
        <KeyValueList
          columns={2}
          items={Object.entries(domainAvailability)
            .filter(([key]) => key === "premiums" || key === "financialPosition")
            .map(([key, value]) => ({
            key,
            label: key,
            value:
              `${value.publishable === true ? "Disponible" : "No disponible"}` +
              (typeof value.missingReason === "string" && value.missingReason ? ` - ${value.missingReason}` : "")
          }))}
        />
      </Card>

      <Card title="Interpretación operativa" subtitle="Qué significa la versión activa para el sitio público.">
        <div style={{ display: "grid", gap: 14 }}>
          <p className="meta-note">
            La metadata aquí visible corresponde al dataset actualmente activo. El frontend público consume sus agregados y catálogos ya procesados, sin abrir los Excel originales durante el request.
          </p>
          <p className="meta-note">Zona horaria mostrada: {publicTimeZoneLabel()}.</p>
          <div className="flow-list">
            <div className="flow-list__item">
              <span>Publicación atómica</span>
              <strong style={{ color: "#0f172a" }}>Activa</strong>
            </div>
            <div className="flow-list__item">
              <span>Rollback inmediato</span>
              <strong style={{ color: "#0f172a" }}>Disponible</strong>
            </div>
            <div className="flow-list__item">
              <span>Fuentes oficiales fase 1</span>
              <strong style={{ color: "#0f172a" }}>{supportedDomains || "Sin dominios activos"}</strong>
            </div>
            <div className="flow-list__item">
              <span>Fuentes no operativas</span>
              <strong style={{ color: "#0f172a" }}>Informe preliminar solo como oráculo de fórmulas</strong>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
