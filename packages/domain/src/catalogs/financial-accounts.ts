import type { FinancialAccount, FinancialAccountAlias } from "../entities/canonical";

export const financialAccountsCatalog: FinancialAccount[] = [
  { accountId: "activos", lineNumber: 1, canonicalName: "ACTIVOS", statementType: "financialPosition", sortOrder: 1 },
  { accountId: "disponibilidades", lineNumber: 2, canonicalName: "DISPONIBILIDADES", statementType: "financialPosition", sortOrder: 2 },
  { accountId: "inversiones-financieras", lineNumber: 3, canonicalName: "INVERSIONES FINANCIERAS", statementType: "financialPosition", sortOrder: 3 },
  { accountId: "prestamos", lineNumber: 4, canonicalName: "PRÉSTAMOS", statementType: "financialPosition", sortOrder: 4 },
  { accountId: "primas-por-cobrar", lineNumber: 5, canonicalName: "PRIMAS POR COBRAR", statementType: "financialPosition", sortOrder: 5 },
  { accountId: "deudas-reaseguradores", lineNumber: 6, canonicalName: "DEUDAS A CARGO DE REASEGURADORES Y REAFIANZADORES", statementType: "financialPosition", sortOrder: 6 },
  { accountId: "activos-venta", lineNumber: 7, canonicalName: "ACTIVOS MANTENIDOS PARA LA VENTA Y GRUPO DE ACTIVOS PARA SU DISPOSICIÓN", statementType: "financialPosition", sortOrder: 7 },
  { accountId: "propiedades-planta-equipo", lineNumber: 8, canonicalName: "PROPIEDADES, PLANTA Y EQUIPO", statementType: "financialPosition", sortOrder: 8 },
  { accountId: "propiedades-inversion", lineNumber: 9, canonicalName: "PROPIEDADES DE INVERSIÓN", statementType: "financialPosition", sortOrder: 9 },
  { accountId: "otros-activos", lineNumber: 11, canonicalName: "OTROS ACTIVOS", statementType: "financialPosition", sortOrder: 10 },
  { accountId: "activos-contingentes", lineNumber: 13, canonicalName: "ACTIVOS CONTINGENTES", statementType: "financialPosition", sortOrder: 11 },
  { accountId: "total-activos", lineNumber: 14, canonicalName: "TOTAL ACTIVOS", statementType: "financialPosition", sortOrder: 12 },
  { accountId: "pasivos", lineNumber: 15, canonicalName: "PASIVOS", statementType: "financialPosition", sortOrder: 13 },
  { accountId: "obligaciones-asegurados", lineNumber: 16, canonicalName: "OBLIGACIONES CON ASEGURADOS", statementType: "financialPosition", sortOrder: 14 },
  { accountId: "reservas-siniestros", lineNumber: 17, canonicalName: "RESERVAS PARA SINIESTROS", statementType: "financialPosition", sortOrder: 15 },
  { accountId: "obligaciones-intermediarios", lineNumber: 18, canonicalName: "OBLIGACIONES CON INTERMEDIARIOS", statementType: "financialPosition", sortOrder: 16 },
  { accountId: "cuentas-por-pagar", lineNumber: 19, canonicalName: "CUENTAS POR PAGAR", statementType: "financialPosition", sortOrder: 17 },
  { accountId: "obligaciones-financieras", lineNumber: 20, canonicalName: "OBLIGACIONES FINANCIERAS", statementType: "financialPosition", sortOrder: 18 },
  { accountId: "obligaciones-reaseguradores", lineNumber: 21, canonicalName: "OBLIGACIONES CON REASEGURADORES Y REAFIANZADORES", statementType: "financialPosition", sortOrder: 19 },
  { accountId: "reservas-tecnicas", lineNumber: 22, canonicalName: "RESERVAS TÉCNICAS Y MATEMÁTICAS", statementType: "financialPosition", sortOrder: 20 },
  { accountId: "otros-pasivos", lineNumber: 23, canonicalName: "OTROS PASIVOS", statementType: "financialPosition", sortOrder: 21 },
  { accountId: "creditos-diferidos", lineNumber: 24, canonicalName: "CRÉDITOS DIFERIDOS", statementType: "financialPosition", sortOrder: 22 },
  { accountId: "pasivos-contingentes", lineNumber: 25, canonicalName: "PASIVOS CONTINGENTES", statementType: "financialPosition", sortOrder: 23 },
  { accountId: "subtotal-pasivos-patrimonio", lineNumber: 26, canonicalName: "SUBTOTAL PASIVOS Y PATRIMONIO", statementType: "financialPosition", sortOrder: 24 },
  { accountId: "patrimonio", lineNumber: 27, canonicalName: "PATRIMONIO", statementType: "financialPosition", sortOrder: 25 },
  { accountId: "capital-social", lineNumber: 28, canonicalName: "CAPITAL SOCIAL", statementType: "financialPosition", sortOrder: 26 },
  { accountId: "aportes-no-capitalizados", lineNumber: 29, canonicalName: "APORTES PATRIMONIALES NO CAPITALIZADOS", statementType: "financialPosition", sortOrder: 27 },
  { accountId: "resultados-acumulados", lineNumber: 30, canonicalName: "RESULTADOS ACUMULADOS", statementType: "financialPosition", sortOrder: 28 },
  { accountId: "resultado-neto", lineNumber: 31, canonicalName: "RESULTADO NETO DEL EJERCICIO", statementType: "financialPosition", sortOrder: 29 },
  { accountId: "patrimonio-restringido", lineNumber: 32, canonicalName: "PATRIMONIO RESTRINGIDO NO DISTRIBUIBLE", statementType: "financialPosition", sortOrder: 30 },
  { accountId: "total-pasivos-patrimonio", lineNumber: 33, canonicalName: "TOTAL PASIVOS Y PATRIMONIO", statementType: "financialPosition", sortOrder: 31 },
  { accountId: "cuentas-orden", lineNumber: 34, canonicalName: "CUENTAS DE ORDEN Y REGISTRO", statementType: "financialPosition", sortOrder: 32 }
];

export const financialAccountAliases: FinancialAccountAlias[] = [
  { alias: "TOTAL ACTIVOS", accountId: "total-activos", source: "dictionary" },
  { alias: "ACTIVOS TOTALES", accountId: "total-activos", source: "dictionary" },
  { alias: "RESERVAS TECNICAS Y MATEMATICAS", accountId: "reservas-tecnicas", source: "dictionary" },
  { alias: "PATRIMONIO RESTRINGIDO NO DISTRIBUIBLE", accountId: "patrimonio-restringido", source: "dictionary" },
  { alias: "CUENTAS DE ORDEN Y REGISTRO", accountId: "cuentas-orden", source: "dictionary" }
];
