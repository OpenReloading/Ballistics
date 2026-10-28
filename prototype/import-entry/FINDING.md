# Import entry: finding

Prototype of one Import entry for load files and tables of bullets, powders and cartridges, run on invented files only. Throwaway branch `prototype/import-entry`, never merged, no pull request. Tracks issue #284.

## Pick

| Question | Pick | Rule and measured value |
|---|---|---|
| How a file is told | One inspection per file, from bytes: load-file formats, then a workbook by signature, then a JSON list or delimited text as a table. Extension ignored, picker takes any file. | 9 invented files (CSV 5,000 rows, semicolon CSV with decimal commas, workbook, powders, cartridges, load file of an invented format, unrelated table, text without a table, table of name, diameter and length): 8 of 9 cards right with no click; the ninth is suggested as bullets (medium) and is a table of cartridges, 3 clicks to correct (`measurements.json`, `verdicts`). |
| Kind suggestion | Score each kind from header words and value ranges, tiers high from 0.80, medium from 0.60, low from 0.40, below 0.40 refused with the scores and the floor named. | 19 of 19 right on 16 generated header variants and 3 unrelated tables (`accuracy.txt`); the scorer was tuned on this set, so the number says the rules work, not how they do on real files. Lowest right-kind score 0.60, highest unrelated score 0.20. One wrong guess in the 9 files (below). |
| Column mapping | Auto-map by alias; per column field, unit and decimal mark, each changeable; preview of the first 5 records in stored units; mappings saved by name in the browser. | Largest conversion error 1.8e-15 (g, mm) over grains to g, inches to mm, decimal comma (`accuracy.txt`). Unit taken from the header where it names one, else from the values (the card says so). |
| Row report | Counts first (accepted, with a warning, rejected, new, already here, changed, repeated in file), then rejected rows with row, column, cell and reason. Nothing is written before "Import N valid rows". | 5,028 rows: 4,939 accepted, 9 warnings, 89 rejected, the other rows imported (`measurements.json`, `speed.large.counts`). |
| Duplicates | Deterministic UUID from kind, name, maker and for bullets diameter and mass. | The same file imported twice: new 0, button "Import 0 valid rows" disabled. One changed length in the file: changed 1, new 0 (`duplicates`). |
| Source | One required text per import, overridable per file, written on each record with file name and day as `imported`. | Button disabled without a source (`Commit`). Shipped schema drops the field: `apps/web/test/import-entry.test.ts` ("shows the shipped schema dropping an `imported` entry"). |
| Layout | B: one page of file cards, mapping inline, one report and one Import button at the foot. | Fewer clicks for (a) one clean CSV: 2 against 5, and for the wrong-guess batch 5 against 8 (table below). |

## Run it

```sh
npm ci && npm run build && node prototype/import-entry/write-files.mts && npm run static:build && (npm run pages:serve & sleep 5; node prototype/import-entry/measure.mts; kill %1)
```

The invented files are generated from `apps/web/src/lib/import-entry/fixtures.ts` into `prototype/import-entry/files/` and are not tracked. For the page: `npm run pages:serve`, then http://localhost:3003/import-entry/?layout=b (`layout=a` for the modal); each invented file also has a button on the page. `measure.mts` (Playwright, writes `measurements.json` and `screenshots/`) needs the browser installed once (`npx playwright install --with-deps chromium`). Other checks: `npx vitest run test/import-entry.test.ts` in `apps/web` and `node prototype/import-entry/accuracy.mts`. Run inside the dev container.

## Measurements

