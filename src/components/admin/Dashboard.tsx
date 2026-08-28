// src/components/admin/Dashboard.tsx
// Owns range state, fetches /api/admin/stats, keeps the URL bookmarkable
// (architecture.md §13.3, REQ-22). Panel layout/copy matches
// mockups/admin.html exactly.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { RangePicker } from "./RangePicker";
import { TrendChart } from "./TrendChart";
import { BreakdownBar } from "./BreakdownBar";
import { formatRangeLabel, type PresetKey } from "@/lib/adminRanges";
import { formatCount } from "@/lib/format";
import type { Granularity } from "@/lib/adminStats";
import insurersData from "@/data/insurers.json";
import { PREMIUM_BANDS } from "@/lib/premiumBand";
import { AGE_BANDS } from "@/lib/ageband";

type Stats = {
  total: number;
  granularity: Granularity;
  trend: { bucket: string; n: number }[];
  topRegions: { regionId: string; n: number }[];
  altersklasse: { altersklasse: string; n: number }[];
  franchise: { franchise: number; n: number }[];
  models: { model: string; n: number }[];
  accident: { accident: boolean; n: number }[];
  languages: { locale: string; n: number }[];
  currentInsurers: { insurerCode: string; n: number }[];
  premiumBands: { band: string; n: number }[];
  ageBands: { band: string; n: number }[];
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`stats fetch failed: ${res.status}`);
  return res.json();
};

const ALTERSKLASSE_LABEL: Record<string, string> = {
  erwachsen: "Erwachsen (26+)",
  jung: "Jung (19–25)",
  kind: "Kind (0–18)",
};

const MODEL_LABEL: Record<string, string> = {
  standard: "Standard",
  hausarzt: "Hausarzt",
  hmo: "HMO",
  telmed: "Telmed",
  andere: "Andere",
};

const LOCALE_LABEL: Record<string, string> = {
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  en: "English",
  pt: "Português",
  es: "Español",
  unbekannt: "Unbekannt",
};

const INSURER_NAME: Record<string, string> = Object.fromEntries(
  insurersData.map((i) => [i.insurerCode, i.insurerName]),
);

const PREMIUM_BAND_LABEL: Record<string, string> = {
  "<250": "CHF <250",
  "250-349": "CHF 250–349",
  "350-449": "CHF 350–449",
  "450-549": "CHF 450–549",
  "550+": "CHF 550+",
};

function orderedBandRows(rows: { band: string; n: number }[]): { label: string; value: number }[] {
  const byBand = new Map(rows.map((r) => [r.band, r.n]));
  return PREMIUM_BANDS.filter((b) => byBand.has(b)).map((b) => ({
    label: PREMIUM_BAND_LABEL[b] ?? b,
    value: byBand.get(b) ?? 0,
  }));
}

const AGE_BAND_LABEL: Record<string, string> = {
  "0-18": "0–18",
  "19-25": "19–25",
  "26-35": "26–35",
  "36-45": "36–45",
  "46-55": "46–55",
  "56-65": "56–65",
  "66-75": "66–75",
  "76+": "76+",
};

function orderedAgeBandRows(rows: { band: string; n: number }[]): { label: string; value: number }[] {
  const byBand = new Map(rows.map((r) => [r.band, r.n]));
  return AGE_BANDS.filter((b) => byBand.has(b)).map((b) => ({
    label: AGE_BAND_LABEL[b] ?? b,
    value: byBand.get(b) ?? 0,
  }));
}

type Range = { from: string; to: string; preset: PresetKey | null };

