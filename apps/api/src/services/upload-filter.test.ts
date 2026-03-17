import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
});
