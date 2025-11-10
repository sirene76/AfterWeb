import { NextRequest, NextResponse } from "next/server";

import connectDB from "@/lib/db";
import MaintenanceLog from "@/models/MaintenanceLog";
import { Types } from "mongoose";

export async function GET(
  request: NextRequest,
  { params }: { params: { websiteId: string } },
) {
  try {
    await connectDB();

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(100, Math.max(1, Number(limitParam ?? "20")));

    let websiteId: Types.ObjectId;
    try {
      websiteId = new Types.ObjectId(params.websiteId);
    } catch {
      return NextResponse.json({ error: "Invalid website id" }, { status: 400 });
    }
    const logs = await MaintenanceLog.find({ websiteId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const serialized = logs.map((log) => ({
      id: log._id.toString(),
      websiteId: log.websiteId instanceof Types.ObjectId ? log.websiteId.toString() : String(log.websiteId),
      type: log.type,
      status: log.status,
      details: log.details,
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
