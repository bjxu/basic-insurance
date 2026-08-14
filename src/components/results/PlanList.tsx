import type { PremiumRow } from "@/lib/types";
import { discountVsStandardPct } from "@/lib/lookup";
import { PlanRow } from "./PlanRow";

type Props = {
  plans: PremiumRow[];
  currentInsurerCode: string | null;
  standardBaseline: Map<string, number>;
  memberCounts: Record<string, number>;
  memberCountAsOf: number;
};

export function PlanList({ plans, currentInsurerCode, standardBaseline, memberCounts, memberCountAsOf }: Props) {
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
          memberCount={memberCounts[plan.insurerCode]}
          memberCountAsOf={memberCountAsOf}
        />
      ))}
    </div>
  );
}
