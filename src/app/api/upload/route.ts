import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { analyzeSite } from "@/lib/analyzeSite";
import { connectToDatabase } from "@/lib/db";
import { extractZip } from "@/lib/extractZip";
import Website from "@/models/Website";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const userEmail = (form.get("userEmail") as string) || "anonymous@afterweb.dev";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadDir = path.join("/tmp", "afterweb-uploads");
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, `${randomUUID()}-${file.name}`);
    await writeFile(filePath, buffer);

    const extracted = extractZip(buffer);
    const analysis = analyzeSite(extracted);

    await connectToDatabase();

    const site = await Website.create({
      name: analysis.title || "Uploaded Site",
      userEmail,
      status: "analyzed",
      meta: {
        pages: analysis.pageCount,
        scripts: analysis.scriptCount,
        seoScore: analysis.seoScore,
        title: analysis.title,
        description: analysis.description,
      },
    });

    return NextResponse.json({ siteId: site._id.toString(), message: "Upload successful" });
  } catch (error) {
    console.error("Error handling upload", error);
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
  }
}
