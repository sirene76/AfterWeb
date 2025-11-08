import { load } from "cheerio";
import type { ExtractedFiles } from "./extractZip";

export interface SiteAnalysis {
  title: string;
  description: string;
  scriptCount: number;
  pageCount: number;
  seoScore: number;
}

export function analyzeSite(files: ExtractedFiles): SiteAnalysis {
  const htmlEntries = Object.entries(files).filter(([name]) =>
    name.toLowerCase().endsWith(".html") || name.toLowerCase().endsWith(".htm"),
  );

  const indexContent = files["index.html"] ?? htmlEntries[0]?.[1] ?? "";
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

  return {
    title,
    description,
    scriptCount,
    pageCount,
    seoScore,
  };
}
