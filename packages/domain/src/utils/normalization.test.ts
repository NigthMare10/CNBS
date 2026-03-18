import { describe, expect, it } from "vitest";
import { resolveFinancialAccountWithFallback, resolveInstitution, resolveInsuranceLine } from "./normalization";
import { repairMojibake } from "./text";

describe("resolveInstitution", () => {
  it("resolves cosmetic institution aliases like SEGUROS EQUIDAD, S.A.", () => {
    expect(resolveInstitution("SEGUROS EQUIDAD, S.A.")?.institutionId).toBe("equidad");
    expect(resolveInstitution("Seguros Equidad")?.institutionId).toBe("equidad");
    expect(resolveInstitution("SEGUROS EQUIDAD SA")?.institutionId).toBe("equidad");
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
    expect(resolveFinancialAccountWithFallback("CrÃ©ditos Diferidos", 24).account?.accountId).toBe("creditos-diferidos");
    expect(resolveFinancialAccountWithFallback("Propiedades de InversiÃ³n", 9).account?.accountId).toBe("propiedades-inversion");
    expect(resolveFinancialAccountWithFallback("Reservas TÃ©cnicas y MatemÃ¡ticas", 22).account?.accountId).toBe("reservas-tecnicas");
    expect(resolveFinancialAccountWithFallback("PrÃ©stamos", 4).account?.accountId).toBe("prestamos");
    expect(resolveFinancialAccountWithFallback("Activos Mantenidos para la Venta y Grupo de Activos para su DisposiciÃ³n", 7).account?.accountId).toBe("activos-venta");
  });

  it("uses controlled line fallback when the line number is authoritative", () => {
    const result = resolveFinancialAccountWithFallback("Cr?ditos raros", 24);
    expect(result.account?.accountId).toBe("creditos-diferidos");
    expect(result.strategy).toBe("line-number");
  });
});

describe("resolveInsuranceLine", () => {
  it("resolves Ganadero as a subline under otros seguros generales", () => {
    expect(resolveInsuranceLine("Ganadero")?.lineId).toBe("ganadero");
    expect(resolveInsuranceLine("Otros Seguros Generales / Ganadero")?.lineId).toBe("ganadero");
  });
});
