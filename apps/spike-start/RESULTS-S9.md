# S9 results: a 200,000-row grid on TanStack Table and Virtual

A grid of 200,000 rows on TanStack Table 9 (manual sorting and filtering) and TanStack Virtual scrolls without a single long task in Chromium, with both an in-memory source and a chunked source answered after a delay. The full APG grid keyboard pattern works in Chromium, WebKit and Firefox, and so does reaching the last row. No tuning was needed. The remaining cost is on the data side: sorting the 200,000 rows in `arraySource` blocks the main thread for 65 to 300 ms.

## Versions

| Package                 | Version                                         |
| ----------------------- | ----------------------------------------------- |
| @tanstack/react-table   | 9.3.1 (table-core 9.3.1, store 0.11.2)          |
| @tanstack/react-virtual | 3.14.26 (virtual-core 3.19.11)                  |
| @tanstack/react-start   | 1.169.4                                         |
| @tanstack/react-router  | 1.170.46                                        |
| vite (Rolldown)         | 8.3.5                                           |
| react, react-dom        | 19.3.1                                          |
| @mantine/core           | 9.8.0                                           |
| @playwright/test        | 1.65.0                                          |
| Chromium                | 158.0.8127.18 (Playwright build 1254, headless) |
| WebKit                  | 27.2 (Playwright build 2388, headless)          |
| Firefox                 | 159.0 (Playwright build 1572, headless)         |
| Node                    | 26.12.1 (dev container)                         |

Base: `main` at `66b4730f`, with the spike app of `spike/start-editions-hydration` at `c2773290` and, from `spike/start-shared-view`, the `cp` fix in `scripts/site.ts` for the dev container's bind mount.

Machine: Apple M5 Max, 36 GB, macOS 27.0. Tests run in the dev container (Podman 6.1.4, Linux 7.2.7 aarch64, 6 CPUs, 19.5 GiB). Viewport 1280 by 720 (the Playwright desktop devices); the scroll area is 430 px high, 13 rows per page.

Row height: 30 px (`--size-control-row`, 1.875rem at a fine pointer; 2.75rem, 44 px, at a coarse pointer was not measured). The grid reads it from the rendered header row.

## Commands

All of them run in the dev container, from `apps/spike-start`, after `pnpm install` and `pnpm run build` at the root.

1. `node scripts/data.ts`, then `PRERENDER=sample node scripts/site.ts`: both editions into `site/`, `/grid/` included.
2. `pnpm exec playwright test e2e/s9.spec.ts --workers 1`: all checks in the three engines (it serves `site/` on port 3043). One worker, so that the long-task gate runs on an otherwise idle machine. The measurements are printed as `S9 ...` lines.
3. `gzip -9 -c site/assets/grid-<hash>.js | wc -c`: the chunk size.

The page is `/grid/`. Its search parameters: `?source=chunked` for the chunked source, `?defer=1` to build the rows only on a `grid:start` event (for the heap reading before the rows exist), `?overscan=<n>` to tune overscan.

## The grid

- `src/routes/grid.tsx` builds 200,000 generated rows (8 columns) and wraps `arraySource` of `@open-reloading/ui` in a timing probe. With `?source=chunked` it also wraps it in `chunkedSource`.
- `src/grid/chunked-source.ts` answers every range from whole chunks of 5,000 rows. Each chunk is loaded once per filter and sort, 40 ms after it is first asked for. A query that is aborted leaves its chunk loads running, so the next query can use them.
- `src/grid/grid.tsx` is the grid. Table runs with `rowSortingFeature` and `columnFilteringFeature`, `manualSorting` and `manualFiltering`, and holds only the rows of the current window. Virtual counts `DataPage.total`, with overscan 12, a fixed row height (`estimateSize`, no per-row measurement) and the header row as `paddingStart`. Each window asks the source for the visible rows plus one page on each side.
- The focus model is our own: a roving `tabindex`, with the focused row added to Virtual's range through `rangeExtractor`, so the row stays rendered while it is scrolled away.

## Criteria

