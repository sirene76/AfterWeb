import "dotenv/config";
import connectDB from "@/lib/db";
import Website from "@/models/Website";
import MaintenanceLog from "@/models/MaintenanceLog";
import { backupToR2 } from "@/lib/backupToR2";
import { generateSeoRecommendations } from "@/lib/aiSeoHelper";
import { runSeoAgent } from "@/lib/seoAgent";
import { sendWeeklyReport } from "@/lib/mailer";

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
          const backupUrl = await backupToR2(site.deployUrl, site._id.toString());
          await MaintenanceLog.create({
            websiteId: site._id,
            type: "backup",
            status: "success",
            details: { backupUrl },
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
