import type { RawPartnerRow } from "./types";
import fs from "node:fs/promises";
import { parse as parseCsv } from "csv-parse/sync";

/**
 * CSV parser (header-based).
 *
 * We keep the function name for now to minimize refactors.
 * The uploaded file path is expected to point to a .csv.
 */
export async function parsePartnerPdfToRows(_pdfPath: string): Promise<RawPartnerRow[]> {
  const csvText = await fs.readFile(_pdfPath, "utf-8");

  const records = parseCsv(csvText, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
    relax_column_count: true,
  }) as Array<Record<string, string>>;

  const normKey = (k: string) => k.toLowerCase().replace(/\s+/g, "").replace(/[_-]/g, "");
  const get = (row: Record<string, string>, keys: string[]) => {
    const map = new Map(Object.keys(row).map((k) => [normKey(k), row[k]]));
    for (const key of keys) {
      const v = map.get(normKey(key));
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  };

  return records.map((r) => {
    const externalKey = get(r, ["externalKey", "external_key", "key"]);
    const continent = get(r, ["continent", "continentSection", "region", "area"]);
    const country = get(r, ["country", "countryName", "destinationCountry"]);
    const name = get(r, [
      "partnerInstitution",
      "name",
      "institution",
      "institutionName",
      "school",
      "partner",
      "partnerSchool",
    ]);
    const city = get(r, ["city", "town", "locationCity"]);

    const mobility = get(r, [
      "mobilityProgramme",
      "mobilityProgrammes",
      "mobility",
      "programme",
      "programmes",
    ]);
    const language = get(r, [
      "languageRequirements",
      "languageRequirement",
      "language",
      "languages",
    ]);
    const status = get(r, ["status", "agreementStatus"]);
    const agreementScope = get(r, ["agreementAppliesTo", "agreementScope", "scope"]);
    const degree = get(r, [
      "degreeProgrammesInAgreement",
      "degreeProgramme",
      "degreeProgrammes",
      "degrees",
    ]);
    const furtherInfo = get(r, ["furtherInfo", "info", "notes", "comment"]);
    const latText = get(r, ["lat", "latitude"]);
    const lonText = get(r, ["lon", "lng", "longitude"]);

    return {
      externalKey,
      continentSection: continent,
      country,
      institutionName: name,
      city,
      mobilityProgrammeText: mobility,
      languageText: language,
      agreementScopeText: agreementScope,
      degreeProgrammeText: degree,
      furtherInfoText: furtherInfo,
      statusText: status,
      latText,
      lonText,
    } satisfies RawPartnerRow;
  });
}
