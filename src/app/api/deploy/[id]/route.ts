import { NextResponse } from "next/server";

import connectDB from "@/lib/db";
import { deployToCloudflare } from "@/lib/deployToCloudflare";
import Website from "@/models/Website";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await connectDB();
  const site = await Website.findById(params.id);
  if (!site) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const projectName = process.env.CLOUDFLARE_PROJECT_NAME;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const zipUrl = site.zipUrl ?? site.archiveUrl;

  if (!zipUrl) {
    return NextResponse.json({ error: "Missing source zip for deployment" }, { status: 400 });
  }
  if (!projectName || !token || !accountId) {
    return NextResponse.json({ error: "Cloudflare configuration missing" }, { status: 500 });
  }

  try {
    const deployUrl = await deployToCloudflare(zipUrl, projectName, token, accountId);
    site.deployUrl = deployUrl;
    site.status = "deployed";
    await site.save();
    return NextResponse.json({ deployUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cloudflare deploy failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
