import type { PremiumRow } from "@/lib/types";
import { TARIFART_LABELS, TARIFART_DESCRIPTIONS } from "@/lib/copy";
import { formatChf } from "@/lib/format";

type Props = {
  plan: PremiumRow;
  rank: number;
  isCheapest: boolean;
  isCurrentPlan: boolean;
  previousYearPremium?: number;
};

export function PlanRow({ plan, rank, isCheapest, isCurrentPlan, previousYearPremium }: Props) {
  const yoy =
    previousYearPremium != null && previousYearPremium !== plan.monthlyPremium
      ? ((plan.monthlyPremium - previousYearPremium) / previousYearPremium) * 100
      : null;

  return (
    <div
      role="listitem"
      className={`flex items-center gap-3 rounded-lg border p-3.5 shadow-sm ${
        isCurrentPlan ? "border-red-300 bg-red-50/40" : "border-gray-200 bg-white"
      }`}
    >
      <div className={`w-5 text-center text-sm font-bold ${rank === 1 ? "text-blue-600" : "text-gray-400"}`}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px] truncate">{plan.insurerName}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          <span
            className={`inline-block px-1.5 py-px rounded text-[11px] font-semibold mr-1 ${
              plan.tarifart === "standard"
                ? "bg-gray-100 text-gray-600"
                : plan.tarifart === "hmo"
                  ? "bg-amber-100 text-amber-800"
                  : plan.tarifart === "telmed"
                    ? "bg-violet-100 text-violet-800"
                    : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {TARIFART_LABELS[plan.tarifart]}
          </span>
          · {TARIFART_DESCRIPTIONS[plan.tarifart]}
        </div>
      </div>
      {isCurrentPlan && (
        <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-red-100 text-red-600">
          Deine Kasse
        </span>
      )}
      {yoy != null && (
        <div
          className={`text-xs font-semibold px-1.5 py-px rounded ${
            yoy > 0 ? "bg-red-50 text-red-600" : yoy < 0 ? "bg-green-50 text-green-600" : "text-gray-400 font-normal"
          }`}
        >
          {yoy > 0 ? "+" : ""}
          {yoy.toFixed(1)}%
        </div>
      )}
      <div className="text-right">
        <div className={`text-[17px] font-bold ${isCheapest ? "text-blue-600" : "text-gray-900"}`}>
          {formatChf(plan.monthlyPremium)}
        </div>
        <div className="text-xs text-gray-400">/Monat</div>
      </div>
    </div>
  );
}
