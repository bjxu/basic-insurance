// src/lib/zurichTime.ts
// Pure UTC <-> Europe/Zurich wall-clock conversion helpers for the admin
// dashboard (architecture.md §13.2). No dependency: built on the Intl
// timezone database that's already used elsewhere in the codebase for
// de-CH formatting, just a different zone.
//
// DST edge convention (Europe/Zurich has two transitions a year):
// - Spring forward (the nonexistent wall-clock hour, e.g. 2026-03-29
//   02:00-03:00): zurichWallToUTC snaps forward, matching native Date's own
//   overflow behavior for out-of-range fields.
// - Fall back (the ambiguous, twice-occurring wall-clock hour, e.g.
//   2026-10-25 02:00-03:00): zurichWallToUTC resolves to its *second*
//   occurrence (the post-transition, CET offset) -- the natural fixed
//   point of the same two-pass correction used for every other instant,
//   not a specially-cased branch. This affects at most ~1-2 hours a year,
//   visible only at hourly granularity on those two specific days.

export type ZurichParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

// The Europe/Zurich wall-clock reading of a UTC instant.
export function zurichParts(instant: Date): ZurichParts {
  const parts = PARTS_FORMATTER.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// Europe/Zurich's UTC offset, in milliseconds, at the given instant.
function zurichOffsetMs(instant: Date): number {
  const local = zurichParts(instant);
  const asUTC = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return asUTC - instant.getTime();
}

// The UTC instant at which Europe/Zurich's wall clock reads the given
// components. Two-pass: guess the instant as if the components were UTC,
// read that guess's actual Zurich offset, and correct once more from the
// corrected instant's own offset -- a fixed point that's safe across the
// DST boundary (see the module-level DST edge convention above).
export function zurichWallToUTC(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const naiveMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMs = zurichOffsetMs(new Date(naiveMs));
  const corrected = new Date(naiveMs - offsetMs);
  const offsetMs2 = zurichOffsetMs(corrected);
  return offsetMs2 === offsetMs ? corrected : new Date(naiveMs - offsetMs2);
}
