import { describe, expect, it } from "vitest";
import {
  resolveFinancialAccountWithFallback,
  resolveInstitution,
  resolveInstitutionDetailed,
  resolveInsuranceLine,
  resolveInsuranceLineDetailed
} from "./normalization";
import { repairMojibake } from "./text";

describe("resolveInstitution", () => {
  it("resolves cosmetic institution aliases like SEGUROS EQUIDAD, S.A.", () => {
    expect(resolveInstitution("SEGUROS EQUIDAD, S.A.")?.institutionId).toBe("equidad");
    expect(resolveInstitution("Seguros Equidad")?.institutionId).toBe("equidad");
    expect(resolveInstitution("SEGUROS EQUIDAD SA")?.institutionId).toBe("equidad");
  });

  it("resolves case, spacing, accent, and mojibake variants after normalization", () => {
    const normalized = resolveInstitutionDetailed("  seguros del pais  ");
    const mojibake = resolveInstitutionDetailed("SEGUROS DEL PAÃS");

    expect(normalized.entity?.institutionId).toBe("del-pais");
    expect(normalized.strategy).toBe("normalized-alias");
    expect(mojibake.entity?.institutionId).toBe("del-pais");
    expect(mojibake.usedMojibakeRepair).toBe(true);
  });
});

describe("repairMojibake", () => {
  it("repairs common mojibake sequences before alias matching", () => {
    expect(repairMojibake("CrÃ©ditos Diferidos")).toBe("Créditos Diferidos");
    expect(repairMojibake("Propiedades de InversiÃ³n")).toBe("Propiedades de Inversión");
    expect(repairMojibake("Reservas TÃ©cnicas y MatemÃ¡ticas")).toBe("Reservas Técnicas y Matemáticas");
    expect(repairMojibake("PrÃ©stamos")).toBe("Préstamos");
    expect(repairMojibake("DisposiciÃ³n")).toBe("Disposición");
    expect(repairMojibake("Hospitalizaci贸n")).toBe("Hospitalización");
    expect(repairMojibake("Casco Marit铆mo")).toBe("Casco Marítimo");
  });
});

describe("resolveFinancialAccountWithFallback", () => {
  it("resolves mojibake financial accounts to the correct canonical account", () => {
    expect(resolveFinancialAccountWithFallback("CrÃ©ditos Diferidos", 24).entity?.accountId).toBe("creditos-diferidos");
    expect(resolveFinancialAccountWithFallback("Propiedades de InversiÃ³n", 9).entity?.accountId).toBe("propiedades-inversion");
    expect(resolveFinancialAccountWithFallback("Reservas TÃ©cnicas y MatemÃ¡ticas", 22).entity?.accountId).toBe("reservas-tecnicas");
    expect(resolveFinancialAccountWithFallback("PrÃ©stamos", 4).entity?.accountId).toBe("prestamos");
    expect(resolveFinancialAccountWithFallback("Activos Mantenidos para la Venta y Grupo de Activos para su DisposiciÃ³n", 7).entity?.accountId).toBe("activos-venta");
  });

  it("uses controlled line fallback when the line number is authoritative", () => {
    const result = resolveFinancialAccountWithFallback("Cr?ditos raros", 24);
    expect(result.entity?.accountId).toBe("creditos-diferidos");
    expect(result.strategy).toBe("line-number-fallback");
  });

  it("handles future normalization variants without requiring new aliases", () => {
    const weirdSpacing = resolveFinancialAccountWithFallback("  pRoPiedades   de   inversiOn  ", 9);

    expect(weirdSpacing.entity?.accountId).toBe("propiedades-inversion");
    expect(weirdSpacing.strategy).toBe("normalized-alias");
  });

  it("marks broad matches as ambiguous instead of accepting them silently", () => {
    const result = resolveFinancialAccountWithFallback("TOTAL");

    expect(result.entity).toBeNull();
    expect(result.strategy).toBe("ambiguous");
    expect(result.candidateNames).toContain("TOTAL ACTIVOS");
    expect(result.candidateNames).toContain("TOTAL PASIVOS Y PATRIMONIO");
  });
});

describe("resolveInsuranceLine", () => {
  it("resolves Ganadero as a subline under otros seguros generales", () => {
    expect(resolveInsuranceLine("Ganadero")?.lineId).toBe("ganadero");
    expect(resolveInsuranceLine("Otros Seguros Generales / Ganadero")?.lineId).toBe("ganadero");
  });

  it("normalizes slash, spacing, and accent variants for future workbooks", () => {
    const slashVariant = resolveInsuranceLineDetailed("otros seguros generales  /  ganadero");
    const accentless = resolveInsuranceLineDetailed("casco maritimo");

    expect(slashVariant.entity?.lineId).toBe("ganadero");
    expect(slashVariant.strategy).toBe("normalized-alias");
    expect(accentless.entity?.lineId).toBe("casco-maritimo");
    expect(accentless.strategy).toBe("normalized-alias");
  });
});
