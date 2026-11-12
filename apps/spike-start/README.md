# Start spike (throwaway)

A TanStack Start app in SPA mode with a prerender list. It renders six routes from the view code of `apps/web/src`, with Vite aliases standing in for `next/*`, the two font modules and the store. Both editions (stable at `/`, next under `/next/`) are built and merged into one GitHub Pages-shaped folder. Results: [RESULTS-S11.md](RESULTS-S11.md). Not merged.

1. `pnpm run build` at the root, then here: `node scripts/data.ts` (record files, the catalog index and the news file).
2. `PRERENDER=sample node scripts/site.ts` writes `site/`.
3. `node scripts/weigh.ts site` weighs each route's initial and lazy JavaScript against `apps/web/weight-budget.json`.
4. `pnpm exec playwright test e2e/s11.spec.ts --project chromium` serves `site/` as Pages does and runs the checks.

The S1 to S3 specs and modules are from the earlier spike and no longer match the routes.
