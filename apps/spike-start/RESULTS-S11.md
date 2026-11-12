# S11 results: shared view code under Vite and TanStack Start

Six routes of `apps/web/src` (home, the bullet list, a powder record with its curve chart, the bullet designer, the firearm library, the workbench) build, prerender and hydrate under TanStack Start in both editions. Every route is within its initial budget and every lazy chunk is within 190,000 bytes. The workbench loses text typed before hydration, and the Next export of `main` loses it the same way. The cause is a controlled input in the shared view code, not Start. Beyond the aliases, the stand-ins are config and the route files that replace `app/**/page.tsx` and `layout.tsx`; no file under `apps/web` or `packages` needed an edit.

## Versions

| Package                | Version                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| @tanstack/react-start  | 1.169.4 (start-plugin-core 1.171.55)                               |
| @tanstack/react-router | 1.170.46                                                           |
| vite (Rolldown)        | 8.3.5                                                              |
| @vitejs/plugin-react   | 6.2.1                                                              |
| react, react-dom       | 19.3.1                                                             |
| @mantine/core          | 9.8.0                                                              |
| dexie                  | 4.4.7                                                              |
| echarts                | 6.1.0                                                              |
| @playwright/test       | 1.65.0 (its Chromium headless shell, from the dev container image) |
| Node                   | 26.12.1 (dev container)                                            |

Base: `main` at `6e8ddfe7`.

## Commands

All of them run in the dev container, from `apps/spike-start`, after `pnpm install` and `pnpm run build` at the root.

1. `node scripts/data.ts`: record files, the catalog index and the news file into `public/api/` (1,055 records).
2. `PRERENDER=sample node scripts/site.ts`: both editions into `site/` (stable 11.6 s, next 19.4 s, 31.6 s in total, in the last run). The route list is fixed in `vite.config.ts`, so `PRERENDER` changes nothing here.
3. `node scripts/weigh.ts site` and `node scripts/weigh.ts site/next`: the weights (`--json` for every chunk).
4. `pnpm exec playwright test e2e/s11.spec.ts --project chromium`: the browser checks (it serves `site/` on port 3043).
5. For comparison with Next: `pnpm run static:build` and `pnpm run pages:serve` at the root, then `pnpm exec playwright test e2e/s11-next.spec.ts --project chromium`.

## Criteria

| #   | Criterion                                                                                                   | Result                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Both editions build, six routes prerendered                                                                 | Pass: 7 pages per edition (the six routes and `/?root`, written as `/`)  |
| 2a  | Each route loads in Chromium with no console error or warning, `/` and `/next/`                             | Pass: 12 of 12, no console message, no failed request                    |
| 2b  | Text typed before the entry module loads survives hydration on `/workbench/`                                | Fail, on Start and on the Next export alike (see below)                  |
| 2c  | A chart on `/powders/<id>/`, a drawing on `/bullets/designer/`                                              | Pass: `.echart svg` and `.designer-drawing svg` visible in both editions |
| 3   | Initial JavaScript per route within the group's initial budget                                              | Pass: 6 of 6                                                             |
| 4   | Every lazy chunk at most 190,000 bytes (gzip level 9)                                                       | Pass: largest 181,143                                                    |
| 5   | Dexie, ECharts and Mantine chunks listed                                                                    | Done (below)                                                             |
| 6   | Initial set from the manifest equals the scripts requested before `load` on `/`, `/bullets/`, `/workbench/` | Pass on all six routes in both editions                                  |
| 7   | Everything that stood in for or differed from view code on `main`                                           | Listed below: more than the aliases, no edit to shared code              |

Automatic code splitting is on by default in Start: `autoCodeSplitting: true` in `@tanstack/start-plugin-core` (`dist/esm/schema.js`, line 6), and the manifest holds `src/routes/<file>?tsr-split=component` (and `?tsr-split=notFoundComponent` for the powder route) as dynamic entries without any option set. Loaders and route options stay in the entry, because the route tree imports them.

