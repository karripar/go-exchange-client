import mongoose from "mongoose";

import { PartnerGeocodeJob } from "../models/PartnerGeocodeJob";
import { PartnerSchool } from "../models/PartnerSchool";
import { geocodeCity } from "../geocode/geocodeCity";

const MAX_ROW_ERRORS = 200;
const SAVE_EVERY = 5;

export async function runPartnerGeocode(jobId: string) {
  const job = await PartnerGeocodeJob.findById(jobId);
  if (!job) throw new Error("Geocode job not found");

  job.status = "running";
  job.startedAt = new Date();
  job.finishedAt = undefined;
  job.errorLog = undefined;
  job.summary = {
    totalCandidates: 0,
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  job.set("rowErrors", undefined);
  await job.save();

  const limit = Number(job.requestedLimit ?? 250);

  const candidates = await PartnerSchool.find({
    geocodePrecision: { $ne: "manual" },
    $or: [{ location: { $exists: false } }, { geocodePrecision: "none" }],
  })
    .select({ name: 1, city: 1, country: 1, externalKey: 1, geocodePrecision: 1 })
    .limit(Number.isFinite(limit) ? limit : 250)
    .lean();

  job.summary.totalCandidates = candidates.length;
  await job.save();

  const rowErrors: Array<{ schoolId: string; externalKey?: string; message: string }> = [];

  try {
    for (let i = 0; i < candidates.length; i += 1) {
      const s = candidates[i] as unknown as Record<string, unknown>;
      job.summary.processed += 1;

      const schoolId = String((s as { _id?: unknown })._id);
      const externalKey = typeof s.externalKey === "string" ? s.externalKey : undefined;
      const city = typeof s.city === "string" ? s.city : "";
      const country = typeof s.country === "string" ? s.country : "";
      const name = typeof s.name === "string" ? s.name : "";

      if (!city.trim() || !country.trim()) {
        job.summary.skipped += 1;
        if (rowErrors.length < MAX_ROW_ERRORS) {
          rowErrors.push({
            schoolId,
            externalKey,
            message: !city.trim() && !country.trim() ? "Skipped: missing city and country" : !city.trim() ? "Skipped: missing city" : "Skipped: missing country",
          });
        }
      } else {
        const geo = await geocodeCity(city, country, { name });
        if (!geo) {
          job.summary.failed += 1;
          if (rowErrors.length < MAX_ROW_ERRORS) {
            rowErrors.push({ schoolId, externalKey, message: "No geocode result" });
          }
        } else {
          await PartnerSchool.updateOne(
            { _id: new mongoose.Types.ObjectId(schoolId), geocodePrecision: { $ne: "manual" } },
            {
              $set: {
                location: { type: "Point", coordinates: [geo.lon, geo.lat] },
                geocodePrecision: "city",
                geocodeProvider: geo.provider,
                geocodeQuery: geo.query,
                geocodeUpdatedAt: new Date(),
              },
            }
          );
          job.summary.updated += 1;
        }
      }

      if (i % SAVE_EVERY === 0) {
        if (rowErrors.length) job.set("rowErrors", rowErrors.slice(0, MAX_ROW_ERRORS));
        await job.save();
      }
    }

    if (rowErrors.length) job.set("rowErrors", rowErrors.slice(0, MAX_ROW_ERRORS));

    job.status = "succeeded";
    job.finishedAt = new Date();
    await job.save();
  } catch (err: unknown) {
    job.status = "failed";
    job.finishedAt = new Date();
    const e = err as { stack?: unknown; message?: unknown };
    job.errorLog = String(e?.stack ?? e?.message ?? err);
    if (rowErrors.length) job.set("rowErrors", rowErrors.slice(0, MAX_ROW_ERRORS));
    await job.save();
    throw err;
  }
}