| Measure | Value |
|---|---|
| Kind per file | 8 of 9 cards right (`verdicts`): bullets x3 high, powders high, cartridges high, unrelated table and plain text refused by the kind floor (the text is not refused as "no table", see Limits), load file read by its format; the table of name, diameter and length is suggested as bullets (medium) and is a table of cartridges |
| Kind accuracy, generated variants | 19 of 19 |
| Unit exactness | largest absolute error 1.8e-15 g or mm |
| Rows per second, 5,028 rows, in a worker | read (decode, split, score) 33 to 34 ms plus build (map, validate against the schema, ids, plan) 41 to 44 ms, about 65,000 rows/s; 112 to 184 ms from choosing the file to the counts on screen (two runs on a shared host) |
| Rebuild after a mapping change, 5,028 rows | 105 to 135 ms to the new counts |
| Longest main-thread block | 39 to 65 ms over two runs while the large card renders (24 selects, preview, report); a small file first 40 to 44 ms; the rebuild 20 ms. The second run is under the 50 ms limit, the first over it by 15 ms: the limit is not reliably met, cause not isolated, the worker is not on the main thread. The build issue caps what a card renders. |
| Clicks, typed fields | table below |
| Route weight | `/import-entry` initial 412.7 kB gzip, `/_not-found` 412.2 kB in the same build (+0.5 kB); total 477.3 kB with 64.6 kB gzip of lazy chunks, of which 17.4 kB (layout A 8.9 kB, layout B 8.5 kB, each with the shared cards) is not already in the lazy chunks of `/workbench`; the worker's own chunk 12.6 kB. `check-weight` fails for the new route only because it is in no group. |
| Layout at both sizes | A: the dialog is 620 x 585 px in 1280 x 650 and 351 x 760 px in 390 x 844, inside the window with no horizontal overflow in all four steps. B: no horizontal overflow (page width equals window width), page height 2,631 px at 1280 and 4,547 px at 390 with 5 cards; the preview tables scroll sideways inside their card. Screenshots in `screenshots/`. |
| Keyboard order | `measurements.json`, `keyboard`: skip link, top bar, Choose files, the invented-file buttons, then per file card: Remove, kind, then 3 stops per mapped number column (field, unit, decimal) and 1 per text column. A bullets card with 7 mapped columns has 15 mapping stops before the next card. |

### Clicks per scenario (after the File menu's Import…)

Choosing the files counts as one click, a select as two (open, choose). Typing the source is counted apart.

| Scenario | A modal, four steps | B page of cards | Typed |
|---|---:|---:|---:|
| (a) one clean CSV, 4 rows | 5 | 2 | 1 |
| (b) mixed batch of 3 files (bullets CSV with decimal commas, powders, load file), all guessed right | 5 | 2 | 1 |
| (c) batch of 3 where one guess is wrong (switch kind, map one column) | 8 | 5 | 1 |

Decisions: (a) and (b) none in B; (c) two in both (kind, column). A adds three Continue clicks to every scenario.

## Layout pick

Rule: fewer clicks for (a), then fewer after a wrong guess. B takes 2 clicks and 0 decisions against A's 5; after the wrong guess 5 against 8. The prototype page stays at +0.5 kB initial, but the shipped entry sits behind the File menu on routes that already carry a budget (below). B costs keyboard stops: one tab stop per control of each mapped column. Proposal for the build, not measured here: keep B and fold the mapping of a high-tier card behind one "Columns" button, so the common case has 2 stops per card and a correction stays one click away.

Placement against the budget: behind the File menu the entry is not its own route. `/workbench` is 992.5 of 1001.0 kB total, 8.5 kB of headroom, and layout B's own lazy chunk is 8.5 kB before the mapping fold and the real report. A `next/dynamic` import from the File menu lands in the page's `react-loadable-manifest.json` and so in `total` of every route with a File menu (workbench, lists, designers). Build issue 3 therefore either raises the `total` budget of those groups by about 9 kB in its pull request, or loads the import code with a plain `import()` in the click handler, which that manifest does not list (not tried here).

## Source decision

