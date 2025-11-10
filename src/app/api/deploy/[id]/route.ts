import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { deployToCloudflare } from "@/lib/deployToCloudflare";
import Website from "@/models/Website";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await connectToDatabase();
    const siteId = params.id;
    const website = await Website.findById(siteId);

    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const deployUrl = await deployToCloudflare(website._id.toString());

    website.status = "deployed";
    website.deployUrl = deployUrl;
    await website.save();

    return NextResponse.json({ success: true, deployUrl });
  } catch (error) {
    console.error("Deploy route error", error);
    const message = error instanceof Error ? error.message : "Failed to deploy site";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
