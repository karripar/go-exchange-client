"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { importLibrary, setOptions as setGoogleMapsOptions } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";

import Filters from "@/app/partner-map/components/Filters";
import SearchInput from "@/app/partner-map/components/SearchInput";
import SchoolDrawer from "@/app/partner-map/components/SchoolDrawer";

type LanguageRequirement = {
  language: string;
  level: string;
  notes?: string;
};

type PartnerSchool = {
  id: string;
  name: string;
  continent?: string;
  country?: string;
  city?: string;
  mobilityProgrammes?: string[];
  languageRequirements?: LanguageRequirement[];
  status?: string;
  agreementScope?: string;
  degreeProgrammesInAgreement?: string[];
  furtherInfo?: string;
  links?: Record<string, string | undefined>;
  location?: { type: "Point"; coordinates: [number, number] };
  geocodePrecision?: "none" | "city" | "manual";
};

type PartnerSchoolPoint = {
  id: string;
  name: string;
  country?: string;
  city?: string;
  status?: string;
  coordinates: [number, number];
};

type PartnerSchoolPreview = {
  id: string;
  name: string;
  country?: string;
  city?: string;
  status?: string;
};

type FiltersState = {
  continent: string;
  country: string;
  mobilityProgrammes: string[];
  language: string;
  level: string;
  status: "all" | "confirmed" | "negotiation";
};

type MapStyleId = "light" | "dark" | "satellite";

type RotationMode = "auto" | "off";

const WOW_MIN_ZOOM = 17;

const DEFAULT_FILTERS: FiltersState = {
  continent: "all",
  country: "all",
  mobilityProgrammes: [],
  language: "all",
  level: "all",
  status: "all",
};

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0b1020" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1020" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0b1020" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
];

function markerSizeForZoom(z: number) {
  if (!Number.isFinite(z)) return 34;
  if (z >= 9) return 56;
  if (z >= 7) return 48;
  if (z >= 5) return 42;
  if (z >= 3) return 36;
  return 30;
}

