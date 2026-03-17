import Link from "next/link";
import { Badge, Card, SectionHeading } from "@cnbs/ui";
import { AdminPagination } from "../../../components/admin-pagination";
import { getAdminJson } from "../../../lib/api";
import { requireAdminSession } from "../../../lib/auth";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function publishabilityOf(value: unknown, fallback: string): string {
  if (typeof value === "object" && value !== null && "publishability" in value) {
    const publishability = (value as { publishability?: unknown }).publishability;
    return typeof publishability === "string" ? publishability : fallback;
  }

  return fallback;
}

export default async function IngestionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await requireAdminSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const response =
    (await getAdminJson<{ items: Array<Record<string, unknown>>; page: number; totalPages: number }>(
      `/api/admin/ingestions?page=${page}&pageSize=8`,
      session
    )) ?? { items: [], page: 1, totalPages: 1 };
  const runs = response.items;

  return (
    <div className="admin-page">
      <SectionHeading
        eyebrow="Ingestas"
        title="Corridas en staging"
        description="Lista operativa de corridas cargadas, pendientes de revisión o listas para publicación."
      />

      {runs.length > 0 ? (
        <>
          <div className="admin-list">
            {runs.map((run) => (
              <Card
                key={String(run.ingestionRunId)}
                title={String(run.ingestionRunId)}
                subtitle={String(run.createdAt)}
                actions={
                  <div className="admin-actions">
                    <Badge>{publishabilityOf(run.validationSummary, "blocked")}</Badge>
                    <Badge>{publishabilityOf(run.reconciliationSummary, "warningOnly")}</Badge>
                  </div>
                }
              >
                <div className="admin-grid-fluid">
                  <div className="admin-meta-item">
                    <span className="admin-meta-item__label">Usuario</span>
                    <span className="admin-meta-item__value">{stringValue(run.uploadedBy, "n/d")}</span>
                  </div>
                  <div className="admin-meta-item">
                    <span className="admin-meta-item__label">Archivos recibidos</span>
                    <span className="admin-meta-item__value">{Array.isArray(run.sourceFiles) ? run.sourceFiles.length : 0}</span>
                  </div>
                </div>

                <div className="admin-actions" style={{ marginTop: 18 }}>
                  <Link className="admin-link" href="/reconciliation">
                    Revisar reconciliación
                  </Link>
                  <Link className="admin-link" href="/publish">
                    Ir a publicación
                  </Link>
                </div>
              </Card>
            ))}
          </div>
          <AdminPagination basePath="/ingestions" page={response.page} totalPages={response.totalPages} />
        </>
      ) : (
        <Card title="Sin corridas">No hay ingestas en staging todavía.</Card>
      )}
    </div>
  );
}