| #   | Criterion                                                                                             | Result                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1a  | Chromium, production build: no long task (50 ms or more) during 10 s of wheel scrolling at 3,000 px/s | Pass with both sources: 0 long tasks in 6 of 6 runs each                                                                              |
| 1b  | The same during 50 Page Down presses                                                                  | Pass with both sources: 0 in 6 of 6 runs each (650 rows moved)                                                                        |
| 1c  | The same during Control+End to the last row and Control+Home back                                     | Pass with both sources: 0 in 6 of 6 runs each                                                                                         |
| 1d  | The same while the scroll bar's thumb is dragged to the middle                                        | Pass with both sources: 0 in 6 of 6 runs each (the drag ends at 50.1% to 51.9% of the scroll range)                                   |
| 2   | Keyboard, APG grid pattern, in Chromium, WebKit and Firefox                                           | Pass in all three (below)                                                                                                             |
| 2   | `role="grid"`, `aria-rowcount`, `aria-colcount`, `aria-rowindex`                                      | Pass: `aria-rowcount` 200,001, `aria-colcount` 8, `aria-rowindex` on every row (the header row is 1)                                  |
| 2   | Focused cell keeps the focus, with its `aria-rowindex`, after scrolling out of the window and back    | Pass in all three: focus on row 1 stays through a scroll to 1,500,000 px (about row 50,000) and back; its row keeps `aria-rowindex` 2 |
| 2   | Last row reachable by keyboard, `aria-rowindex` 200,000                                               | Pass in all three, with `aria-rowindex` 200,001 (deliberate, below)                                                                   |
| 3   | Last row reachable by scrolling in all three engines; scroll height                                   | Pass in all three with both sources: scroll height 6,000,030 px (200,001 rows of 30 px), no engine clamps it                          |
| 4   | Recorded: 4x CPU slowdown, heap, DOM nodes, sort and filter, chunk size                               | Below                                                                                                                                 |
| 5   | Tuning if the gate fails                                                                              | Not needed: overscan 12 and a fixed row height pass                                                                                   |
| 6   | Table 9 docs for manual sorting, filtering and `rowCount`                                             | Below                                                                                                                                 |

The `longtask` observer starts after the first rows have painted, as the brief requires, so building the rows and the first query are outside the gate. It does see the main thread: in the same page, sorting by name shows up as a 301 ms long task.

Six runs per source: two on the committed code, and four before the last lint fixes, which changed only the header's Enter and Space handling, a `tabindex` on the grid element and types.

Keyboard, checked step by step in each engine:

- One tab stop. Tab from the filter field lands on the first column header. Shift+Tab from a cell goes back to the filter field, Tab returns to the same cell, and one more Tab leaves the grid.
- Arrow keys, Home and End within the row, Control+Home to the first header cell and Control+End to the last cell of the last row.
- Page Down and Page Up by one page (13 rows).
- Enter on a column header sorts by that column.

Assistive technology itself was not run. The check covers what it would read: the focused element, and the `aria-rowindex` of its row.

## Measurements

### At 4x CPU slowdown (`Emulation.setCPUThrottlingRate`, recorded)

Six runs per source, as for the gate, with the same four scroll runs:

| Source  | Wheel | Page Down | Control+End and Home | Drag                  |
| ------- | ----- | --------- | -------------------- | --------------------- |
| array   | none  | none      | none                 | one 61 ms task, 1 run |
| chunked | none  | none      | none                 | none                  |

### Heap and DOM (Chromium, CDP `Performance.getMetrics` after `HeapProfiler.collectGarbage`)

| Moment                                      | JS heap used | CDP `Nodes` |
| ------------------------------------------- | -----------: | ----------: |
| Before the rows exist (`?defer=1`)          |      3.60 MB |          64 |
| After the first rows paint                  |     45.57 MB |         539 |
| After 10 s of wheel scrolling at 3,000 px/s |     47.77 MB |         757 |

The 200,000 rows take about 42 MB, about 210 bytes per row. During scrolling the page has at most 421 elements, 371 of them in the grid: 40 data rows (14 visible plus 12 overscan on each side) of 9 elements and the header.

### Sort and filter over 200,000 rows in `arraySource` (Chromium, no slowdown)

