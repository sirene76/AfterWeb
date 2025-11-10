/* eslint-disable no-console */
import cron from "node-cron";

import { backupToR2 } from "../src/lib/backupToR2";
import { connectToDatabase } from "../src/lib/db";
import { analyzeSite } from "../src/lib/analyzeSite";
import MaintenanceLog, { type MaintenanceLogType } from "../src/models/MaintenanceLog";
import Website from "../src/models/Website";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = ONE_DAY_MS * 7;

interface DeployedWebsite {
  _id: string;
  deployUrl: string;
  meta?: {
    seoScore?: number;
    title?: string;
    description?: string;
    pages?: number;
    scripts?: number;
  };
}

const uptimeCron = process.env.AFTERWEB_UPTIME_CRON ?? "0 0 * * *"; // Midnight UTC
const backupCron = process.env.AFTERWEB_BACKUP_CRON ?? "0 2 * * 0"; // Sundays 02:00 UTC
const seoCron = process.env.AFTERWEB_SEO_CRON ?? "0 3 * * 0"; // Sundays 03:00 UTC

async function listDeployedWebsites(): Promise<DeployedWebsite[]> {
  const websites = await Website.find({
    status: "deployed",
    deployUrl: { $exists: true, $ne: "" },
  })
    .select({ deployUrl: 1, meta: 1 })
    .lean();

  return websites
    .filter((site): site is typeof site & { deployUrl: string } => typeof site.deployUrl === "string" && site.deployUrl.length > 0)
    .map((site) => ({
      _id: site._id.toString(),
      deployUrl: site.deployUrl,
      meta: site.meta ?? undefined,
    }));
}

async function recordLog(
  websiteId: string,
  type: MaintenanceLogType,
  status: string,
  result: unknown,
): Promise<void> {
  try {
    await MaintenanceLog.create({ websiteId, type, status, result });
  } catch (error) {
    console.error(`Failed to persist ${type} log for ${websiteId}`, error);
  }
}

async function shouldRunMaintenance(
  websiteId: string,
  type: MaintenanceLogType,
  intervalMs: number,
): Promise<boolean> {
  const latest = await MaintenanceLog.findOne({ websiteId, type }).sort({ createdAt: -1 }).lean();
  if (!latest) {
    return true;
  }

  const createdAt = latest.createdAt instanceof Date ? latest.createdAt.getTime() : new Date(latest.createdAt).getTime();
  return Date.now() - createdAt >= intervalMs;
}

async function runUptimeChecks(trigger: string) {
  const websites = await listDeployedWebsites();
  if (websites.length === 0) {
    return;
  }

  console.info(`[Maintenance] Running uptime checks for ${websites.length} sites (trigger: ${trigger})`);

  for (const site of websites) {
    const startedAt = Date.now();
    try {
      const response = await fetch(site.deployUrl, { redirect: "follow" });
      const durationMs = Date.now() - startedAt;
      const status = response.ok ? "success" : "failed";

      await recordLog(site._id, "uptime", status, {
        statusCode: response.status,
        ok: response.ok,
        durationMs,
        trigger,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      await recordLog(site._id, "uptime", "failed", {
        message: error instanceof Error ? error.message : "Unknown error",
        trigger,
        checkedAt: new Date().toISOString(),
      });
    }
  }
}

async function runBackups(trigger: string) {
  const websites = await listDeployedWebsites();
  if (websites.length === 0) {
    return;
  }

  console.info(`[Maintenance] Checking weekly backups for ${websites.length} sites (trigger: ${trigger})`);

  for (const site of websites) {
    const shouldRun = await shouldRunMaintenance(site._id, "backup", ONE_WEEK_MS);
    if (!shouldRun) {
      continue;
    }

    try {
      const backupResult = await backupToR2({ websiteId: site._id, deployUrl: site.deployUrl });
      await recordLog(site._id, "backup", "success", {
        ...backupResult,
        trigger,
      });
    } catch (error) {
      await recordLog(site._id, "backup", "failed", {
        message: error instanceof Error ? error.message : "Unknown error",
        trigger,
      });
    }
  }
}

async function runSeoRescans(trigger: string) {
  const websites = await listDeployedWebsites();
  if (websites.length === 0) {
    return;
  }

  console.info(`[Maintenance] Checking weekly SEO rescans for ${websites.length} sites (trigger: ${trigger})`);

  for (const site of websites) {
    const shouldRun = await shouldRunMaintenance(site._id, "seo", ONE_WEEK_MS);
    if (!shouldRun) {
      continue;
    }

    try {
      const response = await fetch(site.deployUrl, { redirect: "follow" });
      if (!response.ok) {
        throw new Error(`Failed to fetch deployed site (${response.status})`);
      }
      const html = await response.text();
      const analysis = analyzeSite({ "index.html": html });

      await Website.findByIdAndUpdate(site._id, {
        $set: {
          "meta.seoScore": analysis.seoScore,
          "meta.title": analysis.title || site.meta?.title || "",
          "meta.description": analysis.description || site.meta?.description || "",
          "meta.pages": Math.max(site.meta?.pages ?? 0, analysis.pageCount),
          "meta.scripts": analysis.scriptCount,
        },
      }).exec();

      await recordLog(site._id, "seo", "success", {
        ...analysis,
        trigger,
      });
    } catch (error) {
      await recordLog(site._id, "seo", "failed", {
        message: error instanceof Error ? error.message : "Unknown error",
        trigger,
      });
    }
  }
}

async function main() {
  await connectToDatabase();

  const runOnce = process.argv.includes("--once");

  await runUptimeChecks("startup");
  await runBackups("startup");
  await runSeoRescans("startup");

  if (runOnce) {
    process.exit(0);
  }

  cron.schedule(uptimeCron, () => {
    void runUptimeChecks("cron");
  });

  cron.schedule(backupCron, () => {
    void runBackups("cron");
  });

  cron.schedule(seoCron, () => {
    void runSeoRescans("cron");
  });

  console.info(
    `[Maintenance] Worker started. Uptime cron: ${uptimeCron}, backup cron: ${backupCron}, SEO cron: ${seoCron}.`,
  );
}

main().catch((error) => {
  console.error("Maintenance worker failed", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection", reason);
});
