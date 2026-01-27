"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "./popup.css";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  Map as MapLibreMap,
  Marker,
  StyleSpecification,
} from "maplibre-gl";
import Supercluster from "supercluster";

import Filters from "./components/Filters";
import SearchInput from "./components/SearchInput";
import SchoolDrawer from "./components/SchoolDrawer";

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

type SchoolProperties = {
  id: string;
  name: string;
  continent?: string;
  country?: string;
  city?: string;
  mobilityProgrammes?: string[];
  status?: string;
  languageRequirements?: LanguageRequirement[];
};

type PointFeature = GeoJSON.Feature<GeoJSON.Point, SchoolProperties>;

type ClusterProps = {
  cluster: true;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: number;
};

type ClusterFeature = GeoJSON.Feature<GeoJSON.Point, ClusterProps & Record<string, unknown>>;

type MapStyleId = "positron" | "dark-matter" | "satellite";

const STYLE_URLS: Record<Exclude<MapStyleId, "satellite">, string> = {
  positron: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  "dark-matter": "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: "EOX S2 Cloudless",
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg",
      ],
      tileSize: 256,
      attribution: "EOX / Sentinel-2 Cloudless",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#0b1020" } },
    { id: "satellite", type: "raster", source: "satellite" },
  ],
};

function normalizeString(value: string | undefined | null) {
  return (value ?? "").toLowerCase().trim();
}

function hashStringToUnit(value: string) {
  // FNV-1a 32-bit → [0,1)
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // unsigned
  const u = hash >>> 0;
  return u / 2 ** 32;
}

function continentBBox(continent?: string) {
  const c = normalizeString(continent);
  // Rough bounding boxes (lonMin, latMin, lonMax, latMax) for dev fallback coordinates
  if (c === "europe") return [-10, 36, 35, 70] as const;
  if (c === "asia") return [60, 5, 145, 55] as const;
  if (c === "africa") return [-20, -35, 55, 35] as const;
  if (c === "north america") return [-130, 15, -60, 60] as const;
  if (c === "south america") return [-80, -55, -35, 15] as const;
  if (c === "oceania" || c === "australia") return [110, -50, 180, 0] as const;
  return [-180, -60, 180, 80] as const;
}

function getSchoolLngLat(school: PartnerSchool): [number, number] {
  if (school.location?.coordinates?.length === 2) return school.location.coordinates;

  const [lonMin, latMin, lonMax, latMax] = continentBBox(school.continent);
  const seed = `${school.continent ?? ""}|${school.country ?? ""}|${school.city ?? ""}|${school.name ?? ""}`;
  const a = hashStringToUnit(seed);
  const b = hashStringToUnit(`${seed}::b`);

  const lon = lonMin + a * (lonMax - lonMin);
  const lat = latMin + b * (latMax - latMin);

  return [lon, lat];
}

function toGeoJson(items: PartnerSchool[]): GeoJSON.FeatureCollection<GeoJSON.Point, SchoolProperties> {
  const features: PointFeature[] = items.map((s) => {
    const [lon, lat] = getSchoolLngLat(s);
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
      properties: {
        id: s.id,
        name: s.name,
        continent: s.continent,
        country: s.country,
        city: s.city,
        mobilityProgrammes: s.mobilityProgrammes ?? [],
        status: s.status,
        languageRequirements: s.languageRequirements ?? [],
      },
    };
  });

  return { type: "FeatureCollection", features };
}

function markerSizeForZoom(z: number) {
  if (!Number.isFinite(z)) return 34;
  if (z >= 9) return 56;
  if (z >= 7) return 48;
  if (z >= 5) return 42;
  if (z >= 3) return 36;
  return 30;
}

const DEFAULT_FILTERS: FiltersState = {
  continent: "all",
  country: "all",
  mobilityProgrammes: [],
  language: "all",
  level: "all",
  status: "all",
};

