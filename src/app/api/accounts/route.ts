import { NextResponse } from "next/server";

import { getSessionUserEmail } from "@/lib/auth";
import connectDB from "@/lib/db";
import Account from "@/models/Account";
import AccountMember from "@/models/AccountMember";

export async function GET() {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return NextResponse.json([]);
  }

  await connectDB();

  const memberships = await AccountMember.find({ userEmail }).lean();
  if (memberships.length === 0) {
    return NextResponse.json([]);
  }

  const accountIds = memberships.map((membership) => membership.accountId);
  const accounts = await Account.find({ _id: { $in: accountIds } }).lean();

  const roleByAccountId = memberships.reduce<Record<string, string>>((acc, membership) => {
    acc[membership.accountId.toString()] = membership.role;
    return acc;
  }, {});

  const payload = accounts.map((account) => ({
    _id: account._id.toString(),
    name: account.name,
    type: account.type,
    role: roleByAccountId[account._id.toString()] ?? "member",
  }));

  return NextResponse.json(payload);
}
