import { NextResponse } from "next/server";

import { connectMongo } from "@/server/db/mongoose";
import { PartnerGeocodeJob } from "@/server/models/PartnerGeocodeJob";
import { enqueuePartnerGeocode } from "@/server/jobs/partnerGeocodeQueue";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await connectMongo();

  let limit: number | undefined;
  // Prefer query param for reliability across environments (and to allow simple curl testing).
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("limit");
    if (q != null && q !== "") limit = Number(q);
  } catch {
    // ignore
  }

  try {
    const body = (await req.json().catch(() => null)) as any;
    if (body && body.limit != null) limit = Number(body.limit);
  } catch {
    // ignore
  }

  const doc = await PartnerGeocodeJob.create({
    status: "queued",
    requestedLimit: Number.isFinite(limit) ? limit : 250,
    summary: {
      totalCandidates: 0,
      processed: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
  });

  enqueuePartnerGeocode(String(doc._id));

  return NextResponse.json({ jobId: String(doc._id) });
}

export async function GET() {
  await connectMongo();

  const latest = await PartnerGeocodeJob.findOne({}).sort({ createdAt: -1 }).lean();
  if (!latest) return NextResponse.json({ job: null });

  return NextResponse.json({
    job: {
      _id: String(latest._id),
      status: latest.status,
      createdAt: latest.createdAt,
      startedAt: latest.startedAt,
      finishedAt: latest.finishedAt,
      requestedLimit: latest.requestedLimit,
      summary: latest.summary,
      errorLog: latest.errorLog,
      rowErrors: latest.rowErrors,
    },
  });
}
