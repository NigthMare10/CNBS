import { Card, SectionHeading } from "@cnbs/ui";
import { publishRunAction } from "../../actions";
import { AdminPagination } from "../../../components/admin-pagination";
import { getAdminJson } from "../../../lib/api";
import { requireAdminSession } from "../../../lib/auth";

export default async function PublishPage({ searchParams }: { searchParams: Promise<{ error?: string; page?: string }> }) {
  const session = await requireAdminSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const response = await getAdminJson<{ items: Array<Record<string, unknown>>; page: number; totalPages: number }>(
    `/api/admin/ingestions?page=${page}&pageSize=8`,
    session
  );
  const runs = response.items;

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
          {runs.map((run: Record<string, unknown>) => (
            <Card key={String(run.ingestionRunId)} title={String(run.ingestionRunId)} subtitle={String(run.createdAt)}>
              <div className="admin-page">
                <div className="admin-help">
                  Publica esta corrida para generar una versión inmutable en `storage/published/` y actualizar la versión activa del sistema.
                </div>
                <form action={publishRunAction}>
                  <input type="hidden" name="runId" value={String(run.ingestionRunId)} />
                  <button className="admin-button" type="submit">
                    Publicar corrida
                  </button>
                </form>
              </div>
            </Card>
          ))}
          </div>
          <AdminPagination basePath="/publish" page={response.page} totalPages={response.totalPages} />
        </>
      ) : (
        <Card title="Sin corridas disponibles">Primero sube una corrida válida en la ruta de carga para habilitar la publicación.</Card>
      )}
    </div>
  );
}
