# Load data in the catalogue: file layout, API and Pages size, build and validation time

Research for issue #818 of the wayfinder map #817. Question: about 70,000 published load rows are to become catalogue records, and more will follow. Which layout in `packages/data/records` holds them, and what does it cost?

## Answer

One file per cartridge and maker: `records/loads/<cartridge-id>/<maker>.json`, holding `{ cartridge, rows: [...] }`. Every row carries its own `id` and its own source reference (source record id plus page or URL). A newer edition of a maker table edits the rows of those files in place.

For the 68,502 collected rows this is 1,039 files, 65.3 MB in the working tree, 2.7 MiB in a git pack, the largest file 1.07 MB (one file above 1 MB, fifteen above 500 kB), at most 10 files per cartridge folder. Validation of all rows takes 0.47 s. A sparse re-import of one maker touches 85 to 97 files and 446 to 869 kB of diff (10.6k to 18.3k changed lines, 17.4k to 31.1k lines with context): the smallest diff of the six, within GitHub's limits of 300 files and 1 MB per pull request, and over its 20,000 line limit only for the larger maker. Per-row files break the recommended directory width and the clone cost, per-maker-table and per-cartridge files break the Biome file size limit that `npm run lint` turns into an error, and the per-cartridge-and-powder and per-cartridge-and-edition layouts break the pull request diff limits.

Rows stay out of `catalogue/index.json` and out of `bundle.json`. The static site writes one body per cartridge (`api/loads/by-cartridge/<id>.json`), 36.3 MB raw and 2.5 MB gzipped in total, 1.72 MB raw and 108 kB gzipped for the largest cartridge. The web app gets no page per row.

Rows in a file sort by a key without edition or page (powder, bullet, COAL, kind, charge), so a re-cited row keeps its position and the diff shows it once. The cartridge folders also line up with the hold-out split by cartridge: fit tooling can skip the validation and test cartridges by directory without opening a file.

The row shape in these measurements is a sizing assumption (below). The decision on the shape is ticket #819. The layout result does not depend on its details, only on bytes per row (about 0.9 kB pretty-printed).

## The data measured

The generated set has the size and shape of the collected maker load tables: 68,502 rows from 10 makers (Hodgdon 19,453, Vihtavuori 13,472, ADI 12,322, Western 12,251, Norma 2,394, Reload Swiss 2,190, Alliant 2,056, Vectan 1,932, Lovex 1,530, RWS 902). Values are those of the collected rows, converted into the candidate row shape.

| Fact | Count |
|---|---|
| Rows with a cartridge id | 65,887 (257 cartridge ids) |
| Rows without a cartridge record | 2,615 (76 printed cartridge names) |
| Rows whose cartridge id is not a record in the public `packages/data/records/cartridges` | 3,054 (16 ids, for example 6mm-gt 458, 22-nosler 400, 22-creedmoor 384) |
| Rows that can be imported against the public cartridge records today | 62,833 |
| Largest cartridges | 308-win 3,458 rows, 30-06-spring 2,837, 223-rem 2,497, 9-mm-luger 2,406 |
| Rows per cartridge | median 64, p90 501, p99 2,406 |
| Cartridge and powder pairs | 5,453 (median 8 rows, p99 94, max 246) |
| Cartridge and maker pairs | 1,039 |
| Powder ids / maker and powder names | 246 / 283 |
| Distinct bullet (mass, type) pairs | 4,750 |
| Rows with a printed pressure value in bar (PSI or bar) | 29,147; 10,823 more are CUP and carry no bar value |
| Rows with COAL / barrel length / velocity | 66,371 / 62,022 / 68,051 |
| Rows with the same natural key as another row | 124 keys (cartridge, bullet as printed, COAL, powder, kind, barrel, flag) |
| Rows with a charge of 0 | 3 (Norma, start loads); `charge` in `packages/schema/src/load.ts:192` is `positive()` and rejects them |

Existing real records the rows will reference: 1,684 bullets (2.9 MB of JSON) and 247 powders (0.8 MB).

Assumed row shape (sizing only): `id`, `cartridge` (hoisted to the file where the file is per cartridge), `powder`, `bullet { type, mass { value, raw } }`, `kind` (start, max, single, recommended), `charge`, `coal`, `barrelLength`, `velocity` (each `{ value, raw }`), `pressure { value, raw, method }`, `flags`, `note`, and `provenance { kind, sources: [{ source, page | url }] }` using the existing source references of `packages/data/src/sources.ts:29`. Every `raw` is stored (the printed text with its unit). Files are formatted by the repository's Biome, like all records.

## Layouts compared

