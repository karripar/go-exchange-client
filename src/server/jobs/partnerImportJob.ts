import mongoose from "mongoose";
import { PartnerImport } from "../models/PartnerImport";
import { PartnerSchool } from "../models/PartnerSchool";
import { parsePartnerPdfToRows } from "../import/pdfParser";
import { normalizeRow } from "../import/normalize";
import { makeExternalKey } from "../import/makeExternalKey";
import { geocodeCity } from "../geocode/geocodeCity";

function hashStringToUnit(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const u = hash >>> 0;
  return u / 2 ** 32;
}

function continentBBox(continent?: string) {
  const c = (continent ?? "").toLowerCase().trim();
  if (c === "europe") return [-10, 36, 35, 70] as const;
  if (c === "asia") return [60, 5, 145, 55] as const;
  if (c === "africa") return [-20, -35, 55, 35] as const;
  if (c === "north america") return [-130, 15, -60, 60] as const;
  if (c === "south america") return [-80, -55, -35, 15] as const;
  if (c === "oceania" || c === "australia") return [110, -50, 180, 0] as const;
  return [-180, -60, 180, 80] as const;
}

function fallbackCoords(continent: string, country: string, city: string, name: string): { lat: number; lon: number } {
  const [lonMin, latMin, lonMax, latMax] = continentBBox(continent);
  const seed = `${continent}|${country}|${city}|${name}`;
  const a = hashStringToUnit(seed);
  const b = hashStringToUnit(`${seed}::b`);
  const lon = lonMin + a * (lonMax - lonMin);
  const lat = latMin + b * (latMax - latMin);
  return { lat, lon };
}

function looksLikeAgreementScopeText(text: string) {
  return /\bagreement\b|\bgeneral agreement\b|\bsopimus\b|\bscope\b/i.test(text);
}

