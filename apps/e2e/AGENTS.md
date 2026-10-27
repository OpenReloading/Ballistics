# @open-reloading/e2e

Playwright tests against a running API and web app, on the CIP cartridge records, the target faces and the invented example records.

- Project `full` (`tests/web/`): Chromium against the web app.
- Project `pages`, only with `PAGES_URL` set (the Pages site with its base path and a trailing slash, `npm run pages:serve` at the root): `web/smoke.spec.ts` against the Pages edition, and its workbench result for the example load against the server edition's at `WEB_URL`. Pages are opened by relative paths (`./workbench`), so the base path stays.
- One spec per area. No spec needs manufacturer data or load data.
- Every test has its own browser context and `fullyParallel` is on: the tests of one file run on several workers, so a test never relies on another.
- A spec that clicks or types right after loading a page opens it with `gotoHydrated` (`web/nav.ts`): it waits for `html[data-hydrated]`, which `Providers` sets after mount, and for `data-hydrated` on the `h1` of `PageBar`, set once the page itself has mounted (the page hydrates after the layout). No `toPass` retry for a click before hydration.
- Values, formats and parsing are checked in Vitest (`apps/web/test/`, `packages/*/test/`). A spec checks what only a browser shows.

## Specs

| Spec | What only a browser checks |
|---|---|
| `web/smoke.spec.ts` | pages load with a heading and no console error, the forwarding route answers (not in `pages`), the Pages workbench's start card in the window and its example load result equal to the server edition's, a client navigation between two record pages with back and forward and no failed RSC file (`pages` only) |
| `web/a11y-sweep.spec.ts` | axe (WCAG 2.0 to 2.2 A and AA) on every page without a dynamic segment (the folders of `apps/web/src/app`) at 390 and 1280 px, light and dark, the failure naming rule id and node; a page that no entry of `sections` covers fails the spec. Violations not yet fixed go in `known` of the spec with their issue |
| `web/cartridges.spec.ts` | list search and source choice, the ticked rows of the powder and bullet lists (kept in the URL, shift click range, Clear selection, a click on a row opening its record), record page, print layout, CIP outline drawing geometry |
| `web/directory-window.spec.ts` | axe on the cartridge, bullet and powder lists in light and dark, the cartridge list scrolled to its last row with a bounded number of row elements, and left where it is when the browser's records arrive late |
| `web/drawing-face.spec.ts`, `web/drawing-baseline.spec.ts` | rendered text width (two cartridge pages), print page size, pixel baseline of the cartridge drawings (default set: the most common cartridge of each drawing case and a record per geometry they miss, 11 cartridges, light at 390 px, 308 Win. also dark and at 1280 px). The SVG markup of every sample and verified figure is a Vitest golden (`apps/web/test/drawing-markup.test.tsx`) |
| `web/cartridge-designer.spec.ts` | slider keys, redraw, print drawing, 390 px fit, a chosen bullet seated at the entered COAL in the designed case (volume with a measured capacity, "not given" without, depth following the design's L3, axe in light and dark) |
| `web/groups-face.spec.ts` | target face choice and fit |
| `web/target-designer.spec.ts` | the designer's ring ellipses at the entered diameters, a ring that breaks the schema marked invalid and the usable line gone, the saved design reopened from the Open menu after a reload, the saved design chosen as the face of a shot group with its event, axe in light and dark |
| `web/powder-designer.spec.ts` | a powder draft checked against the schema at its fields and the usable line gone with an error, the saved design reopened from the Open menu after a reload, a design chosen in the workbench's Powder card filling the model values and named as a user design in the run's note and the printed report, axe in light and dark |
| `web/default-order.spec.ts` | the discipline and target face directories in the default order of their federation, a header click replacing it. The comparators are Vitest tests (`packages/schema/test/competition-order.test.ts`, `packages/api/test/competition-order.test.ts`) |
| `web/navigation.spec.ts`, `web/search.spec.ts`, `web/settings-dialog.spec.ts`, `web/theme.spec.ts`, `web/safety.spec.ts` | navigation, Alpha badge note, the Report an issue link (with `NEXT_PUBLIC_REPOSITORY_URL` set at build and test, else its absence), site search, Settings dialog (with its Manufacturers tab deleting an unused user manufacturer), theme, first-visit dialog |
| `web/session.spec.ts`, `web/user-data-folder.spec.ts` | session file reading without a network request, the unit choice, example session, print, workspace folder handle, a saved bullet file holding its user manufacturer record |
| `web/user-data-invalid.spec.ts` | a version 1 browser store with a record the format rejects: the Open menu's invalid records list with the error, Download raw and the record as stored in the Export all file |
| `web/component-records.spec.ts` | the bullet record's cartridge list (links) and the cartridge record's link to the bullet list filtered by fit (link, hover help), the bullet data table's End key over the rows its group filter shows. The CIP fit rule is a Vitest test (`apps/web/test/bullet-fit.test.ts`) |
| `web/firearm-library.spec.ts` | the firearm library's search, source filter, count and no-match note over records in the browser store, a row's link opening the editor, the example opened read-only and copied, a mount's zero air and drag factor (with its source) filling the Trajectory tab and named in its result and range card, axe clean in light and dark |
| `web/my-cases.spec.ts` | a user case group in the browser store listed on `/my-cases` and opened in its editor with its measured values, then chosen in the Cartridge card's Case record choice, which fills the measured case capacity field from the capacity record the group names |
| `web/lands-contact.spec.ts` | a firearm in the browser store with a measured lands contact and its bullet: the workbench's Jump row reads "Jump to the lands" with the value from that contact for the same bullet, and keeps the chamber jump with a note for a contact measured with another bullet |
| `web/workbench-no-scroll.spec.ts` | no scroll container overflows and no button, tab, field, label, unit or value is cut at 1280 x 650 and 1536 x 730 (example run and ladders, with the band line shown), 1366 x 657 (example run, 21-step ladder), 1280 x 800 and 1920 x 1080 (example run); at 1100 x 800 only the inputs column scrolls; the ladder steps scroll sideways only. The Trajectory tab as one view (only the results column scrolls) |
| `web/workbench-messages.spec.ts` | the ladder target's message slot keeps the fields, the print button and the table where they are with none, a warning, an error and while typing, and with 1, 3 and 10 messages (focus and End reach the last one), a ladder step size error in the Powder card moves no card, each severity paints its token fill and text with axe clean in light and dark, the notice line keeps its box and what follows it through a result with a warning, an error and none, the warnings list scrolls inside its popover |
| `web/workbench-volume-note.spec.ts` | a volume typed over the example's measured capacity shows the "Chamber volume not measured" note below the results head with the page still in a 1280 x 650 window, axe clean, and the note in the printed report's sub line; the example run shows none |
| `web/workbench-band.spec.ts` | the example run's band line (velocity band, percentiles, input tolerances only), axe on the tiles, the list and that line in light and dark |
| `web/truing.spec.ts` | the truing section of the Trajectory tab: plan statuses, entered rows, a fit with an interval for an identified parameter and a named, valueless one for another, started from the keyboard, axe clean in light and dark |
| `web/workbench-playback.spec.ts` | the interior chart's playback: the bullet flies out of the chart box past the muzzle, slider and values at the muzzle, replay, reduced motion |
| `web/workbench-lot-rows.spec.ts` | the Ladder table's lot rows follow the percentage, the barrel-time chart with the target line, axe in light and dark, the chart at 390 px, the chart and lot rows in the printed report |
| `web/workbench-cartridge-design.spec.ts` | a cartridge design of the browser chosen in the Cartridge card: its volume filled and marked, bore area and twist left empty after a record's values, the figure named for the design, the run's note and the printed report naming it; a load saved on the design keeps `user:<id>` and reopens with the design |
| `web/workbench-load-roundtrip.spec.ts` | a saved load (the example with typed values, a load of records with a typed charge and travel) holds only the typed solver values, reopens from Saved loads with every field as it was and shows nothing unsaved; the example's measured case capacity is a stored user capacity record that the load names; the file of Save options > Download for the API runs through `POST /v1/interior/load-file` and Save still stores the typed keys only |
| `web/workbench-sessions.spec.ts` | a chronograph file read on the Measurements tab is a stored `session` record at once, the mapping of its strings is stored, Save names the saved load on the mapped strings only and the load lists the session, and the load reopens from Saved loads with the strings and their mapping and nothing unsaved |
| `web/workbench-load-notes.spec.ts` | lots typed on the Notes tab, two chronograph sessions with a powder lot that changed between them: the note shows on the Notes tab and under its session on the Measurements tab, Save fixes each session's snapshot, a note dismissed for its session stays dismissed after Save and Open. The rules, wording and snapshots are Vitest tests (`packages/core/test/load-notes.test.ts`, `apps/web/test/load-notes.test.ts`) |
| `web/bullet-search-dialog.spec.ts` | the Bullet card's search dialog: the keyboard flow (open from the button, words and weights, highlight, Escape and Enter, focus returned), Sort by with the focus back in the search box, the card's field finding the same bullets, and axe in light and dark at 390 and 1280 px. Ranking and filters are a Vitest test (`apps/web/test/bullet-search.test.ts`) |
| `web/case-records.spec.ts` | the case list opening a case record with its cartridge link, and the Cartridge card's case record choice filling the capacity field from the record's stated capacity, a typed value replacing it. Which capacity wins is a Vitest test (`apps/web/test/case-capacity.test.ts`) |
| `web/bullet-photo.spec.ts` | the From a photo tool on its rendered sample photograph: the worker cuts the bullet out and measures it (length and diameter with their uncertainties, the scale), axe in the dialog, Open in designer filling the length, a scale point placed from the canvas keys, and a brush stroke from the keys that leaves the length as it was. The cut-out, outline, fits and uncertainties are Vitest tests (`apps/web/test/bullet-photo.test.ts`) |
| `web/workbench-link.spec.ts` | a copied workbench link (fragment) runs the same load with its bullet and powder records missing. Older query links open |

## Commands (this directory, or `-w @open-reloading/e2e` from the root)

- Run the API on `API_URL` and the web app on `WEB_URL` first (the compose stack, or `node packages/api/dist/server.js` and `next start` on a web build made by `npm run build -w @open-reloading/web`)
- Browser, once: `npx playwright install --with-deps chromium`
- Specs that import web sources (`../../apps/web/src/...`) load the workspace packages from their `dist/`. Run `npm run build` at the root first (CI builds schema, importers, core and drawing before `npm run test:e2e`).
- Web pages and the web app's `/api/*` forwarding route carry no version prefix. HTTP requests and responses of the API are tested in `packages/api/test/` and with Schemathesis (`npm run api:conformance`).
- Test: `npm test` (`WEB_URL` default `http://localhost:3001`)
- When to run which:
  - Smoke, fast: `npm run smoke` (root: `npm run e2e:smoke`), `web/smoke.spec.ts` only, about 2 s. The check of a fresh web build in CI.
  - Default, everywhere (local, CI, before a change lands): `npm test` and `npm run drawing-baseline`.
  - Full, on demand (a drawing change that may touch other figures, a font or Playwright upgrade): `npm run drawing-baseline:full`, every sample and verified figure, light and dark, verified ones also at 1280 px (about 420 shots, 3 minutes).
- Single test: `npx playwright test tests/web/smoke.spec.ts -g "<name>"`
- One project: `npx playwright test --project=full`
- Drawing pixel baseline, in the Playwright image (docker or podman): `npm run drawing-baseline`
  - After an intended change add `-- --update-snapshots` and review the snapshots.
  - A drawing case the default set does not draw gets its most common record in `common` of `drawing-baseline.spec.ts`.
  - Playwright never removes a snapshot no test uses: delete those by hand (the full set uses every committed one).
- Visual check (opt-in, against a running web app, images in the git-ignored `visual-check-out/`): `npm run visual-check -- --preset drawing|calculators` or page paths
  - `VISUAL_OUT`: another folder. `VISUAL_WIDTHS` (default `390,1280`): other widths.
  - `VISUAL_LOADS=<n>`: n open loads. `VISUAL_DEFAULTS=1`: that load with the defaulted inputs left out.
  - `VISUAL_TALL=<height>`: one more shot per page in a window that tall.
- Unit tests of the scripts (Vitest): `npm run test:unit`
- `user-data-folder.spec.ts` needs a secure origin (`localhost` or https). From the dev container, `http://host.containers.internal` is not one and its two tests fail. Against the host stack, run the suite in the Playwright image on the host network: `podman run --rm --network=host --userns=keep-id -v "$PWD":"$PWD":z -w "$PWD/apps/e2e" -e CI=1 mcr.microsoft.com/playwright:v<@playwright/test version>-noble npx playwright test`
