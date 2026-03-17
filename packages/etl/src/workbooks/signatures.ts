import type ExcelJS from "exceljs";
import { normalizeText } from "@cnbs/domain";
import { canonicalHeadersForWorksheet, findWorksheetByHeaders, type HeaderAliasConfig, readWorkbook, sheetNameMatches } from "../parsers/excel";
import type { WorkbookDetectionResult } from "../types";

export class WorkbookClassificationError extends Error {
  constructor(
    message: string,
    readonly details: {
      candidateScores: Partial<Record<WorkbookDetectionResult["kind"], number>>;
      sheetNames: string[];
      matchedSignals: string[];
      detectedHeadersBySheet: Array<{ sheetName: string; headers: string[] }>;
    }
  ) {
    super(message);
  }
}

function worksheetHeaderPreview(workbook: ExcelJS.Workbook): Array<{ sheetName: string; headers: string[] }> {
  return workbook.worksheets.slice(0, 8).map((worksheet) => {
    const firstRow = worksheet.getRow(1);
    const rawValues = Array.isArray(firstRow.values) ? firstRow.values.slice(1) : [];
    const headers = rawValues
      .map((value) => {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          return String(value).trim();
        }
        if (value instanceof Date) {
          return value.toISOString().trim();
        }
        if (typeof value === "object" && value !== null && "result" in value) {
          const result = (value as { result?: unknown }).result;
          return typeof result === "string" || typeof result === "number" || typeof result === "boolean"
            ? String(result).trim()
            : result instanceof Date
              ? result.toISOString().trim()
              : "";
        }
        return "";
      })
      .filter(Boolean)
      .slice(0, 20);

    return {
      sheetName: worksheet.name,
      headers
    };
  });
}

export const premiumHeaderConfig: HeaderAliasConfig = {
  requiredColumns: ["Fecha Reporte", "CodInstitucion", "Institucion", "RamoPadre", "Ramo", "CodMoneda", "Moneda", "Saldo"],
  preferredSheetNames: ["Datos", "Primas"],
  aliases: {
    "Fecha Reporte": ["FECHA REPORTE", "FECHA_REPORTE", "FECHA DE REPORTE", "FECHA CORTE"],
    CodInstitucion: ["CODINSTITUCION", "COD INSTITUCION", "COD. INSTITUCION", "CODIGO INSTITUCION"],
    Institucion: ["INSTITUCION", "INSTITUCIÓN", "COMPANIA", "COMPAÑIA", "ASEGURADORA"],
    RamoPadre: ["RAMOPADRE", "RAMO PADRE", "GRUPO RAMO", "RAMO PRINCIPAL"],
    Ramo: ["RAMO", "SUBRAMO", "LINEA", "LÍNEA"],
    CodMoneda: ["CODMONEDA", "COD MONEDA", "COD. MONEDA", "MONEDA COD"],
    Moneda: ["MONEDA", "TIPO MONEDA"],
    Saldo: ["SALDO", "VALOR", "MONTO", "PRIMAS", "IMPORTE"]
  }
};

export const tabularFinancialHeaderConfig: HeaderAliasConfig = {
  requiredColumns: ["Tipo", "Inst", "Logo", "FechaReporte", "Linea", "Cuenta", "MonedaNacional", "MonedaExtranjera"],
  preferredSheetNames: ["Datos", "Balance", "Estado de Resultados", "EstadoResultado", "ER"],
  aliases: {
    Tipo: ["TIPO", "TIPO ESTADO", "CLASE", "SECCION"],
    Inst: ["INST", "CODINSTITUCION", "COD INSTITUCION", "CODIGO", "INSTITUCION COD"],
    Logo: ["LOGO", "INSTITUCION", "INSTITUCIÓN", "COMPANIA", "COMPAÑIA", "ASEGURADORA"],
    FechaReporte: ["FECHAREPORTE", "FECHA REPORTE", "FECHA DE REPORTE", "FECHA CORTE"],
    Linea: ["LINEA", "LÍNEA", "NRO LINEA", "ORDEN", "ITEM"],
    Cuenta: ["CUENTA", "RUBRO", "CONCEPTO", "DESCRIPCION", "DESCRIPCIÓN"],
    MonedaNacional: ["MONEDANACIONAL", "MONEDA NACIONAL", "MN", "MONTO NACIONAL"],
    MonedaExtranjera: ["MONEDAEXTRANJERA", "MONEDA EXTRANJERA", "ME", "MONTO EXTRANJERO"]
  }
};

