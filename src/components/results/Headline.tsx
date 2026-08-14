import type { HeadlineState, PremiumRow } from "@/lib/types";
import { formatChf } from "@/lib/format";

type Props = {
  headline: HeadlineState;
  year: number;
};

export function Headline({ headline, year }: Props) {
  if (headline.kind === "savings") {
    return (
      <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-success-container border border-success-container">
        <span className="text-xl" aria-hidden>💡</span>
        <p className="text-sm text-on-success-container">
          <strong className="block text-base font-bold text-on-surface mb-0.5">
            Wenn du nichts tust: {formatChf(headline.current.monthlyPremium)}/Monat bei{" "}
            {headline.current.insurerName}.
          </strong>
          Günstigstes Angebot für dein Profil {year}: {formatChf(headline.cheapest.monthlyPremium)}/Monat bei{" "}
          {headline.cheapest.insurerName} —{" "}
          <span className="text-success font-bold">
            spare {formatChf(headline.savingsPerYear)}/Jahr durch einen Wechsel.
          </span>
        </p>
      </div>
    );
  }

  if (headline.kind === "already-cheapest") {
    return (
      <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-success-container border border-success-container">
        <span className="text-xl" aria-hidden>✅</span>
        <p className="text-sm text-on-success-container">
          <strong className="block text-base font-bold text-on-surface mb-0.5">
            Du hast bereits das günstigste Angebot für dein Profil.
          </strong>
          {headline.current.insurerName} · {formatChf(headline.current.monthlyPremium)}/Monat.
        </p>
      </div>
    );
  }

  return headline.cheapest ? <CheapestOnly cheapest={headline.cheapest} /> : null;
}

function CheapestOnly({ cheapest }: { cheapest: PremiumRow }) {
  return (
    <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-primary-container border border-primary-container">
      <span className="text-xl" aria-hidden>🔍</span>
      <p className="text-sm text-on-primary-container">
        <strong className="block text-base font-bold text-on-surface mb-0.5">
          Günstigstes Angebot: {formatChf(cheapest.monthlyPremium)}/Monat bei {cheapest.insurerName}.
        </strong>
        Gib deine aktuelle Kasse an, um zu sehen, wie viel du sparen könntest. ↓
      </p>
    </div>
  );
}
