import Account from "@/models/Account";
import AccountMember from "@/models/AccountMember";
import { Types } from "mongoose";

/**
 * Ensures that a user has at least one personal workspace.
 * If none exists, creates a default account and membership.
 */
export async function ensureDefaultAccount(userEmail: string) {
  // Check if a personal account already exists
  const existingMembership = await AccountMember.findOne({ userEmail });
  if (existingMembership) {
    const account = await Account.findById(existingMembership.accountId);
    return account;
  }

  // ✅ Create a new personal account
  const account = await Account.create({
    name: `${userEmail}'s Workspace`,
    type: "personal",
    ownerEmail: userEmail,
    createdAt: new Date(),
  });

  // ✅ Add membership record
  await AccountMember.create({
    accountId: new Types.ObjectId(account._id),
    userEmail,
    role: "owner",
  });

  return account;
}
