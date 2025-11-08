import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import Website from "@/models/Website";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = request.nextUrl;
    const userEmail = searchParams.get("userEmail") ?? undefined;

    const query = userEmail ? { userEmail } : {};
    const websites = await Website.find(query).sort({ createdAt: -1 }).lean();

    const formatted = websites.map((site) => ({
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
      },
      createdAt:
        site.createdAt instanceof Date
          ? site.createdAt.toISOString()
          : new Date(site.createdAt).toISOString(),
    }));

    return NextResponse.json({ websites: formatted });
  } catch (error) {
    console.error("Websites route error", error);
    return NextResponse.json({ error: "Failed to load websites" }, { status: 500 });
  }
}
