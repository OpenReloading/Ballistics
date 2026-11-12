# S10: a Serwist worker per edition on the Start output

Result: **pass**. Two criteria pass with findings:

- No IndexedDB: the string check on the worker file fails, but the runtime check decides and it passes.
- Editions: a cross-folder fetch reaches the next worker, which leaves it to the network.

All criteria pass in Chromium. WebKit passes every check Playwright supports there. Firefox passes precache, budget, cache names and update. Its offline checks are not supported (offline emulation does not reach the worker), and the stable-worker check is inconclusive.

## Versions

| Package                 | Version                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| serwist, @serwist/build | 9.5.13                                                                    |
| @tanstack/react-start   | 1.169.4                                                                   |
| Vite (Rolldown)         | 8.3.5                                                                     |
| Node                    | 26.12.1 (dev container), 26.13.0 (Playwright image)                       |
| @playwright/test        | 1.65.0                                                                    |
| Chromium                | 158.0.8127.18 (headless shell, dev container)                             |
| WebKit, Firefox         | 27.2, 159.0 (official Playwright 1.65.0 image, arm64, the digest CI pins) |

## Commands

Run in the dev container from the repository root unless stated:

```sh
pnpm install                                     # adds serwist and @serwist/build to the spike
pnpm run build
PAGES_EDITION=next pnpm run static:build         # the Next.js export of the next edition in pages/
pnpm --dir apps/spike-start exec node scripts/site.ts      # site/: stable at /, next at /next/, worker injected per edition
pnpm --dir apps/spike-start exec node scripts/variant.ts   # site-b/next: build B, one changed source file
pnpm --dir apps/spike-start exec playwright test e2e/s10.spec.ts --project chromium --workers 1
```

WebKit and Firefox ran natively in the pinned Playwright image (arm64, no emulation), from `apps/spike-start`:

```sh
podman run --rm --ipc=host -v "$PWD:/work:z" -w /work/apps/spike-start -e PW_OUT=test-results-webkit \
  mcr.microsoft.com/playwright:v1.65.0-noble node_modules/.bin/playwright test e2e/s10.spec.ts --project webkit --workers 1
```

- `scripts/site.ts` builds and injects both editions in 9.0 s (4.4 s stable, 4.3 s next; each is the Vite build plus the injection).
- `scripts/serve.ts` serves `site/` on port 3043. `PUT /__next?dir=<folder>` swaps the folder behind `/next/`, which stands in for a new deploy of that edition.

## Criteria

Each check ran three times per browser (`--repeat-each 3`).

| Criterion                                                                                                                    | Chromium                                                                     | WebKit                                           | Firefox                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Precache per edition: every entry revisioned or hashed; build B changes only the entries whose files changed                 | pass                                                                         | pass                                             | pass                                                                                             |
| Precache per edition: on `/next/` only `next:` cache names; the stable worker creates none                                   | pass                                                                         | pass                                             | pass                                                                                             |
| Budget: at or under 1,500,000 bytes gzip level 9 per edition                                                                 | pass (485,826 stable, 485,881 next)                                          | same build                                       | same build                                                                                       |
| Update: new worker stays `waiting` across a reload and a second tab until 'skip-waiting', then one reload onto the new build | pass                                                                         | pass                                             | pass                                                                                             |
| No IndexedDB: worker file holds no `indexedDB`                                                                               | **fail** (see findings)                                                      | same file                                        | same file                                                                                        |
| No IndexedDB: `indexedDB.databases()` is empty after install, activation, update and offline reload                          | pass                                                                         | pass (`databases()` present)                     | pass (the reload was not offline, see below)                                                     |
| Offline: `/`, `/next/`, shell-answered `/next/workbench/`, a prerendered record page, record index from the cache            | pass                                                                         | pass                                             | not supported                                                                                    |
| Editions: with only the stable worker, `/next/` and `/docs/` reach the network untouched                                     | pass                                                                         | pass                                             | inconclusive (no request answered by the stable worker, but the `/next/` page had no controller) |
| Editions: the next worker never sees a request outside `/next/`                                                              | pass for all of the edition's own traffic (finding below)                    | not supported (worker handles are Chromium only) | not supported                                                                                    |
| Handover on one persistent profile, today's worker to Serwist and back                                                       | pass                                                                         | pass                                             | skipped (step 2 needs offline)                                                                   |
| In-place injection on the build output folder                                                                                | pass (`dist/client`, the built worker overwrites the copy of `public/sw.js`) | same build                                       | same build                                                                                       |

Handover details: Chromium took 11.3 to 12.3 s, WebKit 7.4 to 7.9 s.

- Each takeover was one document load: no blank page, no loop, no page errors.
- Today's caches were still listed after step 2, and the Serwist precache after step 3. After step 3 the list was `next:openreloading-shell-<build id>, next:openreloading-app-precache`.
- The record written to `next:openreloading-user-data` in step 1 was read back in step 3.

## Precache per edition

The stable edition has 15 entries: 1,534,955 bytes raw, 485,826 gzip 9. The next edition has 15 entries: 1,535,197 raw, 485,881 gzip 9. The worker file is 32,944 bytes (stable) and 32,936 bytes (next). These are the stable edition's entries; next differs only in its hashes and paths:

