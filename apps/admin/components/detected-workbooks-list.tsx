import { Badge, Card } from "@cnbs/ui";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "premiums":
      return "Workbook de primas";
    case "financialPosition":
      return "Estado de situación financiera";
    case "incomeStatement":
      return "Estado de resultados";
    case "reference":
      return "Referencia opcional";
    default:
      return "Unknown / no clasificado";
  }
}

export function DetectedWorkbooksList({
  run,
  title = "Archivos detectados"
}: {
  run: Record<string, unknown>;
  title?: string;
}) {
  const sourceFiles = Array.isArray(run.sourceFiles) ? (run.sourceFiles as Array<Record<string, unknown>>) : [];

  if (sourceFiles.length === 0) {
    return null;
  }

  return (
    <Card title={title} subtitle="Clasificación automática basada en estructura, hojas, encabezados y señales semánticas.">
      <div className="admin-list">
        {sourceFiles.map((file, index) => {
          const originalFilename = stringValue(file.originalFilename, `archivo-${index + 1}.xlsx`);
          const kind = stringValue(file.kind, "unknown");
          const signature = stringValue(file.detectedSignature, "sin firma detectada");

          return (
            <div className="admin-list-row" key={`${originalFilename}-${index}`}>
              <div className="admin-list-row__content">
                <span className="admin-list-row__title">{originalFilename}</span>
                <span className="admin-list-row__meta">{kindLabel(kind)} · {signature}</span>
              </div>
              <Badge>{kind}</Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
