import { EmptyState, SectionHeading } from "@cnbs/ui";

export default function NotFoundPage() {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <SectionHeading
        eyebrow="Instituciones"
        title="No se encontro la vista solicitada"
        description="La institucion o recurso pedido no esta disponible en la version activa publicada."
      />
      <EmptyState
        title="Recurso no disponible"
        description="Verifica la institucion consultada o regresa a rankings y version para revisar la cobertura actual del dataset."
      />
    </div>
  );
}
