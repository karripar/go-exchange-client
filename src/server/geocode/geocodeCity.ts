import { GeocodeCache } from "../models/GeocodeCache";
import { sleep } from "../utils/sleep";

export type GeocodeResult = {
  lat: number;
  lon: number;
  provider: "nominatim";
  query: string;
  displayName?: string;
  raw?: unknown;
};

type Options = {
  name?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __nominatimRateLimit: { lastAt: number } | undefined;
}

const rateState = global.__nominatimRateLimit ?? { lastAt: 0 };
if (!global.__nominatimRateLimit) global.__nominatimRateLimit = rateState;

function clean(value?: string) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeCity(raw: string) {
  let v = clean(raw);
  if (!v) return "";

  // Common OCR/PDF copy artifacts.
  v = v.replace(/_/g, " ");
  // Merge broken words like "deve-nter" -> "deventer" (but keep genuine hyphenated names).
  v = v.replace(/\b([a-z]{2,4})-([a-z]{2,4})\b/gi, (_m, a: string, b: string) => `${a}${b}`);

  // Special-case known city spellings.
  const lower = v.toLowerCase();
  if (lower === "s-hertogen-bosch" || lower === "s-hertogenbosch") return "'s-Hertogenbosch";

  return v;
}

function cityVariants(rawCity: string): string[] {
  const base = normalizeCity(rawCity);
  if (!base) return [];

  const out: string[] = [base];

  // Split on common separators first.
  for (const part of base.split(/[;,/]+/g)) {
    const p = normalizeCity(part);
    if (p && p !== base) out.push(p);
  }

  const hyphenCount = (base.match(/-/g) ?? []).length;

  if (hyphenCount >= 1) {
    // If it looks like a multi-city list (lots of hyphens or very long), split and try parts/bigrams.
    if (hyphenCount >= 2 || base.length > 28) {
      const parts = base
        .split("-")
        .map((p) => normalizeCity(p))
        .filter((p) => p.length >= 3);

      for (const p of parts) out.push(p);
      for (let i = 0; i < parts.length - 1; i += 1) out.push(`${parts[i]} ${parts[i + 1]}`);
    } else {
      // Single hyphen: try each side and also hyphen->space/comma variants.
      const parts = base.split("-").map((p) => normalizeCity(p));
      if (parts.length === 2 && parts[0].length >= 4 && parts[1].length >= 4) {
        out.push(parts[0], parts[1]);
      }
      out.push(base.replace(/-/g, " "));
      out.push(base.replace(/-/g, ", "));
    }
  }

  // De-dupe + cap the explosion.
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const v of out) {
    const k = v.toLowerCase();
    if (!v || seen.has(k)) continue;
    seen.add(k);
    uniq.push(v);
    if (uniq.length >= 8) break;
  }
  return uniq;
}

async function geocodeViaNominatim(query: string): Promise<GeocodeResult | null> {
  const q = clean(query);
  if (!q) return null;

  const cached = await GeocodeCache.findOne({ query: q }).lean();
  if (cached) {
    if (!cached.ok || !cached.result?.lat || !cached.result?.lon) return null;
    const displayName = typeof cached.result.displayName === "string" ? cached.result.displayName : undefined;
    const raw = cached.result.raw ?? undefined;
    return {
      lat: cached.result.lat,
      lon: cached.result.lon,
      provider: "nominatim",
      query: q,
      displayName,
      raw,
    };
  }

  // Basic rate limiting to be polite with Nominatim.
  const minMs = Number(process.env.GEOCODE_RATE_LIMIT_MS ?? 1100);
  const now = Date.now();
  const wait = Math.max(0, minMs - (now - rateState.lastAt));
  if (wait > 0) await sleep(wait);

  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("limit", "1");
  endpoint.searchParams.set("q", q);

  const userAgent = process.env.GEOCODE_HTTP_USER_AGENT || "go-exchange-client (dev)";

  let ok = false;
  try {
    const res = await fetch(endpoint.toString(), {
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json",
      },
    });

    rateState.lastAt = Date.now();

    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const arr = (await res.json()) as any[];
    const first = Array.isArray(arr) ? arr[0] : null;
    const lat = Number(first?.lat);
    const lon = Number(first?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      await GeocodeCache.create({ query: q, provider: "nominatim", ok: false });
      return null;
    }

    ok = true;
    const displayName = typeof first?.display_name === "string" ? first.display_name : undefined;
    await GeocodeCache.create({
      query: q,
      provider: "nominatim",
      ok: true,
      result: { lat, lon, displayName, raw: first },
    });

    return { lat, lon, provider: "nominatim", query: q, displayName, raw: first };
  } catch {
    if (!ok) {
      // Cache failures too (avoid hammering).
      try {
        await GeocodeCache.create({ query: q, provider: "nominatim", ok: false });
      } catch {
        // ignore
      }
    }
    return null;
  }
}

// Geocode partner school location. Tries a more specific query first if name is provided.
export async function geocodeCity(city: string, country: string, options?: Options): Promise<GeocodeResult | null> {
  const co = clean(country);
  const name = clean(options?.name);

  const cities = cityVariants(city);
  if (!co || !cities.length) return null;

  for (const cityVariant of cities) {
    const queries: string[] = [];
    if (name) queries.push(`${name}, ${cityVariant}, ${co}`);
    queries.push(`${cityVariant}, ${co}`);

    for (const q of queries) {
      const res = await geocodeViaNominatim(q);
      if (res) return res;
    }
  }

  return null;
}
