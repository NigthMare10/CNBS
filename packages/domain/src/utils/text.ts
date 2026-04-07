import slugifyLib from "slugify";

const slugify = slugifyLib as unknown as (str: string, opts?: any) => string;

const mojibakeMap: Record<string, string> = {
  "Ã¡": "á",
  "Ã©": "é",
  "Ã­": "í",
  "Ã³": "ó",
  "Ãº": "ú",
  "Ã": "Á",
  "Ã‰": "É",
  "Ã": "Í",
  "Ã“": "Ó",
  "Ãš": "Ú",
  "Ã±": "ñ",
  "Ã‘": "Ñ",
  "Â": "",
  "贸": "ó",
  "铆": "í",
  "茅": "é",
  "谩": "á",
  "煤": "ú",
  "帽": "ñ",
  "鈥": "-"
};

const semanticRepairMap: Record<string, string> = {
  "Maritímo": "Marítimo",
  "HOSPITALIZACIóN": "HOSPITALIZACIÓN",
  "HospitalizaciÓn": "Hospitalización"
};

function looksLikeUtf8ReadAsLatin1(input: string): boolean {
  return /Ã.|Â|Ð|Ñ/.test(input);
}

function attemptLatin1Utf8Repair(input: string): string {
  try {
    return Buffer.from(input, "latin1").toString("utf8");
  } catch {
    return input;
  }
}

export function repairMojibake(input: string): string {
  let output = input;

  if (looksLikeUtf8ReadAsLatin1(output)) {
    const repaired = attemptLatin1Utf8Repair(output);
    if (repaired && repaired !== output) {
      output = repaired;
    }
  }

  for (const [broken, fixed] of Object.entries(mojibakeMap)) {
    output = output.split(broken).join(fixed);
  }

  for (const [broken, fixed] of Object.entries(semanticRepairMap)) {
    output = output.split(broken).join(fixed);
  }

  return output;
}

export function normalizeText(input: string): string {
  return repairMojibake(input)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function slugKey(input: string): string {
  return slugify(normalizeText(input), { lower: true, strict: true });
}
