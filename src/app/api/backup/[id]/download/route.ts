import { NextResponse } from "next/server";
import { Types } from "mongoose";

import { auth } from "@/lib/auth";
import { getBackupDownloadUrl } from "@/lib/backupToR2";
import connectDB from "@/lib/db";
import Website from "@/models/Website";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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

    if (!website.lastBackupKey) {
      return NextResponse.json(
        { ok: false, error: "NO_BACKUP", message: "No backup found for this website." },
        { status: 404 },
      );
    }

    const downloadUrl = await getBackupDownloadUrl(website.lastBackupKey);

    return NextResponse.json({ ok: true, downloadUrl });
  } catch (error) {
    console.error("Backup download route error", error);
    return NextResponse.json(
      { ok: false, error: "SIGNED_URL_FAILED", message: "Failed to generate download link." },
      { status: 500 },
    );
  }
}
