import {
  financialAccountAliases,
  financialAccountsCatalog,
  institutionAliases,
  institutionsCatalog,
  insuranceLineAliases,
  insuranceLinesCatalog
} from "../catalogs";
import type { FinancialAccount, Institution, InsuranceLine } from "../entities/canonical";
import type { AliasResolutionStrategy } from "../entities/core";
import { repairMojibake } from "./text";

type TextResolutionStrategy = Extract<AliasResolutionStrategy, "direct-alias" | "direct-canonical" | "normalized-alias" | "normalized-canonical">;

export interface AliasResolutionResult<T> {
  entity: T | null;
  normalizedValue: string;
  repairedValue: string;
  strategy: AliasResolutionStrategy;
  candidates: T[];
  candidateIds: string[];
  candidateNames: string[];
  usedMojibakeRepair: boolean;
  requiredNormalization: boolean;
  ambiguityReason: string | null;
}

function stripDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeAliasTokens(value: string): string {
  return stripDiacritics(repairMojibake(value).normalize("NFKC"))
    .toUpperCase()
    .replace(/[/\\|]+/g, " ")
    .replace(/[().,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFormattingOnly(value: string): string {
  return repairMojibake(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[/\\|]+/g, " ")
    .replace(/[().,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAliasInput(value: string): string {
  return normalizeAliasTokens(value);
}

function normalizeInstitutionAlias(value: string): string {
  return normalizeAliasInput(value)
    .replace(/\bSOCIEDAD ANONIMA\b/g, " ")
    .replace(/\bS A\b/g, " ")
    .replace(/\bSA\b/g, " ")
    .replace(/\bCIA\b/g, "COMPANIA")
    .replace(/\bCOMPANIA\b/g, "COMPANIA")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueById<T>(items: T[], getId: (item: T) => string): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const item of items) {
    const id = getId(item);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(item);
  }

  return unique;
}

function baseResolution<T>(input: {
  value: string;
  normalizer: (value: string) => string;
}): Pick<AliasResolutionResult<T>, "normalizedValue" | "repairedValue" | "usedMojibakeRepair"> {
  const repairedValue = repairMojibake(input.value);
  const normalizedValue = input.normalizer(input.value);
  return {
    normalizedValue,
    repairedValue,
    usedMojibakeRepair: repairedValue !== input.value
  };
}

function buildResolutionResult<T>(input: {
  value: string;
  normalizer: (value: string) => string;
  strategy: AliasResolutionStrategy;
  entity: T | null;
  candidates: T[];
  getId: (item: T) => string;
  getName: (item: T) => string;
  ambiguityReason?: string | null;
}): AliasResolutionResult<T> {
  const shared = baseResolution<T>({ value: input.value, normalizer: input.normalizer });
  return {
    ...shared,
    entity: input.entity,
    strategy: input.strategy,
    candidates: input.candidates,
    candidateIds: input.candidates.map(input.getId),
    candidateNames: input.candidates.map(input.getName),
    requiredNormalization:
      input.strategy === "direct-alias" || input.strategy === "direct-canonical"
        ? false
        : input.strategy === "normalized-alias" || input.strategy === "normalized-canonical"
          ? true
          : shared.usedMojibakeRepair || normalizeFormattingOnly(input.value) !== input.value,
    ambiguityReason: input.ambiguityReason ?? null
  };
}

function stageCandidates<T>(input: {
  aliases: Array<{ alias: string; targetId: string }>;
  catalog: T[];
  getId: (item: T) => string;
  getCanonicalName: (item: T) => string;
  normalizer: (value: string) => string;
  value: string;
}): Array<{ strategy: TextResolutionStrategy; candidates: T[] }> {
  const catalogById = new Map(input.catalog.map((item) => [input.getId(item), item]));
  const directAlias = uniqueById(
    input.aliases
      .filter((entry) => entry.alias === input.value)
      .map((entry) => catalogById.get(entry.targetId))
      .filter((item): item is T => item !== undefined),
    input.getId
  );
  const directCanonical = uniqueById(
    input.catalog.filter((item) => input.getCanonicalName(item) === input.value),
    input.getId
  );
  const normalizedAlias = uniqueById(
    input.aliases
      .filter((entry) => input.normalizer(entry.alias) === input.normalizer(input.value))
      .map((entry) => catalogById.get(entry.targetId))
      .filter((item): item is T => item !== undefined),
    input.getId
  );
  const normalizedCanonical = uniqueById(
    input.catalog.filter((item) => input.normalizer(input.getCanonicalName(item)) === input.normalizer(input.value)),
    input.getId
  );

  return [
    { strategy: "direct-alias", candidates: directAlias },
    { strategy: "direct-canonical", candidates: directCanonical },
    { strategy: "normalized-alias", candidates: normalizedAlias },
    { strategy: "normalized-canonical", candidates: normalizedCanonical }
  ];
}

function resolveCatalogEntry<T>(input: {
  aliases: Array<{ alias: string; targetId: string }>;
  catalog: T[];
  getId: (item: T) => string;
  getName: (item: T) => string;
  getCanonicalName: (item: T) => string;
  normalizer: (value: string) => string;
  value: string;
}): AliasResolutionResult<T> {
  const stages = stageCandidates(input);

  for (const stage of stages) {
    if (stage.candidates.length === 1) {
      return buildResolutionResult({
        value: input.value,
        normalizer: input.normalizer,
        strategy: stage.strategy,
        entity: stage.candidates[0] ?? null,
        candidates: stage.candidates,
        getId: input.getId,
        getName: input.getName
      });
    }

    if (stage.candidates.length > 1) {
      return buildResolutionResult({
        value: input.value,
        normalizer: input.normalizer,
        strategy: "ambiguous",
        entity: null,
        candidates: stage.candidates,
        getId: input.getId,
        getName: input.getName,
        ambiguityReason: `${stage.strategy}-matched-multiple-candidates`
      });
    }
  }

  return buildResolutionResult({
    value: input.value,
    normalizer: input.normalizer,
    strategy: "unresolved",
    entity: null,
    candidates: [],
    getId: input.getId,
    getName: input.getName
  });
}

export function resolveInstitutionDetailed(value: string): AliasResolutionResult<Institution> {
  return resolveCatalogEntry({
    aliases: institutionAliases.map((entry) => ({ alias: entry.alias, targetId: entry.institutionId })),
    catalog: institutionsCatalog,
    getId: (item) => item.institutionId,
    getCanonicalName: (item) => item.canonicalName,
    getName: (item) => item.canonicalName,
    normalizer: normalizeInstitutionAlias,
    value
  });
}

export function resolveInstitution(value: string): Institution | null {
  return resolveInstitutionDetailed(value).entity;
}

export function resolveInsuranceLineDetailed(value: string): AliasResolutionResult<InsuranceLine> {
  return resolveCatalogEntry({
    aliases: insuranceLineAliases.map((entry) => ({ alias: entry.alias, targetId: entry.lineId })),
    catalog: insuranceLinesCatalog,
    getId: (item) => item.lineId,
    getCanonicalName: (item) => item.canonicalName,
    getName: (item) => item.canonicalName,
    normalizer: normalizeAliasInput,
    value
  });
}

export function resolveInsuranceLine(value: string): InsuranceLine | null {
  return resolveInsuranceLineDetailed(value).entity;
}

export function resolveFinancialAccountDetailed(value: string): AliasResolutionResult<FinancialAccount> {
  return resolveCatalogEntry({
    aliases: financialAccountAliases.map((entry) => ({ alias: entry.alias, targetId: entry.accountId })),
    catalog: financialAccountsCatalog,
    getId: (item) => item.accountId,
    getCanonicalName: (item) => item.canonicalName,
    getName: (item) => item.canonicalName,
    normalizer: normalizeAliasInput,
    value
  });
}

export function resolveFinancialAccount(value: string): FinancialAccount | null {
  return resolveFinancialAccountDetailed(value).entity;
}

function candidateFinancialAccounts(value: string): FinancialAccount[] {
  const normalizedValue = normalizeAliasInput(value);
  if (normalizedValue.length < 4) {
    return [];
  }

  return uniqueById(
    financialAccountsCatalog.filter((item) => {
      const canonical = normalizeAliasInput(item.canonicalName);
      return canonical.includes(normalizedValue) || normalizedValue.includes(canonical);
    }),
    (item) => item.accountId
  );
}

export function resolveFinancialAccountWithFallback(value: string, lineNumber?: number): AliasResolutionResult<FinancialAccount> {
  const exact = resolveFinancialAccountDetailed(value);
  if (exact.entity || exact.strategy === "ambiguous") {
    return exact;
  }

  const fuzzyCandidates = candidateFinancialAccounts(value);
  const safeLineNumber = typeof lineNumber === "number" && Number.isFinite(lineNumber) ? lineNumber : undefined;
  const lineCandidate = typeof safeLineNumber === "number"
    ? financialAccountsCatalog.find((item) => item.lineNumber === safeLineNumber) ?? null
    : null;

  if (lineCandidate) {
    const candidates = uniqueById(
      fuzzyCandidates.some((candidate) => candidate.accountId === lineCandidate.accountId)
        ? fuzzyCandidates
        : [lineCandidate, ...fuzzyCandidates],
      (item) => item.accountId
    );
    return buildResolutionResult({
      value,
      normalizer: normalizeAliasInput,
      strategy: "line-number-fallback",
      entity: lineCandidate,
      candidates,
      getId: (item) => item.accountId,
      getName: (item) => item.canonicalName,
      ambiguityReason: fuzzyCandidates.length > 1 ? "text-matched-multiple-candidates-but-line-number-was-authoritative" : null
    });
  }

  if (fuzzyCandidates.length > 1) {
    return buildResolutionResult({
      value,
      normalizer: normalizeAliasInput,
      strategy: "ambiguous",
      entity: null,
      candidates: fuzzyCandidates,
      getId: (item) => item.accountId,
      getName: (item) => item.canonicalName,
      ambiguityReason: "substring-candidate-match-multiple-candidates"
    });
  }

  if (fuzzyCandidates.length === 1) {
    return buildResolutionResult({
      value,
      normalizer: normalizeAliasInput,
      strategy: "unresolved",
      entity: null,
      candidates: fuzzyCandidates,
      getId: (item) => item.accountId,
      getName: (item) => item.canonicalName,
      ambiguityReason: "candidate-found-but-no-safe-resolution"
    });
  }

  return exact;
}
