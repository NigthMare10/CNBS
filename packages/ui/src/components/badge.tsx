import type { CSSProperties, PropsWithChildren } from "react";

const palette: Record<string, CSSProperties> = {
  published: { background: "#dcfce7", color: "#166534", borderColor: "#86efac" },
  staged: { background: "#fef3c7", color: "#92400e", borderColor: "#fcd34d" },
  failed: { background: "#ffe4e6", color: "#be123c", borderColor: "#fda4af" },
  warningOnly: { background: "#fef3c7", color: "#92400e", borderColor: "#fcd34d" },
  blocked: { background: "#ffe4e6", color: "#be123c", borderColor: "#fda4af" },
  publishable: { background: "#dcfce7", color: "#166534", borderColor: "#86efac" }
};

export function Badge({ children }: PropsWithChildren) {
  const value = typeof children === "string" ? children : "";
  const color = palette[value] ?? { background: "#e2e8f0", color: "#334155", borderColor: "#cbd5e1" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 700,
        border: "1px solid",
        textTransform: "capitalize",
        letterSpacing: "0.02em",
        ...color
      }}
    >
      {children}
    </span>
  );
}
