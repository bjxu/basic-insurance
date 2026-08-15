"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { filterPlans, cheapestPerInsurer, sortPlans, computeHeadline, standardPremiumsByInsurer } from "@/lib/lookup";
import { encodeState, decodeState } from "@/lib/url-state";
import { validateCurrentPremium } from "@/lib/validate";
import type { CurrentPlan, Insurer, SelfReportedPlan, Tarifart } from "@/lib/types";

import insurersData from "@/data/insurers.json";
import metadata from "@/data/metadata.json";
import type { PremiumRow } from "@/lib/types";

const INSURERS = insurersData as Insurer[];
// Static — INSURERS is a module-level import, not component state, so this is derived
// once at module load, same lifecycle as INSURERS itself (no useMemo needed).
const MEMBER_COUNTS: Record<string, number> = Object.fromEntries(
  INSURERS.filter((i) => i.memberCount != null).map((i) => [i.insurerCode, i.memberCount!]),
);
const ALT_MODELS: Tarifart[] = ["standard", "hausarzt", "telmed", "hmo", "andere"];

export function InsuranceComparator() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
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
    monthlyPremium: initial.currentMonthlyPremium ?? undefined,
  });
  const [premiumsByYear, setPremiumsByYear] = useState<Record<number, PremiumRow[]>>({});
  const [premiumsLoading, setPremiumsLoading] = useState(false);
  const [premiumsError, setPremiumsError] = useState(false);

  const gemeinden = plz.length === 4 ? resolveGemeinden(plz) : [];
  const ambiguous = needsDisambiguation(gemeinden);
  const plzNotFound = plz.length === 4 && gemeinden.length === 0;
  const resolvedGemeinde = bfsNr ? gemeinden.find((g) => g.bfsNr === bfsNr) : gemeinden[0];
  const praemienregionId = resolvedGemeinde?.praemienregionId ?? null;

  const parsedBirthYear = birthYear ? Number(birthYear) : null;
  const altersklasse = parsedBirthYear ? getAltersklasse(parsedBirthYear, year) : null;

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

  // Fetch the active year's premium data once, on first need (architecture.md §3.4 —
  // this file is large enough that it must be a fetched static asset, not bundled).
  useEffect(() => {
    if (premiumsByYear[year]) return;
    let cancelled = false;
    setPremiumsLoading(true);
    setPremiumsError(false);
    fetch(`/data/premiums-${year}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`failed to load premium data for ${year}: HTTP ${res.status}`);
        return res.json();
      })
      .then((rows: PremiumRow[]) => {
        if (!cancelled) setPremiumsByYear((prev) => ({ ...prev, [year]: rows }));
      })
      .catch((err) => {
        // `.finally` below still fires and clears premiumsLoading, so a failure here
        // would otherwise leave a silent blank page with no loading indicator and no
        // way to recover. premiumsError drives a visible retry notice instead.
        console.error(err);
        if (!cancelled) setPremiumsError(true);
      })
      .finally(() => {
        if (!cancelled) setPremiumsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, premiumsByYear]);

  const ALL_PREMIUMS = premiumsByYear[year] ?? [];

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
      currentMonthlyPremium: currentPlan.monthlyPremium ?? null,
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plz, bfsNr, birthYear, franchise, year, unfalldeckung, altModelsActive, currentPlan]);

  const inputsValid = Boolean(praemienregionId && altersklasse && franchise);

  // A current plan is "provided" once both fields are filled with a usable value — no
  // more dataset-matching/disambiguation step (requirement.md §5.1, REQ-14 removed).
  const currentPlanProvided = Boolean(
    currentPlan.insurerCode &&
      currentPlan.monthlyPremium != null &&
      validateCurrentPremium(currentPlan.monthlyPremium).valid,
  );

  const results = useMemo(() => {
    if (!inputsValid || !praemienregionId || !altersklasse || !franchise || ALL_PREMIUMS.length === 0) return null;

    const filtered = filterPlans(ALL_PREMIUMS, {
      praemienregionId,
      altersklasse,
      franchise,
      models: altModelsActive ? ALT_MODELS : ["standard"],
      unfalldeckung,
      year,
    });
    const cheapestRows = sortPlans(cheapestPerInsurer(filtered));

    const standardBaseline = standardPremiumsByInsurer(ALL_PREMIUMS, {
      praemienregionId,
      altersklasse,
      franchise,
      unfalldeckung,
      year,
    });

    const current: SelfReportedPlan | null = currentPlanProvided
      ? {
          insurerCode: currentPlan.insurerCode!,
          insurerName: INSURERS.find((i) => i.insurerCode === currentPlan.insurerCode)?.insurerName ?? currentPlan.insurerCode!,
          monthlyPremium: currentPlan.monthlyPremium!,
        }
      : null;

    const headline = computeHeadline(current, cheapestRows[0] ?? null);

    return { plans: cheapestRows, headline, standardBaseline };
  }, [
    inputsValid,
    praemienregionId,
    altersklasse,
    franchise,
    altModelsActive,
    unfalldeckung,
    year,
    currentPlan,
    currentPlanProvided,
    ALL_PREMIUMS,
  ]);

  const handleGemeindeSelect = useCallback((newBfsNr: number) => setBfsNr(newBfsNr), []);

  return (
    <main className="max-w-[860px] mx-auto my-8 px-4">
      <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-6">
        <h1 className="text-title-large text-on-surface mb-1">{t("inputs.title")}</h1>
        <p className="text-body-medium text-on-surface-variant mb-5">{t("inputs.tagline")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <PlzInput value={plz} onChange={handlePlzChange} notFound={plzNotFound} />
          <BirthYearInput value={birthYear} onChange={setBirthYear} calendarYear={year} />
          <DeductibleSelect altersklasse={altersklasse} value={franchise} onChange={setFranchise} />
        </div>

        {ambiguous && (
          <div className="mt-3 bg-primary-container border border-primary-container rounded-md p-3.5">
            <p className="text-sm text-on-surface-variant mb-2">{t("inputs.gemeindeAmbiguous", { plz })}</p>
            <div className="flex gap-2 flex-wrap">
              {gemeinden.map((g) => (
                <button
                  key={g.bfsNr}
                  type="button"
                  onClick={() => handleGemeindeSelect(g.bfsNr)}
                  className={`px-3 py-1 rounded-full border text-sm ${
                    bfsNr === g.bfsNr
                      ? "bg-primary border-primary text-on-primary font-semibold"
                      : "border-primary-container text-on-surface-variant bg-surface"
                  }`}
                >
                  {g.name} ({g.praemienregionId})
                </button>
              ))}
            </div>
          </div>
        )}
        {!ambiguous && resolvedGemeinde && (
          <p className="text-xs text-primary mt-2">{t("inputs.gemeindeConfirmed", { name: resolvedGemeinde.name })}</p>
        )}

        <CurrentPlanSection insurers={INSURERS} value={currentPlan} onChange={setCurrentPlan} />
      </div>

      {premiumsLoading && !results && (
        <p className="text-sm text-on-surface-variant mt-4" role="status">
          {t("inputs.premiumsLoading")}
        </p>
      )}

      {premiumsError && !premiumsLoading && !results && (
        <div className="mt-4 bg-error-container border border-error-container rounded-md p-3.5" role="alert">
          <p className="text-sm text-on-error-container mb-2">{t("inputs.premiumsError")}</p>
          <button
            type="button"
            onClick={() => {
              setPremiumsError(false);
              setPremiumsByYear((prev) => {
                const next = { ...prev };
                delete next[year];
                return next;
              });
            }}
            className="px-3 py-1.5 rounded-md border border-error text-sm text-error bg-surface hover:bg-error-container"
          >
            {t("inputs.retry")}
          </button>
        </div>
      )}

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

          <p className="text-sm text-on-surface-variant mt-4 mb-2">
            {t("results.summary", {
              count: results.plans.length,
              model: altModelsActive ? t("results.modelAlt") : t("results.modelStandard"),
              coverage: unfalldeckung ? t("filterBar.included") : t("filterBar.excluded"),
              year,
            })}
          </p>

          {results.plans.length > 0 ? (
            <PlanList
              plans={results.plans}
              currentInsurerCode={currentPlan.insurerCode ?? null}
              standardBaseline={results.standardBaseline}
              memberCounts={MEMBER_COUNTS}
              memberCountAsOf={metadata.memberCountAsOf}
            />
          ) : (
            <EmptyState message={t("results.emptyMessage")} />
          )}
        </div>
      )}

      <p className="text-body-small text-outline text-center mt-6 pb-10">
        {t("footer.dataNotice", {
          date: new Date(metadata.publicationDate).toLocaleDateString("de-CH", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        })}
      </p>
    </main>
  );
}
