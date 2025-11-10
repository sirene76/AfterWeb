import { NextRequest, NextResponse } from "next/server";

import connectDB from "@/lib/db";
import MaintenanceLog, { type MaintenanceLogType } from "@/models/MaintenanceLog";
import Website from "@/models/Website";
import { Types } from "mongoose";

interface MaintenanceSummary {
  status: string;
  ranAt: string;
  details: unknown;
}

type MaintenanceByType = Partial<Record<MaintenanceLogType, MaintenanceSummary>>;

async function getMaintenanceSummaries(websiteIds: string[]): Promise<Map<string, MaintenanceByType>> {
  const summaries = new Map<string, MaintenanceByType>();
  if (websiteIds.length === 0) {
    return summaries;
  }

  const types: MaintenanceLogType[] = ["uptime", "backup", "seo"];
  const objectIds = websiteIds.map((id) => new Types.ObjectId(id));
  const pipelines = await Promise.all(
    types.map((type) =>
      MaintenanceLog.aggregate<{
        _id: string;
        log: { websiteId: string; status: string; details: unknown; createdAt: Date };
      }>([
        { $match: { websiteId: { $in: objectIds }, type } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$websiteId", log: { $first: "$$ROOT" } } },
      ]),
    ),
  );

  pipelines.forEach((entries, index) => {
    const type = types[index];
    entries.forEach((entry) => {
      const { log } = entry;
      const createdAt = log.createdAt instanceof Date ? log.createdAt.toISOString() : new Date(log.createdAt).toISOString();
      const websiteId = entry._id?.toString?.() ?? String(entry._id);

      const existing = summaries.get(websiteId) ?? {};
      existing[type] = {
        status: log.status,
        ranAt: createdAt,
        details: log.details,
      };
      summaries.set(websiteId, existing);
    });
  });

  return summaries;
}

async function getLastCheckMap(websiteIds: string[]): Promise<Map<string, string>> {
  const lastCheck = new Map<string, string>();
  if (websiteIds.length === 0) {
    return lastCheck;
  }
  const objectIds = websiteIds.map((id) => new Types.ObjectId(id));
  const results = await MaintenanceLog.aggregate<{ _id: string; createdAt: Date }>([
    { $match: { websiteId: { $in: objectIds } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$websiteId", createdAt: { $first: "$createdAt" } } },
  ]);

  results.forEach((entry) => {
    const createdAt = entry.createdAt instanceof Date ? entry.createdAt : new Date(entry.createdAt);
    const key = entry._id?.toString?.() ?? String(entry._id);
    lastCheck.set(key, createdAt.toISOString());
  });

  return lastCheck;
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = request.nextUrl;
    const userEmail = searchParams.get("userEmail") ?? undefined;

    const query = userEmail ? { userEmail } : {};
const websites: any[] = await Website.find(query).sort({ createdAt: -1 }).lean();
    const websiteIds = websites.map((site) => site._id.toString());
    const maintenanceSummaries = await getMaintenanceSummaries(websiteIds);
    const lastCheckMap = await getLastCheckMap(websiteIds);

    const formatted = websites.map((site) => {
      const maintenance = maintenanceSummaries.get(site._id.toString()) ?? {};

      return {
        id: site._id.toString(),
        name: site.name,
        status: site.status,
        deployUrl: site.deployUrl ?? "",
        userEmail: site.userEmail,
                plan: site.plan ?? null,
        billingStatus: site.billingStatus ?? null,
        meta: {
          pages: site.meta?.pages ?? 0,
          scripts: site.meta?.scripts ?? 0,
          seoScore: site.meta?.seoScore ?? 0,
          title: site.meta?.title ?? "",
          description: site.meta?.description ?? "",
          faviconUrl: site.meta?.faviconUrl ?? "",
        },
        maintenance: {
          uptime: maintenance.uptime ?? null,
          backup: maintenance.backup ?? null,
          seo: maintenance.seo ?? null,
        },
        lastCheck: lastCheckMap.get(site._id.toString()) ?? null,
        createdAt:
          site.createdAt instanceof Date
            ? site.createdAt.toISOString()
            : new Date(site.createdAt).toISOString(),
      };
    });

    return NextResponse.json({ websites: formatted });
  } catch (error) {
    console.error("Websites route error", error);
    return NextResponse.json({ error: "Failed to load websites" }, { status: 500 });
  }
}
