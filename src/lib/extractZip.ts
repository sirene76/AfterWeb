import AdmZip from "adm-zip";
import fs from "fs/promises";
import os from "os";
import path from "path";

export type ExtractedFile = {
  path: string;
  sizeBytes: number;
  contentType: string | null;
};

export type ExtractResult = {
  rootDir: string;
  files: ExtractedFile[];
};

const EXTRACT_BASE_DIR = path.join(process.cwd(), "uploads", "extracted");

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function prepareExtractionDir(rootDir: string): Promise<void> {
  await ensureDir(EXTRACT_BASE_DIR);
  await fs.rm(rootDir, { recursive: true, force: true });
  await fs.mkdir(rootDir, { recursive: true });
}

function detectContentType(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
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
    case ".txt":
      return "text/plain";
    default:
      return null;
  }
}

async function walkExtractedFiles(currentDir: string, rootDir: string): Promise<ExtractedFile[]> {
  const entries = (await fs.readdir(currentDir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const files: ExtractedFile[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkExtractedFiles(fullPath, rootDir)));
    } else if (entry.isFile()) {
      const stats = await fs.stat(fullPath);
      const relativePath = path.relative(rootDir, fullPath).split(path.sep).join("/");
      files.push({
        path: relativePath,
        sizeBytes: stats.size,
        contentType: detectContentType(fullPath),
      });
    }
  }

  return files;
}

export async function extractZip(fileUrl: string, websiteId: string): Promise<ExtractResult> {
  if (!fileUrl) {
    throw new Error("Missing file URL");
  }

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download zip: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const tempZipPath = path.join(os.tmpdir(), `afterweb-${websiteId}-${Date.now()}.zip`);
  await fs.writeFile(tempZipPath, Buffer.from(arrayBuffer));

  const rootDir = path.join(EXTRACT_BASE_DIR, websiteId);
  await prepareExtractionDir(rootDir);

  try {
    const zip = new AdmZip(tempZipPath);
    const entries = zip.getEntries();

    for (const entry of entries) {
      if (entry.isDirectory) {
        continue;
      }

      const originalName = entry.entryName.replace(/\\/g, "/");
      const trimmedName = originalName.replace(/^\/+/, "");
      if (!trimmedName) {
        continue;
      }

      const normalizedPath = path.normalize(trimmedName);
      const resolvedPath = path.resolve(rootDir, normalizedPath);
      const relative = path.relative(rootDir, resolvedPath);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        continue;
      }

      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      await fs.writeFile(resolvedPath, entry.getData());
    }
  } finally {
    await fs.rm(tempZipPath, { force: true });
  }

  const files = await walkExtractedFiles(rootDir, rootDir);
  return { rootDir, files };
}
