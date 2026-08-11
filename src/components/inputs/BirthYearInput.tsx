"use client";

import { validateBirthYear } from "@/lib/validate";
import { getAltersklasse, getFranchiseTiers } from "@/lib/ageband";
import { ALTERSKLASSE_LABELS } from "@/lib/copy";

type Props = {
  value: string;
  onChange: (value: string) => void;
  calendarYear: number;
};

export function BirthYearInput({ value, onChange, calendarYear }: Props) {
  const parsed = value ? Number(value) : null;
  const result = parsed != null ? validateBirthYear(parsed) : { valid: true as const };
  const altersklasse = parsed != null && result.valid ? getAltersklasse(parsed, calendarYear) : null;
  const tiers = altersklasse ? getFranchiseTiers(altersklasse) : null;

  return (
    <div>
      <label htmlFor="by" className="block text-sm font-semibold text-gray-600 mb-1.5">
        Jahrgang
      </label>
      <input
        id="by"
        type="number"
        placeholder="z.B. 1985"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="by-hint"
        aria-invalid={!result.valid}
        className={`w-full h-10 px-3 rounded-md border text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-200 ${
          result.valid ? "border-gray-200 focus:border-blue-600" : "border-red-600 focus:border-red-600"
        }`}
      />
      <p id="by-hint" className={`text-xs mt-1 ${result.valid ? "text-gray-400" : "text-red-600"}`}>
        {!result.valid
          ? result.message
          : altersklasse && tiers
            ? `→ ${ALTERSKLASSE_LABELS[altersklasse]}, Franchise CHF ${tiers[0]}–${tiers[tiers.length - 1]}`
            : "Bestimmt Altersklasse und verfügbare Franchise-Stufen"}
      </p>
    </div>
  );
}
