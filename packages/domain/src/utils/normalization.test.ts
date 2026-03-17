import { describe, expect, it } from "vitest";
import { resolveInstitution } from "./normalization";

describe("resolveInstitution", () => {
  it("resolves cosmetic institution aliases like SEGUROS EQUIDAD, S.A.", () => {
    expect(resolveInstitution("SEGUROS EQUIDAD, S.A.")?.institutionId).toBe("equidad");
    expect(resolveInstitution("Seguros Equidad")?.institutionId).toBe("equidad");
    expect(resolveInstitution("SEGUROS EQUIDAD SA")?.institutionId).toBe("equidad");
  });
});
