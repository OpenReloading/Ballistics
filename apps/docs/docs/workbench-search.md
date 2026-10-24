---
title: Searching records in the workbench
description: What the record search of the workbench cards does today, where it fails on large lists, the options for a search dialog with their size and time numbers, and the decisions that remain.
---

# Searching records in the workbench

A shooter picks a cartridge, bullet or powder in a workbench card by typing a name. This page records how that search behaves, where it fails when the catalogue holds thousands of records, and compares ways to replace it with a dialog. A prototype for bullets exists (`apps/web/src/components/bullet-search-dialog.tsx`); nothing else described under Options is built.

How the numbers were made: one machine in the dev container, single runs unless a spread is given. The public tree holds 2 invented bullets and 1 powder, so the measurements ran on a larger test bundle of the same record format with 1,686 bullets, 248 powders and 577 cartridges (the bundle is not part of the repository). Bullet and powder results are given by query pattern and count only. The cartridge records are public, so their queries are given in full. The 10,000 row sets are the 1,686 bullets repeated with a suffix on id and name, so compressed sizes of them are optimistic: read the gzip figure.

## Recommendation

Option C (inline field and dialog) with matching in the browser (E) and a "Sort by" choice (G). One ranking function serves the inline field, the Ctrl+K palette and the dialog, so the three give the same hits for the same words. E is the base up to about 10,000 rows per kind; the ranking and the filter state are the same for D, E and F, so the source can change later without redoing the dialog.

## What the search does today

- `RecordSearch` (`apps/web/src/components/record-search.tsx:39`) sends `GET <kind>?q=<text>&limit=20` 300 ms after the last key (`:110`), from 2 characters on. The Ctrl+K palette (`apps/web/src/components/workbench-search.tsx`) sends the same `q` per kind with 8 matches each.
- `q` is one substring test (`ilike '%q%'`) over the manufacturer name or an alias, a space, and the product name (`packages/api/src/db/component-queries.ts:29`). For cartridges it tests names and aliases. The Pages edition does the same over `<kind>/search.json` (`apps/web/src/lib/static-api.ts`).
- The words must stand next to each other in that order. Nothing else is searched (no caliber, no weight), and a number is a substring (`168` also matches `0.168`).
- The answer is ordered by manufacturer name, name, id: no relevance order, and no way to narrow other than typing more.
- Enter chooses only when exactly one row is shown and none is highlighted.
- The directory lists search the same records with other rules (`bulletMatches`, `apps/web/src/lib/bullet-rows.ts:55`: every word at a word start, over manufacturer, aliases, name, caliber and weight text). The same words give different answers in the card and on `/bullets`.

## Failures with real queries

Bullets (1,686 records). "API" is what the card shows (total found), "list" is the `/bullets` list, "prototype" is the dialog.

| Query pattern | API | list | prototype |
|---|---|---|---|
| manufacturer, then a product word of the name | 0 | 49 | 49 |
| the same two words reversed | 0 | 49 | 49 |
| `308 168` | 2 | 13 | 13 |
| `.308 168` | 1 | 13 | 13 |
| `308 168gr` | 0 | 1 | 13 |
| `10.9g` (grams) | 0 | 0 | 18 |
| `168` | 16 | 18 | 18 |
| `168 gr` | 14 | 14 | 14 |
| manufacturer and `168` | 0 | 3 | 3 |
| `hp` | 181 | 134 | 134 |
| `30 cal` | 110 | 188 | 188 |

- A manufacturer plus a word of the product name finds nothing: most product names start with their own caliber and weight words, and the substring needs the words adjacent.
- `hp` finds 181 records, and the 20 shown are all from one manufacturer (alphabetical order). `30 cal` shows 20 of 110 from 4 manufacturers.
- Weights are stored in grams and typed in grains or grams, the caliber is stored as a diameter, and neither is searchable in the card.

Powders (248 records): a manufacturer and the digits of a product name find 0 in the card and 3 in the list. The digits alone find 7 in both. A name with letters, a hyphen and digits finds 0 in the card and 1 in the list.

Cartridges (577 CIP records, `GET /cartridges?q=`), total found:

