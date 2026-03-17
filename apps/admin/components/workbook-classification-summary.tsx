import { Badge, Card } from "@cnbs/ui";
import { JsonViewerWithCopy } from "./json-viewer-with-copy";

type CandidateScores = Partial<Record<"premiums" | "financialPosition" | "incomeStatement" | "reference" | "unknown", number>>;

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function detailsOf(issue: Record<string, unknown>) {
  const details = issue.details;
  return typeof details === "object" && details !== null ? (details as Record<string, unknown>) : null;
}

function classificationIssuesOf(run: Record<string, unknown>): Array<Record<string, unknown>> {
  const validationSummary = run.validationSummary;
  if (typeof validationSummary !== "object" || validationSummary === null || !("issues" in validationSummary)) {
    return [];
  }

  const issues = (validationSummary as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) {
    return [];
  }

  return issues.filter(
    (issue): issue is Record<string, unknown> =>
      typeof issue === "object" &&
      issue !== null &&
      "code" in issue &&
      (issue as { code?: unknown }).code === "WORKBOOK_SCHEMA_UNRECOGNIZED"
  );
}

function sortedCandidates(scores: CandidateScores) {
  return Object.entries(scores)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((left, right) => right[1] - left[1]);
}

export function WorkbookClassificationSummary({
  run,
  title = "Resumen de clasificación"
}: {
  run: Record<string, unknown>;
  title?: string;
}) {
  const issues = classificationIssuesOf(run);

  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="admin-page">
      {issues.map((issue, index) => {
        const details = detailsOf(issue);
        const candidateScores = (details?.candidateScores as CandidateScores | undefined) ?? {};
        const detectedHeadersBySheet = Array.isArray(details?.detectedHeadersBySheet)
          ? (details.detectedHeadersBySheet as Array<{ sheetName?: unknown; headers?: unknown }>)
          : [];
        const matchedSignals = Array.isArray(details?.matchedSignals) ? (details.matchedSignals as unknown[]) : [];

        return (
          <Card
            key={`${stringValue(issue.scope, "issue")}-${index}`}
            title={title}
            subtitle="El archivo no pudo clasificarse con confianza suficiente. Revisa señales detectadas y carga una versión con estructura reconocible."
          >
            <div className="admin-page">
              <div className="admin-alert--warning">
                <strong>Razón principal del bloqueo:</strong> {stringValue(issue.message, "No se pudo clasificar el workbook.")}
              </div>

              <div className="admin-grid-2">
                <div className="admin-meta-list">
                  <div className="admin-meta-item">
                    <span className="admin-meta-item__label">Archivo afectado</span>
                    <span className="admin-meta-item__value">{stringValue(issue.scope, "Desconocido")}</span>
                  </div>
                  <div className="admin-meta-item">
                    <span className="admin-meta-item__label">Acción sugerida</span>
                    <span className="admin-meta-item__value">
                      Verifica que el workbook tenga una hoja tabular válida y encabezados coherentes con primas, balance o estado de resultados.
                    </span>
                  </div>
                </div>

                <div className="admin-meta-item">
                  <span className="admin-meta-item__label">Señales detectadas</span>
                  <div className="admin-actions">
                    {matchedSignals.length > 0 ? (
                      matchedSignals.slice(0, 8).map((signal, signalIndex) => <Badge key={signalIndex}>{stringValue(signal)}</Badge>)
                    ) : (
                      <span className="admin-help">No se detectaron señales suficientes.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-grid-2">
                <Card title="Candidatos detectados" subtitle="Puntaje por tipo probable de archivo.">
                  <div className="admin-list">
                    {sortedCandidates(candidateScores).length > 0 ? (
                      sortedCandidates(candidateScores).map(([candidate, score]) => (
                        <div className="admin-list-row" key={candidate}>
                          <div className="admin-list-row__content">
                            <span className="admin-list-row__title">{candidate}</span>
                            <span className="admin-list-row__meta">Score de clasificación</span>
                          </div>
                          <strong>{score}</strong>
                        </div>
                      ))
                    ) : (
                      <div className="admin-alert">No hubo candidatos con score suficiente.</div>
                    )}
                  </div>
                </Card>

                <Card title="Hojas y headers detectados" subtitle="Vista rápida del workbook recibido.">
                  <div className="admin-list">
                    {detectedHeadersBySheet.length > 0 ? (
                      detectedHeadersBySheet.map((entry, entryIndex) => (
                        <div className="admin-list-row" key={`${stringValue(entry.sheetName, "sheet")}-${entryIndex}`}>
                          <div className="admin-list-row__content">
                            <span className="admin-list-row__title">{stringValue(entry.sheetName, "Hoja")}</span>
                            <span className="admin-list-row__meta">
                              {Array.isArray(entry.headers) && entry.headers.length > 0
                                ? entry.headers.map((header) => stringValue(header)).join(" · ")
                                : "Sin headers detectados"}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="admin-alert">No fue posible extraer una vista útil de hojas y encabezados.</div>
                    )}
                  </div>
                </Card>
              </div>

              <JsonViewerWithCopy summary="Ver y copiar detalle técnico completo" value={issue} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
