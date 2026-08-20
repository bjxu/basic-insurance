// REQ-21: append-only inquiry log for activity monitoring, no PII (architecture.md §10).
// Silent on failure — logging must never block or degrade the comparison UI.

import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";

const TARIFARTEN = ["standard", "hmo", "hausarzt", "telmed", "andere"];
const ALTERSKLASSEN = ["kind", "jung", "erwachsen"];

type InquiryPayload = {
  regionId: string;
  altersklasse: string;
  franchise: number;
  year: number;
  models: string[];
  accident: boolean;
};

function isValidPayload(body: unknown): body is InquiryPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.regionId === "string" &&
    b.regionId.length > 0 &&
    typeof b.altersklasse === "string" &&
    ALTERSKLASSEN.includes(b.altersklasse) &&
    typeof b.franchise === "number" &&
    typeof b.year === "number" &&
    Array.isArray(b.models) &&
    b.models.every((m) => typeof m === "string" && TARIFARTEN.includes(m)) &&
    typeof b.accident === "boolean"
  );
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
    await sql`INSERT INTO inquiry_log (region_id, altersklasse, franchise, year, models, accident)
              VALUES (${body.regionId}, ${body.altersklasse}, ${body.franchise}, ${body.year}, ${body.models}, ${body.accident})`;
    return new NextResponse(null, { status: 204 });
  } catch {
    // Logging failures must never surface to the user.
    return new NextResponse(null, { status: 204 });
  }
}
