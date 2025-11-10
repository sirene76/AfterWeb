import AdmZip from "adm-zip";
import path from "path";

export interface ExtractedFile {
  data: string;
  encoding: "utf-8" | "base64";
  mimeType?: string;
}

export type ExtractedFiles = Record<string, ExtractedFile>;

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".css",
  ".js",
  ".json",
  ".txt",
  ".svg",
  ".xml",
  ".md",
]);

function getMimeType(extension: string): string | undefined {
  switch (extension) {
    case ".html":
    case ".htm":
      return "text/html";
    case ".css":
      return "text/css";
    case ".js":
      return "text/javascript";
    case ".json":
      return "application/json";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".xml":
      return "application/xml";
    default:
      return undefined;
  }
}

export function extractZip(buffer: Buffer): ExtractedFiles {
  const zip = new AdmZip(buffer);
  const files: ExtractedFiles = {};

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) {
      continue;
    }

    const entryName = entry.entryName;
    const extension = path.extname(entryName).toLowerCase();
    const data = entry.getData();
    const mimeType = getMimeType(extension);

    if (TEXT_EXTENSIONS.has(extension)) {
      files[entryName] = {
        data: data.toString("utf-8"),
        encoding: "utf-8",
        mimeType,
      };
    } else {
      files[entryName] = {
        data: data.toString("base64"),
        encoding: "base64",
        mimeType,
      };
    }
  }

  return files;
}
