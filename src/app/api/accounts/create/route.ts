import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Account from "@/models/Account";
import AccountMember from "@/models/AccountMember";
import { getSessionUserEmail } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await connectDB();

    const userEmail = await getSessionUserEmail();
    if (!userEmail) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const name = body?.name?.trim();

    if (!name) {
      return NextResponse.json(
        { error: "Workspace name is required" },
        { status: 400 }
      );
    }

    const account = await Account.create({
      name,
      type: "agency",
      ownerEmail: userEmail,
      createdAt: new Date(),
    });

    await AccountMember.create({
      accountId: account._id,
      userEmail,
      role: "owner",
    });

    return NextResponse.json({
      ok: true,
      accountId: account._id.toString(),
      name: account.name,
    });
  } catch (err) {
    console.error("Workspace creation failed", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
