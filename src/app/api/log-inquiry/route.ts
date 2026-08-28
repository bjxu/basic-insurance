// REQ-21: append-only inquiry log for activity monitoring, no PII (architecture.md §10).
// Silent on failure — logging must never block or degrade the comparison UI.

import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { routing } from "@/i18n/routing";
import { PREMIUM_BANDS } from "@/lib/premiumBand";
import { AGE_BANDS } from "@/lib/ageband";
import insurersData from "@/data/insurers.json";

const TARIFARTEN = ["standard", "hmo", "hausarzt", "telmed", "andere"];
const ALTERSKLASSEN = ["kind", "jung", "erwachsen"];
const LOCALES: readonly string[] = routing.locales;
const INSURER_CODES = new Set(insurersData.map((i) => i.insurerCode));
const BANDS: readonly string[] = PREMIUM_BANDS;
const AGE_BAND_VALUES: readonly string[] = AGE_BANDS;

type InquiryPayload = {
  regionId: string;
  altersklasse: string;
  franchise: number;
  year: number;
  models: string[];
  accident: boolean;
  locale?: string;
  currentInsurer?: string;
  currentPremiumBand?: string;
  ageBand?: string;
};

function isValidPayload(body: unknown): body is InquiryPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;

  const baseOk =
    typeof b.regionId === "string" &&
    b.regionId.length > 0 &&
    typeof b.altersklasse === "string" &&
    ALTERSKLASSEN.includes(b.altersklasse) &&
    typeof b.franchise === "number" &&
    typeof b.year === "number" &&
    Array.isArray(b.models) &&
    b.models.every((m) => typeof m === "string" && TARIFARTEN.includes(m)) &&
    typeof b.accident === "boolean";

  if (!baseOk) return false;

  // locale: absent is allowed (stored as NULL); present must be a known locale.
  if (b.locale !== undefined) {
    if (typeof b.locale !== "string" || !LOCALES.includes(b.locale)) return false;
  }

  if (b.currentInsurer !== undefined) {
    if (typeof b.currentInsurer !== "string" || !INSURER_CODES.has(b.currentInsurer)) return false;
  }
  if (b.currentPremiumBand !== undefined) {
    if (typeof b.currentPremiumBand !== "string" || !BANDS.includes(b.currentPremiumBand)) return false;
  }
  if (b.ageBand !== undefined) {
    if (typeof b.ageBand !== "string" || !AGE_BAND_VALUES.includes(b.ageBand)) return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // No POSTGRES_URL configured (e.g. local dev) — no-op rather than error.
  if (!process.env.POSTGRES_URL) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const sql = getSql();
    await sql`INSERT INTO inquiry_log
              (region_id, altersklasse, franchise, year, models, accident, locale, current_insurer, current_premium_band, age_band)
              VALUES (${body.regionId}, ${body.altersklasse}, ${body.franchise}, ${body.year},
                      ${body.models}, ${body.accident}, ${body.locale ?? null},
                      ${body.currentInsurer ?? null}, ${body.currentPremiumBand ?? null}, ${body.ageBand ?? null})`;
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    // Logging failures must never surface to the user — but they must be visible
    // in server logs so schema drift / DB errors don't fail silently.
    console.error("log-inquiry insert failed", err);
    return new NextResponse(null, { status: 204 });
  }
}
