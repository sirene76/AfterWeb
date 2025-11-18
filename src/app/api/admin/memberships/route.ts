import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import connectDB from "@/lib/db";
import AccountMember from "@/models/AccountMember";

export async function GET() {
  await requireAdmin();
  await connectDB();

  const memberships = await AccountMember.find({}).sort({ accountId: 1, userEmail: 1 });
  return NextResponse.json(memberships);
}
