// Aggregate activity stats for the admin dashboard (REQ-22, architecture.md §13.2).
// No raw log rows are ever exposed through this route — counts/aggregates only.

import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { selectGranularity, fillTrendGaps } from "@/lib/adminStats";

type TotalRow = { total: number };
type TrendRow = { bucket: string; n: number };
type RegionRow = { regionId: string; n: number };
type AgeRow = { altersklasse: string; n: number };
type FranchiseRow = { franchise: number; n: number };
type ModelRow = { model: string; n: number };
type AccidentRow = { accident: boolean; n: number };
type LanguageRow = { locale: string; n: number };
type CurrentInsurerRow = { insurerCode: string; n: number };
type PremiumBandRow = { band: string; n: number };
type AgeGroupRow = { ageGroup: string; n: number };

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "from/to must be YYYY-MM-DD" }, { status: 400 });
  }

  if (!process.env.POSTGRES_URL) {
    // No DB configured yet — return an empty-but-well-formed payload so the
    // dashboard UI can be built against a stable shape before data exists.
    return NextResponse.json({
      total: 0,
      granularity: "day",
      trend: [],
      topRegions: [],
      altersklasse: [],
      franchise: [],
      models: [],
      accident: [],
      languages: [],
      currentInsurers: [],
      premiumBands: [],
      ageGroups: [],
    });
  }

  const granularity = selectGranularity(from, to);

  let totalRows: TotalRow[];
  let trendRows: TrendRow[];
  let regionRows: RegionRow[];
  let ageRows: AgeRow[];
  let franchiseRows: FranchiseRow[];
  let modelRows: ModelRow[];
  let accidentRows: AccidentRow[];
  let languageRows: LanguageRow[];
  let currentInsurerRows: CurrentInsurerRow[];
  let premiumBandRows: PremiumBandRow[];
  let ageGroupRows: AgeGroupRow[];

  try {
    const sql = getSql();
    [
      totalRows, trendRows, regionRows, ageRows, franchiseRows, modelRows, accidentRows,
      languageRows, currentInsurerRows, premiumBandRows, ageGroupRows,
    ] = (await Promise.all([
      sql`SELECT COUNT(*)::int AS total FROM inquiry_log WHERE ts >= (${from}::timestamp AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::timestamp AT TIME ZONE 'Europe/Zurich')`,
      sql`SELECT date_trunc(${granularity}, ts AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich' AS bucket, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::timestamp AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::timestamp AT TIME ZONE 'Europe/Zurich') GROUP BY 1 ORDER BY 1`,
      sql`SELECT region_id AS "regionId", COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::timestamp AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::timestamp AT TIME ZONE 'Europe/Zurich') GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      sql`SELECT altersklasse, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::timestamp AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::timestamp AT TIME ZONE 'Europe/Zurich') GROUP BY 1 ORDER BY 2 DESC`,
      sql`SELECT franchise, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::timestamp AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::timestamp AT TIME ZONE 'Europe/Zurich') GROUP BY 1 ORDER BY 1`,
      sql`SELECT unnest(models) AS model, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::timestamp AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::timestamp AT TIME ZONE 'Europe/Zurich') GROUP BY 1 ORDER BY 2 DESC`,
      sql`SELECT accident, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::timestamp AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::timestamp AT TIME ZONE 'Europe/Zurich') GROUP BY 1`,
      sql`SELECT COALESCE(locale, 'unbekannt') AS locale, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::timestamp AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::timestamp AT TIME ZONE 'Europe/Zurich') GROUP BY 1 ORDER BY 2 DESC`,
      sql`SELECT current_insurer AS "insurerCode", COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::timestamp AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::timestamp AT TIME ZONE 'Europe/Zurich') AND current_insurer IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      sql`SELECT current_premium_band AS band, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::timestamp AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::timestamp AT TIME ZONE 'Europe/Zurich') AND current_premium_band IS NOT NULL GROUP BY 1`,
      sql`SELECT age_group AS "ageGroup", COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::timestamp AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::timestamp AT TIME ZONE 'Europe/Zurich') AND age_group IS NOT NULL GROUP BY 1`,
    ])) as [
      TotalRow[], TrendRow[], RegionRow[], AgeRow[], FranchiseRow[], ModelRow[], AccidentRow[],
      LanguageRow[], CurrentInsurerRow[], PremiumBandRow[], AgeGroupRow[],
    ];
  } catch {
    // DB unreachable or inquiry_log not migrated yet — surface a real error
    // rather than a well-formed-but-empty payload that would look identical
    // to "zero inquiries in range" and hide an infrastructure problem.
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  return NextResponse.json({
    total: totalRows[0]?.total ?? 0,
    granularity,
    trend: fillTrendGaps(trendRows, granularity, from, to),
    topRegions: regionRows,
    altersklasse: ageRows,
    franchise: franchiseRows,
    models: modelRows,
    accident: accidentRows,
    languages: languageRows,
    currentInsurers: currentInsurerRows,
    premiumBands: premiumBandRows,
    ageGroups: ageGroupRows,
  });
}
