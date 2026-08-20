// Lazy Neon Postgres client (REQ-21/REQ-22, architecture.md §13.2/§14).
//
// Callers must check `process.env.POSTGRES_URL` themselves first — an unset
// var is a normal "not configured yet" no-op path in the route handlers, not
// an error. This function only throws for the case where a caller forgot
// that check.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cached: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!cached) {
    const url = process.env.POSTGRES_URL;
    if (!url) throw new Error("POSTGRES_URL is not set");
    cached = neon(url);
  }
  return cached;
}

// Test-only: clears the cached client so tests can flip POSTGRES_URL between cases.
export function __resetSqlCacheForTests(): void {
  cached = null;
}
