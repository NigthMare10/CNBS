import type { Publishability, ReconciliationSummary, ValidationSummary } from "../entities/core";

const weight: Record<Publishability, number> = {
  publishable: 0,
  warningOnly: 1,
  blocked: 2
};

export function mergePublishability(
  validationSummary: ValidationSummary,
  reconciliationSummary: ReconciliationSummary
): Publishability {
  return weight[validationSummary.publishability] >= weight[reconciliationSummary.publishability]
    ? validationSummary.publishability
    : reconciliationSummary.publishability;
}