export default function PartnerMapClient() {
  const [data, setData] = useState<PartnerSchool[]>([]);
  const [points, setPoints] = useState<PartnerSchoolPoint[]>([]);
  const [options, setOptions] = useState<{
    continents: string[];
    countries: string[];
    mobilityProgrammes: string[];
    languages: string[];
  } | null>(null);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<PartnerSchoolPreview | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);

  const [mapStyleId, setMapStyleId] = useState<MapStyleId>("positron");

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const [mapRevision, setMapRevision] = useState(0);

  const [zoom, setZoom] = useState<number>(1.5);
  const [clusters, setClusters] = useState<Array<PointFeature | ClusterFeature>>([]);

  const pointsAbortRef = useRef<AbortController | null>(null);

  const openPopup = useCallback((lngLat: [number, number], props: SchoolProperties) => {
    const map = mapRef.current;
    if (!map) return;

    popupRef.current?.remove();

    const root = document.createElement("div");
    root.className = "w-[260px] sm:w-[300px]";

    const header = document.createElement("div");
    header.className = "px-3 py-3 bg-white";

    const title = document.createElement("div");
    title.className = "va-popup-title text-sm text-[#FF5000]";
    title.textContent = props.name;

    const subtitle = document.createElement("div");
    subtitle.className = "mt-1 text-xs text-[var(--typography)]/70";
    const city = props.city?.trim();
    const country = props.country?.trim();
    subtitle.textContent = [city, country].filter(Boolean).join(" • ") || "—";

    header.appendChild(title);
    header.appendChild(subtitle);

    const actions = document.createElement("div");
    actions.className = "px-3 pb-3 bg-white";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "w-full rounded-lg bg-[#FF5000] text-white px-3 py-2 text-sm shadow-sm hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#FF5000]/40";
    btn.textContent = "Näytä tiedot";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      setSelectedSchoolId(props.id);
      popupRef.current?.remove();
      popupRef.current = null;
    });

    actions.appendChild(btn);
    root.appendChild(header);
    root.appendChild(actions);

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: true,
      offset: 16,
      className: "va-map-popup",
    })
      .setLngLat(lngLat)
      .setDOMContent(root)
      .addTo(map);

    popupRef.current = popup;
  }, []);

  const clusterIndex = useMemo(
    () => new Supercluster<SchoolProperties, ClusterProps>({ radius: 60, maxZoom: 14 }),
    []
  );

  const mapStyle = useMemo<string | StyleSpecification>(() => {
    if (mapStyleId === "satellite") return SATELLITE_STYLE;
    return STYLE_URLS[mapStyleId];
  }, [mapStyleId]);

  useEffect(() => {
    // Load filter options from API (backed by MongoDB). If DB isn't configured yet,
    // we'll fall back to empty lists and still let the map render.
    fetch("/api/partner-schools/options")
      .then(async (r) => {
        if (!r.ok) throw new Error("options fetch failed");
        const j = await r.json();
        setOptions(j);
      })
      .catch(() => setOptions({ continents: [], countries: [], mobilityProgrammes: [], languages: [] }));
  }, []);

  const filteredData = useMemo(() => {
    // For now, map points are server-filtered. We keep this only for the drawer and for
    // optional future client-side filtering.
    return data;
  }, [data]);

  const geojson = useMemo(() => {
    // Convert the thin points list to GeoJSON features for Supercluster.
    const features: PointFeature[] = points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: p.coordinates },
      properties: {
        id: p.id,
        name: p.name,
        country: p.country,
        city: p.city,
        status: p.status,
        mobilityProgrammes: [],
        languageRequirements: [],
      },
    }));
    return { type: "FeatureCollection", features };
  }, [points]);

  // Options for UI
  const uniqueContinents = options?.continents ?? [];

  const uniqueCountries = useMemo(() => {
    const all = options?.countries ?? [];
    // Country dropdown should depend on selected continent: server options are global,
    // so we just keep all for now. (Can add /options?continent= later.)
    return all;
  }, [options]);

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

  // Fetch school detail when selecting a marker
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

  // Build / update supercluster index
  useEffect(() => {
    clusterIndex.load(geojson.features as PointFeature[]);

    // Update clusters for current viewport if map exists
    const map = mapRef.current;
    if (!map) return;

    const bounds = map.getBounds();
    const z = map.getZoom();
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];
    const items = clusterIndex.getClusters(bbox, Math.round(z)) as Array<PointFeature | ClusterFeature>;
    setClusters(items);
  }, [clusterIndex, geojson]);

  const fetchPointsForViewport = async (bounds: maplibregl.LngLatBounds, z: number) => {
    pointsAbortRef.current?.abort();
    const ac = new AbortController();
    pointsAbortRef.current = ac;

    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
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
  };

  // Initialize MapLibre map (client-only). Style switches by recreating the map
  // (prop/state driven), avoiding ref.setStyle().
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const prevMap = mapRef.current;
    const prevCenter = prevMap?.getCenter();
    const prevZoom = prevMap?.getZoom();

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: prevCenter ? [prevCenter.lng, prevCenter.lat] : [10, 30],
      zoom: typeof prevZoom === "number" ? prevZoom : 1.5,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    mapRef.current = map;
    setMapRevision((r) => r + 1);

    const update = () => {
      const bounds = map.getBounds();
      const z = map.getZoom();
      setZoom(z);

      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];

      const items = clusterIndex.getClusters(bbox, Math.round(z)) as Array<PointFeature | ClusterFeature>;
      setClusters(items);

      // Fetch server points when zoom is high enough
      fetchPointsForViewport(bounds, z).catch(() => {
        setPoints([]);
      });
    };

    let timer: number | null = null;
    const debouncedUpdate = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(update, 100);
    };

    map.on("load", update);
    map.on("move", debouncedUpdate);
    map.on("zoom", debouncedUpdate);

    return () => {
      if (timer) window.clearTimeout(timer);
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [clusterIndex, mapStyle]);

  // Refetch points when filters/search change (using current viewport)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const z = map.getZoom();
    fetchPointsForViewport(bounds, z).catch(() => {
      setPoints([]);
    });
  }, [filters, searchTerm]);

  // Render markers from clusters (imperative to avoid heavy React layers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const addMarker = (marker: Marker) => {
      marker.addTo(map);
      markersRef.current.push(marker);
    };

    for (const feature of clusters) {
      const [lon, lat] = feature.geometry.coordinates;

      const propsRecord = (feature.properties ?? {}) as Record<string, unknown>;
      const isCluster = Boolean(propsRecord.cluster);

      if (isCluster) {
        const props = propsRecord;
        const count = Number(props.point_count ?? 0);
        const clusterId = Number(props.cluster_id ?? 0);

        const el = document.createElement("button");
        el.type = "button";
        el.className =
          "flex items-center justify-center rounded-full bg-[#FF5000] text-white shadow-lg border border-white/50";
        el.style.width = "36px";
        el.style.height = "36px";
        el.style.fontSize = "12px";
        el.textContent = count >= 1000 ? `${Math.round(count / 100) / 10}k` : String(count);

        el.addEventListener("click", (e) => {
          e.preventDefault();
          const expansionZoom = clusterIndex.getClusterExpansionZoom(clusterId);
          map.easeTo({ center: [lon, lat], zoom: expansionZoom, duration: 450 });
        });

        addMarker(new maplibregl.Marker({ element: el }).setLngLat([lon, lat]));
      } else {
        const props = feature.properties as SchoolProperties;

        const size = markerSizeForZoom(map.getZoom());

        const el = document.createElement("button");
        el.type = "button";
        el.className = "group relative";
        el.title = props.name;

        const img = document.createElement("img");
        img.src = "/images/liito-oravat/21032024_liito-orava_RGB_Metropolia_KV_JO-05.png";
        img.alt = "Partner school";
        img.width = size;
        img.height = size;
        img.style.width = `${size}px`;
        img.style.height = `${size}px`;
        img.style.objectFit = "contain";
        img.style.filter = "drop-shadow(0 3px 6px rgba(0,0,0,.35))";
        img.style.transformOrigin = "center";
        img.style.transition = "transform 120ms ease";

        el.addEventListener("mouseenter", () => {
          img.style.transform = "scale(1.08)";
        });
        el.addEventListener("mouseleave", () => {
          img.style.transform = "scale(1)";
        });

        el.appendChild(img);

        el.addEventListener("click", (e) => {
          e.preventDefault();
          popupRef.current?.remove();
          popupRef.current = null;
          setSelectedPreview({ id: props.id, name: props.name, country: props.country, city: props.city, status: props.status });
          setSelectedSchoolId(props.id);
        });

        addMarker(new maplibregl.Marker({ element: el }).setLngLat([lon, lat]));
      }
    }
  }, [clusters, clusterIndex, mapRevision, openPopup]);

  // Keep country filter valid when continent changes
  useEffect(() => {
    if (filters.country === "all") return;
    const stillExists = uniqueCountries.some((c) => normalizeString(c) === normalizeString(filters.country));
    if (!stillExists) setFilters((prev) => ({ ...prev, country: "all" }));
  }, [filters.country, uniqueCountries]);

  const handleFiltersChange = (patch: Partial<FiltersState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchTerm("");
    setSelectedSchoolId(null);
  };

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
                  onClick={() => setMapStyleId("positron")}
                  aria-pressed={mapStyleId === "positron"}
                  className={
                    "rounded-lg border px-3 py-2 text-left " +
                    (mapStyleId === "positron" ? "border-[#FF5000] bg-[#FF5000]/10" : "border-black/10 bg-white hover:bg-black/5")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm border border-black/10 bg-white" />
                    <div className="text-sm font-semibold">Light</div>
                  </div>
                  <div className="mt-1 text-xs text-[var(--typography)]/70">Clean (Positron)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setMapStyleId("dark-matter")}
                  aria-pressed={mapStyleId === "dark-matter"}
                  className={
                    "rounded-lg border px-3 py-2 text-left " +
                    (mapStyleId === "dark-matter" ? "border-[#FF5000] bg-[#FF5000]/10" : "border-black/10 bg-white hover:bg-black/5")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm border border-black/10 bg-[#111827]" />
                    <div className="text-sm font-semibold">Dark</div>
                  </div>
                  <div className="mt-1 text-xs text-[var(--typography)]/70">High contrast</div>
                </button>

                <button
                  type="button"
                  onClick={() => setMapStyleId("satellite")}
                  aria-pressed={mapStyleId === "satellite"}
                  className={
                    "rounded-lg border px-3 py-2 text-left " +
                    (mapStyleId === "satellite" ? "border-[#FF5000] bg-[#FF5000]/10" : "border-black/10 bg-white hover:bg-black/5")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-sm border border-black/10"
                      style={{ background: "linear-gradient(135deg,#0b1020,#2dd4bf)" }}
                    />
                    <div className="text-sm font-semibold">Satellite</div>
                  </div>
                  <div className="mt-1 text-xs text-[var(--typography)]/70">EOX S2 Cloudless</div>
                </button>
              </div>
            </div>

            <SearchInput value={searchTerm} onDebouncedChange={setSearchTerm} placeholder="Search name/country/city" />
          </div>
        </div>

        <div className="p-4 max-h-[60vh] lg:max-h-[calc(100vh-240px)] overflow-auto">
          <Filters
            data={data}
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
