import AdmZip from "adm-zip";
import fs from "fs/promises";
import path from "path";

export interface ExtractedFile {
  data: string;
  encoding: "utf-8" | "base64";
  mimeType?: string;
}

export type ExtractedFiles = Record<string, ExtractedFile>;

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

export interface ExtractedFileSummary {
  path: string;
  sizeBytes: number;
  contentType?: string;
}

export interface ExtractZipResult {
  rootDir: string;
  files: ExtractedFileSummary[];
}

export interface ExtractZipParams {
  websiteId: string;
  zipUrl: string;
}

const EXTRACT_BASE_DIR = path.join(process.cwd(), "uploads", "extracted");

async function prepareExtractionDir(dir: string): Promise<void> {
  await fs.mkdir(EXTRACT_BASE_DIR, { recursive: true });
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

export async function extractZip({ websiteId, zipUrl }: ExtractZipParams): Promise<ExtractZipResult> {
  if (!zipUrl) {
    throw new Error("Missing zip URL for extraction");
  }

  const response = await fetch(zipUrl);
  if (!response.ok) {
    throw new Error(`Failed to download zip: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const zip = new AdmZip(buffer);
  const rootDir = path.join(EXTRACT_BASE_DIR, websiteId);

  await prepareExtractionDir(rootDir);

  const files: ExtractedFileSummary[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) {
      continue;
    }

    const originalName = entry.entryName.replace(/\\/g, "/");
    const trimmedName = originalName.replace(/^\/+/, "");
    if (!trimmedName) {
      continue;
    }

    const normalizedRelative = path.normalize(trimmedName);
    const resolvedPath = path.resolve(rootDir, normalizedRelative);
    const relativeFromRoot = path.relative(rootDir, resolvedPath);

    if (relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot)) {
      continue;
    }

    const data = entry.getData();
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, data);

    const extension = path.extname(trimmedName).toLowerCase();
    const posixPath = normalizedRelative.split(path.sep).join("/");

    files.push({
      path: posixPath,
      sizeBytes: data.length,
      contentType: getMimeType(extension),
    });
  }

  return { rootDir, files };
}
