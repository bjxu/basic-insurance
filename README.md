# Basic Insurance — Krankenkassenvergleich

A single-page web app for comparing Swiss mandatory basic health insurance
(*Grundversicherung* / OKP) premiums. See [requirement.md](./requirement.md) for
the full requirements and [architecture.md](./architecture.md) for the technical
architecture.

## Local Development

```bash
npm install
npm run ingest    # download BAG data and regenerate src/data/ + public/data/ JSON (see scripts/ingest.ts)
npm run dev       # Next.js dev server on :3000
npm test          # Vitest unit + integration
```

## Provider Product Descriptions (optional, maintenance)

`npm run crawl-descriptions` crawls insurer websites for product-specific descriptions
(see `scripts/crawl/`). Needs `ANTHROPIC_API_KEY` in the environment and at least one
real `seedUrl` filled into `src/data/insurer-sources.json` — both are stubbed/empty by
default, so this is safe to skip for normal development.

## Blackbox Comparison Test (optional, maintenance)

`npm run test:blackbox` (`scripts/blackbox-compare.ts`) spot-checks the live prixio.ch
site against the official BAG calculator, priminfo.ch, for correctness. It:

- Samples 10 random (premium region, franchise) combinations from the real BAG region
  data — every other input (adult birth year, Standard model, accident coverage
  included, current year) is held fixed at prixio's own defaults, so it's an
  apples-to-apples comparison.
- Drives both sites with headless Chromium (Playwright) and compares, per insurer,
  prixio's displayed monthly premium against priminfo's net "Total" column (the figure
  after priminfo's CO₂-/VOC-levy credit — the same basis prixio displays).
- Prints a pass/fail summary to the console and writes a full per-case, per-insurer
  JSON report to the OS temp dir (path printed at the end of the run).
- Exits non-zero if there's any price mismatch or any case errors out.

```bash
npm run test:blackbox
```

**Note:** priminfo.admin.ch is a low-traffic government site and appears to
rate-limit/soft-block automated traffic after a burst of requests (observed while
building this script — prixio.ch was unaffected, only priminfo failed). The script
already retries each case with backoff, but if every case fails with a priminfo-side
timeout or "0 matching rows" error, that's the site throttling you, not a script bug —
wait a while (minutes, possibly longer) and try again, ideally without hammering it
with repeated back-to-back runs.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Vercel Postgres (inquiry
logging) · Recharts (admin dashboard). Details in [architecture.md](./architecture.md).

