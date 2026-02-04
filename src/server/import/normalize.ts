import type { NormalizedPartnerRow, RawPartnerRow, LanguageRequirement } from "./types";

function clean(value?: string) {
  return (value ?? "").trim();
}

function normalizeStatus(statusText?: string): NormalizedPartnerRow["status"] {
  const s = clean(statusText).toLowerCase();
  if (s === "confirmed") return "confirmed";
  if (s === "negotiation") return "negotiation";
  if (s === "unknown") return "unknown";
  if (s.includes("confirm")) return "confirmed";
  if (s.includes("negoti")) return "negotiation";
  return "unknown";
}

function splitMobility(text?: string) {
  const t = clean(text);
  if (!t) return [];
  return t
    .split(/,|;|\//g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseLanguageText(text?: string): LanguageRequirement[] {
  const t = clean(text);
  if (!t) return [];

  const canonicalLanguageFromText = (value: string) => {
    const v = value.toLowerCase();
    const mapping: Array<[RegExp, string]> = [
      [/\benglish\b/i, "English"],
      [/\bswedish\b/i, "Swedish"],
      [/\bfinnish\b/i, "Finnish"],
      [/\bgerman\b/i, "German"],
      [/\bfrench\b/i, "French"],
      [/\bspanish\b/i, "Spanish"],
      [/\bitalian\b/i, "Italian"],
      [/\bdutch\b/i, "Dutch"],
      [/\bnorwegian\b/i, "Norwegian"],
      [/\bdanish\b/i, "Danish"],
    ];
    for (const [re, canonical] of mapping) {
      if (re.test(v)) return canonical;
    }
    return null;
  };

  // Examples:
  // - "English B2"
  // - "Studies in Swedish: B2"
  // - "Swedish: B2"
  const colon = t.match(/^(.*?)\s*:\s*(A2|B1|B2|C1|C2)\b/i);
  if (colon) {
    const notes = colon[1].trim();
    const level = colon[2].toUpperCase();

    // Try to extract language from notes (e.g. "Studies in Swedish")
    const inLang = notes.match(/\bin\s+([A-Za-zÅÄÖåäö\s()./-]+)$/i);
    const language = (inLang?.[1] ?? notes).trim();
    return [{ language, level, notes }].filter((x) => x.language);
  }

  const spaced = t.match(/([A-Za-zÅÄÖåäö\s()\/.-]+)\s+(A2|B1|B2|C1|C2)\b/i);
  if (spaced) {
    const language = spaced[1].trim();
    const level = spaced[2].toUpperCase();
    return [{ language, level }];
  }

  // Handle cases like: "English course grade min. 3 (B2)" or "... B2 ..."
  const anyLevel = t.match(/\b(A2|B1|B2|C1|C2)\b/i);
  if (anyLevel) {
    const level = anyLevel[1].toUpperCase();

    const inLang = t.match(/\bstudies\s+in\s+([A-Za-zÅÄÖåäö\s()./-]+)\b/i);
    const languageFromStudiesIn = inLang?.[1]?.trim();
    const languageFromCommon = canonicalLanguageFromText(t);
    const language = (languageFromStudiesIn || languageFromCommon || "").trim();

    return [{
      language: language || t,
      level,
      notes: t,
    }].filter((x) => x.language);
  }

  // No explicit CEFR level found; keep the language text but use a safe placeholder level.
  return [{ language: t, level: "UNKNOWN" }].filter((x) => x.language);
}

function splitDegreeProgrammes(text?: string) {
  const t = clean(text);
  if (!t) return [];
  return t
    .split(/\n|,|;|\//g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseCoord(value?: string) {
  const t = clean(value);
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

export function normalizeRow(row: RawPartnerRow): NormalizedPartnerRow | null {
  const externalKey = clean(row.externalKey) || undefined;
  const continent = clean(row.continentSection);
  const country = clean(row.country);
  const name = clean(row.institutionName);
  const city = clean(row.city);

  if (!name || !country) return null;

  const lat = parseCoord(row.latText);
  const lon = parseCoord(row.lonText);

  return {
    externalKey,
    name,
    continent: continent || "Unknown",
    country,
    city,
    status: normalizeStatus(row.statusText),
    mobilityProgrammes: splitMobility(row.mobilityProgrammeText),
    languageRequirements: parseLanguageText(row.languageText),
    agreementScope: clean(row.agreementScopeText) || undefined,
    degreeProgrammesInAgreement: splitDegreeProgrammes(row.degreeProgrammeText),
    furtherInfo: clean(row.furtherInfoText) || undefined,
    coordinates:
      typeof lat === "number" && typeof lon === "number"
        ? { lat, lon }
        : undefined,
  };
}