All six hold the same 68,502 rows.

- A: one file per row, `loads/<id>.json` (68,502 files).
- B: one file per maker table, `loads/<maker>-<edition>.json` (10 files).
- C: one file per cartridge, all makers (333 files: 257 cartridge records and 76 printed names without a record).
- D: one file per cartridge and powder, `loads/<cartridge>/<powder>.json` (5,449 files).
- E: one file per cartridge and source (maker table edition), `loads/<cartridge>/<source>.json` (1,039 files).
- F: one file per cartridge and maker, rows citing their own source (1,039 files). The recommendation.

Row ids are the first 10 hex digits of a SHA-1 over the natural key (maker, cartridge, printed bullet mass and type, COAL, powder, kind, barrel, flag) plus an occurrence counter for the 124 equal keys. The key leaves out edition, page, charge, velocity and pressure, so a newer edition finds its older row and reports it as changed rather than as removed and created.

### Repository

| | A per row | B per table | C per cartridge | D per cartridge+powder | E per cartridge+source | F per cartridge+maker |
|---|---|---|---|---|---|---|
| Files | 68,502 | 10 | 333 | 5,449 | 1,039 | 1,039 |
| Working tree, bytes | 61.5 MB | 56.9 MB | 65.2 MB | 62.7 MB | 54.1 MB | 65.3 MB |
| On disk (4 kB blocks) | 280.6 MB | 56.9 MB | 65.9 MB | 73.7 MB | 56.3 MB | 67.3 MB |
| Median / max file | 916 B / 1.2 kB | 1.7 MB / 17.0 MB | 66 kB / 3.16 MB | 7.4 kB / 192 kB | 21 kB / 0.85 MB | 27 kB / 1.07 MB |
| Files over 1 MB / over 2 MiB | 0 / 0 | 9 / 4 | 10 / 4 | 0 / 0 | 0 / 0 | 1 / 0 |
| Widest directory | 68,502 | 10 | 333 | 100 (333 folders) | 10 (333 folders) | 10 (333 folders) |
| Git pack after `gc` | 50.0 MiB | 2.5 MiB | 2.7 MiB | 4.1 MiB | 2.7 MiB | 2.7 MiB |
| `git clone` (pack in the clone, time) | 31.8 MB, 1.95 s | | | 4.9 MB, 0.25 s | | 3.0 MB, 0.14 s |
| `git add -A` of everything | 3.1 s | 0.23 s | 0.30 s | 0.46 s | 0.28 s | not timed |
| `biome check` of the set | 7 s | files over 2 MiB warn | files over 2 MiB warn | not timed | 2 s | 3 s |

Limits that decide (sources below): GitHub recommends at most 3,000 entries in one directory and objects of at most 1 MB (enforced at 100 MB). Biome's `files.maxSize` in `biome.json:10` is 2 MiB, and `npm run lint` is `biome check --error-on-warnings .` (`package.json:23`): a file over 2 MiB prints a warning and so fails the lint. B and C each have 4 such files, so they need the limit raised or the files excluded, and Biome then checks files of 17 MB.

A breaks the directory width by a factor of 23 and costs 280 MB of disk blocks and a 2 s checkout. It would need a sharded folder structure to be usable, and still means 68,502 tiny files for tools, editors and CI cache steps.

The git numbers were measured on a scratch repository per layout (one commit, `git gc`, then a clone with `--no-local`). Local `gc` packed A badly (50 MiB), a clone's server-side repack gives 31.8 MB. History growth is not in the table: with sparse changes it is a few hundred small objects in A and one delta per touched file elsewhere.

### Re-import and merge

A synthetic re-import of one maker, seeded: 3 % of its rows change (velocity and note), 1 % are added, 0.5 % are removed. Changed and added rows cite the new edition, unchanged rows keep citing the old one (S1). S2 is the same plus a new edition citation on every row of the maker. Two re-imports of different makers (Hodgdon, 19,453 rows; Vihtavuori, 13,472 rows) were then merged into one branch.

S1, Hodgdon (Vihtavuori in brackets):

| | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| Files changed | 830 (575) | 2 (2) | 97 (85) | 656 (294) | 191 (160) | 97 (85) |
| Lines inserted + deleted | 14.8k (9.3k) | 53.1k (31.8k) | 63.5k (39.2k) | 52.7k (35.6k) | 52.8k (31.6k) | 18.3k (10.6k) |
| Diff bytes | 814 kB (437 kB) | 1.51 MB (836 kB) | 1.72 MB (1.04 MB) | 1.79 MB (1.01 MB) | 1.52 MB (845 kB) | 869 kB (446 kB) |
| Merge of the two | clean | clean | 1 conflict | clean | clean | clean |

