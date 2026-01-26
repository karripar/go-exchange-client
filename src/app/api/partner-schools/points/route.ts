import { NextResponse } from "next/server";
import { connectMongo } from "@/server/db/mongoose";
import { PartnerSchool } from "@/server/models/PartnerSchool";

export const runtime = "nodejs";

function parseBBox(bboxParam: string | null): [number, number, number, number] | null {
  if (!bboxParam) return null;
  const parts = bboxParam.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  const [west, south, east, north] = parts;
  return [west, south, east, north];
}

function bboxToPolygon([west, south, east, north]: [number, number, number, number]) {
  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

export async function GET(req: Request) {
  await connectMongo();

  const url = new URL(req.url);
  const bbox = parseBBox(url.searchParams.get("bbox"));
  // zoom is optional; kept for potential future optimizations
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const zoom = Number(url.searchParams.get("zoom") ?? "0");

  if (!bbox) return NextResponse.json({ error: "Missing/invalid bbox" }, { status: 400 });

  const continent = url.searchParams.get("continent") || undefined;
  const country = url.searchParams.get("country") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const mobility = url.searchParams.get("mobility") || undefined;
  const lang = url.searchParams.get("lang") || undefined;
  const level = url.searchParams.get("level") || undefined;
  const q = url.searchParams.get("q") || undefined;

  const query: any = {
    location: { $geoWithin: { $geometry: bboxToPolygon(bbox) } },
  };

  if (continent && continent !== "all") query.continent = continent;
  if (country && country !== "all") query.country = country;
  if (status && status !== "all") query.status = status;

  if (mobility) {
    const raw = mobility
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    // Support simplified UI filter groups.
    // These are *not* stored as exact values in Mongo; we translate them to regex queries.
    const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();
    const groups = new Set(
      raw
        .map(normalize)
        .map((v) => {
          if (v === "erasmus") return "erasmus";
          if (v === "nordplus") return "nordplus";
          if (v === "bilateral agreements" || v === "bilateral" || v === "bilateral agreement") return "bilateral";
          if (v === "other exchange destinations" || v === "other") return "other";
          return null;
        })
        .filter(Boolean) as string[]
    );

    if (groups.size > 0) {
      const or: any[] = [];
      if (groups.has("erasmus")) {
        // Match plain Erasmus programmes (exclude bilateral hybrids).
        or.push({ mobilityProgrammes: { $regex: /\berasmus\b/i } });
        or.push({ mobilityProgrammes: { $regex: /\beras mus\b/i } });
      }
      if (groups.has("nordplus")) {
        or.push({ mobilityProgrammes: { $regex: /\bnordplus\b/i } });
      }
      if (groups.has("bilateral")) {
        or.push({ mobilityProgrammes: { $regex: /\bbilateral\b/i } });
      }
      if (groups.has("other")) {
        // Anything that is NOT Erasmus/Nordplus/Bilateral.
        or.push({
          $and: [
            { mobilityProgrammes: { $not: /\berasmus\b/i } },
            { mobilityProgrammes: { $not: /\bnordplus\b/i } },
            { mobilityProgrammes: { $not: /\bbilateral\b/i } },
          ],
        });
      }

      if (or.length > 0) query.$and = [...(query.$and ?? []), { $or: or }];
    } else {
      // Backwards-compatible exact matching (old UI values).
      if (raw.length > 0) query.mobilityProgrammes = { $in: raw };
    }
  }

  if (lang && lang !== "all") {
    if (level && level !== "all") {
      query.languageRequirements = { $elemMatch: { language: lang, level } };
    } else {
      query["languageRequirements.language"] = lang;
    }
  } else if (level && level !== "all") {
    query["languageRequirements.level"] = level;
  }

  if (q && q.trim()) {
    const term = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(term, "i");
    query.$or = [{ name: rx }, { country: rx }, { city: rx }];
  }

  const docs = await PartnerSchool.find(query)
    .select({ name: 1, country: 1, city: 1, status: 1, location: 1 })
    .limit(3000)
    .lean();

  const items = docs
    .filter((d) => d.location?.coordinates?.length === 2)
    .map((d) => ({
      id: String(d._id),
      name: d.name,
      country: d.country,
      city: d.city,
      status: d.status,
      coordinates: d.location!.coordinates as [number, number],
    }));

  return NextResponse.json({ items });
}
