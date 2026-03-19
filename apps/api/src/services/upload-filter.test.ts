import { mkdtemp, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { mapMultipartUploadsToInputs } from "./upload-filter";

describe("mapMultipartUploadsToInputs", () => {
  it("filters out blob and zero-byte phantom uploads", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cnbs-upload-filter-"));
    const real = join(dir, "real.xlsx");
    const ghost = join(dir, "ghost.xlsx");
    await writeFile(real, Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    await writeFile(ghost, Buffer.alloc(0));

    const files = await mapMultipartUploadsToInputs([
      { filepath: real, filename: "Primas.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      { filepath: ghost, filename: "blob", mimetype: "application/octet-stream" }
    ]);

    expect(files).toHaveLength(1);
    expect(files[0]?.originalFilename).toBe("Primas.xlsx");
  });

  it("preserves both real uploaded xlsx files when multiple files are selected", async () => {
    const files = await mapMultipartUploadsToInputs([
      {
        filepath: resolve(process.cwd(), "..", "..", "Primas (3).xlsx"),
        filename: "Primas (3).xlsx",
        mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      },
      {
        filepath: resolve(process.cwd(), "..", "..", "EstadoSituacionFinanciera (2).xlsx"),
        filename: "EstadoSituacionFinanciera (2).xlsx",
        mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    ]);

    expect(files).toHaveLength(2);
    expect(files.map((file) => file.originalFilename).sort()).toEqual(["EstadoSituacionFinanciera (2).xlsx", "Primas (3).xlsx"]);
  });

  it("drops missing temporary multipart files instead of throwing", async () => {
    const files = await mapMultipartUploadsToInputs([
      {
        filepath: resolve(process.cwd(), "missing-upload.xlsx"),
        filename: "missing-upload.xlsx",
        mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    ]);

    expect(files).toHaveLength(0);
  });
});
