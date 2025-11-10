import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import MaintenanceLog from "@/models/MaintenanceLog";

export async function GET(
  request: NextRequest,
  { params }: { params: { websiteId: string } },
) {
  try {
    await connectToDatabase();

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(100, Math.max(1, Number(limitParam ?? "20")));

    const logs = await MaintenanceLog.find({ websiteId: params.websiteId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const serialized = logs.map((log) => ({
      id: log._id.toString(),
      websiteId: log.websiteId,
      type: log.type,
      status: log.status,
      result: log.result,
      createdAt:
        log.createdAt instanceof Date
          ? log.createdAt.toISOString()
          : new Date(log.createdAt).toISOString(),
    }));

    return NextResponse.json({ logs: serialized });
  } catch (error) {
    console.error("Maintenance logs route error", error);
    return NextResponse.json({ error: "Failed to load maintenance logs" }, { status: 500 });
  }
}
