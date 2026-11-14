---

title: mantine-datatable on the bullet list
description: A one-day trial of mantine-datatable 9.4.0 against the hand-written directory table on /bullets, measured on JavaScript and CSS weight, axe, keyboard use, semantics, German text and selection, and why the table stays.
---

# mantine-datatable on the bullet list

## Question

Web app, directory lists: can the open-source table component mantine-datatable replace `DirectoryTable` on `/bullets`, the hardest list (1684 catalog rows, as counted in `bullet-list.tsx`; Compare picks, shift ranges, state in the URL, German, print), without losing a behavior and within the JavaScript budget? The diff is the closed draft pull request [#1162](https://github.com/OpenReloading/Ballistics/pull/1162), head `dc0d94d3`; its throwaway spec of 12 checks, `apps/e2e/tests/web/datatable-trial.spec.ts`, lives only there.

## Method

- Trial: branch from `main` at `7e1255c3`, `mantine-datatable` 9.4.0 and `clsx` 2.1.1 pinned exactly in `apps/web`, a `DatatableTrial` adapter of 191 lines with the props of `DirectoryTable` (minus `onOpen`), swapped in on `/bullets` only. Mapped: the three sort states to and from the URL sort, the help tooltips on the heads, number alignment and dim cells, the tick order, the maximum of 4 and `can` through `isRecordSelectable`, German box labels, the empty state, 50 rows per page in place of windowing, a print of 200 rows with the note, the noscript list, six new German catalog entries. Not rebuilt, as decided in advance: the roving tab stop and arrow keys, windowing, `aria-sort` and the `columnheader` role, German sort-state labels, the "At most {max}" tooltip. No patch of the package. The existing `.directory-table` styles were reused through `classNames`, `data-row`, `data-id` and `data-picked`.
- Same machine, same dev container, `main` first and the trial second: `pnpm run build`, `pnpm run static:build`, `pnpm --filter @rangefoundry/web run check-weight` (the trial ran before the scope rename, under the package's earlier name), `node tools/src/licences.ts`, gzip level 9 of every CSS file of the build, Playwright (`--project=full`, Chromium) on the existing specs for the list and on a throwaway spec of 12 checks that prints each measured value.
- The export used by the e2e job is the sample build: `/bullets` holds 7 demo bullets. Paging and print were checked with 240 more bullets seeded into the browser store (247 rows). The 1684-row catalog was not measured. Firefox and WebKit were not run (the Shift+Space range, the `role="button"` heads); 320 and 390 px were covered by axe and two screenshots only. Seen but not checked further: a disabled select-all box in the head, and an extra `top: 0` rule the phone's sticky head needed.
- Accept rule, set before the build: the license passes; `check-weight` passes with `weight-budget.json` unchanged; no new axe finding; no keyboard check worse than today; no English text under German; sort in three states, in the URL and as `aria-sort`; selection with maximum, `can`, order and both range gestures; paging accepted (default: no; the owner has not decided, and the verdict does not depend on it); print of 200 rows with its note; and at least one criterion better than today. All must hold.
- Sources: the published 9.4.0 package (license field, `DataTableHeaderCell`, `DataTableRowSelectorCell` read from its source map, 2026-11-10), [npm, mantine-datatable](https://www.npmjs.com/package/mantine-datatable), [source repository](https://github.com/icflorescu/mantine-datatable); the meaning of `aria-sort` from [WAI-ARIA 1.2, aria-sort](https://www.w3.org/TR/wai-aria-1.2/#aria-sort); Space on a `role="button"` from the [WAI-ARIA APG, Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/).

## Formulas

None: no model equation. A route's weight is the sum of the gzip level 9 sizes of the JavaScript files it loads (`initial`) or may load (`total`), as in the [web size budgets](./web-size-budgets.md); a delta is the trial minus `main`.

## Numbers

| Criterion                                                                         | `main`                                               | Trial                                                                                                             |
| --------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| License (`node tools/src/licences.ts`)                                            | pass                                                 | pass after a one-line NOTICE refresh (MIT)                                                                        |
| `/bullets` initial, gzip                                                          | 433161 B (budget 446000)                             | 460368 B, +27207 B, 14.4 kB over                                                                                  |
| `/bullets` total, gzip                                                            | 486206 B (budget 497000)                             | 513423 B, +27217 B, 16.4 kB over                                                                                  |
| Other routes                                                                      | `/cartridges` 430213 B, `/workbench` total 1059880 B | +178 B, and +146 B (26 B over the budget at `7e1255c3`): the new German entries, probably                         |
| CSS, gzip of all files                                                            | 60509 B                                              | 63614 B, +3105 B                                                                                                  |
| axe on `/bullets` (3 widths, light and dark; ticked rows)                         | 0 findings                                           | 0 findings                                                                                                        |
| Existing list specs (bullet list, cartridge list, windowing), 38 tests            | pass                                                 | pass, after one fix (tick box 16 px, now 24 px)                                                                   |
| 104 further tests in 16 spec files touching `/bullets`                            | not run                                              | pass                                                                                                              |
| Tab stops in the table body, 7 rows                                               | 1                                                    | 14 (2 per row, about 100 per page of 50)                                                                          |
| Arrow keys between rows                                                           | work                                                 | none                                                                                                              |
| Enter and Space on a head                                                         | sort                                                 | Enter sorts, Space does nothing                                                                                   |
| Heads with the `columnheader` role, `aria-sort` after a sort                      | 11 of 11, 1                                          | 2 of 11, 0                                                                                                        |
| English under German                                                              | none                                                 | "Not sorted", "Sorted ascending" (fixed labels of the package's sort icons)                                       |
| Sort in three states in the URL by click                                          | yes                                                  | yes                                                                                                               |
| Order of ticks, maximum 4, click range, Shift+Space range, print of 200 with note | yes                                                  | yes (adapter code)                                                                                                |
| Tooltip "At most 4 at once"                                                       | shown                                                | not shown                                                                                                         |
| Row the user cannot tick (`can` false: a bullet of the user's own)                | no box                                               | a disabled box                                                                                                    |
| DOM rows with 247 rows                                                            | 27 (windowed)                                        | 50 (paged)                                                                                                        |
| Code                                                                              | 901 lines of `directory-table.tsx`, about 80 rules   | adapter 191 lines and 23 CSS lines added, 6 exports added, no table code removed (the other lists keep the table) |

Failures by kind: 7 of the 12 throwaway checks fail, all of behavior (tab stops, arrows, Space, `aria-sort`, `columnheader`, English labels, tooltip); no existing spec fails on a class name, because the adapter keeps the class and data attributes they select.

## Result

worse. Not adopted: `DirectoryTable` stays on every list.

- The weight alone fails the gate: the build adds 27.2 kB to `/bullets` against 10.8 kB of total headroom (the forecast before the build was 16.6 kB for the package alone, unmeasured; the rest is presumably the Mantine components it pulls in), and the trial may not raise `weight-budget.json`.
- In the trial the package gave a sortable head `role="button"` and handled Enter only, set no `aria-sort` after a sort (Chromium), gave every row control a tab stop, and labeled its sort icons in English. Fixing these means a patch or an upstream change; none was made.
- The trial reuses the existing table styles, so it removes no code; a full swap would remove the 901 lines only if every list moved.
- Not tried: 9.7.5 (installable from 2026-11-12, once it is older than the 3 days of `minimumReleaseAge` in `pnpm-workspace.yaml`). Whether it fixes the points above is unverified.
- A repeat starts from the points above: a release that sets `aria-sort` and `columnheader`, handles Space, takes a localized label for the sort icons, and a build under 11 kB larger on `/bullets`.

## Data basis

measured: builds of `main` and of the trial in one container, the gate's own `check-weight` functions, Playwright on Chromium; the package's source as published for 9.4.0.

## Where in the app

- `apps/web/src/components/directory-table.tsx`: the table the trial was measured against.
- `apps/web/src/components/bullet-list.tsx`: the list that was swapped.
- `apps/web/weight-budget.json`: the budget the trial exceeded.
- `apps/web/scripts/check-weight.mts`: the gate.
- `apps/web/src/app/layout.tsx`: where the component styles are imported.

## Confidence

high: the weight is the same in four builds and fails the gate by 14 to 16 kB; the keyboard and semantics checks ran once, in Chromium; the host gzip for CSS and the container's Node zlib for JavaScript are not the CI binary, which moves a route by 0.1 to 0.2 % ([web size budgets](./web-size-budgets.md)), about 0.5 to 1 kB here against the 27 kB found.
