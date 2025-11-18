import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import connectDB from "@/lib/db";
import AccountMember from "@/models/AccountMember";

export async function GET() {
  await requireAdmin();
  await connectDB();

  const users = await AccountMember.aggregate([
    {
      $group: {
        _id: "$userEmail",
        roles: { $push: "$role" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return NextResponse.json(users);
}
