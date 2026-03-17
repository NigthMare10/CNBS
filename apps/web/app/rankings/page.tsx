import { Card, EmptyState, SectionHeading } from "@cnbs/ui";
import { publicApi } from "../../lib/api";

export const dynamic = "force-dynamic";

function currency(value: number) {
  return new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL", maximumFractionDigits: 0 }).format(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function RankingsPage() {
  const rankings = (await publicApi.rankings()) as Record<string, Array<Record<string, unknown>>>;
  const rankingGroups = [
    { key: "premiums", title: "Primas", description: "Posición por primas oficiales publicadas." },
    { key: "assets", title: "Activos", description: "Comparativo por activos totales del balance." },
    { key: "equity", title: "Patrimonio", description: "Comparativo por patrimonio reportado." }
  ];

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <SectionHeading
        eyebrow="Rankings"
        title="Comparativos institucionales"
        description="Cuadros derivados de datos oficiales habilitados en fase 1."
      />
      <div className="page-grid-3">
        {rankingGroups.map((group) => {
          const items = (rankings[group.key] ?? []).slice(0, 12);

          return (
            <Card key={group.key} title={group.title} subtitle={group.description}>
              {items.length > 0 ? (
                <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                  {items.map((item, index) => (
                    <li
                      key={`${group.key}-${stringValue(item.institutionId, stringValue(item.institutionName, String(index)))}`}
                      className="flow-list__item"
                    >
                      <span style={{ color: "#334155", lineHeight: 1.5 }}>
                        <strong style={{ color: "#0f172a" }}>{index + 1}.</strong> {stringValue(item.institutionName, stringValue(item.institutionId))}
                      </span>
                      <strong style={{ color: "#0f172a", whiteSpace: "nowrap" }}>
                        {currency(Number(item.premiumAmount ?? item.totalAssets ?? item.equity ?? 0))}
                      </strong>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState title="Sin ranking disponible" description="La versión activa no contiene registros suficientes para este comparativo." />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
