import { Card, SectionHeading } from "@cnbs/ui";
import { AdminPagination } from "../../../components/admin-pagination";
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
                  <span className="admin-list-row__meta">{String(event.timestamp)}</span>
                </div>
                <div className="admin-help">Actor: {String(event.actor)}</div>
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
