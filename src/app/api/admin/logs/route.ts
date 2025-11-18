import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import connectDB from "@/lib/db";
import Log from "@/models/Log";

export async function GET() {
  await requireAdmin();
  await connectDB();

  const logs = await Log.find({}).sort({ createdAt: -1 });
  return NextResponse.json(logs);
}
