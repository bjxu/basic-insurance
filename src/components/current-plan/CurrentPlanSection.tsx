"use client";

import type { CurrentPlan } from "@/lib/types";
import type { Tarifart } from "@/lib/types";

type Insurer = { insurerCode: string; insurerName: string };

type ProductOption = { tarifCode: string; productName: string };

type Props = {
  insurers: Insurer[];
  franchiseTiers: number[];
  value: Partial<CurrentPlan>;
  onChange: (value: Partial<CurrentPlan>) => void;
  productOptions: ProductOption[] | null;
};

const MODELS: Tarifart[] = ["standard", "hausarzt", "telmed", "hmo", "andere"];

export function CurrentPlanSection({ insurers, franchiseTiers, value, onChange, productOptions }: Props) {
  return (
    <details className="mt-5 pt-4 border-t border-gray-100">
      <summary className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-blue-600 list-none [&::-webkit-details-marker]:hidden before:content-['▸'] before:text-xs [details[open]_&]:before:content-['▾']">
        Was zahlst du heute?{" "}
        <span className="font-normal text-gray-500">&nbsp;(optional — zeigt deine Ersparnis)</span>
      </summary>
      <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label htmlFor="current-insurer" className="block text-sm font-semibold text-gray-600 mb-1.5">
            Aktuelle Kasse
          </label>
          <select
            id="current-insurer"
            value={value.insurerCode ?? ""}
            onChange={(e) => onChange({ ...value, insurerCode: e.target.value, tarifCode: undefined })}
            className="w-full h-10 px-3 rounded-md border border-gray-200 text-[15px] bg-white outline-none focus:border-blue-600"
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
          <label htmlFor="current-franchise" className="block text-sm font-semibold text-gray-600 mb-1.5">
            Aktuelle Franchise
          </label>
          <select
            id="current-franchise"
            value={value.franchise ?? ""}
            onChange={(e) => onChange({ ...value, franchise: Number(e.target.value), tarifCode: undefined })}
            className="w-full h-10 px-3 rounded-md border border-gray-200 text-[15px] bg-white outline-none focus:border-blue-600"
          >
            <option value="">–</option>
            {franchiseTiers.map((t) => (
              <option key={t} value={t}>
                CHF {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="current-model" className="block text-sm font-semibold text-gray-600 mb-1.5">
            Aktuelles Modell
          </label>
          <select
            id="current-model"
            value={value.tarifart ?? ""}
            onChange={(e) => onChange({ ...value, tarifart: e.target.value as Tarifart, tarifCode: undefined })}
            className="w-full h-10 px-3 rounded-md border border-gray-200 text-[15px] bg-white outline-none focus:border-blue-600"
          >
            <option value="">–</option>
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="current-accident" className="block text-sm font-semibold text-gray-600 mb-1.5">
            Unfalldeckung
          </label>
          <select
            id="current-accident"
            value={value.unfalldeckung == null ? "" : value.unfalldeckung ? "1" : "0"}
            onChange={(e) => onChange({ ...value, unfalldeckung: e.target.value === "1", tarifCode: undefined })}
            className="w-full h-10 px-3 rounded-md border border-gray-200 text-[15px] bg-white outline-none focus:border-blue-600"
          >
            <option value="">–</option>
            <option value="1">Eingeschlossen</option>
            <option value="0">Ausgeschlossen</option>
          </select>
        </div>
      </div>
      {productOptions && productOptions.length > 1 && (
        <div className="mt-3">
          <label htmlFor="current-product" className="block text-sm font-semibold text-gray-600 mb-1.5">
            Genaues Produkt
          </label>
          <select
            id="current-product"
            value={value.tarifCode ?? ""}
            onChange={(e) => onChange({ ...value, tarifCode: e.target.value || undefined })}
            className="w-full h-10 px-3 rounded-md border border-gray-200 text-[15px] bg-white outline-none focus:border-blue-600"
          >
            <option value="">– bitte wählen –</option>
            {productOptions.map((p) => (
              <option key={p.tarifCode} value={p.tarifCode}>
                {p.productName}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Deine Kasse bietet mehrere Produkte zu diesem Modell/dieser Franchise an — wähle dein genaues Produkt für eine korrekte Ersparnis-Berechnung.
          </p>
        </div>
      )}
    </details>
  );
}
