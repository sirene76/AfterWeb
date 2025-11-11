import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Account from "@/models/Account";
import AccountMember from "@/models/AccountMember";
import { getSessionUserEmail } from "@/lib/auth";
import { ensureDefaultAccount } from "@/lib/account";

export async function GET() {
  const userEmail = await getSessionUserEmail();
  if (!userEmail) {
    return NextResponse.json([]);
  }

  await connectDB();

  // Find existing memberships
  let memberships = await AccountMember.find({ userEmail }).lean();

  // ✅ Auto-create default workspace if none exist
  if (memberships.length === 0) {
    await ensureDefaultAccount(userEmail);
    memberships = await AccountMember.find({ userEmail }).lean();
  }

  const accountIds = memberships.map((m) => m.accountId);
  const accounts = await Account.find({ _id: { $in: accountIds } }).lean();

  const roleByAccountId = memberships.reduce<Record<string, string>>((acc, m) => {
    acc[m.accountId.toString()] = m.role;
    return acc;
  }, {});

  const payload = accounts.map((acc) => ({
    _id: acc._id?.toString?.() ?? "",
    name: acc.name,
    type: acc.type,
    role: roleByAccountId[acc._id?.toString?.() ?? ""] ?? "member",
  }));

  return NextResponse.json(payload);
}
