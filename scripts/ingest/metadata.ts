//
// Carries the hand-maintained parts of src/data/metadata.json across an ingest run.
//
// scripts/ingest.ts rewrites metadata.json from scratch on every run, but
// `environmentalLevyPerMonth` (src/lib/environmentalLevy.ts) does not come from the BAG
// source files at all — it's a BAFU figure entered by hand, on a different publication
// schedule. Without this module a re-ingest would silently drop it and revert the
// levy-adjusted pricing with no error and no failing test. So: read what's already on
// disk, carry the map forward, and refuse to write a metadata.json whose year has no
// published figure.

export type CarryForwardResult =
  | { ok: true; environmentalLevyPerMonth: Record<string, number> }
  | { ok: false; error: string };

const FILE = "src/data/metadata.json";

function missingYearError(year: number, known: string[]): string {
  return (
    `no environmental levy figure for ${year}. That amount comes from BAFU, not from the ` +
    `BAG files being ingested, so it can't be derived here — add the ${year} BAFU ` +
    `CO2-/VOC-Lenkungsabgabe redistribution (CHF per insured person per month) to ` +
    `"environmentalLevyPerMonth" in ${FILE} as {"${year}": <amount>}, then re-run the ingest. ` +
    (known.length > 0 ? `Known years: ${known.join(", ")}.` : `No years are currently published.`)
  );
}

/**
 * Given the raw text of the existing metadata.json (or `null` if the file doesn't exist)
 * and the year being ingested, returns the `environmentalLevyPerMonth` map to write into
 * the new metadata.json — every previously published year preserved, so re-ingesting an
 * older year never drops a newer figure.
 *
 * Fails (rather than defaulting to an empty map) when the file is missing/unreadable or
 * when `year` has no published figure — the moment someone onboards a new premium year is
 * exactly when the levy figure needs a human decision.
 */
export function carryForwardEnvironmentalLevy(
  existingMetadataJson: string | null,
  year: number,
): CarryForwardResult {
  if (existingMetadataJson === null) {
    return {
      ok: false,
      error:
        `${FILE} not found, so the environmental levy figures can't be carried forward. ` +
        missingYearError(year, []),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(existingMetadataJson);
  } catch (e) {
    return { ok: false, error: `${FILE} is not valid JSON: ${(e as Error).message}` };
  }

  const raw = (parsed as { environmentalLevyPerMonth?: unknown } | null)?.environmentalLevyPerMonth;
  if (raw === undefined) {
    return { ok: false, error: `${FILE} has no "environmentalLevyPerMonth" map. ${missingYearError(year, [])}` };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: `${FILE}: "environmentalLevyPerMonth" must be an object mapping year to CHF amount.` };
  }

  const environmentalLevyPerMonth: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return {
        ok: false,
        error: `${FILE}: "environmentalLevyPerMonth"["${k}"] must be a finite number, got ${JSON.stringify(v)}.`,
      };
    }
    environmentalLevyPerMonth[k] = v;
  }

  if (environmentalLevyPerMonth[String(year)] === undefined) {
    return { ok: false, error: missingYearError(year, Object.keys(environmentalLevyPerMonth).sort()) };
  }

  return { ok: true, environmentalLevyPerMonth };
}