export function Dashboard({
  initialFrom,
  initialTo,
  initialPreset,
}: {
  initialFrom: string;
  initialTo: string;
  initialPreset: PresetKey | null;
}) {
  const router = useRouter();
  const [range, setRange] = useState<Range>({ from: initialFrom, to: initialTo, preset: initialPreset });

  useEffect(() => {
    router.replace(`/admin?from=${range.from}&to=${range.to}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const { data: stats, error, isValidating } = useSWR<Stats>(
    `/api/admin/stats?from=${range.from}&to=${range.to}`,
    fetcher,
    { keepPreviousData: true },
  );

  const showSkeleton = isValidating;

  return (
    <main className="max-w-[1100px] mx-auto my-7 px-5">
      <h1 className="sr-only">Admin-Dashboard — Anfrage-Aktivität</h1>

      <RangePicker from={range.from} to={range.to} activePreset={range.preset} onChange={setRange} />

      {error ? (
        <p className="text-error">Fehler beim Laden der Statistik.</p>
      ) : (
        <div className={showSkeleton ? "animate-pulse" : undefined}>
          <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5 inline-block mb-5 min-w-[220px]">
            <div className="text-xs font-semibold text-outline uppercase tracking-wide">Anfragen im Zeitraum</div>
            <div className="text-4xl font-bold tracking-tight my-1 text-on-surface">
              {stats ? formatCount(stats.total) : "–"}
            </div>
            <div className="text-xs text-outline">{formatRangeLabel(range.from, range.to)}</div>
          </div>

          <TrendChart data={stats?.trend ?? []} granularity={stats?.granularity ?? "day"} />

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5">
              <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
                Top 10 Prämienregionen
              </h2>
              <BreakdownBar
                rows={(stats?.topRegions ?? []).map((r) => ({ label: r.regionId, value: r.n }))}
                total={stats?.total}
              />
            </div>
            <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5">
              <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">Altersklasse</h2>
              <BreakdownBar
                rows={(stats?.altersklasse ?? []).map((r) => ({
                  label: ALTERSKLASSE_LABEL[r.altersklasse] ?? r.altersklasse,
                  value: r.n,
                }))}
              />
              <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mt-6 mb-4">
                Unfalldeckung
              </h2>
              <BreakdownBar
                rows={(stats?.accident ?? []).map((r) => ({
                  label: r.accident ? "Eingeschlossen" : "Ausgeschlossen",
                  value: r.n,
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5">
              <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
                Franchise-Verteilung
              </h2>
              <BreakdownBar
                labelWidth="short"
                rows={(stats?.franchise ?? []).map((r) => ({ label: `CHF ${r.franchise}`, value: r.n }))}
              />
            </div>
            <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5">
              <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
                Versicherungsmodell
              </h2>
              <BreakdownBar
                labelWidth="short"
                rows={(stats?.models ?? []).map((r) => ({ label: MODEL_LABEL[r.model] ?? r.model, value: r.n }))}
              />
            </div>
          </div>

          <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5 mt-4">
            <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
              Altersverteilung
            </h2>
            <BreakdownBar labelWidth="short" rows={orderedAgeBandRows(stats?.ageBands ?? [])} />
          </div>

          <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5 mt-4">
            <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
              Anfragen pro Sprache
            </h2>
            <BreakdownBar
              rows={(stats?.languages ?? []).map((r) => ({
                label: LOCALE_LABEL[r.locale] ?? r.locale,
                value: r.n,
              }))}
              total={stats?.total}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5">
              <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-1">
                Aktuelle Krankenkasse
              </h2>
              <p className="text-body-small text-outline mb-4">
                nur Anfragen mit angegebener aktueller Krankenkasse
              </p>
              <BreakdownBar
                rows={(stats?.currentInsurers ?? []).map((r) => ({
                  label: INSURER_NAME[r.insurerCode] ?? r.insurerCode,
                  value: r.n,
                }))}
              />
            </div>
            <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5">
              <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-1">
                Aktuelle Prämie
              </h2>
              <p className="text-body-small text-outline mb-4">
                nur Anfragen mit angegebener aktueller Prämie
              </p>
              <BreakdownBar labelWidth="short" rows={orderedBandRows(stats?.premiumBands ?? [])} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
