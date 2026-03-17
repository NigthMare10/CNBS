"use client";

import { useMemo, useState } from "react";

function fallbackCopy(text: string): boolean {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export function JsonViewerWithCopy({
  value,
  summary = "Ver JSON completo"
}: {
  value: unknown;
  summary?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const json = useMemo(() => JSON.stringify(value, null, 2), [value]);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json);
        setStatus("copied");
        return;
      }

      if (fallbackCopy(json)) {
        setStatus("copied");
        return;
      }

      setStatus("error");
    } catch {
      setStatus("error");
    } finally {
      window.setTimeout(() => {
        setStatus("idle");
      }, 2200);
    }
  }

  return (
    <details style={{ marginTop: 20 }}>
      <summary className="admin-link" style={{ cursor: "pointer" }}>
        {summary}
      </summary>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <div className="admin-actions" style={{ justifyContent: "space-between" }}>
          <button className="admin-button-secondary" onClick={() => void handleCopy()} type="button">
            {status === "copied" ? "JSON copiado" : "Copiar JSON"}
          </button>
          <span aria-live="polite" className="admin-help">
            {status === "copied"
              ? "JSON copiado al portapapeles"
              : status === "error"
                ? "No se pudo copiar automáticamente"
                : "Copia el detalle técnico completo para soporte o debugging"}
          </span>
        </div>

        <pre className="admin-code">{json}</pre>
      </div>
    </details>
  );
}