S2, Hodgdon: A touches 19,577 files (27.7k + 24.6k lines, 7.4 MB diff). B and E see the new edition as a renamed file (B 1 file, E 102 files). C 102 files and D 1,684 files, 5.3 and 5.6 MB of diff. F touches 102 files, 55.8k lines, 5.3 MB. All merges of S2 were clean.

Readings:

- GitHub shows at most 300 files per diff, no more than 20,000 lines or 1 MB of raw diff per pull request, and 500 kB per file. The lines row above counts insertions and deletions only. Counting the lines of the diff as it prints, F is 31.1k lines for Hodgdon (3 lines of context) and 17.4k for Vihtavuori; without context and with headers it is 20.9k and 12.4k. So the Vihtavuori-sized re-import fits all three limits, and the Hodgdon-sized one stays within the file and byte limits but not the line limit. These line counts were taken for F only.
- A has 575 to 830 files and misses the file limit. B and E change files by moving rows between them (a new edition is a new file name), so a changed row appears twice. C and D sort rows by source first in this generator, so a re-cited row changes position and appears twice as well; their line counts would fall toward F's with a sort key without the edition, which is why that key is part of the recommendation. D still changes 656 files, and C still has the 2 MiB files and the cross-maker conflict.
- A re-import pull request is not reviewed through the diff view in any layout once a whole edition is re-cited (S2). The import report of #826 (created, changed, unchanged rows) is the review aid, not the diff.
- Merge conflicts between makers: C mixes makers in one file and had one real conflict in one of two merges (S1). D shares a file where two makers print the same cartridge and powder, and merged clean here. A, B, E and F keep makers in separate files.
- A new edition should leave unchanged rows alone (S1). Rewriting the source on all rows (S2) touches every file of the maker in A, C, D and F.

### Validation time

`data:validate` is `node src/validate.ts` over `readRecords` (`packages/data/src/records.ts`). The public data takes 1.0 s wall, of which `readRecords` is 0.08 to 0.18 s.

| Measure (warm file cache, one machine, 3 runs) | Time |
|---|---|
| `readRecords` over the public records plus 65,884 loads of the existing `CatalogueLoad` shape, one file per row | 0.93 to 1.16 s (+0.9 s) |
| Candidate row schema, all 68,502 rows, layout A: read and parse / zod, source resolution and reference checks / total | 0.46 / 0.33 / 0.94 s |
| Same, layouts B, C, D, E, F (total) | 0.46, 0.49, 0.52, 0.44, 0.47 s |

The cross-checks in `packages/data/src/references.ts` build a `Set` per kind and loop once over the loads, so they are linear. The cost per row is about 4.5 microseconds for the schema and, in A, about 7 microseconds for opening a file. Validation time does not separate the layouts by more than half a second. A cold file cache was not measured.

`readKind` (`packages/data/src/read-kind.ts:56`) reads one record per file and requires the id to equal the file name (line 28). Layouts B to F need a reader for files that hold `rows`, with the row id unique across all files of the kind. That is a small addition, and it is the main code change of the recommendation.

### The bundle and the API process

`readRecords` puts every kind into `Bundle`, and `build.ts` writes it to `dist/bundle.json`, which the npm package ships and `loadBundle` (`packages/api/src/bundle.ts:8`) parses at start. With the 65,884 rows in the existing shape, resolved provenance included: `bundle.json` grows from 5.2 MB to 50.2 MB (gzip 290 kB to 4.2 MB, brotli q9 1.8 MB), `JSON.parse` from 13 ms to 154 to 202 ms, and the process resident size from 172 to 241 MB to about 430 MB in the measuring script. Nothing in `packages/api/src/catalogue/` reads `loads` today. Recommendation: published rows do not go into `Bundle`. The data build writes them as per-cartridge bodies (below) and the API reads one body when asked.

## API and Pages

`writeStaticApi` (`packages/api/src/static.ts:56`) writes `catalogue/index.json` and one file per record of the kinds in `recordFiles` (line 17), with one `await mkdir` and `writeFile` per file. On the public data it writes 1,541 files, 5.7 MB, in 104 ms (plus 44 ms for `buildCatalogue`). Median record file is 3.4 kB.

Candidate bodies for load rows (minified JSON, sources listed once per file, provenance as a source id plus page or URL):

