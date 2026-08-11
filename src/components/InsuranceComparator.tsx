"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PlzInput } from "./inputs/PlzInput";
import { BirthYearInput } from "./inputs/BirthYearInput";
import { DeductibleSelect } from "./inputs/DeductibleSelect";
import { CurrentPlanSection } from "./current-plan/CurrentPlanSection";
import { Headline } from "./results/Headline";
import { FilterBar } from "./results/FilterBar";
import { PlanList } from "./results/PlanList";
import { EmptyState } from "./results/EmptyState";
import { getAltersklasse, getFranchiseTiers } from "@/lib/ageband";
import { resolveGemeinden, needsDisambiguation } from "@/lib/location";
import { filterPlans, cheapestPerInsurer, sortPlans, findCurrentPlan, computeHeadline } from "@/lib/lookup";
import { encodeState, decodeState } from "@/lib/url-state";
import type { CurrentPlan, Tarifart } from "@/lib/types";

import premiums2026 from "@/data/premiums-2026.json";
import insurersData from "@/data/insurers.json";
import metadata from "@/data/metadata.json";
import type { PremiumRow } from "@/lib/types";

const ALL_PREMIUMS = premiums2026 as PremiumRow[];
const INSURERS = insurersData as { insurerCode: string; insurerName: string }[];
const ALT_MODELS: Tarifart[] = ["standard", "hausarzt", "telmed", "hmo", "andere"];

