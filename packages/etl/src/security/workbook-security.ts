import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import type { ValidationIssue } from "@cnbs/domain";
import { securityConfig } from "@cnbs/config";

const XLSX_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream"
];

export async function inspectWorkbookSecurity(
  filePath: string,
  mimeType: string,
  sizeBytes: number
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  if (!filePath.toLowerCase().endsWith(".xlsx")) {
    issues.push({
      code: "SECURITY_EXTENSION_REJECTED",
      severity: "critical",
      status: "failed",
      scope: filePath,
      message: "Only .xlsx workbooks are allowed in phase 1."
    });
  }

  if (!XLSX_MIME_TYPES.includes(mimeType)) {
    issues.push({
      code: "SECURITY_MIME_REJECTED",
      severity: "high",
      status: "failed",
      scope: filePath,
      message: `Unexpected MIME type: ${mimeType}`
    });
  }

  if (sizeBytes > securityConfig.uploadMaxBytes) {
    issues.push({
      code: "SECURITY_SIZE_LIMIT",
      severity: "critical",
      status: "failed",
      scope: filePath,
      message: `Workbook exceeds size limit of ${securityConfig.uploadMaxBytes} bytes.`
    });
  }

  const buffer = await readFile(filePath);

  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    issues.push({
      code: "SECURITY_MAGIC_BYTES",
      severity: "critical",
      status: "failed",
      scope: filePath,
      message: "Workbook does not have ZIP magic bytes."
    });

    return issues;
  }

  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);

  if (entries.length > securityConfig.maxZipEntries) {
    issues.push({
      code: "SECURITY_ZIP_ENTRIES",
      severity: "critical",
      status: "failed",
      scope: filePath,
      message: "Workbook contains too many ZIP entries."
    });
  }

  const hasMacro = entries.some((entry) => entry.name.toLowerCase().includes("vbaproject.bin"));
  const hasEncryptedPackage = entries.some((entry) => entry.name.toLowerCase().includes("encryptedpackage"));
  const workbookXmlEntry = entries.find((entry) => entry.name === "xl/workbook.xml");

  if (hasMacro) {
    issues.push({
      code: "SECURITY_MACRO_DETECTED",
      severity: "critical",
      status: "failed",
      scope: filePath,
      message: "Macro-enabled workbook content detected."
    });
  }

  if (hasEncryptedPackage) {
    issues.push({
      code: "SECURITY_ENCRYPTED_PACKAGE",
      severity: "critical",
      status: "failed",
      scope: filePath,
      message: "Encrypted workbook package detected."
    });
  }

  if (workbookXmlEntry) {
    const workbookXml = await workbookXmlEntry.async("string");
    if (workbookXml.includes("workbookProtection") || workbookXml.includes("fileSharing")) {
      issues.push({
        code: "SECURITY_WORKBOOK_PROTECTED",
        severity: "high",
        status: "failed",
        scope: filePath,
        message: "Protected or shared workbook settings detected."
      });
    }
  }

  let compressedTotal = 0;
  let inflatedTotal = 0;

  for (const entry of entries) {
    const entryData = entry as unknown as { _data?: { compressedSize?: number; uncompressedSize?: number } };
    compressedTotal += entryData._data?.compressedSize ?? 0;
    inflatedTotal += entryData._data?.uncompressedSize ?? 0;
  }

  const ratio = compressedTotal === 0 ? inflatedTotal : inflatedTotal / compressedTotal;

  if (ratio > securityConfig.maxInflationRatio) {
    issues.push({
      code: "SECURITY_ZIP_BOMB_RATIO",
      severity: "critical",
      status: "failed",
      scope: filePath,
      message: `Workbook inflation ratio ${ratio.toFixed(2)} exceeds threshold.`
    });
  }

  return issues;
}
