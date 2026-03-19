"use client";

import { Card, SectionHeading } from "@cnbs/ui";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <SectionHeading
        eyebrow="Servicio"
        title="No fue posible cargar esta vista"
        description="El dashboard no pudo completar la consulta en este momento. Intenta recargar sin perder el estado operativo publicado."
      />
      <Card title="Error temporal" subtitle="La version activa y los artefactos publicados no se modificaron.">
        <button
          onClick={() => reset()}
          style={{
            border: "none",
            borderRadius: 999,
            background: "#0f766e",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 700,
            padding: "12px 18px"
          }}
          type="button"
        >
          Reintentar
        </button>
      </Card>
    </div>
  );
}