export async function runPartnerImport(importId: string) {
  const importDoc = await PartnerImport.findById(importId);
  if (!importDoc) throw new Error("Import not found");

  importDoc.status = "running";
  importDoc.startedAt = new Date();
  importDoc.errorLog = undefined;
  importDoc.summary = { inserted: 0, updated: 0, unchanged: 0, failedRows: 0 };
  importDoc.set("rowErrors", undefined);
  importDoc.set("warnings", undefined);
  await importDoc.save();

  const rowErrors: Array<{ row: number; externalKey?: string; message: string }> = [];
  const warnings: Array<{ row: number; externalKey?: string; message: string }> = [];

  try {
    const rawRows = await parsePartnerPdfToRows(importDoc.localPath);

    for (let i = 0; i < rawRows.length; i += 1) {
      const normalized = normalizeRow(rawRows[i]);
      if (!normalized) {
        importDoc.summary.failedRows += 1;
        rowErrors.push({ row: i + 1, message: "Row missing required fields" });
        continue;
      }

      const externalKey =
        normalized.externalKey ||
        makeExternalKey(normalized.name, normalized.country, normalized.city || "");

      // Soft fix: if agreementScope (Agreement applies to) is empty but the degree-programmes column
      // looks like it contains agreement/scope text, copy it to agreementScope WITHOUT removing it
      // from degreeProgrammesInAgreement.
      const rawRow = rawRows[i] as unknown as Record<string, unknown>;
      const agreementScopeFromCsv = String(rawRow.agreementScopeText ?? "").trim();
      const degreeTextFromCsv = String(rawRow.degreeProgrammeText ?? "").trim();
      const shouldCopyDegreeToAgreementScope =
        !normalized.agreementScope &&
        !agreementScopeFromCsv &&
        !!degreeTextFromCsv &&
        looksLikeAgreementScopeText(degreeTextFromCsv);

      const finalAgreementScope = shouldCopyDegreeToAgreementScope
        ? degreeTextFromCsv
        : normalized.agreementScope;

      const MAX_WARNINGS = 200;
      if (shouldCopyDegreeToAgreementScope && warnings.length < MAX_WARNINGS) {
        const snippet = degreeTextFromCsv.length > 180 ? `${degreeTextFromCsv.slice(0, 180)}…` : degreeTextFromCsv;
        warnings.push({
          row: i + 1,
          externalKey,
          message:
            `Soft fix: copied degreeProgrammesInAgreement value into agreementAppliesTo (agreement scope) because agreementAppliesTo was empty and degree text looked like agreement scope. Copied text: "${snippet}". Original degree value preserved.`,
        });
      }

      // If languageRequirements had no explicit CEFR level, normalize.ts defaults it to UNKNOWN.
      // Log a warning so the CSV can be cleaned later.
      if (
        warnings.length < MAX_WARNINGS &&
        (normalized.languageRequirements ?? []).some((lr) => (lr.level ?? "").toUpperCase() === "UNKNOWN")
      ) {
        const langs = (normalized.languageRequirements ?? [])
          .filter((lr) => (lr.level ?? "").toUpperCase() === "UNKNOWN")
          .map((lr) => lr.language)
          .filter(Boolean)
          .slice(0, 5)
          .join(", ");
        warnings.push({
          row: i + 1,
          externalKey,
          message: `Language requirement missing CEFR level; set to UNKNOWN. (${langs || "unknown language"})`,
        });
      }

      const existing = await PartnerSchool.findOne({ externalKey });

      const update: Record<string, unknown> = {
        externalKey,
        name: normalized.name,
        continent: normalized.continent,
        country: normalized.country,
        city: normalized.city,
        status: normalized.status,
        mobilityProgrammes: normalized.mobilityProgrammes,
        languageRequirements: normalized.languageRequirements,
        agreementScope: finalAgreementScope,
        degreeProgrammesInAgreement: normalized.degreeProgrammesInAgreement,
        furtherInfo: normalized.furtherInfo,
        sourceImportId: new mongoose.Types.ObjectId(importId),
      };

      const csvHasCoords = Boolean(normalized.coordinates);

      if (existing) {
        // Respect manual location
        if (existing.geocodePrecision === "manual") {
          // do not touch location
        } else if (csvHasCoords && normalized.coordinates) {
          update.location = {
            type: "Point",
            coordinates: [normalized.coordinates.lon, normalized.coordinates.lat],
          };
          update.geocodePrecision = "manual";
        } else {
          // geocode if missing
          if (!existing.location || existing.geocodePrecision === "none") {
            const geo = await geocodeCity(normalized.city, normalized.country);
            if (geo) {
              update.location = { type: "Point", coordinates: [geo.lon, geo.lat] };
              update.geocodePrecision = "city";
            } else {
              const fb = fallbackCoords(normalized.continent, normalized.country, normalized.city, normalized.name);
              update.location = { type: "Point", coordinates: [fb.lon, fb.lat] };
              update.geocodePrecision = "none";
            }
          }
        }

        const before = JSON.stringify({
          name: existing.name,
          continent: existing.continent,
          country: existing.country,
          city: existing.city,
          status: existing.status,
          mobilityProgrammes: existing.mobilityProgrammes,
          languageRequirements: existing.languageRequirements,
          agreementScope: existing.agreementScope,
          degreeProgrammesInAgreement: existing.degreeProgrammesInAgreement,
          furtherInfo: existing.furtherInfo,
        });

        await PartnerSchool.updateOne({ _id: existing._id }, { $set: update });

        const afterDoc = await PartnerSchool.findById(existing._id).lean();
        const after = JSON.stringify({
          name: afterDoc?.name,
          continent: afterDoc?.continent,
          country: afterDoc?.country,
          city: afterDoc?.city,
          status: afterDoc?.status,
          mobilityProgrammes: afterDoc?.mobilityProgrammes,
          languageRequirements: afterDoc?.languageRequirements,
          agreementScope: afterDoc?.agreementScope,
          degreeProgrammesInAgreement: afterDoc?.degreeProgrammesInAgreement,
          furtherInfo: afterDoc?.furtherInfo,
        });

        if (before === after) importDoc.summary.unchanged += 1;
        else importDoc.summary.updated += 1;
      } else {
        // Insert new
        if (csvHasCoords && normalized.coordinates) {
          update.location = {
            type: "Point",
            coordinates: [normalized.coordinates.lon, normalized.coordinates.lat],
          };
          update.geocodePrecision = "manual";
        } else {
          const geo = await geocodeCity(normalized.city, normalized.country);
          if (geo) {
            update.location = { type: "Point", coordinates: [geo.lon, geo.lat] };
            update.geocodePrecision = "city";
          } else {
            const fb = fallbackCoords(normalized.continent, normalized.country, normalized.city, normalized.name);
            update.location = { type: "Point", coordinates: [fb.lon, fb.lat] };
            update.geocodePrecision = "none";
          }
        }

        await PartnerSchool.create(update);
        importDoc.summary.inserted += 1;
      }
    }

    // Store a bounded amount of rowErrors to avoid huge docs
    const MAX_ROW_ERRORS = 200;
    if (rowErrors.length > 0) {
      importDoc.set(
        "rowErrors",
        rowErrors.slice(0, MAX_ROW_ERRORS).map((e) => ({
          row: e.row,
          externalKey: e.externalKey,
          message: e.message,
        }))
      );
    }

    const MAX_WARNINGS = 200;
    if (warnings.length > 0) {
      importDoc.set(
        "warnings",
        warnings.slice(0, MAX_WARNINGS).map((w) => ({
          row: w.row,
          externalKey: w.externalKey,
          message: w.message,
        }))
      );
    }

    importDoc.status = "succeeded";
    importDoc.finishedAt = new Date();
    await importDoc.save();
  } catch (err: unknown) {
    importDoc.status = "failed";
    importDoc.finishedAt = new Date();
    const e = err as { stack?: unknown; message?: unknown };
    importDoc.errorLog = String(e?.stack ?? e?.message ?? err);
    importDoc.summary.failedRows += rowErrors.length;

    const MAX_ROW_ERRORS = 200;
    if (rowErrors.length > 0) {
      importDoc.set(
        "rowErrors",
        rowErrors.slice(0, MAX_ROW_ERRORS).map((e) => ({
          row: e.row,
          externalKey: e.externalKey,
          message: e.message,
        }))
      );
    }

    const MAX_WARNINGS = 200;
    if (warnings.length > 0) {
      importDoc.set(
        "warnings",
        warnings.slice(0, MAX_WARNINGS).map((w) => ({
          row: w.row,
          externalKey: w.externalKey,
          message: w.message,
        }))
      );
    }

    await importDoc.save();

    throw err;
  }
}
