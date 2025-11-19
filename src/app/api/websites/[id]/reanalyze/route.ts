import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { extractZip } from "@/lib/extractZip";
import { generateWebsiteReport } from "@/lib/generateWebsiteReport";
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

    website.status = "analyzing";
    website.errorReason = undefined;
    await website.save();

    await Log.create({
      event: "reanalyze",
      status: "info",
      message: "Re-analysis started.",
      accountId: website.accountId ?? undefined,
      websiteId: website._id,
    });

    const extractResult = await extractZip(website.zipUrl, website._id.toString());

    website.files = extractResult.files.map((file) => ({
      path: file.path,
      sizeBytes: file.sizeBytes,
      contentType: file.contentType,
    }));
    await website.save();

    const report = await generateWebsiteReport({
      websiteId: website._id.toString(),
      extractResult,
    });

    website.status = "ready";
    website.meta = {
      pages: report.pageCount,
      scripts: website.meta?.scripts ?? 0,
      seoScore: report.seoScore,
      title: website.meta?.title ?? website.name,
      description: website.meta?.description ?? "",
      faviconUrl: website.meta?.faviconUrl ?? "",
    };
    await website.save();

    await Log.create({
      event: "reanalyze",
      status: "success",
      message: "Re-analysis completed.",
      accountId: website.accountId ?? undefined,
      websiteId: website._id,
      metadata: { reportId: report._id },
    });

    return NextResponse.json({
      ok: true,
      websiteId: website._id.toString(),
      reportId: report._id.toString(),
    });
  } catch (error) {
    console.error("Reanalyze route error", error);
    return NextResponse.json({ ok: false, error: "UNKNOWN" }, { status: 500 });
  }
}