| Body | Files | Raw total | Gzip total | Median raw / gzip | p95 raw / gzip | Max raw / gzip |
|---|---|---|---|---|---|---|
| By cartridge | 333 | 36.3 MB | 2.5 MB | 37.4 kB / 3.0 kB | 469 kB / 31 kB | 1.72 MB / 108 kB |
| By powder | 250 | 36.2 MB | 2.8 MB | 88.5 kB / 7.1 kB | 466 kB / 34 kB | 1.06 MB / 70 kB |
| One file per row, provenance resolved as `recordAnswer` writes a record | 68,502 | 52.5 MB | 32.8 MB (per file) | 0.8 kB | 1 kB | about 1 kB |

- The largest cartridge body (308-win, 3,458 rows) is 1.72 MB raw, 108 kB gzip, 76 kB brotli at quality 11 (88 kB at quality 9). `JSON.parse` of it takes 7 to 12 ms in Node. Whether GitHub Pages serves it compressed is unverified; its documentation does not say.
- Writing the per-row files with the loop of `writeStaticApi`: 3.1 s for 68,502 files, 0.17 s for the 583 grouped files. The deploy artifact as a zip: 42.0 MB and 2.4 s for per-row files, 5.5 MB and 0.3 s for the grouped files (Python `zipfile`, level 6, as a proxy for the artifact upload).
- A cartridge body needs a list shape for the REST API, `GET /cartridges/{id}/loads`, with `powder`, `maker` and bullet mass filters. 3,458 rows at 1.72 MB should be paged or filtered there, the static file stays whole.

### Pages size limit

GitHub: published Pages sites may be no larger than 1 GB, the soft bandwidth limit is 100 GB per month, and a deployment times out after 10 minutes. Whether the 1 GB counts compressed or unpacked bytes is not stated; the numbers below are unpacked file sizes, the stricter reading.

From the Pages workflow run of main (run 41204208553): the `next` edition is 9,999 files and 158.9 MB (docs 53.4 MB, cartridge pages 49.0 MB, disciplines 33.7 MB, `api/` 5.7 MB). The `stable` edition is 9,049 files and 378.6 MB because it was built from older code whose cartridge pages are 460 kB each (the `next` ones are 84 kB, the HTML holds the head only, `apps/web/scripts/check-prerender.mts` header). Today's deployed site is therefore about 537 MB unpacked (379 MB plus 159 MB). Once a release carries the new code, both editions weigh about 159 MB, and the table below starts from that.

| | Per edition | Both editions |
|---|---|---|
| Now (`next` code) | 159 MB | 318 MB |
| Plus 1,684 bullet and 247 powder record pages at 84 to 95 kB (5 files each) | +183 MB | +367 MB, total 685 MB |
| Plus load bodies by cartridge | +36 MB | +73 MB, total 758 MB |
| Plus load bodies by cartridge and by powder | +72 MB | +145 MB, total 830 MB |
| Plus 68,502 per-row API files instead | +52.5 MB (and 68,502 files) | +105 MB, total 790 MB |

The record pages of the real bullets and powders, not the load rows, are the larger part of the growth. With them the site is at 69 % of the limit, with both kinds of load bodies at 83 %. Bodies by cartridge only keep it at 76 %. A per-row page route (`/loads/[id]`) would add 68,502 pages, about 5.8 GB, and is out of the question.

### Search and filters

- Rows do not belong in `catalogue/index.json`. The file is 530,748 bytes now (the documentation says 460 kB), the budget test caps it at 600,000 bytes and 80,000 gzipped (`packages/api/test/catalogue-budget.test.ts:45`). One index entry per row built like `derive.ts` (item, sort key, search text) is about 25.7 MB raw and 2.2 MB gzipped for 68,502 rows. The service worker precaches the index, so every visitor would download it.
- A small summary file does help: `loads/index.json` with one entry per cartridge (rows, number of powders, sources) is 42.6 kB raw, 4.3 kB gzipped. It drives a "published loads" badge, the row count in lists and the choice of which body to fetch. Add the per-powder counts per cartridge to it if the powder page needs a list before fetching.
- Filters by powder, bullet mass, maker, kind and barrel run in the browser over the loaded cartridge body, at most 3,458 rows. No further index is needed. For a powder page, fetch the cartridge bodies the summary lists, or add the per-powder bodies if that proves too slow (not measured).
- Side effect for the bullet and powder tickets: the 1,684 real bullets would add about 0.75 MB to the index at the 447 bytes per bullet the two demo bullets take now (an estimate from `index.json`), so the 600 kB budget needs a decision there.
- The fallback triggers of `apps/docs/docs/data/catalogue-storage.md` (more than about 200,000 rows or an index over about 200 MB) are not reached: the rows stay out of the index, and 68,502 rows are a third of the row trigger if they were counted.

