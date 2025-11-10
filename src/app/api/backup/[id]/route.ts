import { NextResponse } from "next/server";

import { backupToR2 } from "@/lib/backupToR2";
import connectDB from "@/lib/db";
import MaintenanceLog from "@/models/MaintenanceLog";
import Website from "@/models/Website";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params; // ✅ await params before use

  try {
    await connectDB();

    const website = await Website.findById(id);
    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    if (!website.deployUrl) {
      return NextResponse.json(
        { error: "Website has not been deployed yet" },
        { status: 400 }
      );
    }

    const backupUrl = await backupToR2(website.deployUrl, website._id.toString());

    await MaintenanceLog.create({
      websiteId: website._id,
      type: "backup",
      status: "success",
      details: { backupUrl },
    });

    return NextResponse.json({ success: true, backupUrl });
  } catch (error) {
    console.error("Backup route error", error);

    await MaintenanceLog.create({
      websiteId: id,
      type: "backup",
      status: "fail",
      details: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    }).catch((logError) => {
      console.error("Failed to write backup failure log", logError);
    });

    return NextResponse.json(
      { error: "Failed to back up site" },
      { status: 500 }
    );
  }
}
