type MappingDomainKey = "institution" | "insuranceLine" | "financialAccount";

export interface MappingExampleView {
  domain: MappingDomainKey;
  scope: string;
  originalValue: string;
  repairedValue: string;
  normalizedValue: string;
  canonicalId: string | null;
  canonicalName: string | null;
  strategy: string;
  lineNumber: number | null;
  usedMojibakeRepair: boolean;
  requiredNormalization: boolean;
  candidateIds: string[];
  candidateNames: string[];
  ambiguityReason: string | null;
}

export interface MappingRepairView {
  domain: MappingDomainKey;
  originalValue: string;
  repairedValue: string;
  normalizedValue: string;
  canonicalId: string;
  canonicalName: string;
  strategy: string;
  count: number;
}

export interface MappingDomainView {
  key: MappingDomainKey;
  label: string;
  totalAttempts: number;
  repairedByNormalization: number;
  aliasesMatched: number;
  fallbackByLineNumber: number;
  ambiguousAliases: number;
  unresolvedAliases: number;
  textsRequiringMojibakeRepair: number;
  aliasesResolvedAfterNormalization: number;
  aliasesResolvedByDirectAlias: number;
}

export interface MappingSummaryView {
  repairedByNormalization: number;
  aliasesMatched: number;
  lineNumberFallback: number;
  fallbackByLineNumber: number;
  unresolvedAliases: number;
  ambiguousAliases: number;
  totalAttempts: number;
  textQuality: {
    textsRequiringMojibakeRepair: number;
    aliasesResolvedAfterNormalization: number;
    aliasesResolvedByDirectAlias: number;
    aliasesResolvedByLineNumberFallback: number;
    ambiguousAliases: number;
    unresolvedAliases: number;
  };
  domains: MappingDomainView[];
  topAliasRepairs: MappingRepairView[];
  resolvedExamples: MappingExampleView[];
  ambiguousExamples: MappingExampleView[];
  unresolvedExamples: MappingExampleView[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function domainLabel(key: MappingDomainKey): string {
  if (key === "institution") {
    return "Instituciones";
  }
  if (key === "insuranceLine") {
    return "Ramos";
  }
  return "Cuentas financieras";
}

function parseDomain(key: MappingDomainKey, value: unknown): MappingDomainView {
  const record = asRecord(value);
  return {
    key,
    label: domainLabel(key),
    totalAttempts: numberValue(record.totalAttempts),
    repairedByNormalization: numberValue(record.repairedByNormalization),
    aliasesMatched: numberValue(record.aliasesMatched),
    fallbackByLineNumber: numberValue(record.fallbackByLineNumber),
    ambiguousAliases: numberValue(record.ambiguousAliases),
    unresolvedAliases: numberValue(record.unresolvedAliases),
    textsRequiringMojibakeRepair: numberValue(record.textsRequiringMojibakeRepair),
    aliasesResolvedAfterNormalization: numberValue(record.aliasesResolvedAfterNormalization),
    aliasesResolvedByDirectAlias: numberValue(record.aliasesResolvedByDirectAlias)
  };
}

function parseExample(value: unknown): MappingExampleView {
  const record = asRecord(value);
  const domain = stringValue(record.domain) as MappingDomainKey;
  return {
    domain: domain === "institution" || domain === "insuranceLine" || domain === "financialAccount" ? domain : "institution",
    scope: stringValue(record.scope),
    originalValue: stringValue(record.originalValue),
    repairedValue: stringValue(record.repairedValue),
    normalizedValue: stringValue(record.normalizedValue),
    canonicalId: typeof record.canonicalId === "string" ? record.canonicalId : null,
    canonicalName: typeof record.canonicalName === "string" ? record.canonicalName : null,
    strategy: stringValue(record.strategy),
    lineNumber: typeof record.lineNumber === "number" ? record.lineNumber : null,
    usedMojibakeRepair: booleanValue(record.usedMojibakeRepair),
    requiredNormalization: booleanValue(record.requiredNormalization),
    candidateIds: stringArray(record.candidateIds),
    candidateNames: stringArray(record.candidateNames),
    ambiguityReason: typeof record.ambiguityReason === "string" ? record.ambiguityReason : null
  };
}

function parseRepair(value: unknown): MappingRepairView | null {
  const record = asRecord(value);
  const domain = stringValue(record.domain) as MappingDomainKey;
  if (!(domain === "institution" || domain === "insuranceLine" || domain === "financialAccount")) {
    return null;
  }

  const canonicalId = stringValue(record.canonicalId);
  const canonicalName = stringValue(record.canonicalName);
  if (!canonicalId || !canonicalName) {
    return null;
  }

  return {
    domain,
    originalValue: stringValue(record.originalValue),
    repairedValue: stringValue(record.repairedValue),
    normalizedValue: stringValue(record.normalizedValue),
    canonicalId,
    canonicalName,
    strategy: stringValue(record.strategy),
    count: numberValue(record.count)
  };
}

export function getMappingSummary(value: unknown): MappingSummaryView {
  const record = asRecord(value);
  const textQuality = asRecord(record.textQuality);
  const domains = asRecord(record.domains);

  return {
    repairedByNormalization: numberValue(record.repairedByNormalization),
    aliasesMatched: numberValue(record.aliasesMatched),
    lineNumberFallback: numberValue(record.lineNumberFallback),
    fallbackByLineNumber: numberValue(record.fallbackByLineNumber, numberValue(record.lineNumberFallback)),
    unresolvedAliases: numberValue(record.unresolvedAliases, numberValue(record.unresolved)),
    ambiguousAliases: numberValue(record.ambiguousAliases),
    totalAttempts: numberValue(record.totalAttempts),
    textQuality: {
      textsRequiringMojibakeRepair: numberValue(textQuality.textsRequiringMojibakeRepair),
      aliasesResolvedAfterNormalization: numberValue(textQuality.aliasesResolvedAfterNormalization),
      aliasesResolvedByDirectAlias: numberValue(textQuality.aliasesResolvedByDirectAlias),
      aliasesResolvedByLineNumberFallback: numberValue(textQuality.aliasesResolvedByLineNumberFallback, numberValue(record.lineNumberFallback)),
      ambiguousAliases: numberValue(textQuality.ambiguousAliases, numberValue(record.ambiguousAliases)),
      unresolvedAliases: numberValue(textQuality.unresolvedAliases, numberValue(record.unresolvedAliases, numberValue(record.unresolved)))
    },
    domains: [
      parseDomain("institution", domains.institution),
      parseDomain("insuranceLine", domains.insuranceLine),
      parseDomain("financialAccount", domains.financialAccount)
    ],
    topAliasRepairs: Array.isArray(record.topAliasRepairs)
      ? record.topAliasRepairs.map(parseRepair).filter((item): item is MappingRepairView => item !== null)
      : [],
    resolvedExamples: Array.isArray(record.resolvedExamples) ? record.resolvedExamples.map(parseExample) : [],
    ambiguousExamples: Array.isArray(record.ambiguousExamples) ? record.ambiguousExamples.map(parseExample) : [],
    unresolvedExamples: Array.isArray(record.unresolvedExamples) ? record.unresolvedExamples.map(parseExample) : []
  };
}

export function getMappingSummaryHeadline(summary: MappingSummaryView): string {
  if (
    summary.repairedByNormalization === 0 &&
    summary.ambiguousAliases === 0 &&
    summary.unresolvedAliases === 0 &&
    summary.fallbackByLineNumber === 0
  ) {
    return "No fue necesario corregir texto ni resolver alias conflictivos.";
  }

  if (summary.ambiguousAliases === 0 && summary.unresolvedAliases === 0) {
    if (summary.textQuality.textsRequiringMojibakeRepair > 0) {
      return `Se corrigieron ${summary.textQuality.textsRequiringMojibakeRepair} textos y todos los aliases quedaron resueltos.`;
    }

    if (summary.repairedByNormalization > 0 || summary.fallbackByLineNumber > 0) {
      return `Se normalizaron ${summary.repairedByNormalization} aliases y todos quedaron resueltos.`;
    }
  }

  return `Se detectaron ${summary.ambiguousAliases} aliases ambiguos y ${summary.unresolvedAliases} aliases no resueltos.`;
}

export function mappingDomainLabel(domain: MappingDomainKey): string {
  return domainLabel(domain);
}

export function mappingStrategyLabel(strategy: string): string {
  if (strategy === "direct-alias") {
    return "Alias directo";
  }
  if (strategy === "direct-canonical") {
    return "Canónico directo";
  }
  if (strategy === "normalized-alias") {
    return "Alias tras normalizar";
  }
  if (strategy === "normalized-canonical") {
    return "Canónico tras normalizar";
  }
  if (strategy === "line-number-fallback") {
    return "Fallback por línea";
  }
  if (strategy === "ambiguous") {
    return "Ambiguo";
  }
  return "No resuelto";
}
