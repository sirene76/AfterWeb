import { load } from "cheerio";
import fs from "fs/promises";
import path from "path";

import type { ExtractResult } from "@/lib/extractZip";
import WebsiteReport from "@/models/WebsiteReport";
import type { IWebsiteReport } from "@/models/WebsiteReport";

const LARGE_IMAGE_KB = 300;
const LARGE_ASSET_KB = 500;

export type WebsiteReportInput = {
  websiteId: string;
  extractResult: ExtractResult;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isImageFile(filePath: string, contentType: string | null): boolean {
  if (contentType?.startsWith("image/")) {
    return true;
  }
  const ext = path.extname(filePath).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"].includes(ext);
}

function isAssetFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".css" || ext === ".js";
}

export async function generateWebsiteReport({
  websiteId,
  extractResult,
}: WebsiteReportInput): Promise<IWebsiteReport> {
  const htmlFiles = extractResult.files.filter((file) => file.path.toLowerCase().endsWith(".html"));

  const seoIssues = {
    missingTitle: [] as string[],
    missingDescription: [] as string[],
    missingOrMultipleH1: [] as string[],
    missingCanonical: [] as string[],
    missingAlt: [] as string[],
  };

  const performanceIssues = {
    largeImages: [] as { path: string; sizeKb: number }[],
    largeAssets: [] as { path: string; sizeKb: number }[],
  };

  let imageCount = 0;

  for (const file of htmlFiles) {
    const absolutePath = path.join(extractResult.rootDir, file.path);
    try {
      const content = await fs.readFile(absolutePath, "utf-8");
      const $ = load(content);

      const title = $("title").first().text().trim();
      if (!title) {
        seoIssues.missingTitle.push(file.path);
      }

      const description = $('meta[name="description"]').attr("content")?.trim() ?? "";
      if (!description) {
        seoIssues.missingDescription.push(file.path);
      }

      const canonical = $('link[rel="canonical"]').attr("href")?.trim() ?? "";
      if (!canonical) {
        seoIssues.missingCanonical.push(file.path);
      }

      const h1Count = $("h1").length;
      if (h1Count !== 1) {
        seoIssues.missingOrMultipleH1.push(file.path);
      }

      $("img").each((index, element) => {
        imageCount += 1;
        const alt = $(element).attr("alt")?.trim();
        if (!alt) {
          const src = $(element).attr("src")?.trim();
          seoIssues.missingAlt.push(src || `${file.path}#img-${index + 1}`);
        }
      });
    } catch (error) {
      console.warn(`Failed to analyze HTML file ${file.path}`, error);
    }
  }

  for (const file of extractResult.files) {
    const sizeKb = Math.round(file.sizeBytes / 1024);

    if (isImageFile(file.path, file.contentType) && sizeKb > LARGE_IMAGE_KB) {
      performanceIssues.largeImages.push({ path: file.path, sizeKb });
    }

    if (isAssetFile(file.path) && sizeKb > LARGE_ASSET_KB) {
      performanceIssues.largeAssets.push({ path: file.path, sizeKb });
    }
  }

  const pageCount = htmlFiles.length;
  const assetCount = extractResult.files.length;

  const seoPenalty =
    seoIssues.missingTitle.length * 2 +
    seoIssues.missingDescription.length * 2 +
    seoIssues.missingOrMultipleH1.length * 1 +
    seoIssues.missingCanonical.length * 1 +
    seoIssues.missingAlt.length * 0.5;

  const performancePenalty =
    performanceIssues.largeImages.length * 2 + performanceIssues.largeAssets.length * 2;

  const seoScore = clamp(100 - seoPenalty, 0, 100);
  const performanceScore = clamp(100 - performancePenalty, 0, 100);

  const summary = `Scanned ${pageCount} pages and ${assetCount} assets. SEO score ${seoScore}/100, performance score ${performanceScore}/100.`;

  const report = await WebsiteReport.create({
    website: websiteId,
    pageCount,
    assetCount,
    imageCount,
    seoScore,
    performanceScore,
    seoIssues,
    performanceIssues,
    summary,
  });

  return report;
}
