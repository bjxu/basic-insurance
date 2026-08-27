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
  JSON report, plus a full-page screenshot of each site's results for every case, to a
  timestamped directory under the OS temp dir (path printed at the end of the run) — so
  a mismatch (or the data in general) can be eyeballed directly, not just diffed.
- Exits non-zero if there's any price mismatch or any case errors out.

```bash
npm run test:blackbox
```

**Note:** priminfo.admin.ch's autocomplete widget occasionally fails to initialize on a
fresh page load (observed a handful of times while building this script — prixio.ch was
unaffected). The script retries each case with backoff to absorb that. If you instead
see every case fail with the *same* error, that's more likely a real bug (e.g. priminfo
changed its markup) than transient flakiness — worth a closer look before re-running.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Vercel Postgres (inquiry
logging) · Recharts (admin dashboard). Details in [architecture.md](./architecture.md).

