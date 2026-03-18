import {
  financialAccountAliases,
  financialAccountsCatalog,
  institutionAliases,
  institutionsCatalog,
  insuranceLineAliases,
  insuranceLinesCatalog
} from "../catalogs";
import type {
  FinancialAccount,
  Institution,
  InsuranceLine
} from "../entities/canonical";
import { normalizeText, repairMojibake } from "./text";

export function normalizeAliasInput(value: string): string {
  return normalizeText(repairMojibake(value));
}

function normalizeInstitutionAlias(value: string): string {
  return normalizeAliasInput(value)
    .replace(/[.,]/g, " ")
    .replace(/\bSOCIEDAD ANONIMA\b/g, " ")
    .replace(/\bS A\b/g, " ")
    .replace(/\bS\.A\b/g, " ")
    .replace(/\bSA\b/g, " ")
    .replace(/\bCIA\b/g, "COMPANIA")
    .replace(/\bCOMPAÑIA\b/g, "COMPANIA")
    .replace(/\s+/g, " ")
    .trim();
}

function byAlias<T extends { alias: string }>(
  aliases: T[],
  value: string,
  key: keyof T
): string | null {
  const normalized = normalizeAliasInput(value);
  const found = aliases.find((entry) => normalizeAliasInput(entry.alias) === normalized);
  const resolved = found?.[key];
  return typeof resolved === "string" ? resolved : null;
}

export function resolveInstitution(value: string): Institution | null {
  const institutionId =
    byAlias(institutionAliases, value, "institutionId") ??
    institutionAliases.find((entry) => normalizeInstitutionAlias(entry.alias) === normalizeInstitutionAlias(value))
      ?.institutionId ??
    institutionsCatalog.find((item) => normalizeInstitutionAlias(item.canonicalName) === normalizeInstitutionAlias(value))
      ?.institutionId ??
    null;

  return institutionsCatalog.find((item) => item.institutionId === institutionId) ?? null;
}

export function resolveInsuranceLine(value: string): InsuranceLine | null {
  const lineId =
    byAlias(insuranceLineAliases, value, "lineId") ??
    insuranceLinesCatalog.find((item) => normalizeAliasInput(item.canonicalName) === normalizeAliasInput(value))?.lineId ??
    null;

  return insuranceLinesCatalog.find((item) => item.lineId === lineId) ?? null;
}

export function resolveFinancialAccount(value: string): FinancialAccount | null {
  const accountId =
    byAlias(financialAccountAliases, value, "accountId") ??
    financialAccountsCatalog.find((item) => normalizeAliasInput(item.canonicalName) === normalizeAliasInput(value))?.accountId ??
    null;

  return financialAccountsCatalog.find((item) => item.accountId === accountId) ?? null;
}

export function resolveFinancialAccountWithFallback(value: string, lineNumber?: number): {
  account: FinancialAccount | null;
  normalizedValue: string;
  candidate: FinancialAccount | null;
  strategy: "alias" | "line-number" | "unresolved";
} {
  const normalizedValue = normalizeAliasInput(value);
  const exact = resolveFinancialAccount(value);
  if (exact) {
    return { account: exact, normalizedValue, candidate: exact, strategy: "alias" };
  }

  const lineCandidate = typeof lineNumber === "number"
    ? financialAccountsCatalog.find((item) => item.lineNumber === lineNumber) ?? null
    : null;

  if (lineCandidate) {
    return { account: lineCandidate, normalizedValue, candidate: lineCandidate, strategy: "line-number" };
  }

  const candidate = financialAccountsCatalog.find((item) => normalizeAliasInput(item.canonicalName).includes(normalizedValue) || normalizedValue.includes(normalizeAliasInput(item.canonicalName))) ?? null;
  return { account: null, normalizedValue, candidate, strategy: "unresolved" };
}
