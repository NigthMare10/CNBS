import { Card, SectionHeading } from "@cnbs/ui";
import { AdminPagination } from "../../../components/admin-pagination";
import { formatAdminDateTime } from "../../../lib/date-time";
import { getAdminJson } from "../../../lib/api";
import { requireAdminSession } from "../../../lib/auth";

function actionCounts(events: Array<Record<string, unknown>>) {
  return Object.entries(
    events.reduce<Record<string, number>>((acc, event) => {
      const action = typeof event.action === "string" ? event.action : "UNKNOWN";
      acc[action] = (acc[action] ?? 0) + 1;
      return acc;
    }, {})
  );
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await requireAdminSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const response = await getAdminJson<{ items: Array<Record<string, unknown>>; page: number; totalPages: number }>(
    `/api/admin/audit?page=${page}&pageSize=12`,
    session
  );
  const events = response.items;
  const counts = actionCounts(events);
  const systemStatus = await getAdminJson<Record<string, unknown>>("/api/admin/system/status", session);
  const activeDataset = systemStatus.activeDataset as Record<string, unknown> | undefined;
  const activeVersionId = typeof activeDataset?.datasetVersionId === "string" ? activeDataset.datasetVersionId : null;

  return (
    <div className="admin-page">
      <SectionHeading
        eyebrow="Auditoría"
        title="Eventos operativos"
        description="Trazabilidad de ingestas, publicaciones y rollbacks."
      />

      {counts.length > 0 && (
        <div className="admin-grid-fluid">
          {counts.map(([action, count]) => (
            <div className="admin-meta-item" key={action}>
              <span className="admin-meta-item__label">{action}</span>
              <span className="admin-meta-item__value">{count}</span>
            </div>
          ))}
        </div>
      )}

      <Card>
        {events.length > 0 ? (
          <div className="admin-list">
            {events.map((event: Record<string, unknown>) => (
              <div key={String(event.auditEventId)} className="admin-list-row">
                <div className="admin-list-row__content">
                  <span className="admin-list-row__title">{String(event.action)}</span>
                  <span className="admin-list-row__meta">{formatAdminDateTime(stringValue(event.timestamp))}</span>
                  <span className="admin-list-row__meta">
                    ingestionRunId: {stringValue(event.ingestionRunId, "n/d")} · datasetVersionId: {stringValue(event.datasetVersionId, "n/d")}
                  </span>
                </div>
                <div className="admin-actions">
                  {activeVersionId && stringValue(event.datasetVersionId) === activeVersionId ? <span className="admin-alert--success" style={{ padding: "6px 10px", fontSize: 12 }}>Versión activa</span> : null}
                  <div className="admin-help">Actor: {String(event.actor)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-alert">No hay eventos de auditoría disponibles todavía.</div>
        )}
      </Card>

      <AdminPagination basePath="/audit" page={response.page} totalPages={response.totalPages} />
    </div>
  );
}
