# @open-reloading/e2e

Playwright tests against the static export of the web app (`pages/`, served by `npm run pages:serve`) and a running API. The export has no API: pages read data files (`/api/<kind>/<id>.json`, `/api/catalogue/index.json`) and compute in Web Workers, so a spec that waits for or mocks a data request names that file. Every page path has a trailing slash (`exported` of `web/nav.ts`).

## Projects

- `full` (`tests/web/`): Chromium against the export at the site root on `WEB_URL` (default `http://localhost:3003`). The API on `API_URL` (default `http://localhost:3000`) is read by `web/smoke.spec.ts` and `web/workbench-load-roundtrip.spec.ts` only.
- `pages`, only with `PAGES_URL` set (an export under a base path, trailing slash): `web/smoke.spec.ts`, which opens pages by relative paths.
- `firefox` and `webkit`, only with `ALL_ENGINES` set: `web/smoke.spec.ts` in Firefox and WebKit (`apps/docs/docs/browsers.md`). Install them once with `npx playwright install --with-deps firefox webkit`, then `ALL_ENGINES=1 npx playwright test --project=firefox --project=webkit`.

## Writing specs

- One spec per area. A spec checks what only a browser shows; values, formats and parsing are Vitest tests (`apps/web/test/`, `packages/*/test/`). No spec needs manufacturer or load data.
- Every test has its own browser context and `fullyParallel` is on: a test never relies on another.
- A spec that clicks or types right after loading a page opens it with `gotoHydrated` (`web/nav.ts`), which waits for `html[data-hydrated]` and the `h1` of `PageBar`. No `toPass` retry for a click before hydration.
- A cartridge record a spec opens is in the export's sample (`apps/web/src/lib/prerender-sample.ts`): any other cartridge answers 404 and a link to it logs a failed request. A spec that checks the console starts where every cartridge it links is in the sample.
- A route with an `[id]` segment needs a record in `web/a11y-states.spec.ts`, and a page without one an entry of `sections` (`web/a11y-sweep.spec.ts`); both specs fail otherwise.

## The accessibility sweep

`web/a11y.ts` runs axe-core on a page state and reports each finding `web/a11y-lists.json` does not list. A new dialog, popover or page state adds a state to `a11y-states.spec.ts`, not an axe run of its own.

- Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` (with `target-size`) and `best-practice`. No rule is switched off. Widths 320, 390 and 1280 px, light and dark.
- A "needs review" result fails like a violation unless listed. An entry names the rule, a part of the node's selector or markup (after the `data-testid` of its closest marked ancestor) and, where it applies, the route or state (`where`).
- `a11y-lists.json`: `known` (a finding not fixed, with its reason and `workaround`; fix the component instead where possible) and `reviewed` (a "needs review" result a person found to pass, with the reason; a `color-contrast` entry also gives the measured contrast in both themes, recheck it when the tokens change).

## Commands (this directory, or `-w @open-reloading/e2e` from the root)

- First, at the root after `npm run build`: `npm run static:build` (the sample) or the full export `npm run pages -w @open-reloading/tools -- --no-docs`, then `npm run pages:serve`, and the API on `API_URL` (`node packages/api/dist/server.js` or `docker compose up api`). Specs that import web sources load the packages from their `dist/`.
- Browser, once: `npx playwright install --with-deps chromium`
- Test: `npm test`. Smoke only: `npm run smoke` (root: `npm run e2e:smoke`). Single test: `npx playwright test tests/web/smoke.spec.ts -g "<name>"`. One project: `--project=full`.
- Default before a change lands: `npm test` and `npm run drawing-baseline`. On demand (a drawing change that may touch other figures, a font or Playwright upgrade): `npm run drawing-baseline:full` (needs a full export).
- Drawing pixel baseline: runs in the Playwright image (docker or podman), so from the dev container build the export inside and run `npm run pages:serve` and `npm run drawing-baseline` on the host.
  - After an intended change add `-- --update-snapshots` and review the snapshots. Playwright never removes an unused snapshot: delete it by hand.
  - A drawing case the default set does not draw gets its most common record in `common` of `drawing-baseline.spec.ts`.
- Visual check (images in the git-ignored `visual-check-out/`): `npm run visual-check -- --preset <preset>` (`drawing` or `calculators`) or page paths. `VISUAL_OUT`, `VISUAL_WIDTHS` (default `390,1280`), `VISUAL_LOADS=<n>`, `VISUAL_DEFAULTS=1`, `VISUAL_TALL=<height>`.
- Unit tests of the scripts: `npm run test:unit`
- Pages under a base path: `PAGES_BASE_PATH=/Ballistics npm run pages:build`, `PAGES_BASE_PATH=/Ballistics npm run pages:serve`, then `PAGES_URL=http://localhost:3003/Ballistics/ npm test -- --project=pages`.
- `user-data-folder.spec.ts` needs a secure origin; `http://host.containers.internal` is not one. Run the suite on the host network instead: `version=$(node -p "require('@playwright/test/package.json').version") && podman run --rm --network=host --userns=keep-id -v "$PWD":"$PWD":z -w "$PWD/apps/e2e" -e CI=1 "mcr.microsoft.com/playwright:v$version-noble" npx playwright test` (from the root, as `scripts/baseline.sh` looks up the version).
