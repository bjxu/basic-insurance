"use client";

import type { Altersklasse } from "@/lib/types";
import { getFranchiseTiers } from "@/lib/ageband";

type Props = {
  altersklasse: Altersklasse | null;
  value: number | null;
  onChange: (value: number) => void;
};

export function DeductibleSelect({ altersklasse, value, onChange }: Props) {
  const tiers = altersklasse ? getFranchiseTiers(altersklasse) : [];

  return (
    <div>
      <label htmlFor="fran" className="block text-sm font-semibold text-gray-600 mb-1.5">
        Franchise
      </label>
      <select
        id="fran"
        value={value ?? ""}
        disabled={!altersklasse}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-10 px-3 rounded-md border border-gray-200 text-[15px] bg-white outline-none focus:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400"
      >
        <option value="" disabled>
          {altersklasse ? "Wählen…" : "Erst Jahrgang eingeben"}
        </option>
        {tiers.map((tier) => (
          <option key={tier} value={tier}>
            CHF {tier}
          </option>
        ))}
      </select>
    </div>
  );
}
