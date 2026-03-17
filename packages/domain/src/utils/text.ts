import slugify from "slugify";

const mojibakeMap: Record<string, string> = {
  "贸": "ó",
  "铆": "í",
  "茅": "é",
  "谩": "á",
  "煤": "ú",
  "帽": "ñ",
  "鈥": "-"
};

export function repairMojibake(input: string): string {
  let output = input;

  for (const [broken, fixed] of Object.entries(mojibakeMap)) {
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
