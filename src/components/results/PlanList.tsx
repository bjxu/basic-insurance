import type { PremiumRow } from "@/lib/types";
import { discountVsStandardPct } from "@/lib/lookup";
import { PlanRow } from "./PlanRow";

type Props = {
  plans: PremiumRow[];
  currentInsurerCode: string | null;
  standardBaseline: Map<string, number>;
};

export function PlanList({ plans, currentInsurerCode, standardBaseline }: Props) {
  return (
    <div role="list" className="flex flex-col gap-1.5">
      {plans.map((plan, i) => (
        <PlanRow
          key={plan.insurerCode}
          plan={plan}
          rank={i + 1}
          isCheapest={i === 0}
          isCurrentPlan={plan.insurerCode === currentInsurerCode}
          discountPct={plan.tarifart === "standard" ? null : discountVsStandardPct(standardBaseline.get(plan.insurerCode), plan.monthlyPremium)}
        />
      ))}
    </div>
  );
}
