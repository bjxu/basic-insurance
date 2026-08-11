// Aggregate activity stats for the admin dashboard (REQ-22, architecture.md §13.2).
// No raw log rows are ever exposed through this route — counts/aggregates only.

import { NextRequest, NextResponse } from "next/server";

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
    });
  }

  // Deferred: wire up @vercel/postgres and run the aggregation queries from
  // architecture.md §13.2 once POSTGRES_URL is provisioned.
  return NextResponse.json({ error: "not implemented" }, { status: 501 });
}
