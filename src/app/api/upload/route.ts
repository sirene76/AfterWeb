import { NextResponse } from "next/server";
import { Types } from "mongoose";

import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { deployToCloudflare } from "@/lib/deployToCloudflare";
import { extractZip } from "@/lib/extractZip";
import { generateWebsiteReport } from "@/lib/generateWebsiteReport";
import { makeUploadError } from "@/lib/uploadErrors";
import Account from "@/models/Account";
import Log from "@/models/Log";
import Website from "@/models/Website";
import type { ExtractResult } from "@/lib/extractZip";
import type { IWebsiteReport } from "@/models/WebsiteReport";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const session = await auth();
    const userEmail = session?.user?.email;
    if (!userEmail) {
      return NextResponse.json(
        makeUploadError("INVALID_BODY", "You must be signed in to upload."),
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        makeUploadError("INVALID_BODY", "Request body must be valid JSON."),
        { status: 400 },
      );
    }

    if (!isRecord(body)) {
      return NextResponse.json(
        makeUploadError("INVALID_BODY", "Request body must be an object."),
        { status: 400 },
      );
    }

    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
    const siteName =
      typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled site";

    if (!fileUrl) {
      return NextResponse.json(
        makeUploadError("MISSING_FILE_URL", "An uploaded file URL is required."),
        { status: 400 },
      );
    }

    if (!accountId) {
      return NextResponse.json(
        makeUploadError("MISSING_WORKSPACE_ID", "A workspaceId must be provided."),
        { status: 400 },
      );
    }

    if (!Types.ObjectId.isValid(accountId)) {
      return NextResponse.json(
        makeUploadError("MISSING_WORKSPACE_ID", "Workspace not found."),
        { status: 404 },
      );
    }

    const account = await Account.findById(accountId);
    if (!account) {
      return NextResponse.json(
        makeUploadError("MISSING_WORKSPACE_ID", "Workspace not found."),
        { status: 404 },
      );
    }

    const website = await Website.create({
      name: siteName,
      userEmail,
      ownerEmail: userEmail,
      account: account._id,
      accountId: account._id,
      status: "uploading",
      archiveUrl: fileUrl,
      zipUrl: fileUrl,
      files: [],
      meta: {
        pages: 0,
        scripts: 0,
        seoScore: 0,
        title: siteName,
        description: "",
        faviconUrl: "",
      },
    });

    await Log.create({
      event: "upload",
      status: "info",
      message: "Upload started.",
      accountId: account._id,
      websiteId: website._id,
      metadata: { fileUrl },
    });

    let extractResult: ExtractResult;
    try {
      extractResult = await extractZip(fileUrl, website._id.toString());
    } catch (error) {
      website.status = "error";
      website.errorReason = "EXTRACTION_FAILED";
      await website.save();

      await Log.create({
        event: "upload",
        status: "failure",
        message: "Failed to extract zip.",
        accountId: account._id,
        websiteId: website._id,
        metadata: { error: error instanceof Error ? error.message : error },
      });

      return NextResponse.json(
        makeUploadError("EXTRACTION_FAILED", "Could not extract the uploaded zip file."),
        { status: 400 },
      );
    }

    const hasIndexHtml = extractResult.files.some((file) => {
      const normalized = file.path.toLowerCase();
      return normalized === "index.html" || normalized.endsWith("/index.html");
    });

    if (!hasIndexHtml) {
      website.status = "error";
      website.errorReason = "MISSING_INDEX_HTML";
      await website.save();

      await Log.create({
        event: "upload",
        status: "failure",
        message: "Zip is missing index.html.",
        accountId: account._id,
        websiteId: website._id,
      });

      return NextResponse.json(
        makeUploadError(
          "MISSING_INDEX_HTML",
          "The uploaded site must contain an index.html file in the root or a folder.",
        ),
        { status: 400 },
      );
    }

    website.files = extractResult.files.map((file) => ({
      path: file.path,
      sizeBytes: file.sizeBytes,
      contentType: file.contentType,
    }));
    website.status = "analyzing";
    website.errorReason = undefined;
    await website.save();

    let report: IWebsiteReport;
    try {
      report = await generateWebsiteReport({
        websiteId: website._id.toString(),
        extractResult,
      });
    } catch (error) {
      website.status = "error";
      website.errorReason = "ANALYSIS_FAILED";
      await website.save();

      await Log.create({
        event: "upload",
        status: "failure",
        message: "Failed to analyze site.",
        accountId: account._id,
        websiteId: website._id,
        metadata: { error: error instanceof Error ? error.message : error },
      });

      return NextResponse.json(
        makeUploadError("ANALYSIS_FAILED", "Failed to analyze the site HTML for SEO/performance."),
        { status: 500 },
      );
    }

    await Log.create({
      event: "upload",
      status: "success",
      message: "Analysis completed.",
      accountId: account._id,
      websiteId: website._id,
      metadata: { reportId: report._id },
    });

    website.meta = {
      pages: report.pageCount,
      scripts: website.meta?.scripts ?? 0,
      seoScore: report.seoScore,
      title: website.meta?.title ?? siteName,
      description: website.meta?.description ?? "",
      faviconUrl: website.meta?.faviconUrl ?? "",
    };
    await website.save();

    try {
      const deployResult = await deployToCloudflare(website, extractResult.rootDir);
      website.status = "deployed";
      website.errorReason = undefined;
      website.previewUrl = deployResult.previewUrl ?? website.previewUrl;
      website.deployUrl = deployResult.previewUrl ?? website.deployUrl;
      await website.save();

      await Log.create({
        event: "deploy",
        status: "success",
        message: "Deployment completed.",
        accountId: account._id,
        websiteId: website._id,
        metadata: { deployResult },
      });

      return NextResponse.json({
        ok: true,
        websiteId: website._id.toString(),
        reportId: report._id.toString(),
        deployOk: true,
        previewUrl: website.previewUrl ?? null,
      });
    } catch (error) {
      website.status = "ready";
      website.errorReason = "DEPLOY_FAILED";
      await website.save();

      await Log.create({
        event: "deploy",
        status: "failure",
        message: "Deployment failed.",
        accountId: account._id,
        websiteId: website._id,
        metadata: { error: error instanceof Error ? error.message : error },
      });

      return NextResponse.json({
        ok: true,
        websiteId: website._id.toString(),
        reportId: report._id.toString(),
        deployOk: false,
        deployError: "DEPLOY_FAILED",
      });
    }
  } catch (error) {
    console.error("Unexpected upload error", error);
    return NextResponse.json(
      makeUploadError("UNKNOWN", "Unexpected error in upload route."),
      { status: 500 },
    );
  }
}