## Weights (gzip level 9, stable edition)

The next edition differs by at most 22 bytes per route.

| Route                        | Group        | Initial |  Budget | Files | Lazy chunks | Largest lazy                       |
| ---------------------------- | ------------ | ------: | ------: | ----: | ----------: | ---------------------------------- |
| `/`                          | shell        | 360,703 | 424,000 |    55 |          34 | 111,389 (`de`, the German catalog) |
| `/bullets/`                  | lists        | 378,170 | 446,000 |    68 |          24 | 111,389 (`de`)                     |
| `/powders/demo-powder-dp40/` | curve charts | 400,768 | 468,000 |    68 |          32 | 181,143 (`echart`)                 |
| `/bullets/designer/`         | designers    | 350,851 | 419,000 |    50 |          65 | 111,389 (`de`)                     |
| `/firearms/`                 | tools        | 470,778 | 570,000 |    82 |          35 | 111,389 (`de`)                     |
| `/workbench/`                | workbench    | 570,051 | 643,000 |    92 |          68 | 181,143 (`echart`)                 |

The initial set is the static import closure of the client entry and of every `?tsr-split=` chunk of the matched route. Lazy chunks are what dynamic imports reach from there, other routes' split chunks excluded, plus the workers and the chunks they import. No lazy chunk is over 190,000, so there is no import or split to name. `echart` is the closest, at 95% of the limit.

Workers are separate bundles and not in `.vite/manifest.json`. `weigh.ts` finds them through the `new Worker(new URL(...))` file names in the chunks:

| Worker                                              |   Bytes | Reached on                    |
| --------------------------------------------------- | ------: | ----------------------------- |
| `import-entry.worker`                               | 100,411 | designer, firearms, workbench |
| `hole-detection.worker`                             |  72,783 | workbench                     |
| `bullet-photo.worker`                               |  62,035 | designer                      |
| `compute.worker`                                    |  29,962 | all six                       |
| `grt-load-file` (imported by `import-entry.worker`) |   3,761 | designer, firearms, workbench |

## Dexie, ECharts and Mantine

| Package                | Chunk           |   Bytes | `/`     | `/bullets/` | `/powders/…/` | `/bullets/designer/` | `/firearms/` | `/workbench/` |
| ---------------------- | --------------- | ------: | ------- | ----------- | ------------- | -------------------- | ------------ | ------------- |
| Dexie                  | `user-db-dexie` |  31,200 | initial | initial     | initial       | initial              | initial      | initial       |
| ECharts (with ZRender) | `echart`        | 181,143 | -       | -           | lazy          | -                    | -            | lazy          |

Dexie is initial on every route because the layout's providers and offline layer import the store. Its chunk holds Dexie and the stand-in store module only.

Rolldown puts Mantine modules into 41 chunks (487,041 bytes in all), mixed with application code; there is no Mantine-only chunk. The largest is the entry chunk `index` (136,488 bytes: React DOM, the router, Mantine core and layout code). Chunks holding Mantine code, per route:

| Route                        | Initial chunks / bytes | Lazy chunks / bytes |
| ---------------------------- | ---------------------- | ------------------- |
| `/`                          | 23 / 252,687           | 7 / 32,316          |
| `/bullets/`                  | 23 / 245,749           | 6 / 31,978          |
| `/powders/demo-powder-dp40/` | 24 / 253,025           | 6 / 31,978          |
| `/bullets/designer/`         | 22 / 245,411           | 14 / 57,247         |
| `/firearms/`                 | 29 / 287,177           | 4 / 18,896          |
| `/workbench/`                | 30 / 376,274           | 9 / 97,302          |

`node scripts/weigh.ts site` prints each of the 41 chunks with its status per route.

## Initial set against the browser

`e2e/s11.spec.ts` compares, on each route, the `.js` resources the browser started before `loadEventStart` with the initial set `weigh.ts` computes. On all six routes in both editions there were none missing and none extra (55, 68, 68, 50, 82 and 92 files). The first version of `weigh.ts` counted only `?tsr-split=component`. The browser also fetched the powder route's `?tsr-split=notFoundComponent` chunk before `load`, because the router loads every split component of a matched route. `weigh.ts` now counts all of them.

