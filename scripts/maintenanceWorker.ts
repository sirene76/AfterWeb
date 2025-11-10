import "dotenv/config";
import connectDB from "@/lib/db";
import Website from "@/models/Website";
import MaintenanceLog from "@/models/MaintenanceLog";
import { analyzeSite } from "@/lib/analyzeSite";
import { backupToR2 } from "@/lib/backupToR2";

async function run() {
  await connectDB();
  const websites = await Website.find({ status: "deployed" });
  for (const site of websites) {
    if (!site.deployUrl) {
      continue;
    }
    // 1️⃣ Uptime check
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

    // 2️⃣ Weekly backup & SEO (once per 7 days)
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
        continue;
      }

      try {
        const seo = await analyzeSite(site.deployUrl);
        await MaintenanceLog.create({ websiteId: site._id, type: "seo", status: "success", details: seo });
        site.meta.seoScore = seo.seoScore;
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
  console.log("✅ Maintenance cycle completed");
  process.exit(0);
}
run();
