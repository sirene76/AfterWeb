import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

import { analyzeSite } from "@/lib/analyzeSite";
import { ensureDefaultAccount } from "@/lib/account";
import { getSessionUserEmail } from "@/lib/auth";
import connectDB from "@/lib/db";
import { deployToCloudflare } from "@/lib/deployToCloudflare";
import {
  type ExtractZipResult,
  type ExtractedFiles,
  extractZip,
} from "@/lib/extractZip";
import { generateWebsiteReport } from "@/lib/generateWebsiteReport";
import AccountMember from "@/models/AccountMember";
import Log from "@/models/Log";
import Website from "@/models/Website";

const TEXT_FILE_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".css",
  ".js",
  ".json",
  ".txt",
  ".svg",
  ".xml",
  ".md",
]);

async function buildExtractedFilesForAnalysis(
  extractResult: ExtractZipResult,
): Promise<ExtractedFiles> {
  const files: ExtractedFiles = {};

  for (const file of extractResult.files) {
    const absolutePath = path.join(extractResult.rootDir, file.path);
    try {
      const buffer = await fs.readFile(absolutePath);
      const extension = path.extname(file.path).toLowerCase();
      if (TEXT_FILE_EXTENSIONS.has(extension)) {
        files[file.path] = {
          data: buffer.toString("utf-8"),
          encoding: "utf-8",
          mimeType: file.contentType,
        };
      } else {
        files[file.path] = {
          data: buffer.toString("base64"),
          encoding: "base64",
          mimeType: file.contentType,
        };
      }
    } catch (error) {
      console.warn(`Failed to include extracted file ${file.path} for analysis`, error);
    }
  }

  return files;
}

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
      name: uploadedFileName.replace(/\.zip$/i, "") || "Uploaded Site",
      userEmail,
      accountId: resolvedAccountId,
      status: "uploaded",
      archiveUrl: fileUrl ?? undefined,
      zipUrl: fileUrl ?? undefined,
      meta: {
        pages: 0,
        scripts: 0,
        seoScore: 0,
        title: "",
        description: "",
        faviconUrl: "",
      },
    });

    const extractResult = await extractZip({ websiteId: site._id.toString(), zipUrl: fileUrl });
    const extractedFiles = await buildExtractedFilesForAnalysis(extractResult);
    const analysis = await analyzeSite(extractedFiles);

    const report = await generateWebsiteReport({ websiteId: site._id.toString(), extractResult });

    site.name = analysis.title || site.name;
    site.status = "analyzed";
    site.meta = {
      pages: analysis.pageCount,
      scripts: analysis.scriptCount,
      seoScore: report.seoScore,
      title: analysis.title,
      description: analysis.description,
      faviconUrl: analysis.faviconDataUrl ?? "",
    };
    site.files = extractResult.files;
    await site.save();

    await Log.create({
      event: "upload",
      status: "success",
      message: `Upload processed for ${userEmail}`,
      accountId: resolvedAccountId,
      websiteId: site._id,
      metadata: {
        fileUrl,
        meta: site.meta,
        reportId: report._id,
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
          cloudflareAccountId!,
        );
        if (deployUrl) {
          site.deployUrl = deployUrl;
        }
        site.status = "deployed";
        await site.save();

        await Log.create({
          event: "deploy",
          status: "success",
          message: `Automatic deploy completed for ${site.name}`,
          accountId: resolvedAccountId,
          websiteId: site._id,
          metadata: { deployUrl },
        });
      } catch (deployError) {
        console.error("Automatic deployment failed", deployError);
        site.status = "failed";
        await site.save();

        await Log.create({
          event: "deploy",
          status: "failure",
          message: `Automatic deploy failed for ${site.name}`,
          accountId: resolvedAccountId,
          websiteId: site._id,
          metadata: {
            error: deployError instanceof Error ? deployError.message : "Deployment failure",
          },
        });
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
    try {
      await connectDB();
      await Log.create({
        event: "upload",
        status: "failure",
        message: error instanceof Error ? error.message : "Upload failed",
        metadata: {
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    } catch (logError) {
      console.error("Failed to log upload error", logError);
    }

    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
  }
}