| Action                                                  | Query time (synchronous) | Long task |
| ------------------------------------------------------- | -----------------------: | --------- |
| Sort by name (ascending)                                |                   295 ms | 301 ms    |
| Sort by weight (numeric, so descending first)           |                    65 ms | 68 ms     |
| Filter the name by "kalo", sorted by weight: 2,762 rows |                    13 ms | none      |
| Generating the 200,000 rows (test data, on load)        |                   139 ms | not gated |

Each figure is from the first run on the committed code. Across all runs: name 274 to 302 ms, weight 61 to 71 ms, filter 12 to 13 ms, generation 127 to 149 ms.

### Chunk size

`grid-<hash>.js`: 71,855 bytes, **21,874 bytes at gzip level 9**. It holds Table (table-core with the two features, react-table, store), Virtual, the grid, the route and the row generator. React, Mantine (`TextInput`) and `@open-reloading/ui` are in shared chunks.

## Table 9 docs

- Manual sorting: "Sorting" guide, https://tanstack.com/table/latest/docs/framework/react/guide/sorting. With `manualSorting: true`, the table expects the data already sorted and only keeps the sorting state, so no sorted row model is needed.
- Manual filtering: "Column Filtering" guide, https://tanstack.com/table/latest/docs/framework/react/guide/column-filtering. The same with `manualFiltering: true`; `column.setFilterValue` and `getFilterValue` hold the state.
- Features and row models: https://tanstack.com/table/latest/docs/guide/features (features are opted into with `tableFeatures`, and row models are optional) and https://tanstack.com/table/latest/docs/guide/client-side-vs-server-side (the `manual*` options and which row models to leave out).
- `rowCount`: an option of the pagination feature, for manual pagination (`rowPaginationFeature.types.d.ts` in table-core 9.3.1: "When manually controlling pagination, you can supply a total `rowCount` value to the table if you know it"). The grid does not use it: Virtual drives the window, not Table's pagination, and the total goes from `DataPage.total` to Virtual's `count`.

## Findings

1. The scroll gate passes as built, with both sources and at 4x slowdown, apart from one 61 ms drag task. No fallback is indicated: neither tuned windowed rendering nor an index split into chunks is needed for scrolling.
2. Sorting 200,000 rows on the main thread is a long task (274 to 302 ms by name, 61 to 71 ms by a number). Filtering is not (13 ms). A source that sorts in a worker, or answers from a presorted index, removes it. `DataSource.query` is already asynchronous and takes an `AbortSignal`, so either fits the current interface. No interface change was needed for this spike.
3. `aria-rowindex` of the last row is 200,001, not 200,000. The header row is row 1 of the grid, so the data rows are 2 to 200,001 and `aria-rowcount` is 200,001. WAI-ARIA 1.2 counts every row of the grid, header rows included (https://www.w3.org/TR/wai-aria-1.2/#aria-rowindex). Numbering data rows from 1 would put the header outside the count.
4. Table 9 has a `cellSelectionFeature` (`table_getFocusedCell`, `cell_getTabIndex`, `table_moveCellSelection`). It moves over `table.getRowModel().rows` (`cellSelectionFeature.utils.js`, lines 565 to 569, in table-core 9.3.1). Under manual windowing, that is only the loaded window, so it cannot move to row 199,999 before that row is loaded. The grid keeps its own focus as a row index and a column index.
5. Keeping the focused row in Virtual's range (`rangeExtractor`) keeps the focused element alive across any scroll distance. The cost is one extra rendered row.
6. A click on a row's own 1 px bottom border hit no cell, so it focused the scroll container. The keys then scrolled natively instead of moving the cell. The border is now on the cells. The grid element also has `tabindex="-1"`, so a click in it outside a cell focuses the grid, and its keys still move the cell. The scroll container keeps `tabindex="-1"` as well. Neither is in the tab order, so the grid stays one tab stop.
7. Headless Chromium hides scroll bars by default (`--hide-scrollbars`). The spec removes that flag, so the thumb drag in 1d drags a real 15 px scroll bar.
8. Caching in both sources is keyed by the identity of the filter and sort arrays (`arraySource` already works this way). The grid keeps them in React state, so they change only when a sort or filter changes. A caller that builds equal arrays on every render would defeat the cache.
