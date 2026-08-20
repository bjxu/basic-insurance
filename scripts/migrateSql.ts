// Pure SQL text for the inquiry_log migration — kept separate from migrate.ts
// (which runs it against a real database at module load) so it can be
// imported safely from a test. Columns match every query in
// architecture.md §13.2.

export const MIGRATE_SQL = `
CREATE TABLE IF NOT EXISTS inquiry_log (
  id           SERIAL PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  region_id    TEXT NOT NULL,
  altersklasse TEXT NOT NULL,
  franchise    INTEGER NOT NULL,
  year         INTEGER NOT NULL,
  models       TEXT[] NOT NULL,
  accident     BOOLEAN NOT NULL
)`.trim();
