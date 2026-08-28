// Pure SQL text for the inquiry_log migration — kept separate from migrate.ts
// (which runs it against a real database at module load) so it can be
// imported safely from a test. Columns and types match architecture.md
// §10.3 exactly.

export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS inquiry_log (
  id                   BIGSERIAL PRIMARY KEY,
  ts                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  region_id            TEXT NOT NULL,
  altersklasse         TEXT NOT NULL,
  franchise            SMALLINT NOT NULL,
  year                 SMALLINT NOT NULL,
  models               TEXT[] NOT NULL,
  accident             BOOLEAN NOT NULL,
  locale               TEXT,
  current_insurer      TEXT,
  current_premium_band TEXT,
  age_band             TEXT
);
`.trim();

export const CREATE_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_inquiry_log_ts ON inquiry_log (ts);
`.trim();

// Columns added after inquiry_log first shipped (architecture.md §10.3).
// Idempotent so `npm run db:migrate` stays safe to re-run against a
// database that already has some or all of them.
export const ALTER_TABLE_SQL = [
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS locale TEXT;",
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS current_insurer TEXT;",
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS current_premium_band TEXT;",
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS age_band TEXT;",
];
