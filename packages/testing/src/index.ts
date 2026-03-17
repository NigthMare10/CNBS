import { join } from "node:path";

export const workbookFixtures = {
  premiums: join(process.cwd(), "packages", "testing", "fixtures", "workbooks", "primas.xlsx"),
  financialPosition: join(
    process.cwd(),
    "packages",
    "testing",
    "fixtures",
    "workbooks",
    "estado_situacion_financiera.xlsx"
  ),
  reference: join(
    process.cwd(),
    "packages",
    "testing",
    "fixtures",
    "workbooks",
    "informe_financiero_referencia.xlsx"
  )
};
