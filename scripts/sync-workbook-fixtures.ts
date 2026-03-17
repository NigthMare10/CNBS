import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const fixtureDir = join(root, "packages", "testing", "fixtures", "workbooks");
mkdirSync(fixtureDir, { recursive: true });

for (const fileName of [
  "primas.xlsx",
  "estado_situacion_financiera.xlsx",
  "informe_financiero_referencia.xlsx"
]) {
  const source = join(root, fileName);
  const target = join(fixtureDir, fileName);

  if (!existsSync(source)) {
    throw new Error(`Workbook fixture source not found: ${fileName}`);
  }

  cpSync(source, target);
}

console.log("Workbook fixtures synchronized.");
