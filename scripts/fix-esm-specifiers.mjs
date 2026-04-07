import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const targetRoot = process.argv[2];

if (!targetRoot) {
  throw new Error("Usage: node scripts/fix-esm-specifiers.mjs <dist-dir>");
}

const root = resolve(targetRoot);

async function collectJavaScriptFiles(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return await collectJavaScriptFiles(entryPath);
      }

      return extname(entry.name) === ".js" ? [entryPath] : [];
    })
  );

  return files.flat();
}

async function resolveRuntimeSpecifier(filePath, specifier) {
  const absoluteTarget = resolve(filePath, "..", specifier);
  const fileCandidate = `${absoluteTarget}.js`;
  const indexCandidate = join(absoluteTarget, "index.js");

  if (await exists(fileCandidate)) {
    return normalizeSpecifier(relative(resolve(filePath, ".."), fileCandidate));
  }

  if (await exists(indexCandidate)) {
    return normalizeSpecifier(relative(resolve(filePath, ".."), indexCandidate));
  }

  return specifier;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeSpecifier(path) {
  const normalized = path.replaceAll("\\", "/");
  return normalized.startsWith(".") ? normalized : `./${normalized}`;
}

async function rewriteFile(filePath) {
  const original = await readFile(filePath, "utf8");
  const matches = [...original.matchAll(/(?<=\bfrom\s*["'])(\.{1,2}\/[^"']+)(?=["'])|(?<=\bimport\s*["'])(\.{1,2}\/[^"']+)(?=["'])/gu)];
  if (matches.length === 0) {
    return;
  }

  let updated = original;

  for (const match of matches) {
    const specifier = match[1] ?? match[2];
    if (!specifier || specifier.endsWith(".js") || specifier.endsWith(".json")) {
      continue;
    }

    const resolvedSpecifier = await resolveRuntimeSpecifier(filePath, specifier);
    updated = updated.replaceAll(specifier, resolvedSpecifier);
  }

  if (updated !== original) {
    await writeFile(filePath, updated, "utf8");
  }
}

const files = await collectJavaScriptFiles(root);
await Promise.all(files.map(async (filePath) => await rewriteFile(filePath)));
