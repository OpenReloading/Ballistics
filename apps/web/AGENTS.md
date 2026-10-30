<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# @open-reloading/web

Next.js App Router (TypeScript, React), built as a static export: the browser reads data files and runs the simulations itself; only the build reads the API at `API_URL` (default `http://localhost:3000`) for the record pages. Package rules: root `AGENTS.md`.

## Commands (this directory, or `-w @open-reloading/web` from the root)

- Dev server: `npm run dev:static` at the root (Static site below).
- Build: the export, `npm run static:build` or `npm run pages:build` at the root. `npm run build` here is the export build they run and needs the API at `API_URL`.
- Type check: `npm run typecheck` (generates route types first).
- Test: `npm test` (Vitest, `test/`). Coverage: `npm run test:coverage` (exclusions with reasons in `vitest.config.ts`).
- Prerender check after an export: `node scripts/check-prerender.mts` with the `PRERENDER` value of the export (`sample` for `--sample`). It fails for a list or record route without `index.html` or `index.txt`, and for a record page whose HTML lacks one of the head values of its record (`test/check-prerender.test.ts`).
- What a run must build from the changed files: `node scripts/ci-plan.mts` (prints `check=`, `e2e=`, `prerender=`; rules in the script, test `test/ci-plan.test.ts`). The export scripts of `tools/src` are inputs of `e2e`. Local: `--stamp apps/web/.next/ci-plan-stamp --require full`; after a build on a clean tree `--write-stamp apps/web/.next/ci-plan-stamp --prerender <mode>`.
- Translations: `npm run i18n -- missing <code>` lists the English messages the catalogue lacks; `-- messages` lists every message (`scripts/i18n.mts`).
- Drawing font changed (`src/app/fonts/`): run `node scripts/glyph-advances.mts`.
- Build workers: `next.config.ts` caps static generation at 8 (`BUILD_WORKERS` for another number).
- Build cache: `.next/cache/turbopack` is reusable. `.next/cache/fetch-cache` holds API responses, so `prebuild` deletes it and CI never caches it.

## JavaScript budget

`npm run check-weight` after an export build (`npm run static:build` leaves `.next`; CI runs it in the `e2e` job). Per route it sums the gzip level 9 bytes of each JavaScript file as `initial` and `total` (with the lazy chunks), and fails when a route is over the `budget` of its group in `weight-budget.json`, is in no group, or a group lists a route the build lacks. A route with less than 1 % headroom gets a warning.