| Query | API | list | first API hits |
|---|---|---|---|
| `308` | 5 | 60 | 308 EH, 308 Marlin Express, 308 Match |
| `308 win` | 1 | 6 | 308 Win. |
| `win 308` | 0 | 6 | none |
| `.308 winchester` | 0 | 1 | none |
| `7.62x51` | 0 | 0 | none |
| `7,62x51` | 0 | 1 | none |
| `7.62 x 51` | 0 | 0 | none |
| `6.5x55` | 0 | 0 | none |
| `6.5 creedmoor` | 0 | 1 | none |
| `30-06` | 4 | 4 | 30-06 Ackley Improved, 30-06 Court Cartry, 30-06 R Stief |
| `30 06` | 0 | 5 | none |
| `300 win mag` | 0 | 2 | none |
| `223` | 2 | 3 | 223 Rem., 223 Win. SS Mag. |
| `223 rem` | 1 | 1 | 223 Rem. |
| `9mm` | 2 | 29 | 9 mm Browning court, 9 x 18 |
| `9x19` | 0 | 1 | none |
| `45 acp` | 2 | 2 | 38-45 ACP, 45 Auto |
| `5.56`, `nato`, `300 wm` | 0 | 0 | none |

Spacing, hyphen and decimal separator variants (`30 06` against `30-06`, `7.62x51` against the printed `7,62 x 51`) are not treated as the same by either search. This is the largest group of misses for cartridges and applies to the directory list as well. `308` in the list also matches cartridges of the .308 caliber by their caliber text.

Cost of the current path: the API answers `q` in a median of 4.5 ms (bullets), 2.4 ms (cartridges) and 1.4 ms (powders) on localhost, one request per pause in typing.

## Search technology

All three work in the server edition and the Pages edition.

**D. Server `q` with tokens.** Keep the list routes, make `q` token based on the server, add query parameters for caliber and mass ranges. One request per search, about 4 KB for 20 rows (a 200-row page is 41 KB at 10,000 bullets). Needs a contract change (baseline, schema, docs) and the same rule a second time in the Pages edition's file reader (`static-api.ts`), tested against the API. Server time at 10,000 records is not measured (unverified; the current substring scan is linear).

**E. The browser reads the whole list through the existing routes once, then matches and orders.** No API change. The browser's own designs and the cartridge fit filter (`bulletFits` of core) are already client side.

| | 1,686 bullets | 10,000 bullets |
|---|---|---|
| list JSON, raw / gzip | 367 KB / 37 KB | 2.58 MB / 228 KB |
| packed rows (`packBullets`), raw / gzip | 242 KB / 34 KB | 1.49 MB / 201 KB |
| requests of 200 rows | 9 | 50 |
| dialog opened to first row | 0.22 s | 0.9 to 1.3 s (4 runs) |
| same at 4 times slower CPU | 1.0 s | 2.0 to 2.1 s (4 runs) |
| key to updated count and rows | 40 to 50 ms | 40 to 60 ms (4 times slower CPU: 140 to 210 ms) |
| search in a script, index built | 1.3 ms | 7.7 ms |
| first search in that script, builds the index | about 50 ms | about 300 ms |

**F. A static search index built at build time**, like the docs site's Pagefind index (which holds the docs pages, the code reference and the REST operations, no records). Spike: one record per bullet through the index's custom-record API, with name, manufacturer, caliber and weight as text and manufacturer and caliber as filters.

| | 1,686 bullets | 10,000 bullets |
|---|---|---|
| files written | 1,707 | 10,044 |
| total size | 1.13 MB | 3.44 MB |
| without the per-record files | 693 KB | 805 KB |
| first search: files and bytes loaded | 27 files, 178 KB | 27 files, 220 KB |
| later searches | 0 to 18 files, 0 to 12 KB | 0 to 20 files, 0 to 7 KB |
| search time | 1 to 77 ms | 4 to 81 ms |

F has small first loads and scales further than E, but it adds ten thousand files to the Pages edition (about 300 MB already), a separate build step in both editions, no numeric range filter (weight and diameter ranges need buckets as filters), ranking weights per field only, and the browser's own designs and the cartridge fit are outside the index, which needs a second code path to merge them.

Where E stops: the whole-list read is linear, so 10,000 rows per kind cost about 0.2 MB gzip and 1 to 2 s on a slow device. Past about 50,000 rows (unverified) D or F is the better base.

## Options

Decision 1, the shape of the search:

- **A. Improved inline combobox**: word matching in any order, ranking, grouped results. Smallest change. No filters, no weight or caliber range, no preview, and the phone list stays short; thousands of records stay a typing exercise.
- **B. A dialog only**, opened from the card: query, filters, sortable result, preview. Best for browsing. The common case "I know the name" costs one more step, and the card head changes its behaviour.
- **C. Both (recommended)**: the card's field keeps typing for a quick pick, a button at its end opens the dialog with the typed text. The prototype is C for bullets; the inline field there still uses the API search.

Decision 2, where matching runs: D, E (recommended up to about 10,000 rows per kind) or F, as in the previous section.

Decision 3, sorting the result:

- **G. A "Sort by" choice** (best match, name, heaviest, highest BC). Works on a phone and keeps the list a plain listbox with the focus in the search box (recommended).
- **H. Sortable column headers.** Needs the grid pattern, so the focus and key handling of the listbox change.

## The bullet prototype

- `searchBullets` (`apps/web/src/lib/bullet-search.ts:121`) filters with the directory's `bulletMatches` rules and orders by `bulletRelevance` (`:106`). Per typed word the best field counts: a weight match 8 (`168` and `168gr` as grains, `10.9g` as grams), a caliber match 6 (`308` and `.308`), an exact word 2 times and a word start 1 times the field weight (product name 3, manufacturer and aliases 2). Ties by manufacturer, name and id; the browser's designs first among equals. Rows are indexed once per list (`WeakMap`, `:84`).
- Keyboard and focus: the dialog opens with the focus in the search box, a combobox over a listbox (`aria-activedescendant`, `bullet-search-dialog.tsx:211`), so the focus never leaves it. Arrow keys and Page keys move the highlight, Enter chooses, Ctrl+Enter is left alone for Run, Escape closes and the focus returns to the button. A status line announces the count. Tab goes through the filters and the preview link; the rows are not tab stops.
- Filters: manufacturer, caliber (with counts), mass range in the preset's unit, source (all, catalogue, my designs; shown with designs), the cartridge fit as a removable chip, and the sort choice.
- Mixing records: the browser's designs are listed with a "Your design" badge, found by the same words and filters, first among equals.
- Phone: full screen; the filters sit behind a Filters button (Sort stays visible), each row stacks the name over caliber, mass and BC, the preview is left out. At 1280 px the result list and the preview sit side by side.
- Tests: `apps/web/test/bullet-search.test.ts` (ranking and filters) and `apps/e2e/tests/web/bullet-search-dialog.spec.ts` (keyboard flow; axe clean in light and dark at 390 and 1280 px).
- Not done: rows beyond the first 100 are not drawn (a window as the directory tables use is needed), no typo tolerance, no sortable headers, no powder or cartridge dialog, and the catalogue is read again on each page load.

## Follow-up issues (proposed)

1. **Shared ranking for every record picker.** Cartridge, powder and bullet pickers, the Ctrl+K palette and the directory lists use one matching and ordering function: words in any order, decimal comma and point and the spacing and hyphen variants treated alike, weights and calibers for bullets.
   - Every query of the cartridge table that names an existing record finds it (`7.62x51`, `7.62 x 51`, `30 06`, `.308 winchester`, `9x19`, `win 308`).
   - The card's field, Ctrl+K and `/bullets` give the same hits for the same words.
   - A unit test lists the queries.
2. **Bullet dialog for production** (after decisions 1 to 3). Rows beyond 100 in a window, the final sort control, the phone layout checked at 390 px with real data, the workbench docs updated, the prototype's shortcuts removed.
   - 10,000 bullets: dialog open to first row at most 1.5 s, key to rows at most 100 ms, measured in the browser tests with a generated list.
   - axe clean in light and dark at 390 and 1280 px; the workbench no-scroll spec unchanged.
3. **Powder and cartridge dialogs on the same shell.** Filters of their lists (powders: base, grain form, burn-rate order; cartridges: case type, caliber, Pmax); the shell is extracted from the bullet dialog.
   - Each of the three cards opens its dialog from the button of its field.
   - One keyboard spec covers the shared shell; kinds differ only by columns and filters.
4. **Catalogue loading and indexing.** Keep the list across page loads (the offline layer's cache), read pages together, move the index build to a worker above a measured row count, and check the Pages edition against the server edition.
   - The dialog opens from a warm cache without a request.
   - A test compares the Pages edition's pages with the API's.
5. **Server `q` with tokens**, only if decision 2 is D, or for callers that stay on the API (the designers, the seating preview and the trajectory form pickers). Same rule in the API and in `static-api.ts`; the contract baseline rewritten in the same change.
   - The queries of follow-up 1 give the same hits from the API and from the Pages edition.
   - `api:check` and `api:conformance` pass.
6. **Firearm catalogue search**, after the firearm records decision. Manufacturer, model, variant, barrel length and caliber as fields and filters in the same shell, measured with a generated list of 10,000 firearms.
   - A firearm is found by `<manufacturer> <caliber>` and `<model> <barrel length>` in any word order.
   - The user's own firearms are listed and marked as in the bullet dialog.
7. **Fix the accessible name of the workbench load switcher.** With a cartridge linked, its button fails axe `label-content-name-mismatch` at 1280 px in light (its `aria-label` does not contain the visible text).
   - axe clean on `/workbench?cartridge=308-win` in light and dark at 390 and 1280 px.
   - The existing workbench specs pass.