export default function PartnerMapGoogleClient() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  const [options, setOptions] = useState<{
    continents: string[];
    countries: string[];
    mobilityProgrammes: string[];
    languages: string[];
  } | null>(null);

  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [points, setPoints] = useState<PartnerSchoolPoint[]>([]);
  const [data, setData] = useState<PartnerSchool[]>([]);

  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<PartnerSchoolPreview | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);

  const [mapStyleId, setMapStyleId] = useState<MapStyleId>("light");
  const [zoom, setZoom] = useState<number>(2);

  // Demo effect: auto-enable 45° tilt + rotation when zoomed in enough.
  // Requirement: only Light style uses auto rotation; Satellite stays non-rotating.
  const [rotationMode, setRotationMode] = useState<RotationMode>("auto");

  // Make it explicit: rotation can only be enabled on Light.
  useEffect(() => {
    if (mapStyleId !== "light" && rotationMode !== "off") setRotationMode("off");
  }, [mapStyleId, rotationMode]);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const loadedRef = useRef(false);
  const presentationRef = useRef<{ usesMapId: boolean } | null>(null);
  const lastViewRef = useRef<{ center: google.maps.LatLngLiteral; zoom: number } | null>(null);
  const wowActiveRef = useRef(false);

  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);

  const pointsAbortRef = useRef<AbortController | null>(null);

  const uniqueContinents = options?.continents ?? [];
  const uniqueCountries = options?.countries ?? [];
  const uniqueMobility = options?.mobilityProgrammes ?? [];
  const uniqueLanguages = options?.languages ?? [];

  const selectedSchool = useMemo(() => {
    if (!selectedSchoolId) return null;
    return data.find((s) => s.id === selectedSchoolId) ?? null;
  }, [data, selectedSchoolId]);

  const selectedPointPreview = useMemo<PartnerSchoolPreview | null>(() => {
    if (!selectedSchoolId) return null;
    const p = points.find((x) => x.id === selectedSchoolId);
    return p ? { id: p.id, name: p.name, country: p.country, city: p.city, status: p.status } : null;
  }, [points, selectedSchoolId]);

  const computeWowActive = useCallback((wowEnabled: boolean, style: MapStyleId) => {
    const map = mapRef.current;
    if (!map) return false;
    const z = map.getZoom() ?? 0;
    if (!wowEnabled) return false;
    if (rotationMode !== "auto") return false;
    if (style !== "light") return false;
    return z >= WOW_MIN_ZOOM;
  }, [rotationMode]);

  const applyPresentationToMap = useCallback(
    (style: MapStyleId, wowEnabled: boolean) => {
      const map = mapRef.current;
      if (!map) return;

      const wowActive = computeWowActive(wowEnabled, style);
      const wasActive = wowActiveRef.current;
      wowActiveRef.current = wowActive;

      if (!wowActive) {
        // Normal mode: keep 0/0 baseline
        map.setHeading(0);
        map.setTilt(0);
        map.setOptions({ rotateControl: false });
      } else {
        // Wow mode: enable rotation + tilt when supported.
        // NOTE: 45° imagery typically only works for satellite/hybrid at high zoom.
        map.setOptions({ rotateControl: true });
        if (!wasActive) {
          map.setHeading(0);
        }
        map.setTilt(45);
      }

      // Base map type per style.
      if (style === "satellite") {
        // Keep satellite strictly satellite (no auto hybrid/rotation on this style).
        map.setHeading(0);
        map.setTilt(0);
        map.setOptions({ mapTypeId: google.maps.MapTypeId.SATELLITE, styles: null, rotateControl: false });
        return;
      }

      if (style === "dark") {
        map.setOptions({ mapTypeId: google.maps.MapTypeId.ROADMAP, styles: DARK_STYLE });
        return;
      }

      map.setOptions({ mapTypeId: google.maps.MapTypeId.ROADMAP, styles: null });
    },
    [computeWowActive]
  );

  const fetchPointsForViewport = useCallback(
    async () => {
      const map = mapRef.current;
      if (!map) return;
      const bounds = map.getBounds();
      if (!bounds) return;

      pointsAbortRef.current?.abort();
      const ac = new AbortController();
      pointsAbortRef.current = ac;

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const bbox = `${sw.lng()},${sw.lat()},${ne.lng()},${ne.lat()}`;

      const z = map.getZoom() ?? 0;
      const params = new URLSearchParams({ bbox, zoom: String(z) });
      if (filters.continent !== "all") params.set("continent", filters.continent);
      if (filters.country !== "all") params.set("country", filters.country);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.mobilityProgrammes.length) params.set("mobility", filters.mobilityProgrammes.join(","));
      if (filters.language !== "all") params.set("lang", filters.language);
      if (filters.level !== "all") params.set("level", filters.level);
      if (searchTerm.trim()) params.set("q", searchTerm.trim());

      const res = await fetch(`/api/partner-schools/points?${params.toString()}`, { signal: ac.signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "points fetch failed");
      setPoints(json.items as PartnerSchoolPoint[]);
    },
    [filters, searchTerm]
  );

  const recreateMap = useCallback(
    (opts: { usesMapId: boolean; style: MapStyleId; wow: boolean }) => {
      const container = mapContainerRef.current;
      if (!container) return;

      // Best-effort cleanup
      try {
        clustererRef.current?.clearMarkers();
        clustererRef.current = null;
      } catch {
        // ignore
      }

      try {
        for (const m of markersRef.current) m.setMap(null);
        markersRef.current = [];
      } catch {
        // ignore
      }

      const prev = mapRef.current;
      if (prev) {
        try {
          google.maps.event.clearInstanceListeners(prev);
        } catch {
          // ignore
        }
      }
      mapRef.current = null;
      presentationRef.current = null;

      // Capture last view (fallback to current)
      const view =
        lastViewRef.current ??
        (prev
          ? {
              center: { lat: prev.getCenter()?.lat() ?? 30, lng: prev.getCenter()?.lng() ?? 10 },
              zoom: prev.getZoom() ?? 2,
            }
          : { center: { lat: 30, lng: 10 }, zoom: 2 });

      // Force a fresh map instance in the same container
      container.innerHTML = "";

      wowActiveRef.current = false;

      const map = new google.maps.Map(container, {
        center: view.center,
        zoom: view.zoom,
        mapTypeControl: false,
        streetViewControl: true,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: "greedy",
        mapId: opts.usesMapId ? mapId || undefined : undefined,
        mapTypeId: opts.style === "satellite" ? google.maps.MapTypeId.SATELLITE : google.maps.MapTypeId.ROADMAP,
        styles: !opts.wow && opts.style === "dark" ? DARK_STYLE : null,
        rotateControl: false,
        heading: 0,
        tilt: 0,
      });

      mapRef.current = map;
      presentationRef.current = { usesMapId: opts.usesMapId };

      // Enforce "rotation off" so it can't re-enable via internal state or gestures.
      const enforcingRef = { current: false };
      const enforceIfNeeded = () => {
        if (enforcingRef.current) return;
        const shouldBeActive = computeWowActive(opts.wow, opts.style);
        if (shouldBeActive) return;

        const tilt = map.getTilt() ?? 0;
        const heading = map.getHeading() ?? 0;
        if (tilt === 0 && heading === 0) return;

        enforcingRef.current = true;
        map.setHeading(0);
        map.setTilt(0);
        map.setOptions({ rotateControl: false });
        setTimeout(() => {
          enforcingRef.current = false;
        }, 0);
      };

      const tiltListener = map.addListener("tilt_changed", enforceIfNeeded);
      const headingListener = map.addListener("heading_changed", enforceIfNeeded);

      const idleListener = map.addListener("idle", () => {
        const c = map.getCenter();
        const z = map.getZoom() ?? 2;
        if (c) lastViewRef.current = { center: { lat: c.lat(), lng: c.lng() }, zoom: z };
        setZoom(z);
        fetchPointsForViewport().catch(() => setPoints([]));
      });

      // Ensure presentation is enforced (some options apply lazily)
      applyPresentationToMap(opts.style, opts.wow);

      // initial fetch
      fetchPointsForViewport().catch(() => setPoints([]));

      return () => {
        google.maps.event.removeListener(idleListener);
        google.maps.event.removeListener(tiltListener);
        google.maps.event.removeListener(headingListener);
      };
    },
    [applyPresentationToMap, computeWowActive, fetchPointsForViewport, mapId]
  );

  // Load filter options (Mongo-backed)
  useEffect(() => {
    fetch("/api/partner-schools/options")
      .then(async (r) => {
        if (!r.ok) throw new Error("options fetch failed");
        const j = await r.json();
        setOptions(j);
      })
      .catch(() => setOptions({ continents: [], countries: [], mobilityProgrammes: [], languages: [] }));
  }, []);

  // Initialize Google Map
  useEffect(() => {
    if (!apiKey) return;
    if (!mapContainerRef.current) return;

    let canceled = false;

    const init = async () => {
      if (loadedRef.current) {
        return;
      }

      // Configure the Maps JS API loader (must run before importing any libraries)
      setGoogleMapsOptions({
        key: apiKey,
        v: "weekly",
        ...(mapId ? { mapIds: [mapId] } : {}),
      });

      await importLibrary("maps");
      loadedRef.current = true;

      if (canceled) return;

      // Initial map instance
      const usesMapId = Boolean(mapId) && mapStyleId !== "dark";
      recreateMap({ usesMapId, style: mapStyleId, wow: true });
    };

    init().catch(() => {
      // ignore here; UI will show message
    });

    return () => {
      canceled = true;
    };
  }, [apiKey, mapId, mapStyleId, recreateMap]);

  // Apply style / wow when toggled.
  // Dark styled roadmap is ignored when a Map ID is used, so we recreate the map without mapId for dark.
  useEffect(() => {
    const hasMapId = Boolean(mapId);
    const wantsMapId = hasMapId && mapStyleId !== "dark";
    const current = presentationRef.current;

    // If we haven't created the map yet, init effect will handle it.
    if (!mapRef.current) return;

    if (!current || current.usesMapId !== wantsMapId) {
      recreateMap({ usesMapId: wantsMapId, style: mapStyleId, wow: true });
      return;
    }

    applyPresentationToMap(mapStyleId, true);
  }, [applyPresentationToMap, mapId, mapStyleId, recreateMap]);

  // Auto wow-mode depends on zoom threshold; apply when zoom changes.
  useEffect(() => {
    if (!mapRef.current) return;
    applyPresentationToMap(mapStyleId, true);
  }, [applyPresentationToMap, mapStyleId, zoom, rotationMode]);

  // Re-fetch when filters/search changes
  useEffect(() => {
    if (!mapRef.current) return;
    fetchPointsForViewport().catch(() => setPoints([]));
  }, [filters, searchTerm, fetchPointsForViewport]);

  // Render markers + clustering
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous
    clustererRef.current?.clearMarkers();
    clustererRef.current = null;

    for (const m of markersRef.current) {
      m.setMap(null);
    }
    markersRef.current = [];

    const z = map.getZoom() ?? 0;
    const size = markerSizeForZoom(z);

    const markers = points.map((p) => {
      const marker = new google.maps.Marker({
        position: { lat: p.coordinates[1], lng: p.coordinates[0] },
        title: p.name,
        icon: {
          url: "/images/liito-oravat/21032024_liito-orava_RGB_Metropolia_KV_JO-05.png",
          scaledSize: new google.maps.Size(size, size),
        },
        optimized: true,
      });

      marker.addListener("click", () => {
        setSelectedPreview({ id: p.id, name: p.name, country: p.country, city: p.city, status: p.status });
        setSelectedSchoolId(p.id);
      });

      return marker;
    });

    markersRef.current = markers;

    clustererRef.current = new MarkerClusterer({
      map,
      markers,
    });
  }, [points]);

  // Fetch school detail when selecting
  useEffect(() => {
    if (!selectedSchoolId) return;
    setSelectedLoading(true);
    setSelectedError(null);

    fetch(`/api/partner-schools/${selectedSchoolId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("detail fetch failed");
        const j = (await r.json()) as PartnerSchool;
        setData((prev) => {
          const exists = prev.some((x) => x.id === j.id);
          if (exists) return prev.map((x) => (x.id === j.id ? j : x));
          return [...prev, j];
        });
        setSelectedLoading(false);
      })
      .catch((e) => {
        setSelectedLoading(false);
        setSelectedError(String(e?.message ?? e ?? "Detail fetch failed"));
      });
  }, [selectedSchoolId]);

  const handleFiltersChange = (patch: Partial<FiltersState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchTerm("");
    setSelectedSchoolId(null);
  };

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="text-lg font-semibold">Google Maps demo</div>
        <div className="mt-1 text-sm text-[var(--typography)]/70">
          Missing <span className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</span> in your env.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      <section className="rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-black/10">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-[var(--typography)]/70">
              <div>
                <span className="font-semibold">Näkyvissä:</span> {points.length}
              </div>
              <div>
                <span className="font-semibold">Zoom:</span> {zoom.toFixed(2)}
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full px-3 py-1 text-sm bg-[var(--va-grey-50)] hover:bg-[var(--va-grey-100)] border border-black/10"
            >
              Reset
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--typography)]/70 mb-2">Map style</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMapStyleId("light")}
                  aria-pressed={mapStyleId === "light"}
                  className={
                    "rounded-lg border px-3 py-2 text-left " +
                    (mapStyleId === "light"
                      ? "border-[#FF5000] bg-[#FF5000]/10"
                      : "border-black/10 bg-white hover:bg-black/5")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm border border-black/10 bg-white" />
                    <div className="text-sm font-semibold">Light</div>
                  </div>
                  <div className="mt-1 text-xs text-[var(--typography)]/70">Google Roadmap</div>
                </button>

                <button
                  type="button"
                  onClick={() => setMapStyleId("dark")}
                  aria-pressed={mapStyleId === "dark"}
                  className={
                    "rounded-lg border px-3 py-2 text-left " +
                    (mapStyleId === "dark"
                      ? "border-[#FF5000] bg-[#FF5000]/10"
                      : "border-black/10 bg-white hover:bg-black/5")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm border border-black/10 bg-[#111827]" />
                    <div className="text-sm font-semibold">Dark</div>
                  </div>
                  <div className="mt-1 text-xs text-[var(--typography)]/70">Styled Roadmap</div>
                </button>

                <button
                  type="button"
                  onClick={() => setMapStyleId("satellite")}
                  aria-pressed={mapStyleId === "satellite"}
                  className={
                    "rounded-lg border px-3 py-2 text-left " +
                    (mapStyleId === "satellite"
                      ? "border-[#FF5000] bg-[#FF5000]/10"
                      : "border-black/10 bg-white hover:bg-black/5")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-sm border border-black/10"
                      style={{ background: "linear-gradient(135deg,#0b1020,#2dd4bf)" }}
                    />
                    <div className="text-sm font-semibold">Satellite</div>
                  </div>
                  <div className="mt-1 text-xs text-[var(--typography)]/70">Google Satellite</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--typography)]/70 mb-2">Rotation</label>
              <button
                type="button"
                onClick={() => setRotationMode((m) => (m === "auto" ? "off" : "auto"))}
                aria-pressed={rotationMode === "auto"}
                disabled={mapStyleId !== "light"}
                className={
                  "w-full rounded-lg border px-3 py-2 text-left " +
                  (mapStyleId !== "light"
                    ? "border-black/10 bg-black/5 opacity-60 cursor-not-allowed"
                    : rotationMode === "auto"
                      ? "border-[#FF5000] bg-[#FF5000]/10"
                      : "border-black/10 bg-white hover:bg-black/5")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{rotationMode === "auto" ? "Auto" : "Off"}</div>
                    <div className="mt-1 text-xs text-[var(--typography)]/70">
                      Auto enables 3D tilt + rotation at zoom ≥ {WOW_MIN_ZOOM}.
                    </div>
                  </div>
                  <div
                    className={
                      "h-5 w-9 rounded-full border border-black/10 p-0.5 transition-colors " +
                      (rotationMode === "auto" ? "bg-[#FF5000]/30" : "bg-black/10")
                    }
                  >
                    <div
                      className={
                        "h-4 w-4 rounded-full bg-white shadow transition-transform " +
                        (rotationMode === "auto" ? "translate-x-4" : "translate-x-0")
                      }
                    />
                  </div>
                </div>
              </button>
            </div>

            <SearchInput value={searchTerm} onDebouncedChange={setSearchTerm} placeholder="Search name/country/city" />
          </div>
        </div>

        <div className="p-4 max-h-[60vh] lg:max-h-[calc(100vh-240px)] overflow-auto">
          <Filters
            data={[]}
            filters={filters}
            uniqueContinents={uniqueContinents}
            uniqueCountries={uniqueCountries}
            uniqueMobility={uniqueMobility}
            uniqueLanguages={uniqueLanguages}
            onChange={handleFiltersChange}
          />
        </div>
      </section>

      <section className="relative rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden">
        <div ref={mapContainerRef} className="h-[60vh] min-h-[420px] lg:h-[calc(100vh-220px)] lg:min-h-[520px] w-full" />

        <SchoolDrawer
          schoolId={selectedSchoolId}
          school={selectedSchool}
          preview={selectedSchool ?? selectedPreview ?? selectedPointPreview}
          loading={selectedLoading && !selectedSchool}
          error={selectedError}
          onClose={() => {
            setSelectedSchoolId(null);
            setSelectedPreview(null);
            setSelectedLoading(false);
            setSelectedError(null);
          }}
        />
      </section>
    </div>
  );
}
