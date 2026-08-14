"use client";

import type { CurrentPlan } from "@/lib/types";

type Insurer = { insurerCode: string; insurerName: string };

type Props = {
  insurers: Insurer[];
  value: Partial<CurrentPlan>;
  onChange: (value: Partial<CurrentPlan>) => void;
};

export function CurrentPlanSection({ insurers, value, onChange }: Props) {
  return (
    <details className="mt-5 pt-4 border-t border-surface-variant">
      <summary className="flex items-center gap-2 cursor-pointer select-none text-title-medium text-primary list-none [&::-webkit-details-marker]:hidden before:content-['▸'] before:text-xs [details[open]_&]:before:content-['▾']">
        Was zahlst du heute?{" "}
        <span className="font-normal text-on-surface-variant">&nbsp;(optional — zeigt deine Ersparnis)</span>
      </summary>
      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="current-insurer" className="block text-label-large text-on-surface-variant mb-1.5">
            Aktuelle Kasse
          </label>
          <select
            id="current-insurer"
            value={value.insurerCode ?? ""}
            onChange={(e) => onChange({ ...value, insurerCode: e.target.value })}
            className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary"
          >
            <option value="">–</option>
            {insurers.map((i) => (
              <option key={i.insurerCode} value={i.insurerCode}>
                {i.insurerName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="current-premium" className="block text-label-large text-on-surface-variant mb-1.5">
            Monatliche Prämie
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-on-surface-variant pointer-events-none">
              CHF
            </span>
            <input
              id="current-premium"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.05"
              placeholder="z.B. 350"
              value={value.monthlyPremium ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                onChange({ ...value, monthlyPremium: raw === "" ? undefined : Number(raw) });
              }}
              className="w-full h-10 pl-11 pr-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>
    </details>
  );
}
