---
title: Web script size budgets
description: What the per-route JavaScript budgets of the web app protect, the headroom of every group on the pre-release integration branch, why one small change moves a route by hundreds of bytes, and four ways to restructure the gate.
---

# Web script size budgets

## Question

Web app, build gate: what do the JavaScript budgets of `weight-budget.json` (checked by `check-weight.mts`) protect, where will they block small features next, and should they be loosened or restructured?

## Method

- Measurement: the static export of the pre-release integration branch at commit `2c9f2c65` (`npm ci`, `npm run build`, `npm run static:build`), built on the host (the dev container did not start). The `.next` it left was measured with the `measure` and `routeFiles` functions of `check-weight.mts`, run twice: with the host Node 26.11.1 (zlib-ng 1.3.1) and with the official Node 26.13.0 linux-x64 binary from nodejs.org (checksum verified against `SHASUMS256.txt`), the version the CI `e2e` job resolved from `.nvmrc` in its last run on the default branch. The CI binary's numbers decide pass or fail and are used below unless marked.
- Headroom: per group, the budget minus the largest measured route of the group, for `initial` and `total`.
- Chunk overhead: for `/workbench`, `/groups` and `/`, the sum of the gzip size of each initial file (what the gate counts) against the gzip size of the same files concatenated, and the gzip size of the smallest chunks.
- Whole-app size: the gzip size of every file under `.next/static`, which the service worker precaches (`precacheList` in `offline.ts` keeps every file but source maps).
- Sources: primary only, read on 2026-10-30. Browser projects: web.dev, the V8 blog and the Lighthouse docs. Build tools with budgets: webpack, Angular CLI, Size Limit. One comparable open project that changed its budget rule for the same friction: the Sentry JavaScript SDK.
- Accept rule for a build issue ("Worth building?"): the option reduces bytes a user loads or makes the gate's state visible before it fails, it touches only the web app's scripts, data and docs (no workflow file, no repository setting), and its cost is a small change with a test.

## Formulas

- Headroom of a group $g$ for key $k$ (initial or total): $H_{g,k} = B_{g,k} - \max_{r \in g} w_{r,k}$, with $B$ the budget and $w$ the measured gzip bytes of route $r$.
- Budget rule: $B_{g,k} = \lceil 1.02 \max_{r \in g} w_{r,k} / 1000 \rceil \cdot 1000$ at the time it is set, raised only by an edit that review sees.
- Per-file overhead of a route: $O = \sum_f \mathrm{gz}(f) - \mathrm{gz}(\mathrm{concat}(f))$. Each file is compressed alone over HTTP, so $\sum_f \mathrm{gz}(f)$ is what crosses the wire; $O$ is what splitting into files costs against one stream.

## Numbers

Headroom at `2c9f2c65`, Node 26.13.0, gzip level 9, bytes:

| Group | Budget initial | Largest initial | Headroom initial | Budget total | Largest total | Headroom total | Largest route |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| error page | 179000 | 176553 | 2447 (1.4 %) | 179000 | 176553 | 2447 (1.4 %) | `/_global-error` |
| shell | 424000 | 411916 | 12084 (2.9 %) | 472000 | 461442 | 10558 (2.2 %) | `/` |
| lists | 446000 | 434317 | 11683 (2.6 %) | 494000 | 483843 | 10157 (2.1 %) | `/powders` |
| records | 506000 | 492169 | 13831 (2.7 %) | 554000 | 541695 | 12305 (2.2 %) | `/bullets/[id]` |
| curve charts | 462000 | 453107 | 8893 (1.9 %) | 701000 | 690229 | 10771 (1.5 %) | `/powders/[id]` |
| designers | 419000 | 406438 | 12562 (3.0 %) | 653000 | 552649 | 100351 (15.4 %) | `/cartridges/designer` |
| tools | 565000 | 563957 | 1043 (0.2 %) | 605000 | 604074 | 926 (0.2 %) | `/groups` |
| workbench | 641000 | 640861 | 139 (0.0 %) | 1024000 | 1004874 | 19126 (1.9 %) | `/workbench` |

Other measured values:

