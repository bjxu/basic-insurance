// Pure SQL text for the inquiry_log migration — kept separate from migrate.ts
// (which runs it against a real database at module load) so it can be
// imported safely from a test. Columns and types match architecture.md
// §10.3 exactly.

export const MIGRATE_SQL = `
CREATE TABLE IF NOT EXISTS inquiry_log (
  id           BIGSERIAL PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  region_id    TEXT NOT NULL,
  altersklasse TEXT NOT NULL,
  franchise    SMALLINT NOT NULL,
  year         SMALLINT NOT NULL,
  models       TEXT[] NOT NULL,
  accident     BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inquiry_log_ts ON inquiry_log (ts);
`.trim();
