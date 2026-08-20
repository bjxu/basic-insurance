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

type Stats = {
  total: number;
  granularity: Granularity;
  trend: { bucket: string; n: number }[];
  topRegions: { regionId: string; n: number }[];
  altersklasse: { altersklasse: string; n: number }[];
  franchise: { franchise: number; n: number }[];
  models: { model: string; n: number }[];
  accident: { accident: boolean; n: number }[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

  const { data: stats, isValidating } = useSWR<Stats>(
    `/api/admin/stats?from=${range.from}&to=${range.to}`,
    fetcher,
    { keepPreviousData: true },
  );

  const showSkeleton = isValidating;

  return (
    <main className="max-w-[1100px] mx-auto my-7 px-5">
      <h1 className="sr-only">Admin-Dashboard — Anfrage-Aktivität</h1>

      <RangePicker from={range.from} to={range.to} activePreset={range.preset} onChange={setRange} />

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
      </div>
    </main>
  );
}
