# Basic Insurance

A small Vue 3 + Vite + TypeScript site with a premium comparison tool: enter age,
insurance type, coverage amount, and deductible, and get a rough monthly/annual
estimate.

The estimator ([src/lib/estimate.ts](src/lib/estimate.ts)) is a simplified, local
formula for demo purposes — it is **not** a real quote and isn't pulled from any
insurer's rate table. Swap it out once a real pricing source is wired up.

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
- [src/lib/estimate.ts](src/lib/estimate.ts) — the (placeholder) pricing formula
- [src/router/index.ts](src/router/index.ts) — routes
