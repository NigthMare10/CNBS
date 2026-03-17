interface MetricItem {
  key: string;
  label: string;
  value: string;
  hint?: string;
}

export function MetricGrid({ items }: { items: MetricItem[] }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 16,
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
      }}
    >
      {items.map((item) => (
        <article
          key={item.key}
          style={{
            borderRadius: 24,
            background: "linear-gradient(145deg, #0f172a 0%, #1e293b 100%)",
            padding: "22px 22px 20px",
            color: "#f8fafc",
            boxShadow: "0 24px 48px rgba(15, 23, 42, 0.14)"
          }}
        >
          <p style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.18em", color: "#94a3b8" }}>{item.label}</p>
          <p style={{ margin: "12px 0 0", fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>{item.value}</p>
          {item.hint && <p style={{ margin: "10px 0 0", fontSize: 14, color: "#cbd5e1", lineHeight: 1.5 }}>{item.hint}</p>}
        </article>
      ))}
    </div>
  );
}
