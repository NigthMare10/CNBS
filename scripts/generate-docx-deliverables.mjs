import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const workspaceRoot = resolve(process.cwd());
const deliverablesDir = resolve(workspaceRoot, "deliverables");
const sourcesDir = resolve(deliverablesDir, "_sources");

mkdirSync(deliverablesDir, { recursive: true });
mkdirSync(sourcesDir, { recursive: true });

const documentDate = new Intl.DateTimeFormat("es-HN", {
  day: "2-digit",
  month: "long",
  year: "numeric"
}).format(new Date());

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function paragraph(text) {
  return `<p>${text}</p>`;
}

function bullets(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function ordered(items) {
  return `<ol>${items.map((item) => `<li>${item}</li>`).join("")}</ol>`;
}

function table(headers, rows, caption = "") {
  return `
    <table>
      ${caption ? `<caption>${caption}</caption>` : ""}
      <thead>
        <tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>
  `;
}

function callout(title, body, variant = "note") {
  return `<div class="callout ${variant}"><strong>${title}</strong><div>${body}</div></div>`;
}

function diagram(title, body) {
  return `
    <div class="diagram-card">
      <div class="diagram-title">${title}</div>
      ${body}
    </div>
  `;
}

function boxRow(cells) {
  return `<table class="diagram-table"><tbody><tr>${cells.join("")}</tr></tbody></table>`;
}

function box(text, variant = "default", colspan = 1) {
  return `<td class="diagram-box ${variant}" colspan="${colspan}">${text}</td>`;
}

function arrow(text = "→") {
  return `<td class="diagram-arrow">${text}</td>`;
}

function section(number, id, title, content) {
  return `<section id="${id}"><h1>${number}. ${title}</h1>${content}</section>`;
}

function coverPage(input) {
  return `
    <section class="cover-page">
      <div class="cover-rule"></div>
      <p class="cover-kicker">${input.kicker}</p>
      <h1 class="cover-title">${input.title}</h1>
      <p class="cover-subtitle">${input.subtitle}</p>
      <table class="cover-meta">
        <tbody>
          <tr><th>Versión del documento</th><td>${input.version}</td></tr>
          <tr><th>Fecha</th><td>${input.date}</td></tr>
          <tr><th>Responsable</th><td>${input.owner}</td></tr>
          <tr><th>Estado</th><td>${input.status}</td></tr>
        </tbody>
      </table>
      <p class="cover-note">${input.note}</p>
    </section>
  `;
}

function tocPage(title, sections) {
  return `
    <section>
      <h1>${title}</h1>
      <div class="toc-box">
        <ol>
          ${sections.map((item) => `<li><a href="#${item.id}">${item.number}. ${item.title}</a></li>`).join("")}
        </ol>
      </div>
    </section>
  `;
}

function buildHtmlDocument(input) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    @page { size: A4; margin: 2.1cm 1.8cm 2.1cm 1.8cm; }
    body {
      font-family: Calibri, Arial, sans-serif;
      color: #162234;
      font-size: 11pt;
      line-height: 1.45;
      margin: 0;
    }
    h1, h2, h3 {
      color: #0f2f4a;
      margin: 0 0 10pt;
    }
    h1 { font-size: 18pt; border-bottom: 2px solid #0f766e; padding-bottom: 4pt; margin-top: 18pt; }
    h2 { font-size: 14pt; margin-top: 14pt; }
    h3 { font-size: 12pt; margin-top: 12pt; }
    p, li { margin: 0 0 7pt; }
    ul, ol { margin: 0 0 10pt 18pt; padding: 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10pt 0 14pt;
      font-size: 10pt;
    }
    caption {
      caption-side: top;
      text-align: left;
      font-weight: 700;
      color: #0f2f4a;
      margin-bottom: 4pt;
    }
    th, td {
      border: 1px solid #b8c8d6;
      padding: 6pt 7pt;
      vertical-align: top;
    }
    th {
      background: #113a5c;
      color: #ffffff;
      font-weight: 700;
    }
    code {
      font-family: Consolas, "Courier New", monospace;
      font-size: 9.5pt;
      background: #edf4f7;
      padding: 1pt 3pt;
      border-radius: 3pt;
    }
    .page-break { page-break-before: always; }
    .cover-page {
      min-height: 24cm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      text-align: center;
      border: 1px solid #c7d3dc;
      padding: 1.5cm;
      background: linear-gradient(180deg, #f5fbfb 0%, #ffffff 100%);
    }
    .cover-rule {
      width: 30%;
      margin: 0 auto 18pt;
      border-top: 5px solid #0f766e;
    }
    .cover-kicker {
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #0f766e;
      font-weight: 700;
      margin-bottom: 12pt;
    }
    .cover-title {
      font-size: 24pt;
      border: none;
      margin: 0 0 12pt;
      padding: 0;
    }
    .cover-subtitle {
      font-size: 12pt;
      color: #475569;
      margin: 0 auto 18pt;
      max-width: 80%;
    }
    .cover-meta {
      width: 70%;
      margin: 0 auto 16pt;
      font-size: 10.5pt;
    }
    .cover-meta th {
      width: 38%;
      text-align: left;
      background: #e7f4f1;
      color: #0f2f4a;
    }
    .cover-note {
      color: #475569;
      font-size: 10.5pt;
    }
    .toc-box {
      border: 1px solid #c7d3dc;
      background: #fbfdfe;
      padding: 12pt 14pt;
    }
    .toc-box a {
      color: #0f2f4a;
      text-decoration: none;
    }
    .callout {
      border-left: 5px solid #0f766e;
      background: #f4fbf9;
      padding: 9pt 11pt;
      margin: 10pt 0 12pt;
    }
    .callout.warning { border-left-color: #b45309; background: #fff7ed; }
    .callout.risk { border-left-color: #b91c1c; background: #fef2f2; }
    .diagram-card {
      border: 1px solid #b8c8d6;
      background: #fbfdfe;
      padding: 10pt;
      margin: 10pt 0 14pt;
    }
    .diagram-title {
      font-weight: 700;
      color: #0f2f4a;
      margin-bottom: 8pt;
    }
    .diagram-table { margin: 0; }
    .diagram-box {
      border: 2px solid #0f766e;
      background: #e7f8f4;
      text-align: center;
      font-weight: 700;
      padding: 10pt 8pt;
    }
    .diagram-box.dark { background: #dbeafe; border-color: #1d4ed8; }
    .diagram-box.warn { background: #fef3c7; border-color: #b45309; }
    .diagram-box.risk { background: #fee2e2; border-color: #b91c1c; }
    .diagram-arrow {
      border: none;
      width: 6%;
      text-align: center;
      font-size: 16pt;
      color: #0f766e;
      font-weight: 700;
    }
    .small { font-size: 9.5pt; color: #475569; }
    .muted { color: #475569; }
    .two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14pt;
    }
  </style>
</head>
<body>
${input.body}
</body>
</html>
  `.trim();
}

function buildTechnicalDocumentHtml() {
  const sections = [
    {
      number: "1",
      id: "resumen-ejecutivo",
      title: "Resumen ejecutivo",
      content:
        paragraph("La plataforma CNBS Dashboard es una solución institucional para ingesta manual segura, validación, reconciliación, publicación versionada, activación controlada y consulta pública de información del sector asegurador.") +
        paragraph("El sistema está construido como un monorepo modular con tres planos principales: portal público, módulo administrativo y API/ETL. La primera versión operativa usa exclusivamente dos fuentes primarias reales: <code>premiums</code> y <code>financialPosition</code>. El informe preliminar se mantiene como referencia metodológica y de fórmulas, pero no participa como fuente runtime.") +
        bullets([
          "Reduce dependencia de procesos manuales y de hojas de cálculo abiertas en tiempo de consulta.",
          "Introduce staging, validación, reconciliación, publicación inmutable, versión activa y rollback.",
          "Protege la integridad pública mediante la regla de honestidad: si un dato no es derivable con integridad, se muestra como no disponible.",
          "Deja trazabilidad operativa desde la corrida cargada hasta la versión activa servida por el sitio público."
        ]) +
        callout(
          "Criterio de verdad del documento",
          "Este documento se elaboró a partir del código real del repositorio, configuraciones, rutas, pruebas automatizadas y documentación existente en <code>docs/</code> y <code>docs/skills/</code>. Cuando un aspecto no pudo afirmarse con certeza, se declara como limitación, supuesto o pendiente.",
          "note"
        )
    },
    {
      number: "2",
      id: "antecedentes",
      title: "Antecedentes y contexto del proyecto",
      content:
        paragraph("La necesidad observable del proyecto es reemplazar un consumo operativo frágil basado en workbooks aislados por un proceso trazable y controlado que convierta archivos Excel institucionales en datasets publicados y reutilizables por aplicaciones web.") +
        paragraph("La arquitectura y el código muestran una orientación clara a resolver cuatro problemas de negocio: estandarizar la carga, homologar datos, publicar versiones inmutables y evitar que el sitio público dependa directamente de Excel. La existencia de staging, reconciliación, auditoría y rollback evidencia una preocupación explícita por control de calidad, reversibilidad y gobierno del dato.") +
        table(
          ["Tema", "Evidencia observada", "Interpretación documental"],
          [
            ["Entrada de datos", "Carga manual multiarchivo en admin y clasificación por firma", "El sistema está pensado para operación controlada por personal institucional."],
            ["Gobierno del dato", "Validación, reconciliación, publicación versionada y auditoría", "Existe enfoque de control previo a exposición pública."],
            ["Operación pública", "Portal público consume solo artefactos publicados", "La consulta pública se desacopla del procesamiento pesado y de los archivos fuente."],
            ["Respaldo operativo", "Rollback inmediato a una versión anterior", "Se prioriza continuidad operativa y reversibilidad."],
            ["Restricción metodológica", "Solo <code>premiums</code> y <code>financialPosition</code> son operativos", "La primera versión está deliberadamente acotada para preservar integridad." ]
          ],
          "Contexto funcional derivado del repositorio auditado"
        )
    },
    {
      number: "3",
      id: "alcance",
      title: "Alcance funcional y no funcional",
      content:
        table(
          ["Categoría", "Incluido en la primera versión", "Fuera de alcance o limitado"],
          [
            ["Fuentes operativas", "<code>premiums</code>, <code>financialPosition</code>", "<code>incomeStatement</code> como fuente pública; claims/siniestros oficiales"],
            ["Funciones administrativas", "Login, carga, listado de corridas, reconciliación, publicación, versiones, historial, auditoría", "Aprobaciones humanas multi-etapa, flujos BPM, firmas formales"],
            ["Funciones públicas", "Home, rankings, versión activa, ficha institucional", "Analíticas históricas completas, exploradores avanzados, exportación pública"],
            ["Persistencia", "Filesystem versionado local", "Base de datos transaccional, colas distribuidas, object storage"],
            ["Seguridad", "Validación de upload, sesión firmada, token firmado admin/API, RBAC, headers básicos, rate limiting", "MFA, CSP/HSTS completos, autorización OIDC por grupos, antivirus/sandbox"],
            ["Observabilidad", "Health, métricas runtime en memoria, auditoría, trazabilidad de versión", "Monitoreo centralizado, alertas, trazas distribuidas, SIEM"],
            ["Rendimiento", "Materialización de artefactos, caché en memoria, reducción de payloads, lazy charts", "Escalado horizontal con caché distribuida o CDN especializada"]
          ],
          "Alcance observado en el sistema actual"
        ) +
        callout(
          "Restricción operativa clave",
          "El informe preliminar no se usa como fuente runtime. Solo actúa como oráculo de fórmulas, cuadros y relaciones de negocio. Esta restricción se preserva en el pipeline y en la narrativa pública.",
          "warning"
        )
    },
    {
      number: "4",
      id: "metodologia",
      title: "Planificación y metodología de trabajo",
      content:
        paragraph("No se identificó en el repositorio una metodología formal declarada (por ejemplo, Scrum documentado, cronograma o actas). Sin embargo, la estructura del código, las pruebas, la documentación temática y el modelo de publicación permiten inferir una metodología operativa real de carácter iterativo, incremental, modular y orientada a validación.") +
        table(
          ["Rasgo metodológico inferido", "Evidencia", "Valor práctico"],
          [
            ["Iterativo e incremental", "Documentación temática por skills, endurecimientos sucesivos y pruebas de regresión", "Permite cerrar primero estabilidad y luego ampliar cobertura sin romper el flujo base."],
            ["Modular", "Monorepo con <code>apps/*</code> y <code>packages/*</code>", "Separa responsabilidades y facilita mantenimiento."],
            ["Orientado a validación", "Gating explícito por validate/reconcile/publishability", "La publicación depende de controles técnicos previos."],
            ["Versionado por publicaciones", "Datasets inmutables y puntero activo", "Cada publicación es trazable y reversible."],
            ["Hardening progresivo", "Mejoras recientes de seguridad, performance y trazabilidad", "La madurez se construye sin rehacer la arquitectura." ]
          ],
          "Metodología operativa inferida a partir del repositorio"
        ) +
        paragraph("Una lectura razonable de las fases del proyecto es la siguiente:") +
        ordered([
          "Base de monorepo y separación de planos (web, admin, API, ETL, dominio, UI).",
          "Ingesta Excel y clasificación por estructura.",
          "Normalización canónica, validación y reconciliación.",
          "Publicación versionada, versión activa y rollback.",
          "Frontend público y módulo admin operativos.",
          "Hardening de seguridad, resiliencia, trazabilidad y performance.",
          "Cierre documental y preparación para piloto institucional."
        ]) +
        callout(
          "Supuesto metodológico declarado",
          "La planificación documentada en este apartado es inferida del diseño y de la evidencia técnica observable. No se encontró una herramienta formal de gestión del proyecto dentro del repositorio auditado.",
          "warning"
        )
    },
    {
      number: "5",
      id: "arquitectura",
      title: "Arquitectura del sistema",
      content:
        paragraph("La solución usa una arquitectura modular de monorepo con desacoplamiento explícito entre interfaz pública, interfaz administrativa, API y motor de ingestión. El dato público nunca se deriva en tiempo de request a partir de Excel; siempre se sirve desde artefactos publicados y versionados.") +
        diagram(
          "Diagrama de arquitectura general",
          boxRow([
            box("Portal público<br><span class='small'>Next.js + React</span>", "default"),
            arrow("→"),
            box("API pública y privada<br><span class='small'>Fastify</span>", "dark"),
            arrow("↔"),
            box("Servicio ETL / Ingesta<br><span class='small'>clasificación, validación, normalización, publicación</span>", "default"),
            arrow("↔"),
            box("Storage versionado<br><span class='small'>quarantine, staging, published, active, audit</span>", "warn")
          ]) +
            boxRow([
              box("Módulo admin<br><span class='small'>Next.js + server actions</span>", "default"),
              arrow("→"),
              box("Autenticación y control<br><span class='small'>sesión firmada, token firmado, RBAC</span>", "dark"),
              arrow("↗"),
              box("Observabilidad operativa<br><span class='small'>health, route metrics, audit trail, mapping summary</span>", "warn", 3)
            ])
        ) +
        diagram(
          "Diagrama de interacción entre módulos",
          boxRow([
            box("Usuario admin", "default"),
            arrow("→"),
            box("apps/admin", "dark"),
            arrow("→"),
            box("apps/api /api/admin/*", "dark"),
            arrow("→"),
            box("packages/etl", "default")
          ]) +
            boxRow([
              box("Usuario público", "default"),
              arrow("→"),
              box("apps/web", "dark"),
              arrow("→"),
              box("apps/api /api/public/*", "dark"),
              arrow("→"),
              box("storage/published + storage/active", "warn")
            ])
        ) +
        table(
          ["Componente", "Ruta principal", "Responsabilidad"],
          [
            ["Portal público", "<code>apps/web</code>", "Presentar KPIs, rankings, versión activa y fichas institucionales sin leer Excel en runtime."],
            ["Módulo admin", "<code>apps/admin</code>", "Operar login, carga, revisión, publicación, historial y auditoría."],
            ["API", "<code>apps/api</code>", "Exponer endpoints públicos/privados, health, métricas de ruta y filtros multipart."],
            ["ETL y publicación", "<code>packages/etl</code>", "Clasificar, validar, normalizar, reconciliar, construir artefactos y publicar versiones."],
            ["Dominio", "<code>packages/domain</code>", "Modelos canónicos, catálogos, alias, versionado y firma de tokens."],
            ["Configuración", "<code>packages/config</code>", "Entorno, puertos, storage y límites de seguridad."],
            ["Storage local", "<code>storage/*</code>", "Persistencia de cuarentena, staging, datasets publicados, puntero activo y auditoría." ]
          ],
          "Módulos estructurales del repositorio"
        )
    },
    {
      number: "6",
      id: "tecnologias",
      title: "Tecnologías utilizadas",
      content:
        table(
          ["Categoría", "Tecnología", "Uso real dentro del proyecto"],
          [
            ["Lenguaje base", "TypeScript", "Tipado compartido entre apps y packages, contratos y seguridad de compilación."],
            ["Workspace", "pnpm + Turbo", "Monorepo, scripts coordinados de build/lint/test/typecheck."],
            ["Frontend público", "Next.js 15 + React 19", "Portal público con App Router y fetch server-side."],
            ["Frontend admin", "Next.js 15 + React 19", "Panel administrativo con server actions y rutas protegidas."],
            ["API", "Fastify 5", "Endpoints públicos, privados, health y métricas runtime."],
            ["Autenticación federada", "openid-client", "Flujo OIDC con state, nonce y PKCE."],
            ["Parsing Excel", "ExcelJS", "Lectura de workbooks y extracción de filas tabulares."],
            ["Inspección ZIP", "JSZip", "Inspección de seguridad del paquete OOXML."],
            ["Validación", "Zod", "Variables de entorno, contratos de metadata y schemas de workbook."],
            ["Visualización", "ECharts + echarts-for-react", "Charts del sitio público."],
            ["Tablas", "@tanstack/react-table", "Tablas y componentes UI reutilizables."],
            ["Testing", "Vitest", "Unit tests, integración y regresión."],
            ["Logs de desarrollo", "pino-pretty", "Salida legible del API en entorno local."],
            ["Normalización semántica", "slugify + utilidades propias", "Generación de claves, alias y matching canónico." ]
          ],
          "Tecnologías efectivamente usadas según los <code>package.json</code> y el código auditado"
        ) +
        callout(
          "Nota sobre algoritmos especializados",
          "No se identificó un algoritmo formalmente denominado como especializado (por ejemplo, ML u optimización matemática avanzada). La estrategia técnica real se basa en reglas determinísticas: clasificación por señales, matching canónico, materialización de artefactos, caché en memoria, reducción de payload y carga diferida de componentes pesados.",
          "note"
        )
    },
    {
      number: "7",
      id: "modelo-datos",
      title: "Modelo de datos y fuentes de información",
      content:
        table(
          ["Tipo de fuente", "Estado en la versión actual", "Uso dentro del sistema"],
          [
            ["<code>premiums</code>", "Operativa", "Base para primas totales, participación de mercado, primas por institución, primas por ramo y rankings de primas."],
            ["<code>financialPosition</code>", "Operativa", "Base para activos, patrimonio, reservas técnicas, highlights y rankings financieros."],
            ["<code>reference</code>", "No operativa / opcional", "Oráculo para reconciliación y alineación metodológica de cuadros y fórmulas."],
            ["<code>incomeStatement</code>", "Detectable pero no operativa", "Trazabilidad, clasificación y validación semántica; no publica métricas oficiales." ]
          ],
          "Política real de fuentes"
        ) +
        paragraph("El modelo canónico se apoya en catálogos versionados de instituciones, ramos y cuentas financieras. La normalización resuelve alias, diferencias de acentuación, mojibake, espacios dobles, variaciones con slash y casos de mayúsculas/minúsculas irregulares. Cuando un alias puede mapear a más de un candidato, el sistema lo trata como ambiguo y bloquea su aceptación silenciosa.") +
        table(
          ["Dominio", "Columnas o marcadores base", "Derivaciones soportadas"],
          [
            ["Primas", "<code>Fecha Reporte</code>, <code>CodInstitucion</code>, <code>Institucion</code>, <code>RamoPadre</code>, <code>Ramo</code>, <code>Saldo</code>", "Primas por institución, primas por ramo, market share, rankings de primas."],
            ["Balance", "<code>Tipo</code>, <code>Inst</code>, <code>Logo</code>, <code>FechaReporte</code>, <code>Linea</code>, <code>Cuenta</code>, <code>MonedaNacional</code>, <code>MonedaExtranjera</code>", "Activos, patrimonio, reservas técnicas, highlights y rankings financieros."],
            ["ER detectable", "Marcadores como <code>UTILIDAD</code>, <code>RESULTADO NETO</code>, <code>INGRESOS FINANCIEROS</code>", "Solo clasificación y trazabilidad, no publicación operativa." ]
          ],
          "Estructuras de origen relevantes"
        ) +
        diagram(
          "Diagrama de flujo de datos",
          boxRow([
            box("Workbooks cargados", "default"),
            arrow(),
            box("Clasificación y parsing", "dark"),
            arrow(),
            box("Facts canónicos", "default"),
            arrow(),
            box("Aggregates / catálogos / reports", "warn"),
            arrow(),
            box("Sitio público y admin", "dark")
          ])
        )
    },
    {
      number: "8",
      id: "pipeline",
      title: "Pipeline de ingesta y publicación",
      content:
        paragraph("El flujo operativo vigente del proyecto es lineal y gobernado por puntos de control. La publicación solo se habilita cuando la corrida supera seguridad, clasificación, validación y reconciliación con el nivel de severidad permitido.") +
        diagram(
          "Diagrama de flujo de publicación",
          boxRow([
            box("Upload", "default"),
            arrow("↓")
          ]) +
            boxRow([
              box("Staging", "dark"),
              arrow("↓")
            ]) +
            boxRow([
              box("Validate", "default"),
              arrow("↓")
            ]) +
            boxRow([
              box("Reconcile", "dark"),
              arrow("↓")
            ]) +
            boxRow([
              box("Publish", "default"),
              arrow("↓")
            ]) +
            boxRow([
              box("Active version", "warn"),
              arrow("↺")
            ]) +
            boxRow([
              box("Rollback", "risk")
            ])
        ) +
        table(
          ["Etapa", "Qué hace", "Resultado principal", "Bloqueos o controles"],
          [
            ["Upload", "Recibe uno o varios <code>.xlsx</code> desde admin.", "Archivos temporales y metadata de entrada.", "Origen confiable, sesión válida, rate limiting, filtro multipart."],
            ["Quarantine", "Persistencia inicial con hash y nombre saneado.", "<code>SourceFileRecord</code>.", "Aún no implica publicación ni confianza funcional."],
            ["Security inspection", "Revisa extensión, MIME, magic bytes, tamaño, macros, cifrado, protección y ratio ZIP.", "Issues de seguridad.", "Issues críticas bloquean la corrida."],
            ["Classification", "Determina si el archivo es primas, balance, resultados, referencia o desconocido.", "WorkbookKind y firma detectada.", "Baja confianza o roles duplicados bloquean."],
            ["Parse + normalize", "Parsea filas y las homologa contra catálogos canónicos.", "Facts canónicos y <code>mappingSummary</code>.", "Ambigüedad o alias no resuelto bloquean."],
            ["Validate", "Revisa períodos, duplicados, marcadores, fuentes primarias y consistencia mínima.", "<code>validationSummary</code>.", "Críticas/altas bloquean publicación."],
            ["Reconcile", "Contrasta agregados con el workbook de referencia cuando existe.", "<code>reconciliationSummary</code>.", "Issues severas degradan o bloquean según naturaleza."],
            ["Publish", "Materializa metadata, facts, aggregates y catálogos en un dataset inmutable.", "Nueva carpeta en <code>storage/published</code>.", "No se permite publicar corridas bloqueadas."],
            ["Activate", "Actualiza el puntero activo y el namespace de caché.", "Versión activa servida al público.", "Si no se llega a esta etapa, la versión anterior permanece activa."],
            ["Rollback", "Repone la versión activa a una publicación previa.", "Puntero activo actualizado.", "No elimina datasets ni corridas históricas." ]
          ],
          "Detalle del pipeline real"
        ) +
        callout(
          "Secuencia crítica",
          "La conmutación de la versión activa ocurre después de escribir la versión publicada. El switch real atómico del runtime es el puntero <code>storage/active/active-dataset.json</code>; el repositorio no implementa todavía un publish transaccional con directorio temporal y rename final del dataset completo.",
          "warning"
        )
    },
    {
      number: "9",
      id: "seguridad-resiliencia",
      title: "Seguridad y resiliencia",
      content:
        diagram(
          "Diagrama de seguridad por capas",
          boxRow([
            box("Capa 1 · Acceso<br><span class='small'>cookie firmada, OIDC opcional, RBAC</span>", "default"),
            arrow("↓")
          ]) +
            boxRow([
              box("Capa 2 · Integración admin/API<br><span class='small'>secreto + token firmado</span>", "dark"),
              arrow("↓")
            ]) +
            boxRow([
              box("Capa 3 · Upload hardening<br><span class='small'>multipart, MIME, magic bytes, zip, macros, cifrado</span>", "warn"),
              arrow("↓")
            ]) +
            boxRow([
              box("Capa 4 · Datos y matching<br><span class='small'>alias canónicos, ambigüedad bloqueante, degradación segura</span>", "default"),
              arrow("↓")
            ]) +
            boxRow([
              box("Capa 5 · Exposición HTTP<br><span class='small'>helmet, rate limiting, headers básicos, errores controlados</span>", "dark")
            ])
        ) +
        table(
          ["Área", "Control implementado", "Estado"],
          [
            ["Sesión admin", "Cookie firmada y expirable", "Implementado"],
            ["Admin -> API", "Token firmado de servicio y secreto compartido", "Implementado"],
            ["Roles", "RBAC por permiso <code>upload/publish/rollback/audit/view</code>", "Implementado"],
            ["Uploads", "Extensión, MIME, magic bytes, macros, cifrado, ZIP ratio, tamaño", "Implementado"],
            ["Server actions", "Validación de origen confiable", "Implementado"],
            ["HTTP security", "Helmet en API y headers básicos en web/admin", "Implementado parcialmente"],
            ["OIDC", "State, nonce, PKCE", "Implementado parcialmente"],
            ["OIDC por claims/grupos", "Mapeo fino de autorización", "Pendiente"],
            ["CSP/HSTS completos", "Políticas estrictas de navegador", "Pendiente"],
            ["Antivirus/sandbox upload", "Inspección avanzada del binario", "Pendiente" ]
          ],
          "Capas de seguridad documentadas contra el estado real"
        ) +
        callout(
          "Seguridad implementada vs. seguridad pendiente",
          "La primera versión ya contempla controles reales de integridad y acceso. Sin embargo, siguen pendientes cierres típicos de producción: eliminación de secretos por defecto, mapeo OIDC por claims/grupos, CSP/HSTS completos, cierre de CORS por allowlist, limpieza temprana de cuarentena y observabilidad de seguridad más profunda.",
          "warning"
        )
    },
    {
      number: "10",
      id: "riesgos",
      title: "Riesgos, vulnerabilidades y análisis de impacto",
      content:
        table(
          ["Riesgo", "Severidad", "Probabilidad", "Impacto", "Mitigación actual", "Recomendación"],
          [
            ["Uso de credenciales y secreto por defecto en despliegue inseguro", "Alta", "Media", "Muy alto", "Documentación y modo local controlado", "Exigir secretos no triviales y fail-closed fuera de local."],
            ["Autorización OIDC aún no mapeada por claims/grupos", "Alta", "Media", "Alto", "OIDC con identidad autenticada", "Agregar allowlist y mapping de roles corporativos."],
            ["CORS abierto en API", "Media", "Media", "Medio", "Token firmado y secreto compartido", "Restringir orígenes por entorno."],
            ["Carga de archivos maliciosos o corruptos", "Alta", "Media", "Alto", "Validaciones de workbook y cuarentena", "Agregar limpieza temprana, sandbox y scanning avanzado."],
            ["Parser del workbook de referencia sensible a layout fijo", "Media", "Alta", "Medio", "Uso solo como referencia no operativa", "Generalizar parser y agregar pruebas adicionales."],
            ["Cachés en memoria sin límites estrictos", "Media", "Media", "Medio", "Invalidación por namespace", "Agregar políticas de tamaño/evicción o caché distribuida."],
            ["Concurrencia multiinstancia en publish/rollback", "Alta", "Baja", "Alto", "Modelo local single-node", "Agregar locking y commit transaccional en producción."],
            ["Observabilidad solo local/en memoria", "Media", "Alta", "Medio", "Health, métricas runtime, auditoría", "Integrar monitoreo y alertas persistentes."],
            ["Mensajes técnicos en inglés en algunos errores admin", "Baja", "Media", "Bajo", "Errores controlados", "Completar localización y catálogos de mensaje." ]
          ],
          "Matriz de riesgos del estado actual"
        ) +
        callout(
          "Interpretación institucional",
          "Los riesgos principales ya no se concentran en la integridad funcional del flujo, sino en el endurecimiento requerido para un despliegue productivo real. Para piloto o revisión institucional, el sistema está suficientemente controlado; para producción abierta todavía requiere cierres adicionales.",
          "risk"
        )
    },
    {
      number: "11",
      id: "pruebas",
      title: "Pruebas realizadas",
      content:
        paragraph("La validación del sistema combina compuertas de calidad estática y pruebas automatizadas unitarias, de integración y de regresión. En la auditoría final del repositorio se ejecutaron satisfactoriamente <code>typecheck</code>, <code>lint</code>, <code>test</code> y <code>build</code> para todo el monorepo.") +
        table(
          ["Capa de prueba", "Cobertura observada", "Evidencia"],
          [
            ["Type checking", "Compilación sin errores en apps y packages", "<code>pnpm typecheck</code> OK"],
            ["Lint", "Reglas ESLint en monorepo completo", "<code>pnpm lint</code> OK"],
            ["Build", "Compilación de web, admin, API y packages", "<code>pnpm build</code> OK"],
            ["Normalización y alias", "Mojibake, tildes, slash, espacios, mayúsculas, ambigüedad", "<code>packages/domain/src/utils/normalization.test.ts</code>"],
            ["Firma de tokens", "Generación y rechazo de tokens alterados", "<code>packages/domain/src/utils/signed-token.test.ts</code>"],
            ["Clasificación de workbooks", "Primas, balance, referencia, ER", "<code>packages/etl/src/workbooks/signatures.test.ts</code>"],
            ["Flujo ETL", "Publish, rollback, datasets parciales, MIME inválido, referencia sola, alias ambiguos", "<code>packages/etl/src/pipeline/ingestion-service.test.ts</code>"],
            ["API", "Version, overview, institution detail, admin status, 401/404 controlados, degradación segura", "<code>apps/api/src/app.test.ts</code>"],
            ["Upload filter", "Blob fantasma, multiarchivo válido, archivo temporal faltante", "<code>apps/api/src/services/upload-filter.test.ts</code>"],
            ["Helpers UI", "Narrativa por datasetScope, upload form y fechas", "Tests en <code>apps/web</code> y <code>apps/admin</code>" ]
          ],
          "Matriz sintética de pruebas"
        ) +
        paragraph("No se identificaron aún pruebas E2E completas de navegador, pruebas de carga, pruebas formales de headers de seguridad, pruebas del flujo OIDC completo ni validaciones de concurrencia multiinstancia. Estas carencias deben considerarse como pendientes para producción real.")
    },
    {
      number: "12",
      id: "performance",
      title: "Optimización y rendimiento",
      content:
        table(
          ["Estrategia", "Implementación real", "Beneficio"],
          [
            ["Materialización de artefactos", "El ETL publica JSON listos para consumo", "El sitio público no abre Excel en request-time."],
            ["Caché por versión activa", "Puntero activo, metadata, artefactos, staging y audit cacheados en memoria", "Reduce lecturas redundantes de disco."],
            ["Payload trimming", "Overview limitado a 12 elementos; institution detail con preview + count; endpoints admin resumidos", "Menos bytes transferidos y menor costo de serialización."],
            ["Compresión HTTP", "Compresión global en API", "Menor tráfico entre cliente y servidor."],
            ["Lazy charts", "Carga diferida de ECharts en frontend público", "Reduce peso JS inicial y costo de render."],
            ["Fetch en paralelo", "Pantallas admin consultan varios endpoints en <code>Promise.all</code>", "Reduce espera total percibida."],
            ["Caché corta del frontend", "<code>revalidate: 15</code> y <code>stale-while-revalidate</code>", "Balance entre frescura y latencia." ]
          ],
          "Optimizaciones observadas en el código"
        ) +
        table(
          ["Componente o ruta", "Observación local validada"],
          [
            ["API pública", "<code>/api/public/overview</code>, <code>/version</code> y <code>/rankings</code> respondieron 200 en validación local con payloads compactos."],
            ["API admin", "<code>/api/admin/system/status</code>, <code>/ingestions</code>, <code>/publications</code> y <code>/audit</code> respondieron 200 con payloads reducidos respecto a versiones previas."],
            ["Web pública", "Las rutas <code>/</code>, <code>/rankings</code>, <code>/version</code> y <code>/institutions/[institutionId]</code> cargaron de forma estable en las pruebas locales ejecutadas."],
            ["Admin", "Las rutas <code>/ingestions</code>, <code>/reconciliation</code>, <code>/publish</code>, <code>/publications</code>, <code>/history</code> y <code>/audit</code> cargaron de forma estable."],
            ["Vista más pesada", "<code>/reconciliation</code> sigue siendo la pantalla naturalmente más costosa por conservar el JSON técnico completo de la corrida." ]
          ],
          "Resultados cualitativos de la pasada de performance"
        ) +
        callout(
          "Conclusión de rendimiento",
          "No se usan algoritmos especializados avanzados; la mejora se obtuvo mediante decisiones de arquitectura y de ingeniería pragmática: precomputación, caché, límites de payload, compresión y carga diferida.",
          "note"
        )
    },
    {
      number: "13",
      id: "observabilidad",
      title: "Observabilidad, trazabilidad y auditoría",
      content:
        diagram(
          "Diagrama de trazabilidad corrida -> publicación -> versión activa",
          boxRow([
            box("Ingestion run<br><span class='small'>ingestionRunId</span>", "default"),
            arrow(),
            box("Dataset version<br><span class='small'>datasetVersionId</span>", "dark"),
            arrow(),
            box("Active pointer<br><span class='small'>active-dataset.json</span>", "warn"),
            arrow(),
            box("Runtime público", "dark")
          ]) +
            boxRow([
              box("Audit trail<br><span class='small'>INGESTION_STAGED / DATASET_PUBLISHED / DATASET_ROLLED_BACK</span>", "warn", 7)
            ])
        ) +
        table(
          ["Elemento de trazabilidad", "Qué conserva"],
          [
            ["Staging run", "Archivos fuente, summaries, draft dataset, artifacts y calidad de texto."],
            ["Metadata publicada", "Scope, disponibilidad por dominio, períodos, summaries y mappingSummary cuando aplica."],
            ["Active pointer", "Versión actualmente servida por el runtime."],
            ["Audit event", "Actor, acción, run/dataset y detalles operativos."],
            ["Route metrics", "Conteo, errores, duración y bytes por ruta en memoria del API."],
            ["Health endpoints", "Estado del servicio, conteos, métricas de caché y storage." ]
          ],
          "Mecanismos reales de observabilidad y trazabilidad"
        ) +
        paragraph("La solución incluye además telemetría de calidad de texto y matching, visible en reconciliación, auditoría y status administrativo: cantidad de textos reparados por mojibake, aliases resueltos tras normalización, directos, por fallback de línea, ambiguos y no resueltos.")
    },
    {
      number: "14",
      id: "cobertura-funcional",
      title: "Cobertura funcional",
      content:
        paragraph("La cobertura funcional real del producto está sintetizada en la matriz <code>docs/widget-coverage-matrix.md</code>. A continuación se resume el estado de los bloques visibles más relevantes.") +
        table(
          ["Vista", "Bloque o widget", "Estado real", "Dominio requerido"],
          [
            ["Home", "KPIs ejecutivos", "Soportado", "Primas y/o balance según disponibilidad"],
            ["Home", "Primas por ramo", "Soportado", "Primas"],
            ["Home", "Participación de mercado", "Soportado", "Primas"],
            ["Home", "Top activos y reservas", "Soportado", "Balance"],
            ["Home", "Siniestros y relación siniestros/primas", "No soportado honestamente", "Claims no operativos"],
            ["Rankings", "Primas, activos, patrimonio, reservas", "Soportado con degradación por dominio", "Primas o balance"],
            ["Versión", "Metadata y cobertura de dominios", "Soportado", "Metadata publicada"],
            ["Ficha institucional", "Resumen de primas", "Soportado", "Primas"],
            ["Ficha institucional", "Resumen financiero", "Soportado", "Balance"],
            ["Ficha institucional", "Bloque de resultados", "No soportado", "Income statement no operativo" ]
          ],
          "Resumen de cobertura funcional visible"
        ) +
        paragraph("La política de honestidad es parte de la cobertura funcional: la ausencia de una métrica o serie no se considera falla de UX sino comportamiento esperado cuando la fuente operativa no existe o no permite derivación íntegra.")
    },
    {
      number: "15",
      id: "limitaciones",
      title: "Limitaciones actuales",
      content:
        bullets([
          "No existe fuente operativa de claims/siniestros; por tanto, no se publican claims ni ratios dependientes de claims.",
          "<code>incomeStatement</code> sigue fuera de la política operativa pública.",
          "El parser del workbook de referencia continúa sensible a layouts concretos y debe generalizarse si cambia el formato del oráculo.",
          "No hay base de datos, cola distribuida ni locking multiinstancia para publicación concurrente.",
          "OIDC aún no resuelve roles por claims/grupos corporativos.",
          "La observabilidad es suficiente para piloto, pero no para una operación productiva con monitoreo centralizado.",
          "No se integraron capturas congeladas del sistema en estos documentos; se utilizaron diagramas construidos sobre la arquitectura real auditada."
        ])
    },
    {
      number: "16",
      id: "conclusiones",
      title: "Conclusiones y siguientes pasos",
      content:
        paragraph("El sistema auditado se encuentra en una condición madura para una primera revisión institucional y para un piloto controlado. La arquitectura actual es coherente con el problema que resuelve: desacopla la ingestión de los archivos fuente, controla la calidad antes de publicar y protege al sitio público de métricas o series no soportadas.") +
        paragraph("La recomendación técnica es mantener la arquitectura actual y concentrar la siguiente etapa en cierres de producción: gobierno de acceso OIDC por claims/grupos, eliminación de secretos por defecto, observabilidad persistente, hardening adicional de uploads, publicación transaccional más estricta y lineamientos de despliegue con proxy/TLS/CORS cerrados.") +
        table(
          ["Indicador de madurez", "Estimación honesta"],
          [
            ["Readiness para revisión institucional", "Alta"],
            ["Readiness para piloto controlado", "Alta"],
            ["Readiness para producción abierta", "Parcial / requiere cierres adicionales"],
            ["Estimación global de readiness", "85 %" ]
          ],
          "Conclusión ejecutiva"
        )
    },
    {
      number: "17",
      id: "anexos",
      title: "Anexos",
      content:
        "<h2>17.1 Glosario</h2>" +
        table(
          ["Término", "Definición"],
          [
            ["Corrida", "Conjunto de archivos cargados y procesados como una unidad en staging."],
            ["Staging", "Estado intermedio donde la corrida queda validada y lista para revisión."],
            ["Dataset version", "Versión publicada e inmutable del dataset generado por una corrida."],
            ["Versión activa", "Dataset publicado que el runtime público consulta actualmente."],
            ["Rollback", "Cambio del puntero activo hacia una versión publicada anterior."],
            ["Publishability", "Semáforo técnico de publicación: <code>publishable</code>, <code>warningOnly</code> o <code>blocked</code>."],
            ["Oráculo preliminar", "Workbook de referencia usado para reconciliación, fórmulas y cuadros, pero no como fuente runtime." ]
          ],
          "Glosario principal"
        ) +
        "<h2>17.2 Tabla de rutas y endpoints</h2>" +
        table(
          ["Plano", "Ruta o endpoint", "Propósito"],
          [
            ["Web pública", "<code>/</code>", "Vista ejecutiva principal."],
            ["Web pública", "<code>/rankings</code>", "Rankings institucionales."],
            ["Web pública", "<code>/version</code>", "Metadata de la versión activa."],
            ["Web pública", "<code>/institutions/[institutionId]</code>", "Ficha institucional."],
            ["Admin", "<code>/upload</code>", "Carga de workbooks."],
            ["Admin", "<code>/ingestions</code>", "Listado de corridas staging."],
            ["Admin", "<code>/reconciliation</code>", "Revisión técnica detallada."],
            ["Admin", "<code>/publish</code>", "Publicación de corridas publicables."],
            ["Admin", "<code>/publications</code> / <code>/history</code>", "Versiones publicadas y rollback."],
            ["Admin", "<code>/audit</code>", "Bitácora operativa."],
            ["API pública", "<code>GET /api/public/*</code>", "Consumo del portal público y clientes de lectura."],
            ["API admin", "<code>GET/POST /api/admin/*</code>", "Operación administrativa segura." ]
          ],
          "Rutas principales"
        ) +
        "<h2>17.3 Fuentes documentales internas utilizadas</h2>" +
        bullets([
          "<code>docs/architecture.md</code>",
          "<code>docs/ingestion-pipeline.md</code>",
          "<code>docs/source-policy.md</code>",
          "<code>docs/formula-reference.md</code>",
          "<code>docs/chart-specs.md</code>",
          "<code>docs/operational-traceability.md</code>",
          "<code>docs/widget-coverage-matrix.md</code>",
          "<code>docs/security.md</code>",
          "<code>docs/testing-strategy.md</code>",
          "<code>docs/skills/*.md</code>"
        ])
    }
  ];

  return buildHtmlDocument({
    title: "CNBS Documentación Técnica Integral",
    body:
      coverPage({
        kicker: "CNBS Dashboard",
        title: "Documentación Técnica Integral",
        subtitle:
          "Documento consolidado del estado real del repositorio, la arquitectura, la operación y las capacidades actuales de la plataforma.",
        version: "1.0",
        date: documentDate,
        owner: "Equipo del proyecto (basado en auditoría técnica del repositorio actual)",
        status: "Candidato para revisión institucional",
        note:
          "El contenido se consolidó a partir de código real, configuración, pruebas, documentación existente y validaciones finales de calidad." 
      }) +
      '<div class="page-break"></div>' +
      tocPage("Índice estructurado", sections) +
      sections.map((item) => section(item.number, item.id, item.title, item.content)).join("")
  });
}

function buildManualHtml() {
  const sections = [
    {
      number: "1",
      id: "manual-objetivo",
      title: "Objetivo del manual",
      content:
        paragraph("Este manual explica cómo operar la plataforma CNBS Dashboard en su primera versión, con un lenguaje orientado a usuarios administrativos, personal de supervisión, personal de validación y usuarios institucionales no técnicos.") +
        paragraph("El manual describe exclusivamente lo que el sistema hace hoy. Cuando una capacidad no existe o no forma parte del alcance actual, se explica como limitación o estado no disponible.")
    },
    {
      number: "2",
      id: "manual-perfiles",
      title: "Perfil de usuario",
      content:
        table(
          ["Perfil", "Uso esperado"],
          [
            ["Administrador", "Opera carga, publicación, rollback, historial y auditoría."],
            ["Cargador", "Sube workbooks y revisa el estado de la corrida."],
            ["Validador", "Revisa resultados de validación y reconciliación."],
            ["Publicador", "Activa una corrida publicable y ejecuta rollback si corresponde."],
            ["Auditor", "Consulta bitácora operativa y trazabilidad."],
            ["Usuario público", "Consulta el portal institucional sin acceso a funciones privadas." ]
          ],
          "Perfiles visibles en la solución actual"
        )
    },
    {
      number: "3",
      id: "manual-plataforma",
      title: "Descripción general de la plataforma",
      content:
        paragraph("La plataforma tiene dos superficies principales:") +
        bullets([
          "Módulo administrativo: permite iniciar sesión, cargar workbooks, revisar corridas, publicar versiones y ejecutar rollback.",
          "Portal público: muestra indicadores, rankings, versión activa y ficha institucional de forma honesta y controlada."
        ]) +
        paragraph("La información pública se sirve desde datasets publicados. El sitio no abre Excel en tiempo de consulta.") +
        callout(
          "Regla principal",
          "La primera versión pública solo usa dos fuentes operativas: primas y estado de situación financiera. Si un dato requiere otra fuente, el sistema lo mostrará como no disponible.",
          "warning"
        )
    },
    {
      number: "4",
      id: "manual-requisitos",
      title: "Requisitos para usarla",
      content:
        bullets([
          "Acceso a la red y a los servicios locales o institucionales donde corra el sistema.",
          "Credenciales válidas para el módulo admin, ya sea en modo local u OIDC.",
          "Archivos Excel <code>.xlsx</code> válidos del dominio de primas, balance o referencia opcional.",
          "Permisos acordes al rol del usuario para cargar, publicar, revertir o auditar."
        ])
    },
    {
      number: "5",
      id: "manual-acceso",
      title: "Acceso al sistema",
      content:
        ordered([
          "Abra el módulo administrativo en <code>http://localhost:3001/</code> o en la URL institucional configurada.",
          "Si el entorno usa modo local, ingrese usuario y contraseña.",
          "Si el entorno usa SSO, seleccione el ingreso con OIDC y complete la autenticación corporativa.",
          "Una vez autenticado, el sistema lo dirigirá a la pantalla de carga." 
        ]) +
        paragraph("El portal público se consulta por separado en <code>http://localhost:3000/</code> o en la URL pública definida para la institución.")
    },
    {
      number: "6",
      id: "manual-modulos",
      title: "Explicación de los módulos",
      content:
        table(
          ["Módulo", "Qué permite hacer"],
          [
            ["Inicio", "Autenticarse y acceder al panel operativo."],
            ["Ingestas", "Consultar corridas cargadas, su estado, sus archivos y el resultado esperado de publicación."],
            ["Carga", "Subir uno o varios workbooks Excel y enviar la corrida a staging."],
            ["Reconciliación", "Revisar severidades, matching, alias, advertencias y JSON técnico de la corrida."],
            ["Publicar", "Activar corridas que estén permitidas para publicación."],
            ["Publicaciones", "Consultar versiones publicadas y revertir a una versión anterior."],
            ["Historial", "Ver versiones históricas y ejecutar rollback inmediato."],
            ["Auditoría", "Consultar eventos operativos y trazabilidad básica."],
            ["Portal público", "Visualizar indicadores, rankings, cobertura por dominio y fichas institucionales." ]
          ],
          "Mapa funcional de la solución"
        ) +
        diagram(
          "Diagrama de interacción del usuario administrador",
          boxRow([
            box("Ingreso", "default"),
            arrow(),
            box("Carga", "dark"),
            arrow(),
            box("Revisión", "default"),
            arrow(),
            box("Publicación", "warn"),
            arrow(),
            box("Historial / Auditoría", "dark")
          ])
        )
    },
    {
      number: "7",
      id: "manual-flujo",
      title: "Flujo paso a paso de operación",
      content:
        "<h2>7.1 Iniciar sesión</h2>" +
        ordered([
          "Ingrese al panel administrativo.",
          "Autentíquese por modo local u OIDC.",
          "Verifique que el menú superior muestre los módulos administrativos." 
        ]) +
        "<h2>7.2 Cargar archivos</h2>" +
        ordered([
          "Abra la pantalla <strong>Carga</strong>.",
          "Seleccione uno o varios archivos <code>.xlsx</code>.",
          "Haga clic en <strong>Iniciar ingesta</strong>.",
          "Espere a que el sistema clasifique, valide y deje la corrida en staging." 
        ]) +
        "<h2>7.3 Revisar una corrida</h2>" +
        ordered([
          "Después de cargar, el sistema lo redirige a <strong>Reconciliación</strong>.",
          "Revise la etiqueta operativa, el resumen de severidades y el diagnóstico de matching.",
          "Si necesita una vista más resumida de corridas, consulte <strong>Ingestas</strong>." 
        ]) +
        "<h2>7.4 Interpretar validaciones</h2>" +
        bullets([
          "<strong>publishable</strong>: la corrida puede avanzar a publicación.",
          "<strong>warningOnly</strong>: la corrida puede publicarse, pero con advertencias que deben entenderse.",
          "<strong>blocked</strong>: la corrida no puede publicarse mientras existan issues críticos o altos." 
        ]) +
        "<h2>7.5 Interpretar reconciliación</h2>" +
        bullets([
          "Revise reparaciones de texto y aliases resueltos.",
          "Si aparecen aliases ambiguos o no resueltos, la corrida requiere intervención antes de publicar.",
          "El JSON completo sirve como respaldo técnico para soporte y análisis detallado." 
        ]) +
        "<h2>7.6 Publicar</h2>" +
        ordered([
          "Abra la pantalla <strong>Publicar</strong>.",
          "Identifique la corrida deseada.",
          "Si la corrida está bloqueada, el botón aparecerá deshabilitado o reemplazado por el mensaje correspondiente.",
          "Si está permitida, seleccione <strong>Publicar corrida</strong>.",
          "El sistema generará una versión inmutable y actualizará la versión activa." 
        ]) +
        "<h2>7.7 Verificar la versión activa</h2>" +
        ordered([
          "Consulte <strong>Publicaciones</strong> o <strong>Historial</strong> en el panel admin.",
          "Verifique qué versión aparece marcada como activa.",
          "Abra luego el portal público en <strong>Versión</strong> para confirmar la metadata visible al usuario final." 
        ]) +
        "<h2>7.8 Verificar datos públicos</h2>" +
        ordered([
          "Abra el portal público.",
          "Revise <strong>Inicio</strong>, <strong>Rankings</strong>, <strong>Versión</strong> y una ficha institucional.",
          "Confirme que los bloques no soportados se muestren como no disponibles en lugar de valores inventados." 
        ]) +
        "<h2>7.9 Revertir a una versión anterior</h2>" +
        ordered([
          "Abra <strong>Publicaciones</strong> o <strong>Historial</strong>.",
          "Identifique la versión a la que desea volver.",
          "Seleccione <strong>Revertir a esta versión</strong>.",
          "Confirme luego en el portal público que la versión activa haya cambiado." 
        ])
    },
    {
      number: "8",
      id: "manual-estados",
      title: "Explicación de mensajes y estados",
      content:
        table(
          ["Estado o mensaje", "Significado operativo"],
          [
            ["<code>publishable</code>", "La corrida puede publicarse."],
            ["<code>warningOnly</code>", "La corrida puede publicarse, pero existen advertencias que deben entenderse."],
            ["<code>blocked</code>", "La corrida no puede publicarse."],
            ["<code>staged</code>", "La corrida está en staging y pendiente de revisión o publicación."],
            ["Publicada", "La corrida ya generó una versión publicada."],
            ["Activa", "La versión está siendo servida actualmente al sitio público."],
            ["Dato no disponible", "El sistema no puede derivar ese dato con integridad a partir de las fuentes operativas actuales." ]
          ],
          "Estados más importantes visibles para el usuario"
        )
    },
    {
      number: "9",
      id: "manual-tarjetas",
      title: "Qué significa cada tarjeta, cuadro o sección visible",
      content:
        "<h2>9.1 Portal público</h2>" +
        table(
          ["Sección", "Interpretación"],
          [
            ["Estado de la versión", "Muestra la versión activa, el período y el alcance publicado."],
            ["KPIs ejecutivos", "Resume magnitudes soportadas por las fuentes operativas disponibles."],
            ["Gráficos de primas", "Muestran distribución por ramo o institución cuando existe fuente de primas."],
            ["Gráficos de balance", "Muestran activos y reservas cuando existe balance publicado."],
            ["Cobertura por dominio", "Aclara qué dominios están disponibles y cuáles no."],
            ["Ficha institucional", "Muestra un resumen puntual por aseguradora sin inventar bloques no soportados." ]
          ],
          "Elementos visibles del portal público"
        ) +
        "<h2>9.2 Módulo administrativo</h2>" +
        table(
          ["Sección", "Interpretación"],
          [
            ["Archivos detectados", "Indica qué tipo de workbook reconoció el sistema en la última corrida."],
            ["Derivados esperados", "Resume qué artefactos públicos podrán generarse con la corrida."],
            ["Diagnóstico de matching", "Muestra cómo se resolvieron aliases, reparaciones de texto y posibles ambigüedades."],
            ["Reparaciones aplicadas", "Resume normalizaciones y correcciones relevantes de texto o alias."],
            ["Versiones publicadas", "Lista datasets ya materializados y marca cuál está activa."],
            ["Auditoría", "Muestra eventos operativos y trazabilidad general." ]
          ],
          "Elementos visibles del módulo admin"
        )
    },
    {
      number: "10",
      id: "manual-errores",
      title: "Errores comunes y cómo resolverlos",
      content:
        table(
          ["Situación", "Qué significa", "Acción sugerida"],
          [
            ["Credenciales inválidas", "El usuario o contraseña no coinciden con el entorno configurado.", "Verifique credenciales o confirme si el entorno usa OIDC."],
            ["No se detectaron archivos válidos", "La carga no contenía archivos útiles o el navegador envió placeholders vacíos.", "Repita la carga seleccionando los <code>.xlsx</code> reales."],
            ["Corrida bloqueada", "Existen issues críticos o altos en validación o reconciliación.", "Revise la pantalla de Reconciliación y corrija el origen del problema."],
            ["Dato no disponible en web", "El dataset activo no incluye el dominio requerido para ese bloque.", "Revise cobertura y fuentes publicadas en la pantalla Versión."],
            ["Versión no encontrada", "La versión o corrida solicitada ya no está disponible en el storage actual.", "Verifique que la versión exista y consulte Publicaciones o Ingestas."],
            ["Solicitud rechazada por origen no confiable", "El sistema bloqueó la operación por seguridad.", "Intente de nuevo desde el panel y la misma sesión del navegador." ]
          ],
          "Resolución básica de incidencias"
        )
    },
    {
      number: "11",
      id: "manual-buenas-practicas",
      title: "Buenas prácticas de operación",
      content:
        bullets([
          "Cargue únicamente workbooks <code>.xlsx</code> provenientes de la fuente institucional esperada.",
          "Revise la etiqueta operativa, la publishability y la reconciliación antes de publicar.",
          "No interprete un bloque ausente como cero; valide siempre la cobertura por dominio.",
          "Conserve la lógica actual: el informe preliminar es referencia, no fuente pública.",
          "Verifique la versión activa después de publicar y después de cualquier rollback.",
          "Use Auditoría e Historial para reconstruir la secuencia operativa de una versión." 
        ])
    },
    {
      number: "12",
      id: "manual-faq",
      title: "Preguntas frecuentes",
      content:
        "<h2>12.1 ¿Puedo publicar solo el informe preliminar?</h2>" +
        paragraph("No. El informe preliminar no es fuente operativa y nunca se publica por sí solo.") +
        "<h2>12.2 ¿Por qué algunos gráficos muestran “Dato no disponible”?</h2>" +
        paragraph("Porque la fuente requerida no está presente o no permite derivación íntegra en esta versión. El sistema evita inventar datos.") +
        "<h2>12.3 ¿Qué pasa si publico una corrida con advertencias?</h2>" +
        paragraph("La versión se publica, pero queda registro de las advertencias. Deben revisarse según el contexto operativo.") +
        "<h2>12.4 ¿Qué hace el rollback?</h2>" +
        paragraph("Cambia la versión activa a una publicación anterior. No elimina datasets ni corridas históricas.") +
        "<h2>12.5 ¿El estado de resultados ya alimenta el portal público?</h2>" +
        paragraph("No. Puede detectarse y trazarse, pero no forma parte de la política operativa pública actual.")
    },
    {
      number: "13",
      id: "manual-glosario",
      title: "Glosario sencillo",
      content:
        table(
          ["Término", "Explicación"],
          [
            ["Corrida", "Conjunto de archivos cargados y procesados como una sola unidad."],
            ["Staging", "Etapa en la que la corrida queda lista para revisión antes de publicarse."],
            ["Versión activa", "Dataset publicado que ve actualmente el usuario público."],
            ["Rollback", "Volver a una versión activa anterior."],
            ["Fuente operativa", "Archivo que sí alimenta el runtime público."],
            ["Dato no disponible", "Respuesta honesta del sistema cuando una métrica no puede derivarse con seguridad." ]
          ],
          "Glosario para usuarios no técnicos"
        )
    },
    {
      number: "14",
      id: "manual-anexos-visuales",
      title: "Anexos visuales",
      content:
        diagram(
          "Interacción del usuario público",
          boxRow([
            box("Inicio", "default"),
            arrow(),
            box("Rankings", "dark"),
            arrow(),
            box("Versión", "warn"),
            arrow(),
            box("Ficha institucional", "default")
          ])
        ) +
        diagram(
          "Resumen del ciclo administrativo",
          boxRow([
            box("Cargar archivos", "default"),
            arrow(),
            box("Revisar corrida", "dark"),
            arrow(),
            box("Publicar", "warn"),
            arrow(),
            box("Verificar versión activa", "dark"),
            arrow(),
            box("Revertir si es necesario", "risk")
          ])
        ) +
        callout(
          "Nota sobre apoyos visuales",
          "Los anexos visuales de este manual usan diagramas esquemáticos construidos a partir de la arquitectura y las pantallas reales del sistema. No se incrustaron capturas congeladas porque el repositorio auditado no incluye un set oficial de capturas institucionales.",
          "note"
        )
    }
  ];

  return buildHtmlDocument({
    title: "CNBS Manual de Usuario",
    body:
      coverPage({
        kicker: "CNBS Dashboard",
        title: "Manual de Usuario",
        subtitle:
          "Guía operativa de la primera versión del sistema para usuarios administrativos, personal de supervisión y revisión institucional.",
        version: "1.0",
        date: documentDate,
        owner: "Equipo del proyecto (manual elaborado sobre el sistema auditado)",
        status: "Candidato para entrega y capacitación inicial",
        note:
          "El manual describe las funciones efectivamente disponibles en el sistema actual y sus limitaciones reales." 
      }) +
      '<div class="page-break"></div>' +
      tocPage("Índice estructurado", sections) +
      sections.map((item) => section(item.number, item.id, item.title, item.content)).join("")
  });
}

function writeDocxFromHtml({ html, outputDocxPath, title }) {
  const tempRoot = mkdtempSync(join(tmpdir(), "cnbs-docx-"));
  const wordDir = join(tempRoot, "word");
  const relsDir = join(tempRoot, "_rels");
  const wordRelsDir = join(wordDir, "_rels");
  const docPropsDir = join(tempRoot, "docProps");

  mkdirSync(wordDir, { recursive: true });
  mkdirSync(relsDir, { recursive: true });
  mkdirSync(wordRelsDir, { recursive: true });
  mkdirSync(docPropsDir, { recursive: true });

  const createdIso = new Date().toISOString();

  writeFileSync(
    join(tempRoot, "[Content_Types].xml"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="html" ContentType="text/html"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
    "utf8"
  );

  writeFileSync(
    join(relsDir, ".rels"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    "utf8"
  );

  writeFileSync(
    join(wordDir, "document.xml"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
 xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:w10="urn:schemas-microsoft-com:office:word"
 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
 xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
 xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
 xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
 xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
 mc:Ignorable="w14 wp14">
  <w:body>
    <w:altChunk r:id="htmlChunk"/>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1260" w:bottom="1440" w:left="1260" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`,
    "utf8"
  );

  writeFileSync(
    join(wordRelsDir, "document.xml.rels"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="htmlChunk" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/>
</Relationships>`,
    "utf8"
  );

  writeFileSync(join(wordDir, "afchunk.html"), html, "utf8");

  writeFileSync(
    join(docPropsDir, "core.xml"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeHtml(title)}</dc:title>
  <dc:subject>Documentación institucional CNBS</dc:subject>
  <dc:creator>Equipo del proyecto</dc:creator>
  <cp:keywords>CNBS,dashboard,documentación,manual,publicación versionada</cp:keywords>
  <dc:description>Documento generado a partir del estado real del repositorio auditado.</dc:description>
  <cp:lastModifiedBy>Equipo del proyecto</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${createdIso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${createdIso}</dcterms:modified>
</cp:coreProperties>`,
    "utf8"
  );

  writeFileSync(
    join(docPropsDir, "app.xml"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>CNBS Dashboard Deliverables Generator</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Título</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>${escapeHtml(title)}</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
  <Company>CNBS Dashboard</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>1.0</AppVersion>
</Properties>`,
    "utf8"
  );

  const zipCommand = [
    "-NoProfile",
    "-Command",
    `Add-Type -AssemblyName 'System.IO.Compression.FileSystem'; if (Test-Path '${outputDocxPath.replaceAll("'", "''")}') { Remove-Item '${outputDocxPath.replaceAll("'", "''")}' -Force }; [System.IO.Compression.ZipFile]::CreateFromDirectory('${tempRoot.replaceAll("'", "''")}', '${outputDocxPath.replaceAll("'", "''")}')`
  ];

  const result = spawnSync("powershell.exe", zipCommand, { stdio: "inherit" });
  if (result.status !== 0) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw new Error(`No se pudo generar ${outputDocxPath}`);
  }

  rmSync(tempRoot, { recursive: true, force: true });
}

const technicalHtml = buildTechnicalDocumentHtml();
const manualHtml = buildManualHtml();

const technicalHtmlPath = join(sourcesDir, "CNBS_Documentacion_Tecnica_Integral.html");
const manualHtmlPath = join(sourcesDir, "CNBS_Manual_de_Usuario.html");
const technicalDocxPath = join(deliverablesDir, "CNBS_Documentacion_Tecnica_Integral.docx");
const manualDocxPath = join(deliverablesDir, "CNBS_Manual_de_Usuario.docx");

writeFileSync(technicalHtmlPath, technicalHtml, "utf8");
writeFileSync(manualHtmlPath, manualHtml, "utf8");

writeDocxFromHtml({ html: technicalHtml, outputDocxPath: technicalDocxPath, title: "CNBS Documentación Técnica Integral" });
writeDocxFromHtml({ html: manualHtml, outputDocxPath: manualDocxPath, title: "CNBS Manual de Usuario" });

console.log(`Generado: ${technicalDocxPath}`);
console.log(`Generado: ${manualDocxPath}`);
