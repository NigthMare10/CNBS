export function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "#0f766e" }}>{eyebrow}</p>
      <h2 style={{ margin: 0, color: "#0f172a", fontSize: 34, fontWeight: 750, lineHeight: 1.1 }}>{title}</h2>
      {description && <p style={{ margin: 0, maxWidth: 760, color: "#475569", fontSize: 15, lineHeight: 1.7 }}>{description}</p>}
    </div>
  );
}