- Record the values in the dev container (the CI Node's zlib), never with a host Node.
- When a budget is set or raised, it is the largest recorded value of its group plus 2 %, rounded up to 1000 B. Raise it only in a pull request that says why, and record the values then. A new route goes into a group, or a new group.
- Keep a heavy module out of a route: load a dialog or a rarely used tool with a plain `import()` or `next/dynamic` on first use, and keep worker-only code in the worker. Core and importers are `"sideEffects": false`.

## Rules

- Record pages: a thin server page (`src/app/<kind>/[id]/page.tsx`: `generateStaticParams`, `generateMetadata`, head tags from `recordHeadText` in `src/lib/record-metadata.ts`, a loading state) and a client component (`src/components/<kind>-record-page.tsx` on `RecordViewWith`) that reads the record's data file. A new record kind adds both, its entry in `recordHeadText` and in `lists` of `scripts/check-prerender.mts`, and a row in `apps/e2e/tests/web/record-page.spec.ts`.
- Browser API calls go through `apiFetch` (`src/lib/api-fetch.ts`, paths without the version prefix), never `fetch('/api/...')`. Build-time reads use `apiGet` (`src/lib/api.ts`).
- Stored units to SI and back: `toSi` and `fromSi` of `@open-reloading/schema`, never a factor written in place (`test/unit-literals.test.ts` fails on a factor literal). Display units and formatting: `src/lib/units.ts`.
- User data lives in a versioned IndexedDB (`src/lib/user-store.ts`): `upgrade` never touches a record (`test/user-store-upgrade.test.ts`). A record that fails the schema stays stored as invalid; imports never overwrite a stored id, valid or not. Writes that may race another tab go through `putRecordIf` or `updateRecord`. New ids: `newId` (`src/lib/new-id.ts`).
- A new `localStorage` key, IndexedDB name or cache name is declared through `storageName` (`src/lib/edition.ts`), so the next edition keeps its own.
- Questions: `confirmDialog` (`src/components/confirm.tsx`), never `window.confirm` (`test/confirm.test.ts`). A delete that can be taken back asks nothing and calls `offerUndo`.
- Messages: `Message` with severity `info`, `warning` or `error` (`src/components/states.tsx`). A message that may come and go sits in a `MessageSlot` or a box of fixed height, so nothing below moves (`workbench-messages.spec.ts`, `workbench-notes.spec.ts`). Loading, error and empty states take a sentence from the tables in `states.tsx`.
- The workbench has no page scroll from a 1280 x 650 window and cuts no control (`workbench-no-scroll.spec.ts`). Rows grow with `min-height`, not `height`, so the WCAG 1.4.12 text spacing cuts nothing (`text-spacing.spec.ts`). Only record names, the load title and the page bar's status line may end in an ellipsis.
- Every page opens with `PageBar` (`src/components/page-bar.tsx`), its only `h1`. Navigation entries are in `src/lib/sections.ts`; a new page is covered by an entry (`a11y-sweep.spec.ts` fails otherwise).
- The service worker precaches every page route but the record pages (`shellPages` in `src/lib/offline.ts`; `test/offline.test.ts` fails on a route missing from it). It is written to `out/sw.js`, never into `public/`: a leftover `public/sw.js` fails `npm run lint`, delete it.
- Safety: the README Safety text is `src/lib/safety.ts` (checked against `README.md` by `test/safety.test.ts`). English is binding; a translation is approved by the project owner. On-screen notes keep the notice; printed pages and downloaded files carry none (root `AGENTS.md`, Conventions).
- A run never states that a load is safe or within limits.

## UI

- Mantine v9, theme in `src/lib/theme.ts`, `MantineProvider` in `src/components/providers.tsx`. Charts: Apache ECharts through `src/components/echart.tsx`, loaded through `lazy-chart.tsx`. Drawings are custom SVG (`@open-reloading/drawing`), no Mantine inside the SVG.
- Mantine CSS is imported per component in `src/app/layout.tsx` from the `*.layer.css` files: add the file of every new Mantine component there, after the files it builds on. `layers.css` puts the layer `base` (the element defaults of `globals.css`) below `mantine`; every other rule of `globals.css` is unlayered and wins.
- Tokens: font sizes, headings and breakpoints in `theme.ts`, spacing and colours in `globals.css` (drawing colours `--draw-*`; message colours 4.5:1 in both themes, `test/drawing-tokens.test.ts`). Screen text takes the theme sizes, media queries the theme breakpoints (`max-width` one step below, as 47.99em). The dark rule is screen-only, print stays light.
- Corners are square (radius 0). A circle only where it is the shape.
- A field's unit suffix switches that field only, in memory (`src/lib/field-unit.ts`); the Settings store units. A message or placeholder that names a unit is a function of the units shown.
- Providers above `main` keep one context value for the page's life, else React client-renders a streamed page a second time.

## Language

English is the source text in the code; every other language is one catalogue file `src/i18n/<code>.json`, loaded when chosen. No locale in paths. Contributor steps: `apps/docs/docs/translating.md`.

- Text goes through `t('English text', { name })`, `tn(count, one, other)` or `msg('...')` (`src/i18n/translate.ts`), in JSX as `{t('Close')}`. Only string literals compile, so every text is extracted. A plain attribute or child string is not extracted. Context for a word with two senses: `'material\u0004Brass'`.
- A function in `src/lib` that writes text takes the translator as its last parameter; `untranslated()` stands for English where a file or link writes it. Data handed to a client component carries `Wording` (`src/lib/wording.ts`).
- State that outlives a language change keeps a `Say` or the English text, never the translated string. Messages from the packages and the API stay English in state and files and are translated where shown with `translateMessage` (`src/lib/core-messages.ts`, table `core-message-table.json`). `test/core-messages.test.ts` fails for a message of core or the API the table lacks, so a new refusal needs its German text in the same change.
- Numbers: the app holds canonical text (point decimal) everywhere but the screen. Format with `src/i18n/number.ts` (`formatNumber` and its siblings), read typed or pasted text with `parseNumber`. Never `toFixed`, `String(n)` or a template number in display text; an export passes `'en'`.
- Terms: user-facing text says target, never target face; Brass names the case records and groups. Code identifiers, routes and stored keys keep their names. The German term table is `src/i18n/german-terms.json`, edited by hand (`test/german-terms.test.ts`, `test/i18n-catalogue.test.ts`).
- Not translated: models, record names, exported field names, page metadata and the text inside the packages.

## Static site

The web app is a static site without a server, for GitHub Pages or any static host: the records as data files and the simulations in the browser, with the docs site and the licenses beside it. `pages.yml` builds two editions into one deployment: the release edition at the site root from the tag of the latest release, the next edition at `<root>/next/` from `main` (`apps/docs/docs/release.md`, Pages site).

- `next.config.ts` is the only configuration: `output: 'export'` under `PAGES_BASE_PATH` (`''` or a path such as `/Ballistics`) with `trailingSlash`, without Cache Components and Partial Prefetching (`'use cache'` through `experimental.useCache`), no redirects.
  - `basePath` of `src/lib/edition.ts` is the base path in the browser: a plain `<a href>` or asset URL takes it, `Link` and the router add it themselves.
- `apiFetch` is `src/lib/static-api.ts`: GET reads `catalogue/index.json` under `<base>/api/` with `openCatalogue` of `@open-reloading/api/catalogue` (the API's own paging, `q`, filters and refusals) and a record from `<kind>/<id>.json`; POST `interior` and `interior/charge-target` run `@open-reloading/api/compute` in a Web Worker per task (`src/lib/compute.worker.ts`). `test/static-api.test.ts` checks that the answers equal the API's.
- `PAGES_EDITION` (`stable`, the default, or `next`): the next edition's base path is `<PAGES_BASE_PATH>/next` and, sharing the origin, its storage names start with `next:` (`storageName`). Each edition's service worker has its own scope and caches; the root worker leaves `<base>/next/` to the network.
- `PAGES_URL`: the site's origin (docs `url`, `metadataBase`, social image).
- `npm run pages:build` at the root (`tools/src/pages.ts`, after `npm run build`): starts the API over the data bundle, builds the web app against it with `PRERENDER=full`, writes the data files (`writeStaticApi`), builds the docs site into `docs/` (`--no-docs` skips it), copies the licences and writes `.nojekyll` into `pages/` (git-ignored). `.next` stays for `check-weight`.
- `npm run pages:serve` (`tools/src/pages-serve.ts`): `pages/` under `PAGES_BASE_PATH` on `PORT` (default 3003). It does not read `PAGES_EDITION`: after a next build set `PAGES_BASE_PATH` to `<root>/next`.
- Static loop (checks: `apps/e2e/AGENTS.md`), after the root `npm run build`:
  - `npm run dev:static` (`tools/src/static-dev.ts`): writes the data files into `apps/web/public/api/` (git-ignored, removed at the end), runs the API in-process for the server side and `next dev` on port 3000 (`PORT`). It logs React warnings the production build does not.
  - `npm run static:build` (`pages:build --sample`): the export at the site root with `PRERENDER=sample`, no docs, about 15 s. The data files are complete; only the cartridge pages of `src/lib/prerender-sample.ts` are prerendered, any other answers 404. A spec that opens or links a cartridge needs it in the sample.
- Offline: the worker precaches `api/catalogue/index.json` and the language catalogues with the shell; record files stay network-first.
- Size: about 300 MB per edition, about 600 MB deployed; the 1 GB limit of `apps/docs/docs/ci-tools.md` applies.
