// One-time (safe to re-run) migration for the admin dashboard's inquiry log
// (REQ-21/REQ-22, architecture.md §13.2). Run via `npm run db:migrate`.
//
// Requires POSTGRES_URL in the environment — see architecture.md §14.

import { neon } from "@neondatabase/serverless";
import { MIGRATE_SQL } from "./migrateSql";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("✖ db:migrate failed: POSTGRES_URL is not set.");
    process.exit(1);
  }

  const sql = neon(url);
  await sql.query(MIGRATE_SQL);
  console.log("✓ inquiry_log table ready.");
}

main().catch((err) => {
  console.error(`✖ db:migrate failed: ${err}`);
  process.exit(1);
});
