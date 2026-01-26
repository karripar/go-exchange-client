import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectMongo } from "@/server/db/mongoose";
import { PartnerImport } from "@/server/models/PartnerImport";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connectMongo();

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const doc = await PartnerImport.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    _id: String(doc._id),
    originalFileName: doc.originalFileName,
    fileUrl: doc.fileUrl,
    fileHash: doc.fileHash,
    status: doc.status,
    createdAt: doc.createdAt,
    startedAt: doc.startedAt,
    finishedAt: doc.finishedAt,
    summary: doc.summary,
    errorLog: doc.errorLog,
    rowErrors: doc.rowErrors,
    warnings: (doc as any).warnings,
  });
}