## Web build

Loads add no record page if they are shown on the cartridge, powder and bullet pages: the page count logic is `generateStaticParams` per detail route, `staticIds(list, kind)` in `apps/web/src/lib/api.ts:103`, over the list of the catalogue index, and `exportIds` in `apps/web/src/lib/prerender-sample.ts:67`. The sample cuts the cartridge pages only. Rows are fetched in the browser from the data file, so the HTML of a page does not change.

Measured in the Pages workflow runs of main (GitHub-hosted runner, 3 workers; no local web build was run):

- `next` edition: 1,098 pages in 7.5, 10.8 and 11.2 s in three runs (6.8 to 10.2 ms per page).
- `stable` edition (older code): 1,047 pages in 73 s and 2.1 min (70 to 120 ms per page).
- The job limit is 15 minutes (`.github/workflows/pages.yml:45`).

Estimates from those numbers, not measured:

| Added | `next` code | older code |
|---|---|---|
| 1,931 bullet and powder pages | +13 to +20 s | +2.3 to +3.9 min |
| 68,502 per-row pages | +7.8 to +11.6 min and 5.8 GB | beyond the job limit |
| Load bodies (583 files) | 0.2 s of file writing | same |

`check-prerender.mts` reads the HTML and the data file of every record of its eight kinds (`lists`, line 23). Two file reads and six regular expressions per record means about 2 s for the added pages (estimate). It does not read load bodies unless a check is added.

JS budget (`apps/web/weight-budget.json`): the budgets are per route group, not per record, and rows are JSON, not JavaScript. Storage does not change them. The table or chart that shows rows adds code to the `records` group (506 kB initial, 554 kB total) and has to fit there. Parsing the largest body in the browser is about 10 ms in Node; rendering 3,458 rows needs paging or a virtual list (a UI ticket).

## Open points

1. Whether unchanged rows of a newer edition keep citing the edition that printed them (S1, the recommendation) or are re-cited (S2, 19.6k files touched in A and 55.8k diff lines in F for Hodgdon). The log of what changed is the import report either way.
2. How rows without a cartridge record are held: 2,615 rows carry no record at all and 3,054 more name 16 cartridge ids missing from the public data. They cannot sit in `loads/<cartridge-id>/`. Either the cartridge records come first, or those rows wait in the import report.
3. Pages headroom: 758 MB with bodies by cartridge, 830 MB with the by-powder bodies as well, against 1 GB. The by-powder bodies cost 72 MB for a page that could fetch the cartridge bodies instead. Decide before the web ticket builds the powder page.
4. Row ids: the natural key with an occurrence counter (124 equal keys among 68,502) is the id input here; the key must be fixed in #819 and #826 or re-imports will report rows as created and removed.
5. The three zero-charge rows (Norma start loads) conflict with `charge` being positive. Keep as printed with a flag, or drop the field for those rows.
6. A multi-record reader in `readKind` is needed for the recommendation, and the source references must resolve per row (`resolveRecord` already does).

## Method and limits

- Rows were converted by script into the six layouts, formatted with the repository's Biome (`biome format`), and measured on one machine (16 cores, shared with other jobs), file cache warm, three runs each for timings.
- The row shape, the natural key and the mutation scenario are assumptions made for the measurement (seeded; 3 %, 1 % and 0.5 % of one maker's rows). Real re-imports will differ.
- Git figures come from a scratch repository per layout. GitHub's own handling (delta chains on the server, rendering of large diffs) was not tested; its limits are quoted from the documentation below.
- Web build timings come from three runs of the Pages workflow on GitHub-hosted runners; page weights come from the `pages-next` and `pages-stable` artifacts of one of them. The web build was not run locally.
- `readRecords` with the existing `CatalogueLoad` shape ran over 65,884 of the 65,887 rows with a cartridge id; unknown cartridges and the zero charges were reported as errors, which does not change the time materially. Not measured: cold cache, SQLite as a fallback, Pages compression, build memory.

## Sources

- GitHub, repository limits (directory width 3,000 recommended, single object 1 MB recommended and 100 MB enforced, diff limits of 300 files, 20,000 lines, 1 MB per pull request and 500 kB per file): https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits
- GitHub Pages limits (1 GB published site, 100 GB per month soft bandwidth, 10 minute deployment timeout): https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Biome, `files.maxSize` and the warning for larger files: observed with the repository's Biome 2.6.2 (`biome check` on the generated files), configuration in `biome.json:10`.
- Pages workflow run used for build times and artifacts: https://github.com/OpenReloading/Ballistics/actions/runs/41204208553
