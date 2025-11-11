import { NextResponse } from "next/server";
import { Types } from "mongoose";

import { analyzeSite } from "@/lib/analyzeSite";
import { ensureDefaultAccount } from "@/lib/account";
import { getSessionUserEmail } from "@/lib/auth";
import connectDB from "@/lib/db";
import { deployToCloudflare } from "@/lib/deployToCloudflare";
import { extractZip } from "@/lib/extractZip";
import AccountMember from "@/models/AccountMember";
import Website from "@/models/Website";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
    }

    const body = await req.json();
    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl : null;

    const sessionEmail = await getSessionUserEmail();
    const fallbackEmail = typeof body.userEmail === "string" && body.userEmail ? body.userEmail : null;
    const userEmail = sessionEmail ?? fallbackEmail;

    if (!userEmail) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let accountId: string | undefined = typeof body.accountId === "string" ? body.accountId : undefined;

    if (!fileUrl) {
      return NextResponse.json({ error: "Missing file URL" }, { status: 400 });
    }

    const response = await fetch(fileUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to download uploaded file" }, { status: 502 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let uploadedFileName = "uploaded-site.zip";
    try {
      const parsedUrl = new URL(fileUrl);
      const parts = parsedUrl.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        uploadedFileName = parts[parts.length - 1];
      }
    } catch {
      uploadedFileName = "uploaded-site.zip";
    }

    const extracted = extractZip(buffer);
    const analysis = await analyzeSite(extracted);

    await connectDB();

    if (accountId) {
      if (!Types.ObjectId.isValid(accountId)) {
        return NextResponse.json({ error: "Invalid workspace" }, { status: 400 });
      }
      const membership = await AccountMember.findOne({ accountId, userEmail });
      if (!membership) {
        return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
      }
    } else {
      const account = await ensureDefaultAccount(userEmail);
      accountId = account._id.toString();
    }

    const resolvedAccountId = accountId!;

    const site = await Website.create({
      name: analysis.title || uploadedFileName.replace(/\.zip$/i, "") || "Uploaded Site",
      userEmail,
      accountId: resolvedAccountId,
      status: "analyzed",
      archiveUrl: fileUrl ?? undefined,
      zipUrl: fileUrl ?? undefined,
      meta: {
        pages: analysis.pageCount,
        scripts: analysis.scriptCount,
        seoScore: analysis.seoScore,
        title: analysis.title,
        description: analysis.description,
        faviconUrl: analysis.faviconDataUrl ?? "",
      },
    });

    const projectName = process.env.CLOUDFLARE_PROJECT_NAME;
    const token = process.env.CLOUDFLARE_API_TOKEN;
    const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (projectName && token && accountId) {
      try {
const deployUrl = await deployToCloudflare(
  fileUrl,
  projectName!,
  token!,
  cloudflareAccountId!
);
        if (deployUrl) {
          site.deployUrl = deployUrl;
        }
        site.status = "deployed";
        await site.save();
      } catch (deployError) {
        console.error("Automatic deployment failed", deployError);
        site.status = "failed";
        await site.save();
      }
    }

    return NextResponse.json({
      siteId: site._id.toString(),
      accountId: resolvedAccountId,
      message: "Upload successful",
      fileUrl,
      meta: {
        title: analysis.title,
        description: analysis.description,
        faviconUrl: analysis.faviconDataUrl ?? "",
      },
    });
  } catch (error) {
    console.error("Error handling upload", error);
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
  }
}
