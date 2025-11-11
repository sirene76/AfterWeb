import { NextResponse } from "next/server";

import connectDB from "@/lib/db";
import MaintenanceLog from "@/models/MaintenanceLog";
import Website from "@/models/Website";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  try {
    await connectDB();
    const website = await Website.findById(id);

    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }
    if (!website.deployUrl) {
      return NextResponse.json({ error: "Website has not been deployed yet" }, { status: 400 });
    }

    const startedAt = Date.now();
    const response = await fetch(website.deployUrl, {
      method: "GET",
      redirect: "follow",
    });
    const durationMs = Date.now() - startedAt;

    const status = response.ok ? "success" : "fail";
    const log = await MaintenanceLog.create({
      websiteId: website._id,
      type: "uptime",
      status,
      details: {
        statusCode: response.status,
        ok: response.ok,
        durationMs,
      },
    });

    return NextResponse.json({
      success: response.ok,
      statusCode: response.status,
      durationMs,
      logId: (log as any)._id.toString(),
    });
  } catch (error) {
    console.error("Ping route error", error);
    await MaintenanceLog.create({
      websiteId: id,
      type: "uptime",
      status: "fail",
      details: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    }).catch((logError) => {
      console.error("Failed to write ping failure log", logError);
    });

    return NextResponse.json({ error: "Failed to ping deployment" }, { status: 500 });
  }
}
