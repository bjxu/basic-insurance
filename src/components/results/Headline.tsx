import type { HeadlineState, PremiumRow } from "@/lib/types";
import { formatChf } from "@/lib/format";

type Props = {
  headline: HeadlineState;
  year: number;
};

export function Headline({ headline, year }: Props) {
  if (headline.kind === "savings") {
    return (
      <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-green-50 border border-green-200">
        <span className="text-xl" aria-hidden>💡</span>
        <p className="text-sm text-gray-700">
          <strong className="block text-base font-bold text-gray-900 mb-0.5">
            Wenn du nichts tust: {formatChf(headline.current.monthlyPremium)}/Monat {year} bei{" "}
            {headline.current.insurerName}.
          </strong>
          Günstigstes Angebot für dein Profil: {formatChf(headline.cheapest.monthlyPremium)}/Monat bei{" "}
          {headline.cheapest.insurerName} —{" "}
          <span className="text-green-600 font-bold">
            spare {formatChf(headline.savingsPerYear)}/Jahr durch einen Wechsel.
          </span>
        </p>
      </div>
    );
  }

  if (headline.kind === "already-cheapest") {
    return (
      <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-green-50 border border-green-200">
        <span className="text-xl" aria-hidden>✅</span>
        <p className="text-sm text-gray-700">
          <strong className="block text-base font-bold text-gray-900 mb-0.5">
            Du hast bereits das günstigste Angebot für dein Profil.
          </strong>
          {headline.current.insurerName} · {formatChf(headline.current.monthlyPremium)}/Monat {year}.
        </p>
      </div>
    );
  }

  if (headline.kind === "current-plan-not-found") {
    return (
      <>
        <div className="rounded-lg p-3 text-sm text-amber-900 bg-amber-50 border border-amber-200 mb-2">
          <strong>Aktuelle Kasse nicht gefunden.</strong> Der angegebene Plan wurde in den BAG-Daten für
          deine Region nicht gefunden. Das günstigste verfügbare Angebot wird angezeigt.
        </div>
        {headline.cheapest && <CheapestOnly cheapest={headline.cheapest} />}
      </>
    );
  }

  return headline.cheapest ? <CheapestOnly cheapest={headline.cheapest} /> : null;
}

function CheapestOnly({ cheapest }: { cheapest: PremiumRow }) {
  return (
    <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-blue-50 border border-blue-200">
      <span className="text-xl" aria-hidden>🔍</span>
      <p className="text-sm text-gray-700">
        <strong className="block text-base font-bold text-gray-900 mb-0.5">
          Günstigstes Angebot: {formatChf(cheapest.monthlyPremium)}/Monat bei {cheapest.insurerName}.
        </strong>
        Gib deine aktuelle Kasse an, um zu sehen, wie viel du sparen könntest. ↓
      </p>
    </div>
  );
}
