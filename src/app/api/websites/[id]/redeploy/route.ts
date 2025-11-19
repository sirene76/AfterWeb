import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { deployToCloudflare } from "@/lib/deployToCloudflare";
import { extractZip } from "@/lib/extractZip";
import Log from "@/models/Log";
import Website from "@/models/Website";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    await connectDB();
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "NOT_AUTHENTICATED" }, { status: 401 });
    }

    const website = await Website.findById(params.id);
    if (!website) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (!website.zipUrl) {
      return NextResponse.json({ ok: false, error: "NO_ZIP_URL" }, { status: 400 });
    }

    website.status = "deploying";
    website.errorReason = undefined;
    await website.save();

    await Log.create({
      event: "redeploy",
      status: "info",
      message: "Redeploy started.",
      accountId: website.accountId ?? undefined,
      websiteId: website._id,
    });

    const extractResult = await extractZip(website.zipUrl, website._id.toString());
    const deployResult = await deployToCloudflare(website, extractResult.rootDir);

    website.status = "deployed";
    website.previewUrl = deployResult.previewUrl ?? website.previewUrl;
    website.deployUrl = deployResult.previewUrl ?? website.deployUrl;
    await website.save();

    await Log.create({
      event: "redeploy",
      status: "success",
      message: "Redeploy completed.",
      accountId: website.accountId ?? undefined,
      websiteId: website._id,
      metadata: { deployResult },
    });

    return NextResponse.json({
      ok: true,
      websiteId: website._id.toString(),
      previewUrl: website.previewUrl ?? null,
    });
  } catch (error) {
    console.error("Redeploy route error", error);
    return NextResponse.json(
      { ok: false, error: "UNKNOWN", message: "Unexpected error in redeploy route." },
      { status: 500 },
    );
  }
}