- Same build, host Node with zlib-ng: `/workbench` initial 642161 B, 1161 B over its budget; every route 0.1 to 0.2 % larger than with the CI binary (1300 B on `/workbench` initial). The gzip implementation alone moves a route by more than the headroom of tools and workbench.
- The `initial` of `/workbench` binds: the last raise of 20000 B went to its `total`, and its `initial` has 139 B left.
- Shared shell: of the 640861 B initial of `/workbench`, 405449 B are files that 30 or more of the 34 routes load, 78427 B are shared with a few routes and 156985 B are the workbench's own. `/` loads 411916 B. A growth of the shared files spends every group's margin at once.
- Group limits follow the heaviest route only: `/my-cases` (405.8 kB initial) and `/range` (419.4 kB) sit under the 565 kB tools limit, 145 to 159 kB below it; `/cartridges/designer` is 100 kB below its total limit after a drop that lowered no budget.
- Recorded `routes` values are stale: the change column shows +10.0 to +16.9 kB initial on three tools routes and +13.0 kB on `/workbench`, and -87.3 kB total on `/cartridges/designer`, against the values recorded when the budgets were last set.
- Per-file overhead $O$: `/workbench` 14747 B over 34 initial files (434 B per file), `/groups` 12726 B over 29 (439 B), `/` 9694 B over 22 (441 B). The three smallest workbench chunks are 477 to 567 B gzipped (689 to 1847 B raw), mostly the bundler's chunk registration wrapper.
- Whole app: `.next/static` holds 169 JavaScript files, 1984764 B gzipped, plus 313422 B of other files. The service worker precaches all of them once it installs, whatever page was opened.

Answers to the questions of the issue:

