import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { detectWorkbookKind } from "./signatures";

const workbookFixtures = {
  premiums: resolve(process.cwd(), "..", "testing", "fixtures", "workbooks", "primas.xlsx"),
  financialPosition: resolve(
    process.cwd(),
    "..",
    "testing",
    "fixtures",
    "workbooks",
    "estado_situacion_financiera.xlsx"
  ),
  reference: resolve(
    process.cwd(),
    "..",
    "testing",
    "fixtures",
    "workbooks",
    "informe_financiero_referencia.xlsx"
  )
};

describe("detectWorkbookKind", () => {
  it("detects the premiums workbook by schema", async () => {
    await expect(detectWorkbookKind(workbookFixtures.premiums)).resolves.toMatchObject({ kind: "premiums" });
  });

  it("detects the financial position workbook by schema", async () => {
    await expect(detectWorkbookKind(workbookFixtures.financialPosition)).resolves.toMatchObject({ kind: "financialPosition" });
  });

  it("detects the reference workbook by schema", async () => {
    await expect(detectWorkbookKind(workbookFixtures.reference)).resolves.toMatchObject({ kind: "reference" });
  });
});
