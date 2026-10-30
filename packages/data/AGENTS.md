# @open-reloading/data

Canonical records in git, validated against `@open-reloading/schema`, bundled for the API. ESM.

## Commands (this directory, or `-w @open-reloading/data` from the root)

- Validate: `npm run validate` (root: `npm run data:validate`). Needs `@open-reloading/schema` built.
- Build: `npm run build` (writes `dist/bundle.json`, not committed)
- Test: `npm test` (Vitest). Type check: `npm run typecheck`

## Layout

`records/<kind>/<id>.json`, one record per file, read by `readRecords` (`src/records.ts`). The file name without `.json` equals the record `id` (lowercase kebab-case). Fields and rules per kind: the pages of `apps/docs/docs/data/` (overview in `record-model.md`).

- `records/cartridges/`: generated from the official CIP TDCC sheets, never edited by hand. `verification: verified` marks a record whose every value was checked against the sheet. Records the importer cannot re-read are kept from the earlier import.
- `records/manufacturers/`: the id is the slug of the name without the legal form and never changes.
- `records/sources/`: a source two or more records cite, stored once and cited as `{ "source": "<id>" }` (`src/sources.ts`). `readRecords` resolves it before validation.
- `records/renames.json`: old ids by kind directory with the id that replaced each. Rename a record by adding it here, never by reusing an id.
- `load-tables.json` of a records root: the manufacturer load tables a fitted powder cites.
- The `demo-*` records are synthetic (CC0-1.0). `test/fixtures/` holds test data only, never real records.
- Firing series, loads, chronograph sessions and range firings are in the bundle but not served by the API.

## Provenance

Each source names the actual source in `title`. Its `origin` says who stands behind it:

- `manufacturer`: data a manufacturer supplied or published, used with its permission.
- `public`: an open license or public domain, `license` set.
- `community`: contributions. No rules yet.
- Without `origin`, a source with a `license` is `public`, any other `manufacturer`.

A record outside the CIP and target-face kinds enters this repository only through these rules. Target faces: only faces whose numbers were read in the cited rule book.

## Validation

`npm run validate` fails on every finding; the rules are in `src/`:

- Sources (`src/sources.ts`, `src/coverage.ts`): unknown, unused or duplicate source records, and data fields no source supports (identity fields excepted).
- Plausibility (`src/plausibility.ts`): cartridges, bullets, cases, capacities, powders and chronograph sessions. A cartridge finding the record lists in `exceptions` with a reason is exempt; an exception whose finding no longer occurs fails.
- References (`src/references.ts`, `src/federations.ts`, `src/caliber-classes.ts`): every referenced record exists (an old id of `renames.json` counts).
- Duplicate names (`src/names.ts`).
- A fitted powder's `interior` cites a load table of `load-tables.json` and the fit run (`src/load-tables.ts`); a `public` source with a `license` is exempt.
