"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type ImportStatus = {
  _id: string;
  originalFileName: string;
  fileUrl: string;
  fileHash: string;
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  summary?: { inserted: number; updated: number; unchanged: number; failedRows: number };
  errorLog?: string;
  rowErrors?: Array<{ row: number; externalKey?: string; message: string }>;
  warnings?: Array<{ row: number; externalKey?: string; message: string }>;
};

type GeocodeJobStatus = {
  _id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  requestedLimit?: number;
  summary?: { totalCandidates: number; processed: number; updated: number; skipped: number; failed: number };
  errorLog?: string;
  rowErrors?: Array<{ schoolId?: string; externalKey?: string; message: string }>;
};

type GeocodeErrorGroup = {
  key: "missing_city" | "missing_country" | "missing_city_and_country" | "no_geocode" | "other";
  label: string;
  count: number;
  items: Array<{ schoolId?: string; externalKey?: string; message: string }>;
};

export default function PartnerImportAdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [showAllRowErrors, setShowAllRowErrors] = useState(false);
  const timerRef = useRef<number | null>(null);

  const [geocodeJobId, setGeocodeJobId] = useState<string | null>(null);
  const [geocodeStatus, setGeocodeStatus] = useState<GeocodeJobStatus | null>(null);
  const [geocodeBusy, setGeocodeBusy] = useState(false);
  const geocodeTimerRef = useRef<number | null>(null);
  const [geocodeLimit, setGeocodeLimit] = useState<number>(250);

  const geocodeFixGroups = useMemo<GeocodeErrorGroup[]>(() => {
    const items = geocodeStatus?.rowErrors ?? [];
    if (!items.length) return [];

    const groups = new Map<GeocodeErrorGroup["key"], GeocodeErrorGroup>();
    const ensure = (key: GeocodeErrorGroup["key"], label: string) => {
      if (!groups.has(key)) groups.set(key, { key, label, count: 0, items: [] });
      return groups.get(key)!;
    };

    const classify = (m: string): GeocodeErrorGroup["key"] => {
      const msg = (m ?? "").toLowerCase();
      if (msg.includes("skipped:") && msg.includes("missing city and country")) return "missing_city_and_country";
      if (msg.includes("skipped:") && msg.includes("missing city")) return "missing_city";
      if (msg.includes("skipped:") && msg.includes("missing country")) return "missing_country";
      if (msg.includes("no geocode result")) return "no_geocode";
      return "other";
    };

    for (const it of items) {
      const key = classify(it.message);
      const group =
        key === "missing_city"
          ? ensure(key, "Puuttuva kaupunki")
          : key === "missing_country"
            ? ensure(key, "Puuttuva maa")
            : key === "missing_city_and_country"
              ? ensure(key, "Puuttuva kaupunki ja maa")
              : key === "no_geocode"
                ? ensure(key, "Ei löydy geokoodista")
                : ensure(key, "Muu");
      group.count += 1;
      group.items.push(it);
    }

    const order: Record<GeocodeErrorGroup["key"], number> = {
      missing_city_and_country: 1,
      missing_city: 2,
      missing_country: 3,
      no_geocode: 4,
      other: 5,
    };

    return Array.from(groups.values()).sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99));
  }, [geocodeStatus?.rowErrors]);

  const canUpload = useMemo(() => Boolean(file) && !busy, [file, busy]);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/admin/partner-schools/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Upload failed");

      setImportId(json.importId);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!importId) return;

    const poll = async () => {
      const res = await fetch(`/api/admin/partner-schools/import/${importId}`);
      const json = (await res.json()) as ImportStatus;
      if (res.ok) setStatus(json);
    };

    poll();
    timerRef.current = window.setInterval(poll, 1200);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [importId]);

  useEffect(() => {
    if (!status) return;
    if (status.status === "running" || status.status === "queued") return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, [status]);

  const warningSummary = useMemo(() => summarizeMessages(status?.warnings), [status?.warnings]);
  const rowErrorSummary = useMemo(() => summarizeMessages(status?.rowErrors), [status?.rowErrors]);

  useEffect(() => {
    setShowAllWarnings(false);
    setShowAllRowErrors(false);
  }, [importId]);

  const startGeocoding = async () => {
    setGeocodeBusy(true);
    try {
      const safeLimit = Number.isFinite(geocodeLimit) && geocodeLimit > 0 ? Math.floor(geocodeLimit) : 250;
      const res = await fetch(`/api/admin/partner-schools/geocode?limit=${encodeURIComponent(String(safeLimit))}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Geocoding start failed");
      setGeocodeJobId(String(json.jobId));
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(String(e));
    } finally {
      setGeocodeBusy(false);
    }
  };

  useEffect(() => {
    // Poll latest geocode job on page load
    const pollLatest = async () => {
      const res = await fetch("/api/admin/partner-schools/geocode");
      const json = await res.json();
      const job = json?.job as GeocodeJobStatus | null;
      if (res.ok && job?._id) {
        setGeocodeJobId(job._id);
        setGeocodeStatus(job);
      }
    };
    pollLatest().catch(() => null);
  }, []);

  useEffect(() => {
    if (!geocodeJobId) return;

    const poll = async () => {
      const res = await fetch(`/api/admin/partner-schools/geocode/${geocodeJobId}`);
      const json = (await res.json()) as GeocodeJobStatus;
      if (res.ok) setGeocodeStatus(json);
    };

    poll();
    geocodeTimerRef.current = window.setInterval(poll, 1500);

    return () => {
      if (geocodeTimerRef.current) window.clearInterval(geocodeTimerRef.current);
      geocodeTimerRef.current = null;
    };
  }, [geocodeJobId]);

  useEffect(() => {
    if (!geocodeStatus) return;
    if (geocodeStatus.status === "running" || geocodeStatus.status === "queued") return;
    if (geocodeTimerRef.current) window.clearInterval(geocodeTimerRef.current);
    geocodeTimerRef.current = null;
  }, [geocodeStatus]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl sm:text-3xl text-[#FF5000] tracking-wide" style={{ fontFamily: "var(--font-machina-bold)" }}>
        Partner schools import (dev)
      </h1>
      <p className="mt-2 text-sm text-[var(--typography)]/70">
        Upload a CSV file to import / update partner schools for the map.
      </p>

      <div className="mt-6 rounded-xl border border-black/10 bg-white p-4 shadow-sm space-y-4">
        <input
          type="file"
          accept="text/csv,.csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canUpload}
            onClick={upload}
            className="rounded-lg bg-[#FF5000] text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Upload & start import"}
          </button>

          {importId && (
            <div className="text-sm text-[var(--typography)]/70">
              Import ID: <span className="font-mono">{importId}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Geokoodaus</div>
            <div className="mt-1 text-sm text-[var(--typography)]/70">
              Täyttää puuttuvat koordinaatit (kaupunkitaso) ja päivittää kartalle oikeat sijainnit.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--typography)]/70">
              Limit
              <input
                type="number"
                min={1}
                step={1}
                value={geocodeLimit}
                onChange={(e) => setGeocodeLimit(Number(e.target.value))}
                className="ml-2 w-24 rounded-md border border-black/10 bg-white px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={startGeocoding}
              disabled={geocodeBusy || (geocodeStatus?.status === "running" || geocodeStatus?.status === "queued")}
              className="rounded-lg bg-[#FF5000] text-white px-4 py-2 text-sm disabled:opacity-50"
            >
              {geocodeBusy ? "Käynnistetään…" : "Geokoodaa"}
            </button>
          </div>
        </div>

        {geocodeStatus && (
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Status</span>
              <StatusPill status={geocodeStatus.status} />
              <span className="text-xs text-[var(--typography)]/70">
                (Job: <span className="font-mono">{geocodeStatus._id}</span>)
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <Stat label="Candidates" value={geocodeStatus.summary?.totalCandidates ?? 0} />
              <Stat label="Processed" value={geocodeStatus.summary?.processed ?? 0} />
              <Stat label="Updated" value={geocodeStatus.summary?.updated ?? 0} />
              <Stat label="Skipped" value={geocodeStatus.summary?.skipped ?? 0} />
              <Stat label="Failed" value={geocodeStatus.summary?.failed ?? 0} />
            </div>

            {geocodeFixGroups.length ? (
              <div className="mt-4 rounded-lg border border-black/10 bg-[var(--va-grey-50)] p-3">
                <div className="font-semibold">Korjattavat rivit</div>
                <div className="mt-1 text-sm text-[var(--typography)]/70">
                  Korjaa CSV:ään puuttuvat kentät (kaupunki/maa) tai korjaa virheellinen kaupunki–maa-pari.
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {geocodeFixGroups.map((g) => (
                    <span
                      key={g.key}
                      className="rounded-full border border-black/10 bg-white px-2 py-1 text-xs text-[var(--typography)]/70"
                    >
                      {g.label}: {g.count}
                    </span>
                  ))}
                </div>

                <div className="mt-3 space-y-2">
                  {geocodeFixGroups
                    .filter((g) => g.key !== "other")
                    .slice(0, 3)
                    .map((g) => (
                      <div key={g.key} className="rounded-lg border border-black/10 bg-white p-2">
                        <div className="text-sm font-semibold">{g.label}</div>
                        <div className="mt-1 space-y-1">
                          {g.items.slice(0, 5).map((it, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="text-[var(--typography)]/70">
                                {it.externalKey ? <span className="font-mono">{it.externalKey}</span> : null}
                                {it.externalKey ? <span className="mx-2">•</span> : null}
                                {it.schoolId ? <span className="font-mono">{it.schoolId}</span> : null}
                              </span>
                              <span className="ml-2">{it.message}</span>
                            </div>
                          ))}
                          {g.items.length > 5 ? (
                            <div className="text-xs text-[var(--typography)]/70">(+{g.items.length - 5} lisää)</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            {geocodeStatus.status === "failed" ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="font-semibold text-red-900">Geokoodaus epäonnistui</div>
                <div className="mt-1 text-sm text-red-900/80">
                  {firstLine(geocodeStatus.errorLog) || "Tekninen virhe (katso Lisätiedot)."}
                </div>
              </div>
            ) : null}

            {geocodeStatus.rowErrors?.length ? (
              <div className="mt-4">
                <div className="font-semibold">Virheet</div>
                <div className="mt-2 space-y-2">
                  {geocodeStatus.rowErrors.slice(0, 10).map((e, idx) => (
                    <div key={idx} className="text-sm rounded-lg border border-black/10 p-2 bg-white">
                      <div className="text-[var(--typography)]/70">
                        {e.externalKey ? <span className="font-mono">{e.externalKey}</span> : null}
                        {e.externalKey ? <span className="mx-2">•</span> : null}
                        {e.schoolId ? <span className="font-mono">{e.schoolId}</span> : null}
                      </div>
                      <div>{e.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {(geocodeStatus.errorLog || geocodeStatus.rowErrors?.length) && (
              <details className="mt-4 rounded-lg border border-black/10 bg-white">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold">
                  Lisätiedot (tekninen)
                </summary>
                <div className="px-3 pb-3 space-y-3">
                  {geocodeStatus.errorLog ? (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--typography)]/60 mb-2">
                        errorLog
                      </div>
                      <pre className="whitespace-pre-wrap text-xs bg-black/5 p-3 rounded-lg border border-black/10">
                        {geocodeStatus.errorLog}
                      </pre>
                    </div>
                  ) : null}

                  {geocodeStatus.rowErrors?.length ? (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--typography)]/60 mb-2">
                        rowErrors (raw)
                      </div>
                      <pre className="whitespace-pre-wrap text-xs bg-black/5 p-3 rounded-lg border border-black/10">
                        {JSON.stringify(geocodeStatus.rowErrors, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {status && (
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Status</span>
                <StatusPill status={status.status} />
              </div>
              <div className="text-sm text-[var(--typography)]/70">File: {status.originalFileName}</div>
            </div>
            <a
              href={status.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[#FF5000] hover:underline"
            >
              Open uploaded file
            </a>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="Inserted" value={status.summary?.inserted ?? 0} />
            <Stat label="Updated" value={status.summary?.updated ?? 0} />
            <Stat label="Unchanged" value={status.summary?.unchanged ?? 0} />
            <Stat label="Failed" value={status.summary?.failedRows ?? 0} />
          </div>

          {status.status === "failed" ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="font-semibold text-red-900">Import epäonnistui</div>
              <div className="mt-1 text-sm text-red-900/80">
                {firstLine(status.errorLog) || "Tekninen virhe (katso Lisätiedot)."}
              </div>
              <div className="mt-2 text-xs text-red-900/70">
                Vinkki: usein kyse on CSV-datasta (puuttuvat kentät) tai validoinnista.
              </div>
            </div>
          ) : null}

          {status.rowErrors?.length ? (
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Virheet</div>
                  <div className="text-xs text-[var(--typography)]/70">
                    {status.rowErrors.length} riviä epäonnistui (näytetään {showAllRowErrors ? "kaikki" : "ensin 10"}).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllRowErrors((v) => !v)}
                  className="text-sm text-[#FF5000] hover:underline"
                >
                  {showAllRowErrors ? "Näytä vähemmän" : "Näytä kaikki"}
                </button>
              </div>

              {rowErrorSummary.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {rowErrorSummary.map((g) => (
                    <span
                      key={g.label}
                      className="rounded-full border border-black/10 bg-white px-2 py-1 text-xs text-[var(--typography)]/70"
                    >
                      {g.label}: {g.count}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 space-y-2">
                {(showAllRowErrors ? status.rowErrors : status.rowErrors.slice(0, 10)).map((e, idx) => (
                  <div key={idx} className="text-sm rounded-lg border border-black/10 p-2 bg-white">
                    <div className="text-[var(--typography)]/70">
                      Rivi {e.row}{e.externalKey ? <span className="ml-2 font-mono">{e.externalKey}</span> : null}
                    </div>
                    <div>{e.message}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {status.warnings?.length ? (
            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Huomiot</div>
                  <div className="text-xs text-[var(--typography)]/70">
                    {status.warnings.length} huomioita (näytetään {showAllWarnings ? "kaikki" : "ensin 10"}).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllWarnings((v) => !v)}
                  className="text-sm text-[#FF5000] hover:underline"
                >
                  {showAllWarnings ? "Näytä vähemmän" : "Näytä kaikki"}
                </button>
              </div>

              {warningSummary.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {warningSummary.map((g) => (
                    <span
                      key={g.label}
                      className="rounded-full border border-black/10 bg-[var(--va-grey-50)] px-2 py-1 text-xs text-[var(--typography)]/70"
                    >
                      {g.label}: {g.count}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 space-y-2">
                {(showAllWarnings ? status.warnings : status.warnings.slice(0, 10)).map((w, idx) => (
                  <div key={idx} className="text-sm rounded-lg border border-black/10 p-2 bg-[var(--va-grey-50)]">
                    <div className="text-[var(--typography)]/70">
                      Rivi {w.row}{w.externalKey ? <span className="ml-2 font-mono">{w.externalKey}</span> : null}
                    </div>
                    <div>{w.message}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {(status.errorLog || status.rowErrors?.length || status.warnings?.length) && (
            <details className="mt-6 rounded-lg border border-black/10 bg-white">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold">
                Lisätiedot (tekninen)
                <span className="ml-2 text-xs font-normal text-[var(--typography)]/70">
                  (dev / ylläpito)
                </span>
              </summary>
              <div className="px-3 pb-3 space-y-3">
                {status.errorLog ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--typography)]/60 mb-2">
                      errorLog
                    </div>
                    <pre className="whitespace-pre-wrap text-xs bg-black/5 p-3 rounded-lg border border-black/10">
                      {status.errorLog}
                    </pre>
                  </div>
                ) : null}

                {status.rowErrors?.length ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--typography)]/60 mb-2">
                      rowErrors (raw)
                    </div>
                    <pre className="whitespace-pre-wrap text-xs bg-black/5 p-3 rounded-lg border border-black/10">
                      {JSON.stringify(status.rowErrors, null, 2)}
                    </pre>
                  </div>
                ) : null}

                {status.warnings?.length ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--typography)]/60 mb-2">
                      warnings (raw)
                    </div>
                    <pre className="whitespace-pre-wrap text-xs bg-black/5 p-3 rounded-lg border border-black/10">
                      {JSON.stringify(status.warnings, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </div>
            </details>
          )}
        </div>
      )}

      <div className="mt-6 text-sm text-[var(--typography)]/70">
        Tip: after a successful import, try the map at <a className="text-[#FF5000] hover:underline" href="/partner-map">/partner-map</a>.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-[var(--va-grey-50)] p-3">
      <div className="text-xs text-[var(--typography)]/60">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: ImportStatus["status"] }) {
  const cls =
    status === "succeeded"
      ? "bg-green-100 text-green-900 border-green-200"
      : status === "failed"
        ? "bg-red-100 text-red-900 border-red-200"
        : status === "running"
          ? "bg-blue-100 text-blue-900 border-blue-200"
          : "bg-[var(--va-grey-50)] text-[var(--typography)] border-black/10";
  const label =
    status === "succeeded"
      ? "Onnistui"
      : status === "failed"
        ? "Epäonnistui"
        : status === "running"
          ? "Käynnissä"
          : "Jonossa";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{label}</span>;
}

function firstLine(value?: string) {
  if (!value) return "";
  const line = value.split("\n").find((l) => l.trim());
  return (line ?? "").trim();
}

function summarizeMessages(items?: Array<{ message: string }>) {
  if (!items?.length) return [] as Array<{ label: string; count: number }>;

  const labelFor = (message: string) => {
    if (message.startsWith("Soft fix:")) return "Korjaus (soft fix)";
    if (message.toLowerCase().includes("missing cefr level") || message.toLowerCase().includes("set to unknown"))
      return "Kielitaso puuttui";
    return "Muu";
  };

  const map = new Map<string, number>();
  for (const it of items) {
    const label = labelFor(it.message ?? "");
    map.set(label, (map.get(label) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}
