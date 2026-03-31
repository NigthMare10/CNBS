import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { storagePaths } from "@cnbs/config";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageRepository } from "./local-storage";

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("LocalStorageRepository", () => {
  const storage = new LocalStorageRepository();

  beforeEach(async () => {
    await storage.clearStorage();
  });

  it("fills partial active pointer fields from cache-state", async () => {
    const updatedAt = "2026-03-31T12:00:00.000Z";

    await writeJson(join(storagePaths.active, "cache-state.json"), {
      namespace: "test-namespace",
      activeDatasetVersionId: "dataset-v1",
      updatedAt
    });
    await writeJson(join(storagePaths.active, "active-dataset.json"), {
      updatedAt
    });

    const pointer = await storage.getActiveDatasetPointer();

    expect(pointer).toEqual({
      datasetVersionId: "dataset-v1",
      updatedAt
    });
  });

  it("preserves an explicit null active pointer instead of reviving stale cache-state", async () => {
    await writeJson(join(storagePaths.active, "cache-state.json"), {
      namespace: "test-namespace",
      activeDatasetVersionId: "dataset-v1",
      updatedAt: "2026-03-31T12:00:00.000Z"
    });
    await writeJson(join(storagePaths.active, "active-dataset.json"), {
      datasetVersionId: null,
      updatedAt: null
    });

    const pointer = await storage.getActiveDatasetPointer();

    expect(pointer).toEqual({
      datasetVersionId: null,
      updatedAt: null
    });
  });

  it("returns a null pointer when both active pointer and cache-state are incomplete", async () => {
    await rm(join(storagePaths.active, "active-dataset.json"), { force: true });
    await writeJson(join(storagePaths.active, "cache-state.json"), {
      namespace: "test-namespace"
    });

    const pointer = await storage.getActiveDatasetPointer();

    expect(pointer).toEqual({
      datasetVersionId: null,
      updatedAt: null
    });
  });
});
