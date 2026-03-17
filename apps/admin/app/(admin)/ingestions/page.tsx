import Link from "next/link";
import { Badge, Card, SectionHeading } from "@cnbs/ui";
import { AdminPagination } from "../../../components/admin-pagination";
import { WorkbookClassificationSummary } from "../../../components/workbook-classification-summary";
import { formatAdminDateTime } from "../../../lib/date-time";
import { getDerivedArtifactsSummary } from "../../../lib/derived-coverage";
import { getOperationalLabel } from "../../../lib/traceability";
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
  const systemStatus = await getAdminJson<Record<string, unknown>>("/api/admin/system/status", session);
  const activeDataset = systemStatus.activeDataset as Record<string, unknown> | undefined;
  const activeVersionId = typeof activeDataset?.datasetVersionId === "string" ? activeDataset.datasetVersionId : null;

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
                subtitle={formatAdminDateTime(stringValue(run.createdAt))}
                actions={
                  <div className="admin-actions">
                    <Badge>{publishabilityOf(run.validationSummary, "blocked")}</Badge>
                    <Badge>{publishabilityOf(run.reconciliationSummary, "warningOnly")}</Badge>
                    <Badge>{stringValue(run.publicationState, "staged")}</Badge>
                  </div>
                }
              >
                <div className="admin-grid-fluid">
                  <div className="admin-meta-item">
                    <span className="admin-meta-item__label">Etiqueta operativa</span>
                    <span className="admin-meta-item__value">
                      {getOperationalLabel({
                        datasetScope: run.draftDatasetVersion && typeof run.draftDatasetVersion === "object" ? (run.draftDatasetVersion as Record<string, unknown>).datasetScope : undefined,
                        businessPeriods: run.draftDatasetVersion && typeof run.draftDatasetVersion === "object" ? (run.draftDatasetVersion as Record<string, unknown>).businessPeriods : undefined,
                        status: run.publicationState
                      })}
                    </span>
                  </div>
                  <div className="admin-meta-item">
                    <span className="admin-meta-item__label">Usuario</span>
                    <span className="admin-meta-item__value">{stringValue(run.uploadedBy, "n/d")}</span>
                  </div>
                  <div className="admin-meta-item">
                    <span className="admin-meta-item__label">Archivos recibidos</span>
                    <span className="admin-meta-item__value">{Array.isArray(run.sourceFiles) ? run.sourceFiles.length : 0}</span>
                  </div>
                  <div className="admin-meta-item">
                    <span className="admin-meta-item__label">Dataset version</span>
                    <span className="admin-meta-item__value">{stringValue(run.publishedDatasetVersionId, "Aún no publicada")}</span>
                  </div>
                  <div className="admin-meta-item">
                    <span className="admin-meta-item__label">Publicado</span>
                    <span className="admin-meta-item__value">
                      {run.publishedAt ? formatAdminDateTime(stringValue(run.publishedAt)) : "No publicado"}
                    </span>
                  </div>
                </div>

                {run.publishedDatasetVersionId && activeVersionId === run.publishedDatasetVersionId ? (
                  <div className="admin-alert--success" style={{ marginTop: 18 }}>
                    Esta corrida produjo la versión activa actual del sistema.
                  </div>
                ) : run.publishedDatasetVersionId ? (
                  <div className="admin-alert" style={{ marginTop: 18 }}>
                    Esta corrida ya fue publicada y generó una versión histórica.
                  </div>
                ) : null}

                <div className="admin-meta-item" style={{ marginTop: 18 }}>
                  <span className="admin-meta-item__label">Derivados esperados</span>
                  <span className="admin-meta-item__value">
                    {getDerivedArtifactsSummary(
                      run.draftDatasetVersion && typeof run.draftDatasetVersion === "object"
                        ? ((run.draftDatasetVersion as Record<string, unknown>).domainAvailability as Record<string, Record<string, unknown>> | undefined)
                        : undefined
                    ).join(" · ") || "No se derivarán artefactos públicos con esta corrida."}
                  </span>
                </div>

                <div className="admin-actions" style={{ marginTop: 18 }}>
                  <Link className="admin-link" href="/reconciliation">
                    Revisar reconciliación
                  </Link>
                  <Link className="admin-link" href="/publish">
                    Ir a publicación
                  </Link>
                </div>

                <WorkbookClassificationSummary run={run} title="Resumen de clasificación del archivo" />
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
