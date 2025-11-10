import { NextResponse } from "next/server";

import { analyzeSite } from "@/lib/analyzeSite";
import { connectToDatabase } from "@/lib/db";
import { extractZip } from "@/lib/extractZip";
import Website from "@/models/Website";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let buffer: Buffer | null = null;
    let uploadedFileName = "uploaded-site.zip";
    let fileUrl: string | null = null;
    let userEmail = "anonymous@afterweb.dev";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      fileUrl = typeof body.fileUrl === "string" ? body.fileUrl : null;
      userEmail = typeof body.userEmail === "string" && body.userEmail ? body.userEmail : userEmail;

      if (!fileUrl) {
        return NextResponse.json({ error: "Missing file URL" }, { status: 400 });
      }

      const response = await fetch(fileUrl);
      if (!response.ok) {
        return NextResponse.json({ error: "Failed to download uploaded file" }, { status: 502 });
      }

      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);

      try {
        const parsedUrl = new URL(fileUrl);
        const parts = parsedUrl.pathname.split("/").filter(Boolean);
        if (parts.length > 0) {
          uploadedFileName = parts[parts.length - 1];
        }
      } catch {
        uploadedFileName = "uploaded-site.zip";
      }
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      userEmail = (form.get("userEmail") as string) || userEmail;

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      uploadedFileName = file.name;
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
    }

    if (!buffer) {
      return NextResponse.json({ error: "Upload payload was empty" }, { status: 400 });
    }

    const extracted = extractZip(buffer);
    const analysis = analyzeSite(extracted);

    await connectToDatabase();

    const site = await Website.create({
      name: analysis.title || uploadedFileName.replace(/\.zip$/i, "") || "Uploaded Site",
      userEmail,
      status: "analyzed",
      archiveUrl: fileUrl ?? undefined,
      meta: {
        pages: analysis.pageCount,
        scripts: analysis.scriptCount,
        seoScore: analysis.seoScore,
        title: analysis.title,
        description: analysis.description,
        faviconUrl: analysis.faviconDataUrl ?? "",
      },
    });

    return NextResponse.json({
      siteId: site._id.toString(),
      message: "Upload successful",
      fileUrl: fileUrl ?? null,
      meta: {
        title: analysis.title,
        description: analysis.description,
        faviconUrl: analysis.faviconDataUrl ?? "",
      },
    });
  } catch (error) {
    console.error("Error handling upload", error);
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
  }
}
