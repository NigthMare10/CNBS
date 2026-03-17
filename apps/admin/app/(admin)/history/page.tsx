import { Card, SectionHeading } from "@cnbs/ui";
import { rollbackVersionAction } from "../../actions";
import { AdminPagination } from "../../../components/admin-pagination";
import { formatAdminDateTime } from "../../../lib/date-time";
import { getOperationalLabel } from "../../../lib/traceability";
import { getAdminJson } from "../../../lib/api";
import { requireAdminSession } from "../../../lib/auth";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await requireAdminSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const versions = await getAdminJson<{ items: Array<Record<string, unknown>>; page: number; totalPages: number }>(
    `/api/admin/publications?page=${page}&pageSize=8`,
    session
  );

  return (
    <div className="admin-page">
      <SectionHeading
        eyebrow="Historial"
        title="Versiones publicadas"
        description="Selecciona una versión histórica para rollback inmediato."
      />
      <div className="admin-list">
        {versions.items.map((version: Record<string, unknown>) => (
          <Card
            key={String(version.datasetVersionId)}
            title={String(version.datasetVersionId)}
            subtitle={formatAdminDateTime(stringValue(version.publishedAt, stringValue(version.createdAt)))}
          >
            <div className="admin-meta-item" style={{ marginBottom: 18 }}>
              <span className="admin-meta-item__label">Etiqueta operativa</span>
              <span className="admin-meta-item__value">
                {getOperationalLabel({
                  datasetScope: version.datasetScope,
                  businessPeriods: version.businessPeriods,
                  status: version.status
                })}
              </span>
            </div>
            <div className="admin-meta-row">
              <span className="admin-help">Estado: {stringValue(version.status, "published")}</span>
              <form action={rollbackVersionAction}>
                <input type="hidden" name="datasetVersionId" value={String(version.datasetVersionId)} />
                <button className="admin-button-secondary" type="submit">
                  Revertir a esta versión
                </button>
              </form>
            </div>
          </Card>
        ))}
      </div>
      <AdminPagination basePath="/history" page={versions.page} totalPages={versions.totalPages} />
    </div>
  );
}
