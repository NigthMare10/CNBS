import { del, get, head, list, put } from "@vercel/blob";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { bundledStorageRoot, publicProjectUrl, storagePaths } from "@cnbs/config";

export type StoragePersistenceMode = "filesystem" | "vercel-blob";

interface StoragePersistenceInfo {
  mode: StoragePersistenceMode;
  durable: boolean;
  blobPrefix: string | null;
}

function isBlobPersistenceEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN && (process.env.VERCEL || process.env.CNBS_USE_BLOB_STORAGE === "1"));
}

function normalizeRelativePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
}

function storageProjectKey(): string {
  if (publicProjectUrl) {
    return new URL(publicProjectUrl).hostname.toLowerCase();
  }

  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL.toLowerCase();
  }

  return "local";
}

function blobPrefix(): string {
  return `cnbs-storage/${storageProjectKey()}`;
}

function createFileNotFoundError(path: string): Error & { code: string } {
  const error = new Error(`ENOENT: no such file or directory, open '${path}'`) as Error & { code: string };
  error.code = "ENOENT";
  return error;
}

function isBlobNotFound(error: unknown): boolean {
  return error instanceof Error && error.name === "BlobNotFoundError";
}

function isUnderDirectory(path: string, directoryPath: string): boolean {
  const relativePath = relative(resolve(directoryPath), resolve(path));
  return relativePath === "" || (!relativePath.startsWith("..") && !relativePath.includes(":"));
}

function isDurableStoragePath(path: string): boolean {
  if (!isBlobPersistenceEnabled()) {
    return false;
  }

  const resolvedPath = resolve(path);
  if (resolvedPath === resolve(storagePaths.root)) {
    return true;
  }

  return [storagePaths.active, storagePaths.audit, storagePaths.published, storagePaths.staging].some((directoryPath) => isUnderDirectory(path, directoryPath));
}

function storageRelativePath(path: string): string {
  const relativePath = normalizeRelativePath(relative(storagePaths.root, resolve(path)));
  return relativePath.length === 0 ? "" : relativePath;
}

function blobPathname(path: string): string {
  const relativePath = storageRelativePath(path);
  return relativePath.length === 0 ? blobPrefix() : `${blobPrefix()}/${relativePath}`;
}

async function readBlobText(path: string): Promise<string> {
  const result = await get(blobPathname(path), { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw createFileNotFoundError(path);
  }

  return await new Response(result.stream).text();
}

async function writeBlobText(path: string, value: string, contentType: string): Promise<void> {
  await put(blobPathname(path), value, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType
  });
}

async function listBlobEntries(path: string): Promise<string[]> {
  const directoryPath = resolve(path);

  if (directoryPath === resolve(storagePaths.root)) {
    const topLevel = new Set<string>();
    for (const knownDirectory of Object.values(storagePaths).filter((entry) => entry !== storagePaths.root)) {
      const entries = await listBlobEntries(knownDirectory);
      if (entries.length > 0) {
        topLevel.add(basename(knownDirectory));
      }
    }
    return Array.from(topLevel).sort();
  }

  const prefix = `${blobPathname(directoryPath).replace(/\/$/u, "")}/`;
  const entries = new Set<string>();
  let cursor: string | undefined;

  do {
    const result = await list(cursor ? { prefix, cursor } : { prefix });

    for (const blob of result.blobs) {
      const relativeName = normalizeRelativePath(blob.pathname.slice(prefix.length));
      const nextEntry = relativeName.split("/")[0];
      if (nextEntry) {
        entries.add(nextEntry);
      }
    }

    cursor = result.cursor;
    if (!result.hasMore) {
      break;
    }
  } while (cursor);

  return Array.from(entries).sort();
}

async function blobPathExists(path: string): Promise<boolean> {
  const resolvedPath = resolve(path);

  if (resolvedPath === resolve(storagePaths.root)) {
    return (await listBlobEntries(resolvedPath)).length > 0;
  }

  try {
    await head(blobPathname(resolvedPath));
    return true;
  } catch (error) {
    if (isBlobNotFound(error)) {
      return false;
    }

    const entries = await listBlobEntries(resolvedPath);
    if (entries.length > 0) {
      return true;
    }

    throw error;
  }
}

