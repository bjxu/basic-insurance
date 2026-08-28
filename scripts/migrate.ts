// One-time (safe to re-run) migration for the admin dashboard's inquiry log
// (REQ-21/REQ-22, architecture.md §13.2). Run via `npm run db:migrate`.
//
// Requires POSTGRES_URL in the environment — see architecture.md §14.

import { neon } from "@neondatabase/serverless";
import { CREATE_TABLE_SQL, CREATE_INDEX_SQL, ALTER_TABLE_SQL } from "./migrateSql";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("✖ db:migrate failed: POSTGRES_URL is not set.");
    process.exit(1);
  }

  const sql = neon(url);
  await sql.query(CREATE_TABLE_SQL);
  for (const stmt of ALTER_TABLE_SQL) {
    await sql.query(stmt);
  }
  await sql.query(CREATE_INDEX_SQL);
  console.log("✓ inquiry_log table ready.");
}

main().catch((err) => {
  console.error(`✖ db:migrate failed: ${err}`);
  process.exit(1);
});
