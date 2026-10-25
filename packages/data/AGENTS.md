# @open-reloading/data

Canonical records in git, validated against `@open-reloading/schema`, bundled for the API. ESM.

## Layout

`readRecords` reads one records root or several read as one set (`src/records.ts`). `records/powders` and `records/bullets` hold the synthetic demo records (CC0-1.0). `records/capacities`, `records/loads` and `records/chrono` hold none. `firings` and `range` have no folder: `readRecords` reads them where a records root has one.

| Path | Kind and rules |
|---|---|
| `records/cartridges/<id>.json` | `Cartridge`, one per C.I.P. sheet: names (aliases printed on the sheet), table, dates and values. Its source cites `cip-tdcc` with the sheet's URL, SHA-256 and retrieval date. |
| `records/manufacturers/<id>.json` | `Manufacturer` (name, website, aliases). The id is the slug of the name without the legal form and never changes (`apps/docs/docs/data/manufacturers.md`). |
| `records/powders/<id>.json`, `records/bullets/<id>.json` | Components as their manufacturers sell them. `manufacturer` must exist. |
| `records/capacities/<id>.json` | `CaseCapacity` (`origin` `catalogue`, `cartridge` and `caseManufacturer` as `catalogue:<id>` references), one figure from one source. `cartridge` must exist, and `caseManufacturer` where set. |
| `records/loads/<id>.json` | `Load` records (`origin` `catalogue`, records named by `catalogue:<id>` references). `cartridge`, `bullet`, `powder` and `capacity` (where set) must exist, except a bullet or powder a measured load describes by maker and name. |
| `records/chrono/<id>.json` | `ChronoSession` records. Every `load` of a shot string must name a load record. |
| `records/range/<id>.json` | `RangeFirings`, spark-range rounds of one projectile from a report (Mach, total yaw, drag coefficient at that yaw). Not served by the API yet. |
| `records/firings/<id>.json` | `FiringSeries`, rounds fired and measured by others as a publication reports them. `cartridge` must exist. Every source names its URL and `license`. |
| `load-tables.json` of a records root | The manufacturer load tables the powder fit reads (`loadTables` in `@open-reloading/schema`): by row file name, `manufacturer` (a record id), `title`, `url?`, `retrieved`. A file or entry that breaks the schema fails validation. Optional. |
| `records/renames.json` | Old ids by kind directory, each with the id that replaced it (`renames` in `@open-reloading/schema`, `{}` while none). A reference to an old id resolves. |
| `records/sources/<id>.json` | `SourceRecord`, a source that several records cite (the C.I.P. TDCC, rule books, the synthetic demo data), see Provenance below |
| `records/target-faces/<id>.json` | `TargetFace`, see below |
| `records/federations/<id>.json`, `records/disciplines/<id>.json`, `records/target-mappings/<id>.json` | `Federation`, `Discipline`, `TargetMapping`, see below |
| `records/caliber-classes/<id>.json` | `CaliberClass`: groups of cartridges whose bullets have the same diameter, named by the disciplines. Rules in `src/caliber-classes.ts` (below). |
| `test/fixtures/` | Test data only, never real records |

- Target faces: a printed target face as a rule book defines it (ring diameters to the outside edge of the line, inner ten, aiming black, events with their scoring gauge, and where set ring colours, paper size, bulls, ovals and discipline category per event).
  - Served by `GET /target-faces`, scored by `apps/web/src/lib/ring-scoring.ts` (`apps/docs/docs/models/ring-scoring.md`).
  - Only faces whose numbers were read in the cited rule book.
  - An event key the schema does not define (such as `caliber`) rejects the face.
  - `federation` of a face (required in records) and of an event, and `targetMapping.event` (the event id), are checked in `src/federations.ts` (`checkFaceFederations`, `checkMappings`).
