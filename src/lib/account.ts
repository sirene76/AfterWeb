import Account from "@/models/Account";
import AccountMember from "@/models/AccountMember";
import connectDB from "@/lib/db";

export async function ensureDefaultAccount(userEmail: string) {
  await connectDB();

  const existing = await Account.findOne({ ownerEmail: userEmail, type: "personal" });
  if (existing) {
    await AccountMember.updateOne(
      { accountId: existing._id, userEmail },
      { $setOnInsert: { role: "owner" } },
      { upsert: true },
    );
    return existing;
  }

  const account = await Account.create({
    name: `${userEmail}'s Workspace`,
    type: "personal",
    ownerEmail: userEmail,
  });

  await AccountMember.create({
    accountId: account._id,
    userEmail,
    role: "owner",
  });

  return account;
}
