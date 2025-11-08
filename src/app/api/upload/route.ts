import { NextRequest, NextResponse } from "next/server";

import { analyzeSite } from "@/lib/analyzeSite";
import { connectToDatabase } from "@/lib/db";
import { extractZip } from "@/lib/extractZip";
import Website from "@/models/Website";

interface UploadPayload {
  fileUrl?: string;
  userEmail?: string;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as UploadPayload;
    const { fileUrl, userEmail } = payload;

    if (!fileUrl || !userEmail) {
      return NextResponse.json(
        { error: "fileUrl and userEmail are required" },
        { status: 400 },
      );
    }

    const response = await fetch(fileUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to download file: ${response.statusText}` },
        { status: 400 },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const files = extractZip(buffer);
    const analysis = analyzeSite(files);

    await connectToDatabase();

    const website = await Website.create({
      name: analysis.title || "Untitled Site",
      userEmail,
      status: "analyzed",
      deployUrl: "",
      meta: {
        pages: analysis.pageCount,
        scripts: analysis.scriptCount,
        seoScore: analysis.seoScore,
        title: analysis.title,
        description: analysis.description,
      },
    });

    return NextResponse.json({ siteId: website._id.toString() }, { status: 201 });
  } catch (error) {
    console.error("Upload route error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
