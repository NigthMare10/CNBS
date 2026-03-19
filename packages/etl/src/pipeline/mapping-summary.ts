import type {
  AliasResolutionDomain,
  AliasResolutionExample,
  MappingDomainSummary,
  MappingSummary,
  TopAliasRepair
} from "@cnbs/domain";

const MAX_EXAMPLES = 8;
const MAX_TOP_REPAIRS = 8;

export type MappingResolutionEvent = AliasResolutionExample;

export interface MappingSummaryBuilder {
  summary: MappingSummary;
  topRepairCounts: Map<string, TopAliasRepair>;
  exampleKeys: {
    resolved: Set<string>;
    ambiguous: Set<string>;
    unresolved: Set<string>;
  };
}

function emptyDomainSummary(): MappingDomainSummary {
  return {
    totalAttempts: 0,
    repairedByNormalization: 0,
    aliasesMatched: 0,
    fallbackByLineNumber: 0,
    ambiguousAliases: 0,
    unresolvedAliases: 0,
    textsRequiringMojibakeRepair: 0,
    aliasesResolvedAfterNormalization: 0,
    aliasesResolvedByDirectAlias: 0
  };
}

export function createEmptyMappingSummary(): MappingSummary {
  return {
    repairedByNormalization: 0,
    aliasesMatched: 0,
    lineNumberFallback: 0,
    fallbackByLineNumber: 0,
    unresolved: 0,
    unresolvedAliases: 0,
    ambiguousAliases: 0,
    totalAttempts: 0,
    textQuality: {
      textsRequiringMojibakeRepair: 0,
      aliasesResolvedAfterNormalization: 0,
      aliasesResolvedByDirectAlias: 0,
      aliasesResolvedByLineNumberFallback: 0,
      ambiguousAliases: 0,
      unresolvedAliases: 0
    },
    domains: {
      institution: emptyDomainSummary(),
      insuranceLine: emptyDomainSummary(),
      financialAccount: emptyDomainSummary()
    },
    topAliasRepairs: [],
    resolvedExamples: [],
    ambiguousExamples: [],
    unresolvedExamples: []
  };
}

export function createMappingSummaryBuilder(): MappingSummaryBuilder {
  return {
    summary: createEmptyMappingSummary(),
    topRepairCounts: new Map<string, TopAliasRepair>(),
    exampleKeys: {
      resolved: new Set<string>(),
      ambiguous: new Set<string>(),
      unresolved: new Set<string>()
    }
  };
}

function bucketFor(builder: MappingSummaryBuilder, domain: AliasResolutionDomain): MappingDomainSummary {
  return builder.summary.domains[domain];
}

function pushExample(list: AliasResolutionExample[], seen: Set<string>, event: MappingResolutionEvent): void {
  if (list.length >= MAX_EXAMPLES) {
    return;
  }

  const key = [event.domain, event.strategy, event.originalValue, event.canonicalId ?? "", event.scope].join("|");
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  list.push({ ...event });
}

function isDirectMatch(strategy: MappingResolutionEvent["strategy"]): boolean {
  return strategy === "direct-alias" || strategy === "direct-canonical";
}

function isNormalizedMatch(strategy: MappingResolutionEvent["strategy"]): boolean {
  return strategy === "normalized-alias" || strategy === "normalized-canonical";
}

function recordTopRepair(builder: MappingSummaryBuilder, event: MappingResolutionEvent): void {
  if (!isNormalizedMatch(event.strategy) || !event.requiredNormalization || !event.canonicalId || !event.canonicalName) {
    return;
  }

  const key = [event.domain, event.strategy, event.originalValue, event.repairedValue, event.normalizedValue, event.canonicalId].join("|");
  const existing = builder.topRepairCounts.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }

  builder.topRepairCounts.set(key, {
    domain: event.domain,
    originalValue: event.originalValue,
    repairedValue: event.repairedValue,
    normalizedValue: event.normalizedValue,
    canonicalId: event.canonicalId,
    canonicalName: event.canonicalName,
    strategy: event.strategy as TopAliasRepair["strategy"],
    count: 1
  });
}

export function recordAliasResolution(builder: MappingSummaryBuilder, event: MappingResolutionEvent): void {
  const domain = bucketFor(builder, event.domain);
  builder.summary.totalAttempts += 1;
  domain.totalAttempts += 1;

  if (event.usedMojibakeRepair) {
    builder.summary.textQuality.textsRequiringMojibakeRepair += 1;
    domain.textsRequiringMojibakeRepair += 1;
  }

  if (event.requiredNormalization) {
    builder.summary.repairedByNormalization += 1;
    domain.repairedByNormalization += 1;
  }

  if (isDirectMatch(event.strategy) || isNormalizedMatch(event.strategy)) {
    builder.summary.aliasesMatched += 1;
    domain.aliasesMatched += 1;

    if (isDirectMatch(event.strategy)) {
      builder.summary.textQuality.aliasesResolvedByDirectAlias += 1;
      domain.aliasesResolvedByDirectAlias += 1;
    } else {
      builder.summary.textQuality.aliasesResolvedAfterNormalization += 1;
      domain.aliasesResolvedAfterNormalization += 1;
      recordTopRepair(builder, event);
    }

    if (event.requiredNormalization) {
      pushExample(builder.summary.resolvedExamples, builder.exampleKeys.resolved, event);
    }
    return;
  }

  if (event.strategy === "line-number-fallback") {
    builder.summary.lineNumberFallback += 1;
    builder.summary.fallbackByLineNumber += 1;
    builder.summary.textQuality.aliasesResolvedByLineNumberFallback += 1;
    domain.fallbackByLineNumber += 1;
    pushExample(builder.summary.resolvedExamples, builder.exampleKeys.resolved, event);
    return;
  }

  if (event.strategy === "ambiguous") {
    builder.summary.ambiguousAliases += 1;
    builder.summary.textQuality.ambiguousAliases += 1;
    domain.ambiguousAliases += 1;
    pushExample(builder.summary.ambiguousExamples, builder.exampleKeys.ambiguous, event);
    return;
  }

  builder.summary.unresolved += 1;
  builder.summary.unresolvedAliases += 1;
  builder.summary.textQuality.unresolvedAliases += 1;
  domain.unresolvedAliases += 1;
  pushExample(builder.summary.unresolvedExamples, builder.exampleKeys.unresolved, event);
}

export function buildMappingSummary(builder: MappingSummaryBuilder): MappingSummary {
  return {
    ...builder.summary,
    topAliasRepairs: Array.from(builder.topRepairCounts.values())
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        if (left.domain !== right.domain) {
          return left.domain.localeCompare(right.domain);
        }
        return left.canonicalName.localeCompare(right.canonicalName);
      })
      .slice(0, MAX_TOP_REPAIRS)
  };
}
