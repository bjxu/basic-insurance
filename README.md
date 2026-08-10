# Basic Insurance

A small Vue 3 + Vite + TypeScript site comparing real, official Swiss mandatory
health insurance (KVG/OKP) premiums — enter your age, deductible, accident-coverage
choice, and postcode/municipality, and see actual premiums per insurer.

All numbers come from Switzerland's Federal Office of Public Health (BAG) and
priminfo.admin.ch open data — nothing is estimated or fabricated:

- [scripts/build-premium-data.mjs](scripts/build-premium-data.mjs) downloads BAG's
  ~217k-row premium dataset (`Prämien_CH.csv`) *and* the official municipality/
  postcode → premium-region lookup (`praemienregionen.xlsx`), cross-checks that the
  two agree on how many premium regions each canton has, and compacts both into
  [public/data/premiums.json](public/data/premiums.json). Regenerate with
  `npm run build:data` (needs network access to `opendata.bagnet.ch` and
  `www.priminfo.admin.ch`; not run automatically — the deployed site only ever reads
  the committed static JSON).
- [src/lib/health-premiums.ts](src/lib/health-premiums.ts) is the client-side lookup:
  resolves a postcode/municipality search to its exact premium region (not just
  canton — e.g. Zürich the city and rural ZH municipalities are priced differently),
  then filters premiums by that region, age class, deductible, and accident coverage.

**No gender field, on purpose**: Art. 61 KVG requires Swiss insurers to charge the
same OKP premium regardless of sex — BAG's dataset has no such column, so there's
nothing to show. Age only has three real buckets in the data (child 0–18, young adult
19–25, adult 26+), not per-year pricing.

This app covers mandatory health insurance only — no car, home, or other insurance
types; no open data source for those has been wired up.

## Deployment

Deployed to GitHub Pages at <https://bjxu.github.io/basic-insurance/> via
[.github/workflows/deploy.yml](.github/workflows/deploy.yml), which builds and
publishes on every push to `main` (or manually via workflow_dispatch). The build
needs no network access — `public/data/premiums.json` is a committed snapshot, not
fetched at build/deploy time (see `npm run build:data` above).

Because it's a GitHub Pages *project* site (not a custom domain or `<user>.github.io`
root site), `vite.config.ts` sets `base: '/basic-insurance/'` — if this repo is ever
renamed or moved to a custom domain, update that (and the URL above) together.

GitHub Pages serves static files only, with no server-side rewrites — so a direct
load/refresh/bookmark of a route like `/compare` would 404 (client-side navigation
*within* the app is unaffected; only a fresh request to that path is a problem). The
`postbuild` script copies `dist/index.html` to `dist/404.html` as a workaround: GitHub
Pages serves that for any unmatched path, which boots the app and lets Vue Router take
over from wherever the user landed.

## Running

Recommended: use the sandboxed dev container (see
[.devcontainer/README.md](.devcontainer/README.md)) — open in VS Code and
*Reopen in Container*, or `npx @devcontainers/cli up --workspace-folder .`.

```bash
npm install
npm run dev       # start the Vite dev server (http://localhost:5173)
npm run build     # type-check + production build
npm run preview   # preview the production build
```

## Structure

- [src/views/HomeView.vue](src/views/HomeView.vue) — landing page
- [src/views/CompareView.vue](src/views/CompareView.vue) — the comparison tool (postcode/municipality search, age, deductible, accident coverage)
- [src/lib/health-premiums.ts](src/lib/health-premiums.ts) — client-side premium/municipality lookups
- [scripts/build-premium-data.mjs](scripts/build-premium-data.mjs) + [scripts/lib/xlsx-lite.mjs](scripts/lib/xlsx-lite.mjs) — regenerate `public/data/premiums.json` from BAG/priminfo open data
- [src/router/index.ts](src/router/index.ts) — routes
