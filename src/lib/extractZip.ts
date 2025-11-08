import AdmZip from "adm-zip";

export type ExtractedFiles = Record<string, string>;

export function extractZip(buffer: Buffer): ExtractedFiles {
  const zip = new AdmZip(buffer);
  const files: ExtractedFiles = {};

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) {
      continue;
    }

    const entryName = entry.entryName;
    const data = entry.getData();

    try {
      files[entryName] = data.toString("utf-8");
    } catch {
      files[entryName] = data.toString("base64");
    }
  }

  return files;
}