- Federations, disciplines and target mappings: fields, reference rules (`src/federations.ts`) and source rules in `apps/docs/docs/data/federations.md`. Served by `GET /federations`, `/disciplines`, `/target-mappings`.
- Provenance: each source names the actual source in `title` (site and table, report, publication). It may state who stands behind it in `origin`:
  - `manufacturer`: data a manufacturer supplied or published, used with its permission.
  - `public`: an open license or public domain, `license` set. It can be a manufacturer's data.
  - `community`: contributions. No rules yet.
  - Without `origin`, a source with a `license` is `public`, any other `manufacturer`.
  - A record outside the CIP and target-face kinds enters this repository only through these rules.
- Source records (`src/sources.ts`): a source two or more records cite is stored once in `records/sources/` and cited as `{ "source": "<id>" }` plus this record's `page`, `fields`, `kind`, `note` (put before the source record's note) and the `url`, `sha256`, `retrieved` of a file of its own. A federation's `ruleBooks` are source record ids. `readRecords` resolves both before validation, so the bundle and the API carry full sources.

## Commands (this directory, or `-w @open-reloading/data` from the root)

- Validate: `npm run validate` (root: `npm run data:validate`). Needs `@open-reloading/schema` built.
- Build: `npm run build` (writes `dist/bundle.json`, generated, not committed)
- Test: `npm test` (Vitest)
- Type check: `npm run typecheck`

## Facts

- The file name without `.json` equals the record `id` (lowercase kebab-case).
- Edits happen only in these records. The API catalogue is rebuilt from the bundle.
- Cartridge records are generated from the official CIP TDCC sheets: do not hand-edit them.
  - `verification: verified` marks a record whose every value was checked by hand against the sheet.
  - Figure ids name the sheet revision: `sheetId` (`@open-reloading/schema`), `cip-<id>-<revised or published>`.
  - Records the importer cannot re-read (unsupported layouts, cartridges no longer in the listing) are kept from the earlier import.
- Firing series, loads and chronograph sessions are in the bundle but not served by the API yet.

## Validation rules

Every finding below fails validation.

- Sources (`checkSources`, `src/sources.ts`): an unknown source id, a source record no record cites, two source records with the same `sha256`, a reference with a key of the source record (`title`, `publisher`, ...), an embedded source that is also a source record, and an embedded source in two or more records.
- Cartridge values: the plausibility rules in `src/plausibility.ts`. A finding the record lists in `exceptions` with a reason is exempt. An exception whose finding no longer occurs fails too.
- Bullets: `checkBullet` in `src/plausibility.ts` (diameter, mass, BC, length-to-diameter and twist ranges, G7 0.35 to 0.65 times G1).
- Capacities, powders and chronograph sessions: `checkCapacity`, `checkPowder`, `checkChronoSession` in `src/plausibility.ts`.
- Renames (`src/renames.ts`): an old id that is still a record, a replacement that is no record and a file that breaks the schema fail. Where a reference check names an unknown id, an old id of `renames.json` counts as known (`src/references.ts`, `src/federations.ts`).
- Caliber classes (`checkCaliberClasses`, `src/caliber-classes.ts`): a member that is no cartridge record, a cartridge in two classes, a member without G1 on its cartridge side, a nominal diameter more than 0.15 mm from G1 of a member, and a class id of a discipline that is no record.
- Duplicate names (`src/names.ts`): cartridges, powders (names and aliases), bullets, range records and target faces.
- Sources (`checkCoverage`, `src/coverage.ts`): in powders, bullets, capacities, federations, disciplines, target mappings and caliber classes, every data field must be supported by a source.
  - A source with `fields` supports only those dot paths (`base.length`, `ballisticCoefficients`).
  - Identity fields (`manufacturer`, `name`, `productNumber`, ...) need no field-level source.
- Powder `interior` (`checkFittedSources` in `src/load-tables.ts`): only `fitted` sources for `interior` that name a manufacturer load table listed in `load-tables.json` of a records root (`readLoadTables` in `src/records.ts`) and the fit run (`run`: model version, report). The load table's `manufacturer` must exist (`checkManufacturerReferences` in `src/references.ts`).
  - A `public` source with a `license` is exempt.
  - Any other source fails.
