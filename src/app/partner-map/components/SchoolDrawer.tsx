"use client";

import React, { useMemo } from "react";

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
  geocodePrecision?: "none" | "city" | "manual";
};

type Props = {
  schoolId: string | null;
  school: PartnerSchool | null;
  preview?: Partial<PartnerSchool> | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
};

function isValidUrl(value: string | undefined) {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export default function SchoolDrawer({ schoolId, school, preview, loading = false, error = null, onClose }: Props) {
  const links = useMemo(() => {
    if (!school?.links) return [];
    return Object.entries(school.links)
      .filter(([, url]) => isValidUrl(url))
      .map(([key, url]) => ({ key, url: url as string }));
  }, [school]);

  if (!schoolId) return null;

  const headerName = school?.name ?? preview?.name ?? "Partner school";
  const city = school?.city ?? preview?.city;
  const country = school?.country ?? preview?.country;
  const placeLabel = [city?.trim(), country?.trim()].filter(Boolean).join(" • ") || "—";
  const status = school?.status ?? preview?.status;
  const statusLabel =
    status === "confirmed" ? "Confirmed" : status === "negotiation" ? "Negotiation" : status ? String(status) : "—";

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-black/30 z-20 lg:hidden"
      />

      {/* Mobile bottom sheet */}
      <div className="fixed left-0 right-0 bottom-0 z-30 lg:hidden">
        <div className="mx-auto max-w-[900px] rounded-t-2xl bg-white shadow-2xl border border-black/10 overflow-hidden">
          <div className="p-4 border-b border-black/10 bg-white">
            <div>
              <div className="text-sm text-[#FF5000] tracking-wide" style={{ fontFamily: "var(--font-machina-bold)" }}>
                Partner school
              </div>
              <div className="mt-1 text-lg font-semibold leading-snug">{headerName}</div>
              <div className="mt-1 text-sm text-[var(--typography)]/70">{placeLabel}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill label={statusLabel} tone={status === "confirmed" ? "good" : status === "negotiation" ? "warn" : "neutral"} />
                {school?.geocodePrecision ? (
                  <Pill
                    label={
                      school.geocodePrecision === "manual" ? "Coordinates: manual" : school.geocodePrecision === "city" ? "Coordinates: city" : "Coordinates: none"
                    }
                    tone={school.geocodePrecision === "manual" ? "good" : school.geocodePrecision === "city" ? "neutral" : "warn"}
                  />
                ) : null}
              </div>
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--va-grey-50)] hover:bg-[var(--va-grey-100)] border border-black/10"
              >
                Sulje
              </button>
            </div>
          </div>

          <div className="p-4 max-h-[60vh] overflow-auto space-y-4">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="font-semibold text-red-900">Tietojen haku epäonnistui</div>
                <div className="mt-1 text-sm text-red-900/80">{error}</div>
              </div>
            ) : null}

            {loading && !school ? (
              <div className="rounded-lg border border-black/10 bg-[var(--va-grey-50)] p-3 text-sm text-[var(--typography)]/70">
                Haetaan lisätietoja…
              </div>
            ) : null}

            <Section label="Mobility programmes">
              {school?.mobilityProgrammes?.length ? (
                <div className="flex flex-wrap gap-2">
                  {school.mobilityProgrammes.map((p) => (
                    <span
                      key={p}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              ) : (
                "—"
              )}
            </Section>

            <Section label="Language requirements">
              {school?.languageRequirements?.length ? (
                <ul className="space-y-1">
                  {school.languageRequirements.map((r, idx) => (
                    <li key={idx} className="text-sm">
                      <span className="font-medium">{r.language}</span> {r.level}
                      {r.notes ? <span className="text-[var(--typography)]/70"> — {r.notes}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                "—"
              )}
            </Section>

            <Section label="Agreement scope">{school?.agreementScope ?? "—"}</Section>

            <Section label="Degree programmes in agreement">
              {school?.degreeProgrammesInAgreement?.length ? (
                <ul className="list-disc pl-4 space-y-1">
                  {school.degreeProgrammesInAgreement.map((p) => (
                    <li key={p} className="text-sm">
                      {p}
                    </li>
                  ))}
                </ul>
              ) : (
                "—"
              )}
            </Section>

            <Section label="Further info">{school?.furtherInfo ?? "—"}</Section>

            {links.length > 0 && (
              <Section label="Links">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {links.map((l) => (
                    <a
                      key={l.key}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5"
                    >
                      {l.key}
                    </a>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>

      {/* Desktop side drawer */}
      <div className="hidden lg:block absolute top-0 right-0 z-40 h-full w-[420px] bg-white border-l border-black/10 shadow-2xl">
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-black/10 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-[#FF5000] tracking-wide" style={{ fontFamily: "var(--font-machina-bold)" }}>
                  Partner school
                </div>
                <div className="mt-1 text-xl font-semibold leading-snug">{headerName}</div>
                <div className="mt-1 text-sm text-[var(--typography)]/70">{placeLabel}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Pill label={statusLabel} tone={status === "confirmed" ? "good" : status === "negotiation" ? "warn" : "neutral"} />
                  {school?.geocodePrecision ? (
                    <Pill
                      label={
                        school.geocodePrecision === "manual" ? "Coordinates: manual" : school.geocodePrecision === "city" ? "Coordinates: city" : "Coordinates: none"
                      }
                      tone={school.geocodePrecision === "manual" ? "good" : school.geocodePrecision === "city" ? "neutral" : "warn"}
                    />
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1 text-sm bg-[var(--va-grey-50)] hover:bg-[var(--va-grey-100)] border border-black/10"
              >
                Sulje
              </button>
            </div>
          </div>

          <div className="p-4 overflow-auto space-y-4">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="font-semibold text-red-900">Tietojen haku epäonnistui</div>
                <div className="mt-1 text-sm text-red-900/80">{error}</div>
              </div>
            ) : null}

            {loading && !school ? (
              <div className="rounded-lg border border-black/10 bg-[var(--va-grey-50)] p-3 text-sm text-[var(--typography)]/70">
                Haetaan lisätietoja…
              </div>
            ) : null}

            <Section label="Mobility programmes">
              {school?.mobilityProgrammes?.length ? (
                <div className="flex flex-wrap gap-2">
                  {school.mobilityProgrammes.map((p) => (
                    <span
                      key={p}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              ) : (
                "—"
              )}
            </Section>

            <Section label="Language requirements">
              {school?.languageRequirements?.length ? (
                <ul className="space-y-1">
                  {school.languageRequirements.map((r, idx) => (
                    <li key={idx} className="text-sm">
                      <span className="font-medium">{r.language}</span> {r.level}
                      {r.notes ? <span className="text-[var(--typography)]/70"> — {r.notes}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                "—"
              )}
            </Section>

            <Section label="Agreement scope">{school?.agreementScope ?? "—"}</Section>

            <Section label="Degree programmes in agreement">
              {school?.degreeProgrammesInAgreement?.length ? (
                <ul className="list-disc pl-4 space-y-1">
                  {school.degreeProgrammesInAgreement.map((p) => (
                    <li key={p} className="text-sm">
                      {p}
                    </li>
                  ))}
                </ul>
              ) : (
                "—"
              )}
            </Section>

            <Section label="Further info">{school?.furtherInfo ?? "—"}</Section>

            {links.length > 0 && (
              <Section label="Links">
                <div className="grid grid-cols-1 gap-2">
                  {links.map((l) => (
                    <a
                      key={l.key}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5"
                    >
                      {l.key}
                    </a>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Pill({ label, tone }: { label: string; tone: "good" | "warn" | "neutral" }) {
  const cls =
    tone === "good"
      ? "bg-green-100 text-green-900 border-green-200"
      : tone === "warn"
        ? "bg-amber-100 text-amber-900 border-amber-200"
        : "bg-[var(--va-grey-50)] text-[var(--typography)] border-black/10";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{label}</span>;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--typography)]/60 mb-1">{label}</div>
      <div className="text-sm text-[var(--typography)]">{children}</div>
    </div>
  );
}
