# Basic Insurance — Krankenkassenvergleich

A single-page web app for comparing Swiss mandatory basic health insurance
(*Grundversicherung* / OKP) premiums. See [requirement.md](./requirement.md) for
the full requirements and [architecture.md](./architecture.md) for the technical
architecture.

## Local Development

```bash
npm install
npm run ingest    # download BAG data and regenerate src/data/ JSON (see scripts/ingest.ts)
npm run dev       # Next.js dev server on :3000
npm test          # Vitest unit + integration
```

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Vercel Postgres (inquiry
logging) · Recharts (admin dashboard). Details in [architecture.md](./architecture.md).

