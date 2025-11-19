import { NextResponse } from "next/server";
import { Types } from "mongoose";

import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Log from "@/models/Log";
import Website from "@/models/Website";
import WebsiteReport from "@/models/WebsiteReport";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();

    const session = await auth();
    const sessionEmail = session?.user?.email;

    if (!sessionEmail) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED", message: "You must be signed in." },
        { status: 401 },
      );
    }

    const websiteId = params?.id;
    if (!websiteId || !Types.ObjectId.isValid(websiteId)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ID", message: "Invalid website id." },
        { status: 400 },
      );
    }

    const website = await Website.findById(websiteId).lean();
    if (!website) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND", message: "Website not found." },
        { status: 404 },
      );
    }

    const ownerEmail = website.ownerEmail ?? website.userEmail;
    if (ownerEmail && ownerEmail !== sessionEmail) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "You do not have access to this website." },
        { status: 403 },
      );
    }

    const latestReport = await WebsiteReport.findOne({ website: website._id })
      .sort({ createdAt: -1 })
      .lean();

    const logs = await Log.find({ websiteId: website._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const websitePayload = {
      _id: website._id.toString(),
      name: website.name,
      status: website.status,
      previewUrl: website.previewUrl ?? null,
      deployUrl: website.deployUrl ?? null,
      plan: website.plan ?? null,
      billingStatus: website.billingStatus ?? null,
      errorReason: website.errorReason ?? null,
      zipUrl: website.zipUrl ?? null,
      lastBackupAt:
        website.lastBackupAt instanceof Date
          ? website.lastBackupAt.toISOString()
          : website.lastBackupAt
            ? new Date(website.lastBackupAt).toISOString()
            : null,
      lastBackupKey: website.lastBackupKey ?? null,
      lastBackupUrl: website.lastBackupUrl ?? null,
      files: Array.isArray(website.files)
        ? website.files.map((file) => ({
            path: file.path,
            sizeBytes: file.sizeBytes,
            contentType: file.contentType ?? null,
          }))
        : [],
      createdAt:
        website.createdAt instanceof Date
          ? website.createdAt.toISOString()
          : new Date(website.createdAt).toISOString(),
      updatedAt:
        website.updatedAt instanceof Date
          ? website.updatedAt.toISOString()
          : new Date(website.updatedAt).toISOString(),
    };

    const latestReportPayload = latestReport
      ? {
          _id: latestReport._id.toString(),
          createdAt:
            latestReport.createdAt instanceof Date
              ? latestReport.createdAt.toISOString()
              : new Date(latestReport.createdAt).toISOString(),
          pageCount: latestReport.pageCount,
          assetCount: latestReport.assetCount,
          imageCount: latestReport.imageCount,
          seoScore: latestReport.seoScore,
          performanceScore: latestReport.performanceScore,
          seoIssues: {
            missingTitle: latestReport.seoIssues?.missingTitle ?? [],
            missingDescription: latestReport.seoIssues?.missingDescription ?? [],
            missingOrMultipleH1: latestReport.seoIssues?.missingOrMultipleH1 ?? [],
            missingCanonical: latestReport.seoIssues?.missingCanonical ?? [],
            missingAlt: latestReport.seoIssues?.missingAlt ?? [],
          },
          performanceIssues: {
            largeImages: latestReport.performanceIssues?.largeImages ?? [],
            largeAssets: latestReport.performanceIssues?.largeAssets ?? [],
          },
          summary: latestReport.summary ?? null,
        }
      : null;

    const logPayload = logs.map((log) => ({
      _id: log._id.toString(),
      type: log.event ?? "event",
      level: log.status ?? "info",
      message: log.message ?? "",
      createdAt:
        log.createdAt instanceof Date
          ? log.createdAt.toISOString()
          : new Date(log.createdAt).toISOString(),
    }));

    return NextResponse.json({ ok: true, website: websitePayload, latestReport: latestReportPayload, logs: logPayload });
  } catch (error) {
    console.error("Website detail error", error);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", message: "Unable to load website detail." },
      { status: 500 },
    );
  }
}
