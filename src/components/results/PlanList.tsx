import type { PremiumRow } from "@/lib/types";
import { PlanRow } from "./PlanRow";

type Props = {
  plans: PremiumRow[];
  currentInsurerCode: string | null;
};

export function PlanList({ plans, currentInsurerCode }: Props) {
  return (
    <div role="list" className="flex flex-col gap-1.5">
      {plans.map((plan, i) => (
        <PlanRow
          key={plan.insurerCode}
          plan={plan}
          rank={i + 1}
          isCheapest={i === 0}
          isCurrentPlan={plan.insurerCode === currentInsurerCode}
        />
      ))}
    </div>
  );
}
