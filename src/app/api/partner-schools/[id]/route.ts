import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectMongo } from "@/server/db/mongoose";
import { PartnerSchool } from "@/server/models/PartnerSchool";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connectMongo();

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const doc = await PartnerSchool.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: String(doc._id),
    externalKey: doc.externalKey,
    name: doc.name,
    continent: doc.continent,
    country: doc.country,
    city: doc.city,
    status: doc.status,
    mobilityProgrammes: doc.mobilityProgrammes,
    languageRequirements: doc.languageRequirements,
    agreementScope: doc.agreementScope,
    degreeProgrammesInAgreement: doc.degreeProgrammesInAgreement,
    furtherInfo: doc.furtherInfo,
    location: doc.location,
    geocodePrecision: doc.geocodePrecision,
    sourceImportId: doc.sourceImportId ? String(doc.sourceImportId) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}
