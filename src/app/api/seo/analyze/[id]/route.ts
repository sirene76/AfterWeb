import { NextResponse } from "next/server";

import connectDB from "@/lib/db";
import { runSeoAgent } from "@/lib/seoAgent";
import { generateSeoRecommendations } from "@/lib/aiSeoHelper";
import Log from "@/models/Log";
import MaintenanceLog from "@/models/MaintenanceLog";
import Website, { type WebsiteDocument } from "@/models/Website";

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let site: WebsiteDocument | null = null;

  try {
    await connectDB();
    site = await Website.findById(id);

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

    await Log.create({
      event: "seo_scan",
      status: "success",
      message: `SEO scan completed for ${site.name}`,
      accountId: site.accountId ?? undefined,
      websiteId: site._id,
      metadata: { score: analysis.score },
    });

    return NextResponse.json({ analysis, ai });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SEO analysis failed";

    try {
      await connectDB();
      await Log.create({
        event: "seo_scan",
        status: "failure",
        message,
        accountId: site?.accountId ?? undefined,
        websiteId: site?._id ?? undefined,
        metadata: { error: message },
      });
    } catch (logError) {
      console.error("Failed to log SEO error", logError);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
