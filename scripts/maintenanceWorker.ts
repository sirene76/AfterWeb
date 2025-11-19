import "dotenv/config";
import fs from "fs/promises";
import path from "path";

import { backupToR2 } from "@/lib/backupToR2";
import { generateSeoRecommendations } from "@/lib/aiSeoHelper";
import connectDB from "@/lib/db";
import { extractZip } from "@/lib/extractZip";
import { runSeoAgent } from "@/lib/seoAgent";
import { sendWeeklyReport } from "@/lib/mailer";
import MaintenanceLog from "@/models/MaintenanceLog";
import Website from "@/models/Website";

const EXTRACT_BASE_DIR = path.join(process.cwd(), "uploads", "extracted");

async function resolveSourceDir(websiteId: string, zipUrl?: string | null) {
  const existingDir = path.join(EXTRACT_BASE_DIR, websiteId);
  try {
    const stats = await fs.stat(existingDir);
    if (stats.isDirectory()) {
      return existingDir;
    }
  } catch {
    // continue to extraction
  }

  if (!zipUrl) {
    throw new Error("Website archive missing");
  }
  const extraction = await extractZip(zipUrl, websiteId);
  return extraction.rootDir;
}

async function run() {
  await connectDB();
  const websites = await Website.find({ status: "deployed" });
  for (const site of websites) {
    if (!site.deployUrl) {
      continue;
    }
    const plan = site.plan ?? "basic";
    const billingStatus = site.billingStatus ?? "inactive";
    const isCanceled = billingStatus === "canceled";
    const isActive = billingStatus === "active";
    const isStandardOrPro = isActive && (plan === "standard" || plan === "pro");
    const isProPlan = isActive && plan === "pro";

    if (isCanceled) {
      continue;
    }

    // 1️⃣ Uptime check (available for all active or trialing plans)
    try {
      const res = await fetch(site.deployUrl, { method: "GET" });
      const ok = res.status < 400;
      await MaintenanceLog.create({
        websiteId: site._id,
        type: "uptime",
        status: ok ? "success" : "fail",
        details: { code: res.status },
      });
    } catch {
      await MaintenanceLog.create({ websiteId: site._id, type: "uptime", status: "fail" });
    }

    // 2️⃣ Weekly backup (once per 7 days) — Standard & Pro only
    if (isStandardOrPro) {
      const lastBackup = await MaintenanceLog.findOne({ websiteId: site._id, type: "backup" }).sort({ createdAt: -1 });
      if (!lastBackup || Date.now() - lastBackup.createdAt.getTime() > 7 * 24 * 3600 * 1000) {
        try {
          const sourceDir = await resolveSourceDir(site._id.toString(), site.zipUrl ?? undefined);
          const backupResult = await backupToR2(site._id.toString(), sourceDir);
          site.lastBackupAt = new Date();
          site.lastBackupKey = backupResult.objectKey;
          site.lastBackupUrl = null;
          await site.save();
          await MaintenanceLog.create({
            websiteId: site._id,
            type: "backup",
            status: "success",
            details: { objectKey: backupResult.objectKey, sizeBytes: backupResult.sizeBytes },
          });
        } catch (error) {
          await MaintenanceLog.create({
            websiteId: site._id,
            type: "backup",
            status: "fail",
            details: { message: error instanceof Error ? error.message : "Backup failed" },
          });
        }
      }
    }

    // 3️⃣ Weekly SEO audit (once per 7 days) — Pro only
    if (isProPlan) {
      const lastSeo = await MaintenanceLog.findOne({ websiteId: site._id, type: "seo" }).sort({ createdAt: -1 });
      if (!lastSeo || Date.now() - lastSeo.createdAt.getTime() > 7 * 24 * 3600 * 1000) {
        try {
          const html = await fetch(site.deployUrl).then((response) => response.text());
          const analysis = await runSeoAgent(html);
          const ai = await generateSeoRecommendations(analysis);
          await MaintenanceLog.create({
            websiteId: site._id,
            type: "seo",
            status: "success",
            details: { analysis, ai },
          });
          site.meta.seoScore = analysis.score;
          await site.save();
        } catch (error) {
          await MaintenanceLog.create({
            websiteId: site._id,
            type: "seo",
            status: "fail",
            details: { message: error instanceof Error ? error.message : "SEO check failed" },
          });
        }
      }
    }

    if (isProPlan && site.userEmail) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const logs = await MaintenanceLog.find({
        websiteId: site._id,
        createdAt: { $gte: sevenDaysAgo },
      }).sort({ createdAt: -1 });

      const uptimeEvents = logs.filter((log) => log.type === "uptime");
      const seoEvents = logs.filter((log) => log.type === "seo");
      const backupEvents = logs.filter((log) => log.type === "backup");

      const uptimeSuccess = uptimeEvents.filter((log) => log.status === "success").length;
      const uptimePct = uptimeEvents.length
        ? Math.round((uptimeSuccess / uptimeEvents.length) * 100)
        : 100;

      const latestSeoDetails = seoEvents[0]?.details as { analysis?: { score?: number; suggestions?: string[] } } | undefined;
      const lastSeoScore = latestSeoDetails?.analysis?.score ?? "N/A";
      const topSuggestion = latestSeoDetails?.analysis?.suggestions?.[0] ?? "Keep up the good work!";

      const lastBackup = backupEvents[0];
      const backupStatus = lastBackup
        ? lastBackup.status === "success"
          ? "✅ Successful"
          : "⚠️ Failed"
        : "No backups recorded this week";

      const html = `
        <h1>AfterWeb Weekly Report</h1>
        <p><strong>Website:</strong> ${site.name}</p>
        <p><strong>Uptime:</strong> ${uptimePct}%</p>
        <p><strong>Last SEO Score:</strong> ${lastSeoScore}</p>
        <p><strong>Top suggestion:</strong> ${topSuggestion}</p>
        <p><strong>Latest backup:</strong> ${backupStatus}</p>
      `;

      try {
        await sendWeeklyReport(site.userEmail, "Your AfterWeb Weekly Report", html);
      } catch (error) {
        console.error("Failed to send weekly report", error);
      }
    }
  }
  console.log("✅ Maintenance cycle completed");
  process.exit(0);
}
run();