async function deleteBlobTree(path: string): Promise<void> {
  const prefix = `${blobPathname(path).replace(/\/$/u, "")}${resolve(path) === resolve(storagePaths.root) ? "" : "/"}`;
  let cursor: string | undefined;

  do {
    const result = await list(cursor ? { prefix, cursor } : { prefix });
    if (result.blobs.length > 0) {
      await del(result.blobs.map((blob) => blob.pathname));
    }

    cursor = result.cursor;
    if (!result.hasMore) {
      break;
    }
  } while (cursor);

  if (resolve(path) !== resolve(storagePaths.root)) {
    await del(blobPathname(path)).catch(() => undefined);
  }
}

async function seedBlobStorageIfNeeded(): Promise<void> {
  if (!isBlobPersistenceEnabled()) {
    return;
  }

  if (!(await pathExists(bundledStorageRoot)) || (await blobPathExists(storagePaths.root))) {
    return;
  }

  async function copyDirectory(sourceDirectory: string): Promise<void> {
    const entries = await readdir(sourceDirectory, { withFileTypes: true });

    await Promise.all(
      entries.map(async (entry) => {
        const sourcePath = join(sourceDirectory, entry.name);
        if (entry.isDirectory()) {
          await copyDirectory(sourcePath);
          return;
        }

        const relativePath = normalizeRelativePath(relative(bundledStorageRoot, sourcePath));
        const content = await readFile(sourcePath);
        await put(`${blobPrefix()}/${relativePath}`, content, {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: sourcePath.endsWith(".json") ? "application/json" : "application/octet-stream"
        });
      })
    );
  }

  await copyDirectory(bundledStorageRoot);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export function getStoragePersistenceInfo(): StoragePersistenceInfo {
  return {
    mode: isBlobPersistenceEnabled() ? "vercel-blob" : "filesystem",
    durable: isBlobPersistenceEnabled(),
    blobPrefix: isBlobPersistenceEnabled() ? blobPrefix() : null
  };
}

export async function ensureStorageDirectory(path: string): Promise<void> {
  if (isDurableStoragePath(path)) {
    return;
  }

  await mkdir(path, { recursive: true });
}

export async function writeStorageJson(path: string, data: unknown): Promise<void> {
  if (isDurableStoragePath(path)) {
    await writeBlobText(path, `${JSON.stringify(data, null, 2)}\n`, "application/json");
    return;
  }

  await ensureStorageDirectory(dirname(path));
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function readStorageJson<T>(path: string): Promise<T> {
  if (isDurableStoragePath(path)) {
    return JSON.parse(await readBlobText(path)) as T;
  }

  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function storagePathExists(path: string): Promise<boolean> {
  if (isDurableStoragePath(path)) {
    return await blobPathExists(path);
  }

  return await pathExists(path);
}

export async function storageDirectoryHasEntries(path: string): Promise<boolean> {
  try {
    return (await storageListEntries(path)).length > 0;
  } catch {
    return false;
  }
}

export async function storageListEntries(path: string): Promise<string[]> {
  if (isDurableStoragePath(path)) {
    return await listBlobEntries(path);
  }

  return await readdir(path);
}

export async function deleteStorageTree(path: string): Promise<void> {
  if (isDurableStoragePath(path)) {
    await deleteBlobTree(path);
  }

  await rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

export async function seedStorageIfNeeded(): Promise<void> {
  if (isBlobPersistenceEnabled()) {
    await seedBlobStorageIfNeeded();
    await ensureStorageDirectory(storagePaths.quarantine);
    return;
  }

  if (storagePaths.root === bundledStorageRoot) {
    return;
  }

  if (!(await pathExists(bundledStorageRoot)) || (await storageDirectoryHasEntries(storagePaths.root))) {
    return;
  }

  await ensureStorageDirectory(storagePaths.root);
  const entries = await readdir(bundledStorageRoot);
  await Promise.all(
    entries.map(async (entry) => {
      const targetPath = join(storagePaths.root, entry);
      await rm(targetPath, { recursive: true, force: true });
      await cp(join(bundledStorageRoot, entry), targetPath, { recursive: true, force: true });
    })
  );
}
