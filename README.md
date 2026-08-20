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

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Vercel Postgres (inquiry
logging) · Recharts (admin dashboard). Details in [architecture.md](./architecture.md).

