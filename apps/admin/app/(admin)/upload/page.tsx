import { Card, SectionHeading } from "@cnbs/ui";
import { DetectedWorkbooksList } from "../../../components/detected-workbooks-list";
import { WorkbookClassificationSummary } from "../../../components/workbook-classification-summary";
import { uploadWorkbookSetAction } from "../../actions";
import { getAdminJson } from "../../../lib/api";
import { requireAdminSession } from "../../../lib/auth";

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireAdminSession();
  const params = await searchParams;
  const latestRuns = await getAdminJson<{ items: Array<Record<string, unknown>> }>(
    "/api/admin/ingestions?page=1&pageSize=1",
    session
  );
  const latestRun = latestRuns.items.at(0);

  return (
    <div className="admin-page">
      <section className="admin-hero">
        <p className="admin-hero__eyebrow">Carga Manual</p>
        <h1 className="admin-hero__title">Sube la corrida de trabajo y envíala a staging para validación.</h1>
        <p className="admin-hero__copy">
          El sistema detecta los workbooks por su firma estructural, valida seguridad y genera una corrida lista para revisión
          antes de cualquier publicación institucional.
        </p>
      </section>

      <SectionHeading
        eyebrow="Carga"
        title="Subir workbooks de la corrida"
        description="Detecta por firma estructural, aplica validaciones de seguridad y deja la corrida en staging."
      />

      {params.error && <div className="admin-alert--error">{params.error}</div>}

      {latestRun && (
        <>
          <DetectedWorkbooksList run={latestRun} title="Archivos detectados en la última corrida" />
          <WorkbookClassificationSummary
            run={latestRun}
            title="Última corrida con posible problema de clasificación"
          />
        </>
      )}

      <Card>
        <form action={uploadWorkbookSetAction} className="admin-form">
          <label className="admin-field">
            <span className="admin-label">Seleccionar archivos Excel</span>
            <span className="admin-help">
              Puedes subir uno o varios `.xlsx`. El sistema detectará automáticamente si cada archivo corresponde a primas,
              estado de situación financiera, estado de resultados o referencia opcional. Solo primas y estado de situación
              financiera alimentan la publicación pública operativa actual.
            </span>
            <input className="admin-file" name="workbooks" type="file" accept=".xlsx" multiple />
          </label>

          <div className="admin-inline-note">
            No necesitas decidir manualmente el tipo de archivo. La clasificación se hace por firma estructural y contenido, no por nombre.
          </div>

          <div className="admin-actions">
            <button className="admin-button" type="submit">
              Iniciar ingesta
            </button>
            <span className="admin-help">Al terminar se te redirige a la vista de reconciliación.</span>
          </div>
        </form>
      </Card>
    </div>
  );
}