export function InsuranceComparator() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = useMemo(() => decodeState(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [plz, setPlz] = useState(initial.plz ?? "");
  const [bfsNr, setBfsNr] = useState<number | null>(initial.bfsNr);
  const [birthYear, setBirthYear] = useState(initial.birthYear != null ? String(initial.birthYear) : "");
  const [franchise, setFranchise] = useState<number | null>(initial.franchise);
  const [year, setYear] = useState<number>(initial.year ?? metadata.availableYears[metadata.availableYears.length - 1]);
  const [unfalldeckung, setUnfalldeckung] = useState(initial.unfalldeckung);
  const [altModelsActive, setAltModelsActive] = useState(initial.models.length > 1);
  const [currentPlan, setCurrentPlan] = useState<Partial<CurrentPlan>>({
    insurerCode: initial.currentInsurerCode ?? undefined,
    franchise: initial.currentFranchise ?? undefined,
    tarifart: initial.currentTarifart ?? undefined,
    unfalldeckung: initial.currentUnfalldeckung ?? undefined,
  });

  const gemeinden = plz.length === 4 ? resolveGemeinden(plz) : [];
  const ambiguous = needsDisambiguation(gemeinden);
  const plzNotFound = plz.length === 4 && gemeinden.length === 0;
  const resolvedGemeinde = bfsNr ? gemeinden.find((g) => g.bfsNr === bfsNr) : gemeinden[0];
  const praemienregionId = resolvedGemeinde?.praemienregionId ?? null;

  const parsedBirthYear = birthYear ? Number(birthYear) : null;
  const altersklasse = parsedBirthYear ? getAltersklasse(parsedBirthYear, year) : null;
  const franchiseTiers = altersklasse ? getFranchiseTiers(altersklasse) : [];

  // A PLZ edit invalidates any previously-picked Gemeinde from a different PLZ (bug fix:
  // without this, bfsNr could point at a Gemeinde not in the new PLZ's list, silently
  // breaking location resolution with no visible way to recover).
  const handlePlzChange = useCallback((newPlz: string) => {
    setPlz(newPlz);
    setBfsNr(null);
  }, []);

  // A franchise tier only valid for the previous age band must not silently persist
  // (bug fix: previously the <select> could show a stale value not in the new tier list).
  useEffect(() => {
    if (franchise != null && altersklasse && !getFranchiseTiers(altersklasse).includes(franchise)) {
      setFranchise(null);
    }
  }, [altersklasse, franchise]);

  // Sync state to URL (REQ-11) — replace, not push, to avoid history spam.
  useEffect(() => {
    const params = encodeState({
      plz: plz || null,
      bfsNr,
      birthYear: parsedBirthYear,
      franchise,
      year,
      unfalldeckung,
      models: altModelsActive ? ALT_MODELS : ["standard"],
      currentInsurerCode: currentPlan.insurerCode ?? null,
      currentFranchise: currentPlan.franchise ?? null,
      currentTarifart: currentPlan.tarifart ?? null,
      currentUnfalldeckung: currentPlan.unfalldeckung ?? null,
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plz, bfsNr, birthYear, franchise, year, unfalldeckung, altModelsActive, currentPlan]);

  const inputsValid = Boolean(praemienregionId && altersklasse && franchise);

  const results = useMemo(() => {
    if (!inputsValid || !praemienregionId || !altersklasse || !franchise) return null;

    const filtered = filterPlans(ALL_PREMIUMS, {
      praemienregionId,
      altersklasse,
      franchise,
      models: altModelsActive ? ALT_MODELS : ["standard"],
      unfalldeckung,
      year,
    });
    const cheapestRows = sortPlans(cheapestPerInsurer(filtered));

    const currentPlanProvided = Boolean(
      currentPlan.insurerCode && currentPlan.franchise != null && currentPlan.tarifart && currentPlan.unfalldeckung != null,
    );
    const currentRow = currentPlanProvided
      ? findCurrentPlan(ALL_PREMIUMS, {
          insurerCode: currentPlan.insurerCode!,
          franchise: currentPlan.franchise!,
          tarifart: currentPlan.tarifart!,
          unfalldeckung: currentPlan.unfalldeckung!,
          praemienregionId,
          altersklasse,
          year,
        })
      : null;

    const headline = computeHeadline(currentRow, cheapestRows[0] ?? null, currentPlanProvided);

    return { plans: cheapestRows, headline };
  }, [inputsValid, praemienregionId, altersklasse, franchise, altModelsActive, unfalldeckung, year, currentPlan]);

  const handleGemeindeSelect = useCallback((newBfsNr: number) => setBfsNr(newBfsNr), []);

  return (
    <main className="max-w-[860px] mx-auto my-8 px-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <h1 className="text-xl font-bold mb-1">Prämienvergleich</h1>
        <p className="text-sm text-gray-500 mb-5">
          Gib deine Angaben ein — die günstigsten Kassen erscheinen sofort.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <PlzInput value={plz} onChange={handlePlzChange} notFound={plzNotFound} />
          <BirthYearInput value={birthYear} onChange={setBirthYear} calendarYear={year} />
          <DeductibleSelect altersklasse={altersklasse} value={franchise} onChange={setFranchise} />
        </div>

        {ambiguous && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-md p-3.5">
            <p className="text-sm text-gray-700 mb-2">
              PLZ {plz} liegt in mehreren Prämienregionen. Bitte wähle deine Gemeinde:
            </p>
            <div className="flex gap-2 flex-wrap">
              {gemeinden.map((g) => (
                <button
                  key={g.bfsNr}
                  type="button"
                  onClick={() => handleGemeindeSelect(g.bfsNr)}
                  className={`px-3 py-1 rounded-full border text-sm ${
                    bfsNr === g.bfsNr ? "bg-blue-600 border-blue-600 text-white font-semibold" : "border-blue-300 text-gray-700 bg-white"
                  }`}
                >
                  {g.name} ({g.praemienregionId})
                </button>
              ))}
            </div>
          </div>
        )}
        {!ambiguous && resolvedGemeinde && (
          <p className="text-xs text-blue-600 mt-2">&#10003; Gemeinde: {resolvedGemeinde.name}</p>
        )}

        <CurrentPlanSection
          insurers={INSURERS}
          franchiseTiers={franchiseTiers.length ? franchiseTiers : [300, 500, 1000, 1500, 2000, 2500]}
          value={currentPlan}
          onChange={setCurrentPlan}
        />
      </div>

      {results && (
        <div aria-live="polite">
          <Headline headline={results.headline} year={year} />

          <FilterBar
            year={year}
            availableYears={metadata.availableYears}
            onYearChange={setYear}
            altModelsActive={altModelsActive}
            onToggleAltModels={() => setAltModelsActive((v) => !v)}
            unfalldeckung={unfalldeckung}
            onToggleUnfalldeckung={() => setUnfalldeckung((v) => !v)}
          />

          <p className="text-sm text-gray-500 mt-4 mb-2">
            {results.plans.length} Kassen · {altModelsActive ? "günstiges Modell je Kasse" : "günstigstes Standard-Angebot je Kasse"} ·{" "}
            Unfalldeckung {unfalldeckung ? "eingeschlossen" : "ausgeschlossen"} · {year}
          </p>

          {results.plans.length > 0 ? (
            <PlanList plans={results.plans} currentInsurerCode={currentPlan.insurerCode ?? null} />
          ) : (
            <EmptyState message="Für die aktuelle Kombination sind keine Prämien in den BAG-Daten vorhanden. Bitte überprüfe deine Eingaben oder passe die Filter an." />
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-6 pb-10">
        Daten: BAG Opendata · Publikation{" "}
        {new Date(metadata.publicationDate).toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" })} ·
        Nur Pflichtleistungen (OKP) · Kein Sponsoring, keine Vermittlungslinks
      </p>
    </main>
  );
}
