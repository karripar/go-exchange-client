import { GeocodeCache } from "../models/GeocodeCache";
import { sleep } from "../utils/sleep";

export type GoogleGeocodeResult = {
  lat: number;
  lon: number;
  provider: "google";
  query: string;
  displayName?: string;
  raw?: unknown;
};

declare global {
  // eslint-disable-next-line no-var
  var __googleGeocodeRateLimit: { lastAt: number } | undefined;
}

const rateState = global.__googleGeocodeRateLimit ?? { lastAt: 0 };
if (!global.__googleGeocodeRateLimit) global.__googleGeocodeRateLimit = rateState;

function clean(value?: string) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export async function geocodeViaGoogle(query: string): Promise<GoogleGeocodeResult | null> {
  const q = clean(query);
  if (!q) return null;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const cached = await GeocodeCache.findOne({ query: q, provider: "google" }).lean();
  if (cached) {
    if (!cached.ok || !cached.result?.lat || !cached.result?.lon) return null;
    const displayName = typeof cached.result.displayName === "string" ? cached.result.displayName : undefined;
    const raw = cached.result.raw ?? undefined;
    return {
      lat: cached.result.lat,
      lon: cached.result.lon,
      provider: "google",
      query: q,
      displayName,
      raw,
    };
  }

  // Basic rate limiting (mainly to avoid accidental burst usage/cost)
  const minMs = Number(process.env.GEOCODE_GOOGLE_RATE_LIMIT_MS ?? 200);
  const now = Date.now();
  const wait = Math.max(0, minMs - (now - rateState.lastAt));
  if (wait > 0) await sleep(wait);

  const endpoint = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  endpoint.searchParams.set("address", q);
  endpoint.searchParams.set("key", apiKey);

  let ok = false;
  try {
    const res = await fetch(endpoint.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    rateState.lastAt = Date.now();

    if (!res.ok) throw new Error(`Google Geocoding HTTP ${res.status}`);
    const json = (await res.json()) as unknown;
    const obj = json && typeof json === "object" ? (json as Record<string, unknown>) : {};

    const status = String(obj.status ?? "");
    if (status !== "OK") {
      await GeocodeCache.create({ query: q, provider: "google", ok: false, result: { raw: json } });
      return null;
    }

    const results = Array.isArray(obj.results) ? obj.results : [];
    const first = results[0];
    const firstObj = first && typeof first === "object" ? (first as Record<string, unknown>) : null;
    const geometry = firstObj?.geometry;
    const geometryObj = geometry && typeof geometry === "object" ? (geometry as Record<string, unknown>) : null;
    const location = geometryObj?.location;
    const locationObj = location && typeof location === "object" ? (location as Record<string, unknown>) : null;
    const lat = Number(locationObj?.lat);
    const lon = Number(locationObj?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      await GeocodeCache.create({ query: q, provider: "google", ok: false, result: { raw: json } });
      return null;
    }

    ok = true;
    const displayName =
      typeof firstObj?.formatted_address === "string" ? String(firstObj.formatted_address) : undefined;

    await GeocodeCache.create({
      query: q,
      provider: "google",
      ok: true,
      result: { lat, lon, displayName, raw: json },
    });

    return { lat, lon, provider: "google", query: q, displayName, raw: json };
  } catch {
    if (!ok) {
      try {
        await GeocodeCache.create({ query: q, provider: "google", ok: false });
      } catch {
        // ignore
      }
    }
    return null;
  }
}
