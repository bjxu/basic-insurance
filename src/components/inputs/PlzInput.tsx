"use client";

import { validatePlz } from "@/lib/validate";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** True when the PLZ has valid format but doesn't resolve to any known Gemeinde (REQ-13). */
  notFound?: boolean;
};

export function PlzInput({ value, onChange, notFound }: Props) {
  const formatResult = value ? validatePlz(value) : { valid: true as const };
  const result =
    formatResult.valid && notFound
      ? { valid: false as const, message: "PLZ nicht gefunden — bitte überprüfen." }
      : formatResult;

  return (
    <div>
      <label htmlFor="plz" className="block text-sm font-semibold text-gray-600 mb-1.5">
        Postleitzahl (PLZ)
      </label>
      <input
        id="plz"
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder="z.B. 3001"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="plz-hint"
        aria-invalid={!result.valid}
        className={`w-full h-10 px-3 rounded-md border text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-200 ${
          result.valid ? "border-gray-200 focus:border-blue-600" : "border-red-600 focus:border-red-600"
        }`}
      />
      {!result.valid && (
        <p id="plz-hint" className="text-xs text-red-600 mt-1">
          {result.message}
        </p>
      )}
    </div>
  );
}
