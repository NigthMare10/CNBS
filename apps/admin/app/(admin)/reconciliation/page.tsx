import { Badge, Card, SectionHeading } from "@cnbs/ui";
import { AdminPagination } from "../../../components/admin-pagination";
import { DetectedWorkbooksList } from "../../../components/detected-workbooks-list";
import { JsonViewerWithCopy } from "../../../components/json-viewer-with-copy";
import { WorkbookClassificationSummary } from "../../../components/workbook-classification-summary";
import { adminTimeZoneLabel, formatAdminDateTime } from "../../../lib/date-time";
import { getOperationalLabel } from "../../../lib/traceability";
import { getAdminJson } from "../../../lib/api";
import { requireAdminSession } from "../../../lib/auth";

type Severity = "critical" | "high" | "medium" | "low";

function publishabilityOf(value: unknown, fallback: string): string {
  if (typeof value === "object" && value !== null && "publishability" in value) {
    const publishability = (value as { publishability?: unknown }).publishability;
    return typeof publishability === "string" ? publishability : fallback;
  }

  return fallback;
}

function issuesOf(value: unknown): Array<Record<string, unknown>> {
  if (typeof value === "object" && value !== null && "issues" in value) {
    const issues = (value as { issues?: unknown }).issues;
    return Array.isArray(issues) ? (issues as Array<Record<string, unknown>>) : [];
  }

  return [];
}

function countBySeverity(items: Array<Record<string, unknown>>): Record<Severity, number> {
  return items.reduce<Record<Severity, number>>(
    (acc, item) => {
      const severity = item.severity;
      if (severity === "critical" || severity === "high" || severity === "medium" || severity === "low") {
        acc[severity] += 1;
      }
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function ReconciliationPage() {
  const session = await requireAdminSession();
  const runsResponse = await getAdminJson<{ items: Array<Record<string, unknown>>; page: number; totalPages: number }>(
    "/api/admin/ingestions?page=1&pageSize=1",
    session
  );
  const latest = runsResponse.items.at(0);

  if (!latest) {
    return (
      <div className="admin-page">
        <SectionHeading
          eyebrow="Reconciliación"
          title="Revisión de corridas en staging"
          description="Solo las corridas no bloqueadas deben pasar a publicación."
        />
        <Card title="Sin corridas">Aún no existen corridas de ingesta en staging.</Card>
      </div>
    );
  }

  const validationIssues = issuesOf(latest.validationSummary);
  const reconciliationIssues = issuesOf(latest.reconciliationSummary);
  const validationCounts = countBySeverity(validationIssues);
  const reconciliationCounts = countBySeverity(reconciliationIssues);

  return (
    <div className="admin-page">
      <SectionHeading
        eyebrow="Reconciliación"
        title="Revisión de corridas en staging"
        description="Vista resumida de severidades, estado y evidencias de la corrida más reciente."
      />

      <Card
        title={String(latest.ingestionRunId)}
        subtitle={formatAdminDateTime(stringValue(latest.createdAt))}
        actions={
          <div className="admin-actions">
            <Badge>{publishabilityOf(latest.validationSummary, "blocked")}</Badge>
            <Badge>{publishabilityOf(latest.reconciliationSummary, "warningOnly")}</Badge>
          </div>
        }
      >
        <div className="admin-meta-item" style={{ marginBottom: 18 }}>
          <span className="admin-meta-item__label">Etiqueta operativa</span>
          <span className="admin-meta-item__value">
            {getOperationalLabel({
              datasetScope: latest.draftDatasetVersion && typeof latest.draftDatasetVersion === "object" ? (latest.draftDatasetVersion as Record<string, unknown>).datasetScope : undefined,
              businessPeriods: latest.draftDatasetVersion && typeof latest.draftDatasetVersion === "object" ? (latest.draftDatasetVersion as Record<string, unknown>).businessPeriods : undefined,
              status: latest.publicationState
            })}
          </span>
        </div>
        <div className="admin-grid-2">
          <div className="admin-meta-list">
            <div className="admin-meta-item">
              <span className="admin-meta-item__label">Validación</span>
              <span className="admin-meta-item__value">
                Críticas: {validationCounts.critical} · Altas: {validationCounts.high} · Medias: {validationCounts.medium} · Bajas: {validationCounts.low}
              </span>
            </div>
            <div className="admin-meta-item">
              <span className="admin-meta-item__label">Reconciliación</span>
              <span className="admin-meta-item__value">
                Críticas: {reconciliationCounts.critical} · Altas: {reconciliationCounts.high} · Medias: {reconciliationCounts.medium} · Bajas: {reconciliationCounts.low}
              </span>
            </div>
          </div>

          <div className="admin-inline-note">
            Revisa primero los contadores de severidad. Si no existen discrepancias bloqueantes, la corrida puede continuar al paso de publicación. Horario mostrado en {adminTimeZoneLabel()}.
          </div>
        </div>

        <div className="admin-section-divider" style={{ margin: "22px 0" }} />

        <DetectedWorkbooksList run={latest} />

        <div className="admin-section-divider" style={{ margin: "22px 0" }} />

        <div className="admin-grid-2">
          <Card title="Muestra de issues de validación" subtitle="Primeros registros relevantes detectados en la corrida.">
            {validationIssues.length > 0 ? (
              <div className="admin-list">
                {validationIssues.slice(0, 6).map((issue, index) => (
                  <div key={`${String(issue.code)}-${index}`} className="admin-list-row">
                    <div className="admin-list-row__content">
                      <span className="admin-list-row__title">{stringValue(issue.code, "ISSUE")}</span>
                      <span className="admin-list-row__meta">{stringValue(issue.message, "Sin mensaje")}</span>
                    </div>
                    <Badge>{stringValue(issue.severity, "low")}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-alert--success">No se detectaron issues de validación en esta corrida.</div>
            )}
          </Card>

          <Card title="Muestra de issues de reconciliación" subtitle="Primeras diferencias relevantes contra el workbook de referencia.">
            {reconciliationIssues.length > 0 ? (
              <div className="admin-list">
                {reconciliationIssues.slice(0, 6).map((issue, index) => (
                  <div key={`${String(issue.ruleId)}-${index}`} className="admin-list-row">
                    <div className="admin-list-row__content">
                      <span className="admin-list-row__title">{stringValue(issue.ruleId, "RULE")}</span>
                      <span className="admin-list-row__meta">{stringValue(issue.message, "Sin mensaje")}</span>
                    </div>
                    <Badge>{stringValue(issue.severity, "low")}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-alert--success">No se detectaron discrepancias de reconciliación en esta corrida.</div>
            )}
          </Card>
        </div>

        <WorkbookClassificationSummary run={latest} title="Resumen visual del fallo de clasificación" />

        <JsonViewerWithCopy summary="Ver JSON completo de la corrida" value={latest} />
      </Card>

      <AdminPagination basePath="/ingestions" page={runsResponse.page} totalPages={runsResponse.totalPages} />
    </div>
  );
}
