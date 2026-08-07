# Basic Insurance

A small Vue 3 + Vite + TypeScript site with a premium comparison tool: pick an
insurance type and enter your details to compare monthly premiums.

- **Health**: real, official 2026 mandatory health insurance (KVG/OKP) premiums from
  Switzerland's Federal Office of Public Health (BAG) open data — see
  [src/lib/health-premiums.ts](src/lib/health-premiums.ts) and
  [scripts/build-premium-data.mjs](scripts/build-premium-data.mjs) for how the raw
  ~217k-row dataset gets turned into the compact [public/data/premiums.json](public/data/premiums.json)
  the app fetches. Regenerate it with `npm run build:data` (needs network access to
  `opendata.bagnet.ch`; not run automatically — the deployed site only ever reads the
  committed static JSON).
- **Car / home**: still a simplified, local placeholder formula
  ([src/lib/estimate.ts](src/lib/estimate.ts)) — **not** a real quote from any insurer.
  No open data source for these is wired up yet.

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
- [src/views/CompareView.vue](src/views/CompareView.vue) — the comparison tool
- [src/lib/health-premiums.ts](src/lib/health-premiums.ts) — real BAG health premium lookups
- [src/lib/estimate.ts](src/lib/estimate.ts) — the (placeholder) car/home pricing formula
- [scripts/build-premium-data.mjs](scripts/build-premium-data.mjs) — regenerates `public/data/premiums.json` from BAG's open data
- [src/router/index.ts](src/router/index.ts) — routes
