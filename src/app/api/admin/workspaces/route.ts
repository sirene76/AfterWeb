import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import connectDB from "@/lib/db";
import Account from "@/models/Account";

export async function GET() {
  await requireAdmin();
  await connectDB();

  const accounts = await Account.find({}).sort({ createdAt: -1 });
  return NextResponse.json(accounts);
}
