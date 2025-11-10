import { load } from "cheerio";

import type { ExtractedFile, ExtractedFiles } from "./extractZip";

export interface SiteAnalysis {
  title: string;
  description: string;
  scriptCount: number;
  pageCount: number;
  seoScore: number;
  faviconPath?: string;
  faviconDataUrl?: string;
}

function decodeFileContent(file?: ExtractedFile): string {
  if (!file) {
    return "";
  }
  if (file.encoding === "base64") {
    return Buffer.from(file.data, "base64").toString("utf-8");
  }
  return file.data;
}

function toDataUrl(file: ExtractedFile, defaultMime = "application/octet-stream"): string {
  const mimeType = file.mimeType ?? defaultMime;
  const base64 = file.encoding === "base64" ? file.data : Buffer.from(file.data, "utf-8").toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function normalizeAssetPath(rawPath: string): string {
  const trimmed = rawPath.split("?")[0]?.split("#")[0]?.trim() ?? "";
  return trimmed.replace(/^\.\//, "").replace(/^\//, "");
}

const FALLBACK_FAVICON_NAMES = [
  "favicon.ico",
  "favicon.png",
  "favicon.jpg",
  "favicon.svg",
  "images/favicon.ico",
  "images/favicon.png",
  "images/favicon.svg",
  "assets/favicon.ico",
  "assets/favicon.png",
  "assets/favicon.svg",
];

function analyzeFromFiles(files: ExtractedFiles): SiteAnalysis {
  const htmlEntries = Object.entries(files).filter(([name]) =>
    name.toLowerCase().endsWith(".html") || name.toLowerCase().endsWith(".htm"),
  );

  const indexContent = decodeFileContent(files["index.html"] ?? htmlEntries[0]?.[1]);
  const $ = load(indexContent || "<html></html>");

  const title = $("title").first().text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const scriptCount = $("script").length;
  const pageCount = htmlEntries.length || (indexContent ? 1 : 0);

  let seoScore = 50;
  if (title) seoScore += 15;
  if (description) seoScore += 15;
  seoScore += Math.max(0, 20 - scriptCount);
  seoScore += Math.min(20, pageCount * 4);
  seoScore = Math.min(100, Math.max(0, Math.round(seoScore)));

  let faviconDataUrl: string | undefined;
  let faviconPath: string | undefined;

  const declaredIconHref =
    $('link[rel="shortcut icon"]').attr("href") ||
    $('link[rel="icon"]').attr("href") ||
    $('link[rel~="icon"]').attr("href") ||
    "";

  if (declaredIconHref.startsWith("data:")) {
    faviconDataUrl = declaredIconHref;
    faviconPath = "inline";
  } else {
    const cleanedPath = declaredIconHref ? normalizeAssetPath(declaredIconHref) : "";
    const searchOrder = [cleanedPath, ...FALLBACK_FAVICON_NAMES];
    const availablePaths = new Set(Object.keys(files));

    for (const candidate of searchOrder) {
      if (!candidate) {
        continue;
      }
      const normalizedCandidate = normalizeAssetPath(candidate);
      if (!normalizedCandidate) {
        continue;
      }
      if (availablePaths.has(normalizedCandidate)) {
        const file = files[normalizedCandidate];
        faviconDataUrl = toDataUrl(file, file.mimeType ?? "image/x-icon");
        faviconPath = normalizedCandidate;
        break;
      }
      // Also attempt to find by filename only
      for (const key of availablePaths) {
        if (key.toLowerCase().endsWith(normalizedCandidate.toLowerCase())) {
          const file = files[key];
          faviconDataUrl = toDataUrl(file, file.mimeType ?? "image/x-icon");
          faviconPath = key;
          break;
        }
      }
      if (faviconDataUrl) {
        break;
      }
    }
  }

  if (!faviconDataUrl) {
    // As a last resort, search for any icon-like file in the archive
    for (const [pathName, file] of Object.entries(files)) {
      if (/\.(ico|png|jpg|jpeg|svg)$/i.test(pathName)) {
        faviconDataUrl = toDataUrl(file, file.mimeType ?? "image/x-icon");
        faviconPath = pathName;
        break;
      }
    }
  }

  return {
    title,
    description,
    scriptCount,
    pageCount,
    seoScore,
    faviconPath,
    faviconDataUrl,
  };
}

async function analyzeFromUrl(url: string): Promise<SiteAnalysis> {
  if (!url) {
    throw new Error("Missing URL for analysis");
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load site for analysis: ${res.status}`);
  }
  const html = await res.text();
  return analyzeFromFiles({
    "index.html": { data: html, encoding: "utf-8", mimeType: "text/html" },
  });
}

export async function analyzeSite(input: ExtractedFiles | string): Promise<SiteAnalysis> {
  if (typeof input === "string") {
    return analyzeFromUrl(input);
  }
  return analyzeFromFiles(input);
}