const financialPositionSignals = [
  "TOTAL ACTIVOS",
  "ACTIVOS",
  "PASIVOS",
  "PATRIMONIO",
  "RESERVAS TECNICAS Y MATEMATICAS",
  "CUENTAS DE ORDEN Y REGISTRO"
];

const incomeStatementSignals = [
  "UTILIDAD",
  "RESULTADO NETO",
  "INGRESOS FINANCIEROS",
  "PRIMAS RETENIDAS",
  "GASTOS DE INTERMEDIACION",
  "SINIESTRALIDAD RETENIDA",
  "ROE",
  "ROA"
];

const referenceSheetSignals = [
  "1. RAMOS TOTALES",
  "8. PRIMAS Y SINIESTROS TOTALES",
  "RANKING DEL SISTEMA",
  "DESCARGA APP P&S",
  "DESCARGA BG"
];

function scorePremiumWorkbook(workbook: ExcelJS.Workbook): { score: number; matchedSignals: string[]; sheetName?: string } {
  const worksheet = findWorksheetByHeaders(workbook, premiumHeaderConfig);
  if (!worksheet) {
    return { score: 0, matchedSignals: [] };
  }

  const { canonicalHeaders } = canonicalHeadersForWorksheet(worksheet, premiumHeaderConfig);
  const matchedSignals = canonicalHeaders.filter((header) => premiumHeaderConfig.requiredColumns.includes(header));
  let score = matchedSignals.length * 12;
  if (sheetNameMatches(worksheet.name, premiumHeaderConfig.preferredSheetNames ?? [])) {
    score += 6;
  }
  return { score, matchedSignals, sheetName: worksheet.name };
}

function scoreTabularFinancialWorkbook(
  workbook: ExcelJS.Workbook,
  kind: "financialPosition" | "incomeStatement"
): { score: number; matchedSignals: string[]; sheetName?: string } {
  const worksheet = findWorksheetByHeaders(workbook, tabularFinancialHeaderConfig);
  if (!worksheet) {
    return { score: 0, matchedSignals: [] };
  }

  const { canonicalHeaders } = canonicalHeadersForWorksheet(worksheet, tabularFinancialHeaderConfig);
  const headerSignals = canonicalHeaders.filter((header) => tabularFinancialHeaderConfig.requiredColumns.includes(header));
  const accountValues = new Set<string>();

  for (let rowNumber = 2; rowNumber <= Math.min(60, worksheet.rowCount); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const account = row.getCell(canonicalHeaders.indexOf("Cuenta") + 1).value;
    if (typeof account === "string") {
      accountValues.add(normalizeText(account));
    }
  }

  const semanticSignals = (kind === "financialPosition" ? financialPositionSignals : incomeStatementSignals).filter((signal) =>
    Array.from(accountValues).some((account) => account.includes(signal))
  );

  let score = headerSignals.length * 8 + semanticSignals.length * 15;
  if (kind === "financialPosition" && sheetNameMatches(worksheet.name, ["Balance", "Situacion Financiera", "Estado de Situacion Financiera"])) {
    score += 6;
  }
  if (kind === "incomeStatement" && sheetNameMatches(worksheet.name, ["EstadoResultado", "Estado de Resultados", "ER"])) {
    score += 6;
  }

  return { score, matchedSignals: [...headerSignals, ...semanticSignals], sheetName: worksheet.name };
}

