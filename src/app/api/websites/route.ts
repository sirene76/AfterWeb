import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import MaintenanceLog, { type MaintenanceLogType } from "@/models/MaintenanceLog";
import Website from "@/models/Website";

interface MaintenanceSummary {
  status: string;
  ranAt: string;
  result: unknown;
}

type MaintenanceByType = Partial<Record<MaintenanceLogType, MaintenanceSummary>>;

async function getMaintenanceSummaries(websiteIds: string[]): Promise<Map<string, MaintenanceByType>> {
  const summaries = new Map<string, MaintenanceByType>();
  if (websiteIds.length === 0) {
    return summaries;
  }

  const types: MaintenanceLogType[] = ["uptime", "backup", "seo"];
  const pipelines = await Promise.all(
    types.map((type) =>
      MaintenanceLog.aggregate<{
        _id: string;
        log: { websiteId: string; status: string; result: unknown; createdAt: Date };
      }>([
        { $match: { websiteId: { $in: websiteIds }, type } },
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

      const existing = summaries.get(entry._id) ?? {};
      existing[type] = {
        status: log.status,
        ranAt: createdAt,
        result: log.result,
      };
      summaries.set(entry._id, existing);
    });
  });

  return summaries;
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = request.nextUrl;
    const userEmail = searchParams.get("userEmail") ?? undefined;

    const query = userEmail ? { userEmail } : {};
    const websites = await Website.find(query).sort({ createdAt: -1 }).lean();
    const websiteIds = websites.map((site) => site._id.toString());
    const maintenanceSummaries = await getMaintenanceSummaries(websiteIds);

    const formatted = websites.map((site) => {
      const maintenance = maintenanceSummaries.get(site._id.toString()) ?? {};

      return {
        id: site._id.toString(),
        name: site.name,
        status: site.status,
        deployUrl: site.deployUrl ?? "",
        userEmail: site.userEmail,
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
