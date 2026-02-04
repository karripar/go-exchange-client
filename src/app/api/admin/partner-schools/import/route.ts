import { NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { connectMongo } from "@/server/db/mongoose";
import { PartnerImport } from "@/server/models/PartnerImport";
import { enqueuePartnerImport } from "@/server/jobs/partnerImportQueue";

export const runtime = "nodejs";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  await connectMongo();

  const form = await req.formData();
  const file = form.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file (field name: file)" }, { status: 400 });
  }

  const originalFileName = file.name || "upload.pdf";

  const lower = originalFileName.toLowerCase();
  const isCsv = lower.endsWith(".csv") || file.type === "text/csv";
  const isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";
  if (!isCsv && !isPdf) {
    return NextResponse.json({ error: "Only .csv (preferred) or .pdf is supported" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = crypto.createHash("sha256").update(bytes).digest("hex");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const uploadsDir = path.join(process.cwd(), "public", "uploads", "partner-imports");
  await fs.mkdir(uploadsDir, { recursive: true });

  const storedName = `${stamp}-${safeFileName(originalFileName)}`;
  const localPath = path.join(uploadsDir, storedName);
  await fs.writeFile(localPath, bytes);

  const fileUrl = `/uploads/partner-imports/${storedName}`;

  const doc = await PartnerImport.create({
    originalFileName,
    fileUrl,
    localPath,
    fileHash,
    status: "queued",
    createdAt: new Date(),
  });

  enqueuePartnerImport(String(doc._id));

  return NextResponse.json({ importId: String(doc._id) });
}
