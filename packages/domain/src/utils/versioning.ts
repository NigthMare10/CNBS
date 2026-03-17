import { createHash, randomUUID } from "node:crypto";
import type { SourceFileRecord } from "../entities/core";

export function createDatasetVersionId(now = new Date()): string {
  return `dataset-${now.toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
}

export function fingerprintSourceFiles(sourceFiles: SourceFileRecord[]): string {
  const hash = createHash("sha256");
  for (const entry of sourceFiles.map((item) => item.sha256).sort()) {
    hash.update(entry);
  }
  return hash.digest("hex");
}
