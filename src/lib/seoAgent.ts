import * as cheerio from "cheerio";

export async function runSeoAgent(html: string) {
  const $ = cheerio.load(html);

  const title = $("title").text().trim();
  const description = $('meta[name="description"]').attr("content") || "";

  // ✅ use 'any' instead of cheerio.Element
  const headings = $("h1,h2,h3")
    .map((_: number, el: any) => $(el).text())
    .get();

  const links = $("a").length;

  let score = 50;
  if (title) score += 10;
  if (description) score += 10;
  if (headings.length >= 3) score += 15;
  if (links >= 5) score += 15;
  score = Math.min(score, 100);

  const suggestions: string[] = [];
  if (!title) suggestions.push("Add a <title> tag.");
  if (!description) suggestions.push("Add a meta description.");
  if (headings.length < 3) suggestions.push("Add more semantic headings (H2/H3).");
  if (links < 5) suggestions.push("Add internal/external links.");

  return { score, title, description, headings, links, suggestions };
}
