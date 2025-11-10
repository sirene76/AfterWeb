import { NextResponse } from "next/server";

import connectDB from "@/lib/db";
import { runSeoAgent } from "@/lib/seoAgent";
import { generateSeoRecommendations } from "@/lib/aiSeoHelper";
import MaintenanceLog from "@/models/MaintenanceLog";
import Website from "@/models/Website";

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  await connectDB();
  const site = await Website.findById(id);

  if (!site?.deployUrl) {
    return NextResponse.json({ error: "Site not deployed" }, { status: 400 });
  }

  const html = await fetch(site.deployUrl).then((response) => response.text());
  const analysis = await runSeoAgent(html);
  const ai = await generateSeoRecommendations(analysis);

  await MaintenanceLog.create({
    websiteId: id,
    type: "seo",
    status: "success",
    details: { analysis, ai },
  });

  site.meta.seoScore = analysis.score;
  await site.save();

  return NextResponse.json({ analysis, ai });
}
