import type { PropsWithChildren, ReactNode } from "react";

interface CardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, actions, className, children }: CardProps) {
  return (
    <section
      className={className}
      style={{
        borderRadius: 24,
        border: "1px solid rgba(148, 163, 184, 0.22)",
        background: "rgba(255, 255, 255, 0.94)",
        padding: 24,
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)"
      }}
    >
      {(title || subtitle || actions) && (
        <div
          style={{
            marginBottom: 18,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap"
          }}
        >
          <div style={{ minWidth: 0 }}>
            {title && (
              <h3 style={{ margin: 0, color: "#0f172a", fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{title}</h3>
            )}
            {subtitle && (
              <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>{subtitle}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
