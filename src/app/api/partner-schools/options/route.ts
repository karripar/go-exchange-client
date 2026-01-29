import { NextResponse } from "next/server";
import { connectMongo } from "@/server/db/mongoose";
import { PartnerSchool } from "@/server/models/PartnerSchool";

export const runtime = "nodejs";

export async function GET() {
  await connectMongo();

  const [continents, countries, mobilityProgrammes, languages] = await Promise.all([
    PartnerSchool.distinct("continent"),
    PartnerSchool.distinct("country"),
    PartnerSchool.distinct("mobilityProgrammes"),
    PartnerSchool.distinct("languageRequirements.language"),
  ]);

  const unique = (arr: unknown[]) =>
    Array.from(new Set(arr.filter((x) => typeof x === "string" && x.trim()).map((x) => (x as string).trim()))).sort(
      (a, b) => a.localeCompare(b)
    );

  return NextResponse.json({
    continents: unique(continents),
    countries: unique(countries),
    mobilityProgrammes: unique(mobilityProgrammes),
    languages: unique(languages),
    levels: ["A2", "B1", "B2", "C1", "C2"],
  });
}