function scoreReferenceWorkbook(workbook: ExcelJS.Workbook): { score: number; matchedSignals: string[] } {
  const sheetNames = workbook.worksheets.map((worksheet) => normalizeText(worksheet.name));
  const matchedSignals = referenceSheetSignals.filter((sheetName) => sheetNames.includes(sheetName));
  const formulaSheets = workbook.worksheets.filter((worksheet) => worksheet.actualRowCount > 0 && worksheet.getRow(1).cellCount > 0).length;
  const score = matchedSignals.length * 12 + (workbook.worksheets.length > 10 ? 15 : 0) + (formulaSheets > 5 ? 8 : 0);
  return { score, matchedSignals };
}

export async function detectWorkbookKind(filePath: string): Promise<WorkbookDetectionResult> {
  const workbook = await readWorkbook(filePath);
  const sheetNames = workbook.worksheets.map((worksheet) => worksheet.name);

  const premium = scorePremiumWorkbook(workbook);
  const financialPosition = scoreTabularFinancialWorkbook(workbook, "financialPosition");
  const incomeStatement = scoreTabularFinancialWorkbook(workbook, "incomeStatement");
  const reference = scoreReferenceWorkbook(workbook);

  const scores: Partial<Record<WorkbookDetectionResult["kind"], number>> = {
    premiums: premium.score,
    financialPosition: financialPosition.score,
    incomeStatement: incomeStatement.score,
    reference: reference.score,
    unknown: 0
  };

  const ranked = Object.entries(scores)
    .filter((entry): entry is [WorkbookDetectionResult["kind"], number] => typeof entry[1] === "number")
    .sort((left, right) => right[1] - left[1]);

  const [bestKind, bestScore] = ranked[0] ?? ["unknown", 0];
  const secondBestScore = ranked[1]?.[1] ?? 0;
  const confidence = bestScore === 0 ? 0 : Math.min(1, bestScore / Math.max(1, bestScore + secondBestScore));
  const signalsByKind = {
    premiums: premium.matchedSignals,
    financialPosition: financialPosition.matchedSignals,
    incomeStatement: incomeStatement.matchedSignals,
    reference: reference.matchedSignals,
    unknown: []
  } as const;
  const sheetByKind = {
    premiums: premium.sheetName,
    financialPosition: financialPosition.sheetName,
    incomeStatement: incomeStatement.sheetName,
    reference: undefined,
    unknown: undefined
  } as const;

  if (bestScore < 40 || bestScore - secondBestScore < 8) {
    const topCandidates = ranked
      .filter(([, score]) => score > 0)
      .slice(0, 3)
      .map(([kind, score]) => `${kind}:${score}`)
      .join(", ");

    throw new WorkbookClassificationError(
      `Workbook could not be classified with enough confidence. Candidate scores: ${topCandidates || "none"}.`,
      {
      candidateScores: scores,
      sheetNames,
      matchedSignals: ranked.flatMap(([kind]) => signalsByKind[kind as keyof typeof signalsByKind] ?? []).slice(0, 10),
      detectedHeadersBySheet: worksheetHeaderPreview(workbook)
      }
    );
  }

  const signature =
    bestKind === "premiums"
      ? "tabular-premiums-v2"
      : bestKind === "financialPosition"
        ? "tabular-financial-position-v2"
        : bestKind === "incomeStatement"
          ? "tabular-income-statement-v1"
          : bestKind === "reference"
            ? "reference-workbook-v2"
            : "unknown";

  return {
    kind: bestKind,
    signature,
    confidence,
    matchedSignals: [...signalsByKind[bestKind as keyof typeof signalsByKind]],
    detectedSheetName: sheetByKind[bestKind as keyof typeof sheetByKind],
    candidateScores: scores,
    sheetNames
  };
}
