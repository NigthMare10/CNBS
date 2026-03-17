import { Card, SectionHeading } from "@cnbs/ui";
import { rollbackVersionAction } from "../../actions";
import { AdminPagination } from "../../../components/admin-pagination";
import { getAdminJson } from "../../../lib/api";
import { requireAdminSession } from "../../../lib/auth";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function PublicationsPage({ searchParams }: { searchParams: Promise<{ error?: string; page?: string }> }) {
  const session = await requireAdminSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const [versions, systemStatus] = await Promise.all([
    getAdminJson<{ items: Array<Record<string, unknown>>; page: number; totalPages: number }>(
      `/api/admin/publications?page=${page}&pageSize=8`,
      session
    ),
    getAdminJson<Record<string, unknown>>("/api/admin/system/status", session)
  ]);

  const activeDataset = systemStatus.activeDataset as Record<string, unknown> | undefined;
  const activeVersionId = typeof activeDataset?.datasetVersionId === "string" ? activeDataset.datasetVersionId : null;

  return (
    <div className="admin-page">
      <SectionHeading
        eyebrow="Publicaciones"
        title="Versiones publicadas"
        description="Vista consolidada de las versiones publicadas y del dataset activo del sistema."
      />

      {params.error && <div className="admin-alert--error">{params.error}</div>}

      {versions.items.length > 0 ? (
        <>
          <div className="admin-list">
            {versions.items.map((version) => {
              const versionId = String(version.datasetVersionId);
              const isActive = activeVersionId === versionId;

              return (
                <Card
                  key={versionId}
                  title={versionId}
                  subtitle={String(version.publishedAt ?? version.createdAt)}
                  actions={
                    isActive ? (
                      <span className="admin-alert--success" style={{ padding: "6px 12px", fontSize: 12 }}>
                        Activa
                      </span>
                    ) : null
                  }
                >
                  <div className="admin-meta-row">
                    <div className="admin-actions" style={{ gap: 18 }}>
                      <span className="admin-help">Estado: {stringValue(version.status, "published")}</span>
                      <span className="admin-help">Usuario: {stringValue(version.uploadedBy, "n/d")}</span>
                    </div>
                  </div>
                  {!isActive && (
                    <form action={rollbackVersionAction} style={{ marginTop: 18 }}>
                      <input name="datasetVersionId" type="hidden" value={versionId} />
                      <button className="admin-button-secondary" type="submit">
                        Revertir a esta versión
                      </button>
                    </form>
                  )}
                </Card>
              );
            })}
          </div>
          <AdminPagination basePath="/publications" page={versions.page} totalPages={versions.totalPages} />
        </>
      ) : (
        <Card title="Sin versiones publicadas">Aún no se ha publicado ninguna versión.</Card>
      )}
    </div>
  );
}
