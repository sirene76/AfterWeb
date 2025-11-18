import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import connectDB from "@/lib/db";
import Website from "@/models/Website";

export async function GET() {
  await requireAdmin();
  await connectDB();

  const websites = await Website.find({}).sort({ createdAt: -1 });
  return NextResponse.json(websites);
}
