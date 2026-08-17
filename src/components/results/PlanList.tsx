import type { PremiumRow } from "@/lib/types";
import { PlanRow } from "./PlanRow";

type Props = {
  plans: PremiumRow[];
  currentInsurerCode: string | null;
  standardBaseline: Map<string, number>;
  productsByInsurer: Map<string, PremiumRow[]>;
  memberCounts: Record<string, number>;
  memberCountAsOf: number;
};

export function PlanList({
  plans,
  currentInsurerCode,
  standardBaseline,
  productsByInsurer,
  memberCounts,
  memberCountAsOf,
}: Props) {
  return (
    <div role="list" className="flex flex-col gap-1.5">
      {plans.map((plan, i) => (
        <PlanRow
          key={plan.insurerCode}
          plan={plan}
          rank={i + 1}
          isCheapest={i === 0}
          isCurrentPlan={plan.insurerCode === currentInsurerCode}
          standardPremium={standardBaseline.get(plan.insurerCode)}
          products={productsByInsurer.get(plan.insurerCode) ?? [plan]}
          memberCount={memberCounts[plan.insurerCode]}
          memberCountAsOf={memberCountAsOf}
        />
      ))}
    </div>
  );
}