## Text typed before hydration

The test holds every module script, types `308 Win.` into the workbench's cartridge search, then releases the scripts. After hydration the field is the same DOM node, and its value goes from `308 Win.` to empty. The Next export of `main` behaves the same way under the same test (`e2e/s11-next.spec.ts`): same node, value reset to empty.

The cause is in the shared view code: `RecordSearch` keeps the text in `useState('')` and renders the input with `value={q}` (`apps/web/src/components/record-search.tsx`, lines 181 and 251), so React sets the DOM value back to the state once it hydrates. The cheapest fix, outside this spike as it is under `apps/web`, is to read the input's DOM value into the state when the component mounts. The prerendered "Powder lot" field cannot be reached before hydration because it sits in a collapsed panel, so the test uses the cartridge search.

## What stood in for or differed from `main`

Aliases (`vite.config.ts`):

- `next/link`, `next/navigation`, `next/dynamic`, `next/image` go to `src/platform/`. Link maps `href` to the router's `Link` and drops `prefetch`, `shallow` and `locale`. `dynamic(..., { ssr: false })` becomes `React.lazy` inside `ClientOnly`.
- `app/fonts/ui.ts` and `app/fonts/drawing.ts` go to modules with the same exports. Their `@font-face` rules are in `src/platform/fonts.css` and point at the same `woff2` files.
- `lib/user-db.ts` goes to `src/platform/user-db-dexie.ts`, which uses Dexie and has the same exports.

Beyond the aliases:

- `define` for `process.env.NEXT_PUBLIC_*`: base path, edition, build line and tag (computed with `apps/web/src/lib/build-line.ts`), docs and repository URLs. These are the values `next.config.ts` and the Pages build set.
- The route files replace `app/layout.tsx` and the six `app/**/page.tsx`. `__root.tsx` repeats the layout's head tags and component tree. Each loader repeats the page's data assembly from shared `lib/` functions and reads JSON files (`src/data.ts`) instead of `lib/api.ts`. The pages' loading and error states (Suspense fallback, `ServerDataError`) and their metadata other than titles are not carried over.
- `src/styles.css` repeats the layout's CSS imports in their order.
- `public/sw.js` is the spike's service worker in place of the Serwist worker, which is out of scope. `OfflineLayer` registers it unchanged.
- No file under `apps/web` or `packages` failed to build or hydrate, and none needed an edit.

## Findings

- Dexie's `version(1)` opens the native IndexedDB version 10 (Dexie multiplies by 10). A store that moves to Dexie has to keep the native version numbers in mind, and its refusal of a newer database (`VersionError`) is checked against version 10, not 1.
- `apps/web/scripts/check-weight.mts` counts the Next client manifests and the lazy chunks of `next/dynamic`. Workers (up to 100,411 bytes here) are outside both, so the budgets on `main` likely do not weigh them (confidence: medium, from reading the script).
- On Node 26 in the dev container, `fs.cpSync` failed with `EACCES` on the bind-mounted workspace: it created the copied file write-only and could not write into it. `scripts/site.ts` now copies with `cp -R`.
- One `site.ts` run failed in the prerender step with a connect timeout to the preview server Start starts for prerendering. The next run passed with no change.
- Vite warns that `apps/web/src/lib/build-line.ts` and `apps/web/scripts/git-head.ts` are ESM in a CommonJS package, a limit of `configLoader: 'native'`. The build is not affected.
- The S1 to S3 files (`e2e/s1.spec.ts` to `e2e/s3.spec.ts`, `src/i18n.ts`, `src/edition.ts`, `src/not-found.tsx`, `src/sw-register.ts`, `src/routes/$kind/$id.tsx`) are kept but not run. The record route is excluded from the route tree (`routeFileIgnorePattern`).
