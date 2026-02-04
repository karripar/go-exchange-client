import PartnerMapShell from "./PartnerMapShell";

export default function PartnerMapPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl text-[#FF5000] tracking-wide"
            style={{ fontFamily: "var(--font-machina-bold)" }}
          >
            Partner schools map
          </h1>
          <p className="text-sm text-[var(--typography)]/70">
            MapLibre + clustering. Data comes from MongoDB via /api/partner-schools/* (only schools with coordinates are shown).
          </p>
        </div>
      </div>

      <PartnerMapShell />
    </div>
  );
}
