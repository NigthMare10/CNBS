"use client";

import { Card, SectionHeading } from "@cnbs/ui";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="admin-page">
      <SectionHeading
        eyebrow="Admin"
        title="No fue posible completar la operación"
        description="La vista encontró un error recuperable. Los artefactos publicados y la versión activa no se alteraron."
      />
      <Card>
        <button className="admin-button" onClick={() => reset()} type="button">
          Reintentar
        </button>
      </Card>
    </div>
  );
}
