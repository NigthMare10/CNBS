import { stat } from "node:fs/promises";
import type { UploadedWorkbookInput } from "@cnbs/etl";

export interface MultipartUploadLike {
  filepath: string;
  filename: string;
  mimetype: string;
  fieldname?: string;
  file?: { bytesRead?: number };
}

function isMeaningfulUpload(file: MultipartUploadLike, sizeBytes: number): boolean {
  const normalizedName = file.filename.trim().toLowerCase();
  if (!normalizedName || normalizedName === "blob") {
    return false;
  }

  if (sizeBytes <= 0) {
    return false;
  }

  return true;
}

export async function mapMultipartUploadsToInputs(
  files: MultipartUploadLike[]
): Promise<UploadedWorkbookInput[]> {
  const mapped = await Promise.all(
    files.map(async (file) => {
      try {
        const fileStat = await stat(file.filepath);
        const sizeBytes = fileStat.size > 0 ? fileStat.size : Number(file.file?.bytesRead ?? 0);

        if (!isMeaningfulUpload(file, sizeBytes)) {
          return null;
        }

        return {
          filePath: file.filepath,
          originalFilename: file.filename,
          mimeType: file.mimetype,
          sizeBytes
        } satisfies UploadedWorkbookInput;
      } catch {
        return null;
      }
    })
  );

  return mapped.filter((entry): entry is UploadedWorkbookInput => entry !== null);
}
