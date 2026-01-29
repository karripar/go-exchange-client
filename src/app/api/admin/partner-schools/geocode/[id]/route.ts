import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectMongo } from "@/server/db/mongoose";
import { PartnerGeocodeJob } from "@/server/models/PartnerGeocodeJob";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connectMongo();

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const doc = await PartnerGeocodeJob.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    _id: String(doc._id),
    status: doc.status,
    createdAt: doc.createdAt,
    startedAt: doc.startedAt,
    finishedAt: doc.finishedAt,
    requestedLimit: doc.requestedLimit,
    summary: doc.summary,
    errorLog: doc.errorLog,
    rowErrors: doc.rowErrors,
  });
}
