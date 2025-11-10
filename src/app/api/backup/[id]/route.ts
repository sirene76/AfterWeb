import { NextResponse } from "next/server";

import { backupToR2 } from "@/lib/backupToR2";
import { connectToDatabase } from "@/lib/db";
import MaintenanceLog from "@/models/MaintenanceLog";
import Website from "@/models/Website";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await connectToDatabase();

    const website = await Website.findById(params.id);
    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }
    if (!website.deployUrl) {
      return NextResponse.json({ error: "Website has not been deployed yet" }, { status: 400 });
    }

    const result = await backupToR2({
      websiteId: website._id.toString(),
      deployUrl: website.deployUrl,
    });

    await MaintenanceLog.create({
      websiteId: website._id.toString(),
      type: "backup",
      status: "success",
      result,
    });

    return NextResponse.json({ success: true, backup: result });
  } catch (error) {
    console.error("Backup route error", error);
    await MaintenanceLog.create({
      websiteId: params.id,
      type: "backup",
      status: "failed",
      result: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    }).catch((logError) => {
      console.error("Failed to write backup failure log", logError);
    });

    return NextResponse.json({ error: "Failed to back up site" }, { status: 500 });
  }
}
