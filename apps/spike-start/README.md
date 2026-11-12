# Start spike (throwaway)

A minimal TanStack Start app in SPA mode with a prerender list, on `@open-reloading/ui`: the shell, the home page, the load workbench and the catalog's record pages, built twice (stable at `/`, next under `/next/`) and merged into one GitHub Pages-shaped folder. It checks hydration, the shared origin of both editions and the shell hydration defect TanStack/router#8473. Not merged.

1. `pnpm run build` at the root, then here: `node scripts/data.ts` (record files and the prerender list of the public catalog).
2. `PRERENDER=sample node scripts/site.ts` (three records; without `PRERENDER` the whole catalog) writes `site/`.
3. `pnpm exec playwright test` serves `site/` as Pages does (the root `404.html` with status 404 for every missing path) and runs the checks in Chromium, WebKit and Firefox.
