import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

import { auth } from "@/lib/auth";
import { backupToR2, getBackupDownloadUrl } from "@/lib/backupToR2";
import connectDB from "@/lib/db";
import { extractZip } from "@/lib/extractZip";
import Log from "@/models/Log";
import MaintenanceLog from "@/models/MaintenanceLog";
import Website, { type WebsiteDocument } from "@/models/Website";

const EXTRACT_BASE_DIR = path.join(process.cwd(), "uploads", "extracted");

async function resolveSourceDir(website: WebsiteDocument): Promise<string> {
  const websiteId = website._id.toString();
  const existingDir = path.join(EXTRACT_BASE_DIR, websiteId);
  try {
    const stats = await fs.stat(existingDir);
    if (stats.isDirectory()) {
      return existingDir;
    }
  } catch {
    // fallthrough to re-extraction
  }

  if (!website.zipUrl) {
    throw new Error("NO_SOURCE_ARCHIVE");
  }

  const extraction = await extractZip(website.zipUrl, websiteId);
  return extraction.rootDir;
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

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

    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ID", message: "Invalid website id." },
        { status: 400 },
      );
    }

    const website = await Website.findById(id);
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

    if (!website.deployUrl && !website.zipUrl) {
      return NextResponse.json(
        { ok: false, error: "NO_SOURCE", message: "Website does not have files available for backup." },
        { status: 400 },
      );
    }

    const sourceDir = await resolveSourceDir(website);
    const backupResult = await backupToR2(website._id.toString(), sourceDir);

    website.lastBackupAt = new Date();
    website.lastBackupKey = backupResult.objectKey;
    website.lastBackupUrl = null;
    await website.save();

    const downloadUrl = await getBackupDownloadUrl(backupResult.objectKey).catch(() => null);

    await Promise.all([
      MaintenanceLog.create({
        websiteId: website._id,
        type: "backup",
        status: "success",
        details: { objectKey: backupResult.objectKey, sizeBytes: backupResult.sizeBytes },
      }).catch(() => undefined),
      Log.create({
        event: "backup",
        status: "success",
        message: "Backup created.",
        websiteId: website._id,
        metadata: { objectKey: backupResult.objectKey, sizeBytes: backupResult.sizeBytes },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      websiteId: website._id.toString(),
      backupKey: backupResult.objectKey,
      lastBackupAt: website.lastBackupAt.toISOString(),
      downloadUrl,
    });
  } catch (error) {
    console.error("Backup route error", error);

    if (id && Types.ObjectId.isValid(id)) {
      await Promise.all([
        MaintenanceLog.create({
          websiteId: id,
          type: "backup",
          status: "fail",
          details: {
            message: error instanceof Error ? error.message : "Backup failed",
          },
        }).catch(() => undefined),
        Log.create({
          event: "backup",
          status: "failure",
          message: "Backup failed.",
          websiteId: id,
          metadata: { message: error instanceof Error ? error.message : "Unknown error" },
        }).catch(() => undefined),
      ]).catch(() => undefined);
    }

    return NextResponse.json(
      { ok: false, error: "BACKUP_FAILED", message: "Failed to create backup." },
      { status: 500 },
    );
  }
}
