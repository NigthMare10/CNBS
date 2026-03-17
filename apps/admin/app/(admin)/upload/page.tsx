import { Card, SectionHeading } from "@cnbs/ui";
import { uploadWorkbookSetAction } from "../../actions";

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

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

      <Card>
        <form action={uploadWorkbookSetAction} className="admin-form">
          <div className="admin-grid-3">
            <label className="admin-field">
              <span className="admin-label">Workbook de primas</span>
              <span className="admin-help">Fuente primaria oficial de primas en fase 1. Puede cargarse sola.</span>
              <input className="admin-file" name="premiums" type="file" accept=".xlsx" />
            </label>

            <label className="admin-field">
              <span className="admin-label">Estado de situación financiera</span>
              <span className="admin-help">Fuente primaria oficial para balance y highlights financieros. Puede cargarse sola.</span>
              <input className="admin-file" name="financialPosition" type="file" accept=".xlsx" />
            </label>

            <label className="admin-field">
              <span className="admin-label">Workbook de referencia (opcional)</span>
              <span className="admin-help">Solo se usa como apoyo de reconciliación y entendimiento gráfico. No es requisito operativo.</span>
              <input className="admin-file" name="reference" type="file" accept=".xlsx" />
            </label>
          </div>

          <div className="admin-inline-note">
            La web pública no consulta Excel en runtime. Solo las versiones publicadas del dataset quedan disponibles para el sitio.
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
