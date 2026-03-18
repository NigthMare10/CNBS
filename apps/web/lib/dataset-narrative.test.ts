import { describe, expect, it } from "vitest";
import { getCoverageSummary, getHomeHeroCopy } from "./dataset-narrative";

describe("dataset narrative", () => {
  it("summarizes only operational source domains", () => {
    const summary = getCoverageSummary({
      premiums: { publishable: true },
      financialPosition: { publishable: false },
      incomeStatement: { publishable: true }
    });

    expect(summary).toBe("primas");
  });

  it("does not narrate income statement as an operational public source", () => {
    const copy = getHomeHeroCopy({
      datasetScope: "premiums-only",
      domainAvailability: {
        premiums: { publishable: true },
        financialPosition: { publishable: false },
        incomeStatement: { publishable: false }
      }
    });

    expect(copy.description.toLowerCase()).not.toContain("estado de resultados");
  });
});
