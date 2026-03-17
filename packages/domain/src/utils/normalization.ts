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
import { normalizeText } from "./text";

function normalizeInstitutionAlias(value: string): string {
  return normalizeText(value)
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
  const normalized = normalizeText(value);
  const found = aliases.find((entry) => normalizeText(entry.alias) === normalized);
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
    insuranceLinesCatalog.find((item) => normalizeText(item.canonicalName) === normalizeText(value))?.lineId ??
    null;

  return insuranceLinesCatalog.find((item) => item.lineId === lineId) ?? null;
}

export function resolveFinancialAccount(value: string): FinancialAccount | null {
  const accountId =
    byAlias(financialAccountAliases, value, "accountId") ??
    financialAccountsCatalog.find((item) => normalizeText(item.canonicalName) === normalizeText(value))?.accountId ??
    null;

  return financialAccountsCatalog.find((item) => item.accountId === accountId) ?? null;
}