- Field: optional `imported` on the envelope of every user record, `{ source, file, day }`: `source` 1 to 500 characters, `file` up to 200, `day` an ISO date. In `base` of `packages/schema/src/user-data.ts`, so all kinds share it.
- Where it lives: the record, not a side table, so Export all and a single-record file carry it; `planImport` compares kind, name and data only, so a re-import with another day or source stays "already here".
- Why the schema must change: the envelope is a plain object schema, so parsing drops the unknown key (tested).
- Cost of being wrong: before 1.0 none. Adding the optional field later still reads old files, and files written with it read in older apps with the field dropped. Changing its shape (a structured source with URL and license, one per record against one per import) after records carry the first shape needs a rewrite of stored records and files and a format version. Decide before the format freeze (#272).

## Texts

Verdict line of a card: "Table of bullets (high)", "Table of bullets (medium)", "Table of bullets (chosen)", "Load file, read by <format>", "Refused", "Refused: no kind".

Refusals (cause, then one action):

- Over 40 MB: "The file is larger than 40 MB. Split it and import the parts."
- Not text: "The file is not UTF-8 or UTF-16 text; save it as UTF-8 (CSV UTF-8) and import again."
- Cut UTF-16: "UTF-16 text with an odd number of bytes; save it as UTF-8 (CSV UTF-8) and import again."
- Workbook unreadable: "The workbook cannot be read: <reason>. Save it again as XLSX or CSV."
- Workbook empty: "The workbook has no cells with text. Open the right file or paste the table into a sheet."
- Sheet without table: "Sheet "<name>" has no table of two columns or more. Move the table to the first sheet."
- JSON that does not parse: "The text looks like JSON but does not parse. Fix the file or export it again."
- JSON of another shape: "The JSON is neither an OpenReloading data file nor a list of objects with the same keys. Export a table instead."
- No separator: "The text has no table: no row repeats a comma, semicolon or tab as separator. Export the table as CSV."
- Header only: "The table has a header but no rows. Add rows or choose another file."
- No kind reaches the floor: "No column matches a bullet, powder or cartridge field (bullets 0.00, powders 0.00, cartridges 0.00; the floor is 0.40). Pick the kind by hand, or export a table with headers such as Name, Diameter, Weight."
- Load file of a known format without content: "<format>: The file names no bullet and no powder. Add a "bullet:" or "powder:" line."

Rejected rows (listed with row, column, cell):

- "<Field> is empty. Fill the cell or delete the row."
- "<Field> has no unit. Choose a unit for the column."
- "<Field> "<cell>" is not a number with "<mark>" as decimal mark. Fix the cell or change the decimal mark of the column."
- "<Field> <cell> is not above 0. Fix the cell or leave it empty."
- "No column is mapped to <Field>. Map a column to it or read the file as another kind." (row 1)
- The schema's message for the row, then "Fix the row or delete it."

Warnings (row kept or the cell left out):

- "<Field> <cell> <unit> is outside the usual <low> to <high> <stored unit>. Check the unit of the column."
- "<Field> "<cell>" is not one of <choices>. The value is left out; change the cell to keep it."
- Column hints: "unit guessed from values", "decimal mark guessed".

Buttons and labels: "Choose files", "Remove <file>", "Save mapping as", "Save mapping", "Source" (required), "Source of this file", "Replace <n> stored records with the changed rows", "Import <n> valid rows" (n is the rows to write, makers not counted), "Continue", "Back".

## Limits of the prototype

- Texts are English only and not yet through `t`.
- The prototype store is in the worker; the build reads ids and content from the IndexedDB store.
- The invented load format reads a bullet and a powder; real formats are #242, #243 and #245.
- `notes.txt` is not refused as "no table": its comma line splits into two cells, so the card is a table that no kind reaches the floor for, and it offers the kind picker. The "no separator" refusal never fires on the invented set. `detectDelimiter` should require two or more rows of equal width.
- Makers named in a table become user manufacturer records with deterministic ids.
- 5,000-row preview lists at most 100 rejected rows and 8 on the card; the rest is counted.

## What the build issues need

- #244 (generic bulk import): the mapper and kind scorer (`apps/web/src/lib/import-entry/map.ts`, `fields.ts`, `table.ts`, `ids.ts`) lifted into `packages/importers`, and the `imported` source field.
- #242, #243, #245 (load-file importers): the inspection step (`inspect.ts`: a byte-level format registry, workbook before text) and the batch report (`plan.ts`, `FileReport`).

## Build issue drafts

1. **Importers: table to user records.** Move kind scoring, column mapping, unit conversion, row report and deterministic ids from the prototype into `packages/importers` with doc comments. Acceptance: the 19 generated header variants give the right kind, grains and inches convert to g and mm within 1e-12, a row that fails never blocks the others, the same input twice gives the same ids.
2. **Schema: `imported` on the user record envelope.** Add the optional field to every kind, JSON Schema included, before #272. Acceptance: a record with `imported` survives parse, Export all and Import; `planImport` still reports an unchanged re-import as equal; a file without it still reads.
3. **Web: the Import entry as page of file cards.** Layout B behind the File menu's Import…, import code loaded on demand, counts and rejected rows, one Import button with the count, source required. Acceptance: one clean CSV imports in 2 clicks and one typed source, longest main-thread block 50 ms or less at 5,000 rows, route inside `weight-budget.json`, an e2e spec for the duplicate rule.
4. **Inspection step for load files.** A byte-level registry in front of `readLoadFile` (workbooks included), a card per file with the format and what was not read. Acceptance: a mixed batch of a table and two load files gets the right card for each with no click; #242, #243 and #245 add one entry each.
5. **Docs: the mapping model.** A model page on the field aliases, units, tiers and the duplicate key, and saved mappings in the browser. Acceptance: the page lists every alias of `fields.ts` and the tier floors, and `npm test -w @open-reloading/docs` passes.