| Entry                                           |     Raw |  Gzip 9 | Version by |
| ----------------------------------------------- | ------: | ------: | ---------- |
| `assets/index-*.js` (entry chunk)               | 477,862 | 148,838 | hash       |
| `assets/inter-latin-ext-wght-normal-*.woff2`    |  85,068 |  85,116 | hash       |
| `api/catalogue/index.json` (record index)       | 534,068 |  68,084 | revision   |
| `assets/inter-latin-wght-normal-*.woff2`        |  48,256 |  48,254 | hash       |
| `assets/ui-*.css`                               | 261,866 |  38,388 | hash       |
| `assets/inter-cyrillic-ext-wght-normal-*.woff2` |  25,960 |  25,988 | hash       |
| `assets/inter-greek-wght-normal-*.woff2`        |  18,996 |  19,024 | hash       |
| `assets/inter-cyrillic-wght-normal-*.woff2`     |  18,748 |  18,776 | hash       |
| `assets/inter-greek-ext-wght-normal-*.woff2`    |  11,232 |  11,236 | hash       |
| `assets/inter-vietnamese-wght-normal-*.woff2`   |  10,252 |  10,275 | hash       |
| `assets/dist-*.js`                              |  10,099 |   3,820 | hash       |
| `index.html`                                    |  16,021 |   3,799 | revision   |
| `_shell.html`                                   |  15,715 |   3,690 | revision   |
| `assets/routes-*.js`                            |     476 |     321 | hash       |
| `assets/page-bar-*.js`                          |     336 |     217 | hash       |

The spike has no icons or web manifest, so none are listed. Route chunks and record files are cached on first use.

Build B changed only `src/routes/workbench.tsx`. Of the 15 entries, 4 changed: the entry chunk, `routes-*.js`, `index.html` and `_shell.html`. Every kept entry kept its revision exactly when its bytes were unchanged.

## Findings

1. **`cacheId` does not rename the precache.** The constructor builds the precache strategy (`serwist/dist/index.mjs:1323-1325`) before it applies `cacheId` (line 1335). With `cacheId: 'next:...'` the precache stayed `serwist-precache-v2-<scope>`, which has no edition prefix. Fix (used here): `precacheOptions: { cacheName: storageName('openreloading-app-precache') }`, with a name per runtime route. Confidence: high (measured, then read in the source).
2. **The worker file contains IndexedDB code that never runs.** The `Serwist` constructor references `initializeGoogleAnalytics` behind `offlineAnalyticsConfig` (lines 1348-1349). That pulls in the `idb` package, so the bundle contains `indexedDB.open(...)`, `serwist-background-sync` and `www.google-analytics.com`. The worker sets no offline analytics, background sync or expiration, and no database appeared in any browser. A planned build gate that fails on the string `indexedDB` in the worker file would fail on this worker. Cheapest fix: gate on the runtime check (`indexedDB.databases()` after install, update and an offline reload), confidence high. Alternative, unverified: alias `idb` to a stub in the worker build.
3. **Hash cascade.** One changed route file changed 4 precache entries (about 156 KB gzip to fetch again): the entry chunk imports the route chunk by its hashed name, and the home chunk imports the entry. Revisions follow bytes exactly, so this is correct, but most of an update's download is the entry chunk.
4. **Serwist's own `SKIP_WAITING` listener does not check the origin** (lines 1336-1339). The spike adds its own listener for the string `'skip-waiting'` with an origin check and keeps Serwist's for `{ type: 'SKIP_WAITING' }`. A message reaches a worker only from same-origin clients, so the check is defensive.
5. **A cross-folder fetch reaches the next worker.** A fetch from a `/next/` page to `/api/catalogue/index.json` was seen by the next worker, because a controlled page sends all its requests to its controller (Service Worker spec, Handle Fetch). The worker has no route for it and leaves it to the network. Every request the next edition makes itself stayed under `/next/`.
6. **Rolling back leaves the other generation's caches.** Today's worker deletes only caches with its shell prefix, so after step 3 the Serwist precache (about 1.5 MB raw) stays. The same holds the other way. The first-use caches (`next:openreloading-app-pages`, `-assets`, `-records`) have no expiration, because expiration uses IndexedDB, so they grow with use.
7. **Test harness notes.**
   - On a new profile, today's Safety dialog covers its update notice until it is accepted.
   - TanStack Router updates `history.state` after a reload from today's app, which counts as a second `framenavigated`, so the spec counts main-frame document requests instead.
   - WebKit leaves the earlier page's `ServiceWorker` object at `activating` after `controllerchange`, while a new page or a reload reads `activated`.
   - In Firefox, `context.setOffline` does not reach the worker's own fetches: offline, the worker fetched an uncached page from the network. This is measured; there is no Playwright doc for it.
   - In Chromium, a fetch listener added later through `worker.evaluate` is never called, so the spec patches the `FetchEvent.prototype.request` getter instead.

## Sources

- `injectManifest` options (`swSrc`, `swDest`, `globDirectory`, `globPatterns`, `manifestTransforms`): https://serwist.pages.dev/docs/build (`/docs/build/inject-manifest` redirects there). That `injectManifest` ignores `swSrc` and `swDest` in the glob is read in `@serwist/build/dist/index.mjs:535-538`.
- `dontCacheBustURLsMatching`, used for `assets/*-<hash>.*`: https://serwist.pages.dev/docs/build/configuring/dont-cache-bust-urls-matching
- The `Serwist` class (`precacheEntries`, `precacheOptions`, `skipWaiting`, `clientsClaim`, `runtimeCaching`, `fallbacks`): https://serwist.pages.dev/docs/serwist/core/serwist
- Precaching and revisions: https://serwist.pages.dev/docs/serwist/guide/precaching
- Handle Fetch, which sends a controlled client's requests to its worker: https://w3c.github.io/ServiceWorker/#handle-fetch
