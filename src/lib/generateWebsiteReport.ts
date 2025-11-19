import { load } from "cheerio";
import fs from "fs/promises";
import path from "path";

import type { ExtractZipResult } from "@/lib/extractZip";
import WebsiteReport, { type WebsiteReportDocument } from "@/models/WebsiteReport";

const HTML_EXTENSIONS = new Set([".html", ".htm"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"]);
const LARGE_IMAGE_THRESHOLD_BYTES = 300 * 1024;
const LARGE_ASSET_THRESHOLD_BYTES = 500 * 1024;

interface GenerateWebsiteReportParams {
  websiteId: string;
  extractResult: ExtractZipResult;
}

function formatSizeKb(bytes: number): number {
  return Math.round((bytes / 1024) * 100) / 100;
}

export async function generateWebsiteReport({
  websiteId,
  extractResult,
}: GenerateWebsiteReportParams): Promise<WebsiteReportDocument> {
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

  const htmlFiles = extractResult.files.filter((file) =>
    HTML_EXTENSIONS.has(path.extname(file.path).toLowerCase()),
  );

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
          seoIssues.missingAlt.push(`${file.path}#img-${index + 1}`);
        }
      });
    } catch (error) {
      console.warn(`Failed to parse HTML file ${file.path}`, error);
    }
  }

  for (const file of extractResult.files) {
    const extension = path.extname(file.path).toLowerCase();
    if (IMAGE_EXTENSIONS.has(extension) && file.sizeBytes > LARGE_IMAGE_THRESHOLD_BYTES) {
      performanceIssues.largeImages.push({ path: file.path, sizeKb: formatSizeKb(file.sizeBytes) });
    }

    if ((extension === ".css" || extension === ".js") && file.sizeBytes > LARGE_ASSET_THRESHOLD_BYTES) {
      performanceIssues.largeAssets.push({ path: file.path, sizeKb: formatSizeKb(file.sizeBytes) });
    }
  }

  const pageCount = htmlFiles.length;
  const assetCount = Math.max(0, extractResult.files.length - pageCount);

  const seoPenalty =
    seoIssues.missingTitle.length * 10 +
    seoIssues.missingDescription.length * 8 +
    seoIssues.missingOrMultipleH1.length * 6 +
    seoIssues.missingCanonical.length * 4 +
    seoIssues.missingAlt.length * 2;
  const performancePenalty =
    performanceIssues.largeImages.length * 5 + performanceIssues.largeAssets.length * 4;

  const seoScore = Math.max(0, Math.min(100, 100 - seoPenalty));
  const performanceScore = Math.max(0, Math.min(100, 100 - performancePenalty));

  const summary = `Analyzed ${pageCount} pages with ${imageCount} images. SEO score ${seoScore}/100. Performance score ${performanceScore}/100.`;

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
