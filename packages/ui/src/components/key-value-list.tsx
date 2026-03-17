interface KeyValueItem {
  key: string;
  label: string;
  value: string;
}

export function KeyValueList({ items, columns = 2 }: { items: KeyValueItem[]; columns?: 1 | 2 | 3 }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
      }}
    >
      {items.map((item) => (
        <div
          key={item.key}
          style={{
            borderRadius: 18,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            padding: "14px 16px"
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b" }}>{item.label}</div>
          <div style={{ marginTop: 8, color: "#0f172a", fontSize: 15, lineHeight: 1.6, wordBreak: "break-word" }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
