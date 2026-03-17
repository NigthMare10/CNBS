export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div
      style={{
        borderRadius: 24,
        border: "1px dashed #cbd5e1",
        background: "rgba(255,255,255,0.78)",
        padding: "32px 24px",
        textAlign: "center"
      }}
    >
      <h3 style={{ margin: 0, color: "#0f172a", fontSize: 22, fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: "10px auto 0", maxWidth: 560, color: "#64748b", lineHeight: 1.7 }}>{description}</p>
    </div>
  );
}
