"use client";

import { useEffect, useState } from "react";

type Stats = {
  total: number;
  granularity: string;
  trend: { bucket: string; n: number }[];
  topRegions: { regionId: string; n: number }[];
  altersklasse: { altersklasse: string; n: number }[];
  franchise: { franchise: number; n: number }[];
  models: { model: string; n: number }[];
  accident: { accident: boolean; n: number }[];
};

const PRESETS = [
  { label: "Heute", days: 1 },
  { label: "7 Tage", days: 7 },
  { label: "30 Tage", days: 30 },
  { label: "3 Monate", days: 90 },
  { label: "Dieses Jahr", days: 365 },
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  useEffect(() => {
    const params = new URLSearchParams({ from: isoDate(from), to: isoDate(to) });
    fetch(`/api/admin/stats?${params}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <main className="max-w-[1100px] mx-auto my-7 px-5">
      <h1 className="sr-only">Admin-Dashboard — Anfrage-Aktivität</h1>

      <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-3 flex items-center gap-2 flex-wrap mb-5">
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mr-1">Zeitraum</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={days === p.days}
            onClick={() => setDays(p.days)}
            className={`px-3 py-1.5 rounded-full border text-sm ${
              days === p.days ? "bg-primary border-primary text-on-primary font-semibold" : "border-outline-variant text-on-surface-variant"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5 inline-block mb-5 min-w-[220px]">
        <div className="text-xs font-semibold text-outline uppercase tracking-wide">Anfragen im Zeitraum</div>
        <div className="text-4xl font-bold tracking-tight my-1 text-on-surface">{stats?.total ?? "–"}</div>
        <div className="text-xs text-outline">
          {isoDate(from)} – {isoDate(to)}
        </div>
      </div>

      <p className="text-sm text-outline">
        Weitere Panels (Trend-Chart, Top-Regionen, Altersklasse, Franchise, Modell, Unfalldeckung) folgen, sobald{" "}
        <code className="text-xs bg-surface-variant text-on-surface-variant px-1 py-0.5 rounded">POSTGRES_URL</code> konfiguriert und die
        Aggregations-Queries aus architecture.md §13.2 angebunden sind.
      </p>
    </main>
  );
}