1. What each limit protects.
   - `initial` is the script a first visit to the route downloads and runs before the page responds. It is the one with a user-visible effect: download and main-thread execution are the dominant costs of script ([V8, The cost of JavaScript in 2019](https://v8.dev/blog/cost-of-javascript-2019)), main-thread work delays the response to input ([web.dev, Interaction to Next Paint](https://web.dev/articles/inp), good at 200 ms or less; [web.dev, Total Blocking Time](https://web.dev/articles/tbt), good under 200 ms on average mobile hardware). The workbench's own measurement on a throttled CPU found long tasks of 103 to 312 ms ([Automatic run and undo on the workbench](./workbench-auto-run-undo.md)). Confidence high for the direction, low for any byte threshold: the sources give no threshold for this app. The 170 KB figure of [web.dev, Performance budgets 101](https://web.dev/articles/performance-budgets-101) is a 2018 example for a 3G baseline device, and every group here is 2.4 to 3.8 times it; webpack warns at 250000 B per entry point by default and gives no reason for the number ([webpack, Performance](https://webpack.js.org/configuration/performance/)).
   - `total` adds the chunks a route loads on demand (a dialog, a tab). A user pays them only on use, so per route it protects less. The whole app is precached by the service worker (about 2.3 MB gzipped), which Lighthouse's payload guidance speaks to: it flags pages over 5000 KiB and advises under 1600 KiB ([Lighthouse, Avoid enormous network payloads](https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight)); that payload is precached after the first visit, so how it counts for a user is unverified. No per-route limit covers the whole-app size. Confidence medium.
   - The group: one limit for routes that share a layout. It protects the heaviest route and leaves the others with up to 159 kB unguarded (measured). Confidence high.
2. Where it gets in the way next: workbench `initial` (139 B) and tools (1043 B initial, 926 B total) fail on the next change that adds code to them or to the shared shell. Every other group has 1.4 to 3.0 % left, about one or two small features of shared code. Confidence high (measured), with the caveat that the CI run itself was not repeated.
3. Options, cost and what each protects less:
   - Per-route limits instead of group totals: 34 limits instead of 8, each set by the same rule. Guards the light routes the groups leave open, but adds friction (34 limits that can block) and does not touch the problem of this issue. Not recommended.
   - Headroom rule (limit = recorded value + fixed margin, re-set by a documented step): the current rule is this with a 2 % margin and no re-set step, which is why the recorded values drifted. A periodic re-set is what Sentry did with a weekly automatic raise and then removed: it stopped the friction of a change that only tipped an old limit, but hid larger increases under the raised limit ([getsentry/sentry-javascript#21813](https://github.com/getsentry/sentry-javascript/issues/21813)). Cost: one step per release or per raise. Protects less against slow growth. Recommended only as the re-record step of the next option.
   - Warning band before the failing limit: Angular CLI has `maximumWarning` and `maximumError` per budget, also relative to a baseline ([Angular, Building, Configuring size budgets](https://angular.dev/tools/cli/build)); webpack has hints `warning` and `error` ([webpack, Performance](https://webpack.js.org/configuration/performance/)). In `check-weight.mts` it costs a headroom column and a "near the limit" line in the table it already writes to the job summary, with no workflow change. Protects nothing more by itself, but shows the state before a change fails. Recommended.
   - Per-change limit (not in the issue, the comparable project's answer): measure the base branch, fail a change that adds more than a fixed number of gzip bytes to any route, with a label to accept a larger one, and keep the totals as report only. Sentry adopted this with 500 B on gzipped bundles ([getsentry/sentry-javascript#24737](https://github.com/getsentry/sentry-javascript/pull/24737)). It fixes the problem of this issue (a small change no longer fails because earlier changes used the margin) and catches a large change at any size. Cost: a base-branch measurement stored by CI and a label path, both workflow changes. Protects less against slow growth of many small changes. Owner decision.
   - Splitting the workbench into lazily loaded parts: the only option that lowers what a user downloads. The page adds 235 kB initial over the shell, 157 kB of it its own chunks; it already loads the seating preview, measurements, the groups tab and the bullet search dialog with `next/dynamic` (`workbench-figure.tsx`, `workbench-results.tsx`, `workbench-inputs.tsx`). Which further parts are not needed for the first render was not measured here; a module-level breakdown comes first. Cost: one engineering change with a visual check; moves bytes from `initial` to `total`, so its `total` limit then binds. Recommended as a build issue with that breakdown as its first step.
4. Why a small change moves a route by hundreds of bytes: each file is compressed alone, and a file costs about 430 to 440 B against one stream (measured, three routes): the gzip header, the chunk registration wrapper, and the compression context the file cannot share with its neighbours. When a module is imported from a second route, the bundler can move it, and modules near it, into a new or different shared chunk; a route then loads one more file, or the same code split differently, and pays one file's overhead with no new code. That the bundler places a module imported from two routes into a chunk of its own is inferred from the chunk counts and the stale-value changes above, not read in a primary source (the [Turbopack docs](https://nextjs.org/docs/app/api-reference/turbopack) do not describe the chunking rule): unverified. Should the gate measure it differently: no. The per-file sum is what crosses the wire, so it is the true cost; a gzip of the concatenation would be steadier but would hide real bytes. What should change is the reaction to it: a per-change limit of a few hundred bytes would trip on it, so its threshold must sit above one file's overhead (Sentry's 500 B does). Confidence medium.
5. Recommendation: see Result.

## Result

no change. Not adopted in code; recommendation (medium confidence): keep the absolute group budgets as a ceiling, make their headroom visible with a warning band and re-recorded weights in `check-weight.mts`, split the workbench's first render, and let the owner decide whether CI gates on a per-change limit instead.

- Build issues opened (labelled needs-triage): issue #650, the headroom column, near-limit warning and re-recording of the weights in `check-weight.mts` and `weight-budget.json`; issue #651, a module-level breakdown of the workbench's initial chunks followed by moving the parts not needed for the first render behind `next/dynamic`.
- For the owner, and not opened as issues: whether CI gates on a per-change limit with a label to accept (a workflow change: a base-branch measurement job, an artifact, the label check); whether the workbench `initial` (139 B left) and tools budgets are raised again before the split lands, since the next change to them fails; whether the gate's numbers should stop depending on the zlib build (the CI Node version is resolved from `.nvmrc` as the newest 26.x, so a Node update can move every route by up to about 1 kB).
- Per-route limits and a periodic automatic raise are not recommended.

## Data basis

measured: the static export of the pre-release integration branch at `2c9f2c65`, built on one host and measured with the gate's own functions under the CI Node binary; sources as listed under Method.

## Where in the app

- `apps/web/weight-budget.json`: the budgets and recorded weights.
- `apps/web/scripts/check-weight.mts`: `measure`, `routeFiles`, `violations`, `table`.
- `apps/web/src/lib/offline.ts`: `precacheList`, the whole-app precache.
- `apps/web/src/components/workbench-results.tsx`, `apps/web/src/components/workbench-figure.tsx`, `apps/web/src/components/workbench-inputs.tsx`: the workbench's existing lazy parts.

## Confidence

medium: the headroom and overhead numbers are measured with the CI Node binary but not in a CI run; the chunking mechanism is inferred, and the sources give no byte threshold for this app.
