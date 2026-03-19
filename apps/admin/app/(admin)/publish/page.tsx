import { Card, SectionHeading } from "@cnbs/ui";
import { publishRunAction } from "../../actions";
import { AdminPagination } from "../../../components/admin-pagination";
import { formatAdminDateTime } from "../../../lib/date-time";
import { getOperationalLabel } from "../../../lib/traceability";
import { getAdminJson } from "../../../lib/api";
import { requireAdminSession } from "../../../lib/auth";

export default async function PublishPage({ searchParams }: { searchParams: Promise<{ error?: string; page?: string }> }) {
  const session = await requireAdminSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const [response, systemStatus] = await Promise.all([
    getAdminJson<{ items: Array<Record<string, unknown>>; page: number; totalPages: number }>(
      `/api/admin/ingestions?page=${page}&pageSize=8`,
      session
    ),
    getAdminJson<Record<string, unknown>>("/api/admin/system/status", session)
  ]);
  const runs = response.items;
  const activeDataset = systemStatus.activeDataset as Record<string, unknown> | undefined;
  const activeVersionId = typeof activeDataset?.datasetVersionId === "string" ? activeDataset.datasetVersionId : null;

  function publishabilityOf(value: unknown, fallback: string): string {
    if (typeof value === "object" && value !== null && "publishability" in value) {
      const publishability = (value as { publishability?: unknown }).publishability;
      return typeof publishability === "string" ? publishability : fallback;
    }

    return fallback;
  }

  function mergedPublishability(run: Record<string, unknown>): string {
    const validation = publishabilityOf(run.validationSummary, "blocked");
    const reconciliation = publishabilityOf(run.reconciliationSummary, "warningOnly");
    if (validation === "blocked" || reconciliation === "blocked") {
      return "blocked";
    }
    if (validation === "warningOnly" || reconciliation === "warningOnly") {
      return "warningOnly";
    }
    return "publishable";
  }

  return (
    <div className="admin-page">
      <SectionHeading
        eyebrow="Publicación"
        title="Activar versión validada"
        description="La activación reemplaza atómicamente el puntero activo del dataset."
      />

      {params.error && <div className="admin-alert--error">{params.error}</div>}

      {runs.length > 0 ? (
        <>
          <div className="admin-list">
          {runs.map((run: Record<string, unknown>) => {
            const runPublishability = mergedPublishability(run);
            return (
            <Card key={String(run.ingestionRunId)} title={String(run.ingestionRunId)} subtitle={formatAdminDateTime(typeof run.createdAt === "string" ? run.createdAt : "") }>
              <div className="admin-page">
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
                <div className="admin-help">
                  Publica esta corrida para generar una versión inmutable en `storage/published/` y actualizar la versión activa del sistema.
                </div>
                {runPublishability === "blocked" ? (
                  <div className="admin-alert--error">
                    Esta corrida está bloqueada y no puede publicarse hasta resolver los issues críticos o altos detectados en validación o reconciliación.
                  </div>
                ) : null}
                {typeof run.publishedDatasetVersionId === "string" && run.publishedDatasetVersionId.length > 0 ? (
                  <div className={activeVersionId === run.publishedDatasetVersionId ? "admin-alert--success" : "admin-alert"}>
                    {activeVersionId === run.publishedDatasetVersionId
                      ? `Esta corrida ya fue publicada y corresponde a la versión activa (${run.publishedDatasetVersionId}).`
                      : `Esta corrida ya fue publicada como ${run.publishedDatasetVersionId} el ${formatAdminDateTime(typeof run.publishedAt === "string" ? run.publishedAt : "")}.`}
                  </div>
                ) : runPublishability === "blocked" ? (
                  <button className="admin-button-secondary" disabled type="button">
                    Publicación bloqueada
                  </button>
                ) : (
                  <form action={publishRunAction}>
                    <input type="hidden" name="runId" value={String(run.ingestionRunId)} />
                    <button className="admin-button" type="submit">
                      Publicar corrida
                    </button>
                  </form>
                )}
              </div>
            </Card>
          )})}
          </div>
          <AdminPagination basePath="/publish" page={response.page} totalPages={response.totalPages} />
        </>
      ) : (
        <Card title="Sin corridas disponibles">Primero sube una corrida válida en la ruta de carga para habilitar la publicación.</Card>
      )}
    </div>
  );
}
