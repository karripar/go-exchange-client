"use client";

import React from "react";

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
  mobilityProgramme?: string[];
  languageRequirements?: LanguageRequirement[];
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

type Props = {
  data: PartnerSchool[];
  filters: FiltersState;
  uniqueContinents: string[];
  uniqueCountries: string[];
  uniqueMobility: string[];
  uniqueLanguages: string[];
  onChange: (patch: Partial<FiltersState>) => void;
};

const MOBILITY_GROUPS = [
  { key: "Erasmus", label: "Erasmus" },
  { key: "Nordplus", label: "Nordplus" },
  { key: "Bilateral agreements", label: "Bilateral agreements" },
  { key: "Other exchange destinations", label: "Other exchange destinations" },
] as const;

function toggleInArray(list: string[], value: string) {
  if (list.includes(value)) return list.filter((x) => x !== value);
  return [...list, value];
}

export default function Filters({
  filters,
  uniqueContinents,
  uniqueCountries,
  uniqueMobility: _uniqueMobility,
  uniqueLanguages: _uniqueLanguages,
  onChange,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[var(--typography)]/70 mb-1">Continent</label>
          <select
            value={filters.continent}
            onChange={(e) => onChange({ continent: e.target.value, country: "all" })}
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="all">All</option>
            {uniqueContinents.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--typography)]/70 mb-1">Country</label>
          <select
            value={filters.country}
            onChange={(e) => onChange({ country: e.target.value })}
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="all">All</option>
            {uniqueCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--typography)]/70 mb-2">Status</label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "all" as const, label: "All" },
                { key: "confirmed" as const, label: "Confirmed" },
                { key: "negotiation" as const, label: "Negotiation" },
              ] as const
            ).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onChange({ status: s.key })}
                className={
                  "rounded-full border px-3 py-1 text-sm " +
                  (filters.status === s.key
                    ? "border-[#FF5000] bg-[#FF5000]/10 text-[var(--typography)]"
                    : "border-black/10 bg-white text-[var(--typography)]/80 hover:bg-black/5")
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-[var(--typography)]/70">Programme type</label>
          {filters.mobilityProgrammes.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ mobilityProgrammes: [] })}
              className="text-xs text-[#FF5000] hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="mt-2 space-y-2">
          {MOBILITY_GROUPS.map((p) => (
            <label key={p.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.mobilityProgrammes.includes(p.key)}
                onChange={() =>
                  onChange({ mobilityProgrammes: toggleInArray(filters.mobilityProgrammes, p.key) })
                }
              />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-[var(--typography)]/60">
          Detailed programme info is shown when you open a marker.
        </div>
      </div>

      <div className="rounded-lg bg-[var(--va-grey-50)] border border-black/10 p-3 text-xs text-[var(--typography)]/70">
        Tip: click a marker to open details.
      </div>
    </div>
  );
}
