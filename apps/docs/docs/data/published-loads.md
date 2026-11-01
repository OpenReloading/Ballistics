---
title: Published loads
description: The load tables powder and bullet makers print, stored as printed with their velocity, pressure, primer and source, and the rules the data validation checks.
---

# Published loads

A published load file holds the loads one table prints for one cartridge: the recipe (bullet, powder, primer, case, overall length and test barrel) once, with its start, maximum, single or recommended charge, each with the velocity and pressure printed for it. Every figure keeps the text the table prints. Nothing is rounded, interpolated or filled from another table, and a figure the table does not print is absent. Schema: `packages/schema/src/published-load.ts` (`publishedLoads`). Rules: `packages/data/src/published-loads.ts`.

A published load is not a `Load` (the workbench recipe of one user, `packages/schema/src/load.ts`) and not a `FiringSeries` (rounds fired and measured, `measured` provenance). It has charges with outputs, and it describes bullets and powders by their printed text where no record exists.

## Layout

`records/loads/<cartridge id>/<table>.json`, one file per cartridge and table. The folder is the cartridge, the file name is the maker's id, or `<maker id>-customer` for a table of loads that customers sent in. The plain `Load` records stay directly in `records/loads/`. Published loads are read by `readRecords` and returned next to the bundle (`publishedLoads`), not inside it: `bundle.json` and `catalogue/index.json` do not carry them.

## File

| Field | Meaning |
|---|---|
| `id` | The file name without `.json` |
| `maker` | Id of the manufacturer record that publishes the table |
| `producedBy` | `maker`, or `customer` for loads its customers sent in |
| `cartridgeName`, `cartridge` | The cartridge as the table prints it, and its `catalogue:<id>` reference. The folder is that id |
| `loads` | The loads, each with an `id` unique in the file. They are sorted by `id`, so a newer edition edits loads in place |
| `provenance` | Kind `published`. Each source names `publisher`, `url`, `retrieved` and `origin` |

## Load

| Field | Meaning |
|---|---|
| `bullet` | `printed` (make, type and number as printed), `mass`, the `diameter` where the table prints one, and `record`, a `catalogue:` bullet reference where a record matches |
| `powder` | `printed` and `record` |
| `primer` | See Primer below |
| `case` | The case as printed |
| `coal` | Overall length as printed. `limit: min` where the table prints a minimum. A printed word such as `Flush` has no `value` |
| `barrel` | `length` and `twist` (length of one turn: `1:12"` is 304.8 mm) |
| `charges` | One charge per kind: `start`, `max`, `single` (stands alone) and `recommended` |
| `source` | Position in `provenance.sources` of the source that printed the load. Absent: the first. A load a newer edition prints unchanged keeps citing the edition that printed it |
| `page`, `url` | Page, anchor or row of the source, and a deep link where it differs from the source URL |

A charge has `charge`, `velocity` (with `point`, the symbol the table prints for the measuring point, such as `v3` or `V5`, and its `distance` only where the source defines the symbol), `pressure`, `marks` (marks with a stated meaning: `compressed`, `do-not-reduce`, `subsonic`, `reduced-recoil`, `proof-tested`) and `printedMarks` (marks printed without a stated meaning, as printed).

## Printed figures

A figure is `{ value?, raw }`. `raw` is the printed text with its unit (`55 gr`, `13,600 PSI`, `3,30 g / 50 grs`) and is always present. `value` is the printed number in the stored unit, converted with the exact factor and kept to 7 significant digits: 13,600 psi is 937.687 bar, 55 gr is 3.563940 g.

- A figure with no stored unit has `raw` only: a crusher pressure (CUP, LUP) is not converted to bar, `Flush` has no number.
- A table that prints a figure without a unit has `assumedUnit` next to `raw`, and `value` rests on it.
- `data:validate` reads the numbers and units printed in `raw` (a decimal comma, thousands commas, a pair such as `g / grs`, a twist `1:12"`) and fails a `value` that matches none of them to 7 significant digits.

## Pressure and its basis

A pressure has the printed `unit` (`bar`, `psi`, `CUP`, `LUP`), the `peak` figure, and a `method` only where the source names one or the unit implies it. `methodBasis` says which: `stated` or `from-unit`. A table that names no method (a pressure printed next to a C.I.P. maximum, for example) leaves `method` and `methodBasis` absent.

The method is also the basis a pressure is compared on. Values on different bases are never converted into each other and a comparison refuses to mix them:

| `method` | Meaning |
|---|---|
| `transducer` | The C.I.P. method, as the cartridge records state it |
| `case-contact` | A transducer that rests against the outside of the case, the way maker tables print psi figures |
| `crusher` | A copper crusher: a conventional value in CUP or LUP, no bar value, compared by velocity only |
| `piezo`, `energy` | As the cartridge records state them |

A bar or psi figure has a `value` in bar. A crusher figure has none, and a crusher method is printed in CUP or LUP.

## Primer

`primer.printed` is the primer as the table prints it, so `RWS 5333 und 5341` stays whole. `primer.records` lists catalogue primers only where an explicit alias maps the printed text to them, never by matching. `primer.size` and `primer.magnum` are set only where the printed text states a size class (`Large Rifle Magnum`, `LRM`), never read from a model number. A primer the table does not print is absent. `data:validate` fails a printed `size` or `magnum` that differs from a primer record the load names.

## Sources and licence

Maker data carries no project licence. A table's source names the maker as `publisher`, the URL and the retrieval date, and has `origin: manufacturer`: data the maker published or supplied, which claims no permission. The maker's own terms go in `terms` where it states any, with a `license` of the form `LicenseRef-<name>`. A published load source with a project licence (an SPDX id) fails validation. Fitted parameters derived from these rows are the project's own data under the data licence.

A table that several files cite is a source record (`records/sources/`). The raw download stays out of the repository; the source record keeps its `sha256`.

## Hold-out split

The split of a row follows from its cartridge: the first byte of the SHA-256 of the lower-case cartridge id is 0 to 50 for test, 51 to 101 for validation and 102 to 255 for training (`splitOf`, `packages/cli/src/split.ts`). It is not stored. Fit tooling reads training rows only, and model choices use the validation rows.

## Import and re-import

A collector writes the loads of a table edition to a folder of its own, laid out like the records: `loads/<cartridge id>/<table>.json`, the loads in the order the table prints them. The merge sets the load ids and merges each file into `packages/data/records/loads/`:

```sh
npm run loads:merge -w @open-reloading/data -- <incoming folder> [--accept <id>... | --accept-all] [--dry-run]
```

The id of a load is the first 10 hex digits of the SHA-1 of its natural key: maker, cartridge, printed bullet text and bullet mass, COAL with its limit, printed powder, the set of charge kinds, barrel length and twist, and the marks of each charge. A figure counts by its `value` (its `raw` where it has none), so `55 gr` and `55 grs` are one key. Loads of equal key are counted in printed order: the first has the bare hash, the second `<hash>-2`, and so on. Edition, page, charge, velocity, pressure, primer and case are not in the key, so a newer edition finds its older load. An id the incoming file carries is replaced. Code: `loadId` and `mergePublishedLoads` in `packages/data/src/published-load-merge.ts`.

By load id, the merge:

- creates a load the repository does not have;
- leaves a load whose content (everything but `id`, `source`, `page` and `url`) is equal as it is, so it keeps citing the edition and page that printed it;
- lists a load with other content as changed, with the field paths that differ, and writes it only when its id follows `--accept` or with `--accept-all`;
- keeps a load the incoming edition no longer prints and lists it as absent. A load is never deleted.

An accepted load replaces the stored one whole, so a `record` link set in the repository and missing from the incoming file goes with it; the report lists such a link among the changed fields. A created or accepted load cites the incoming source, which is appended to `provenance.sources` where the file does not have it yet (a reference to a source record and the same source written out count as one). The other fields of a file in the repository stay as they are. The loads are written sorted by id, formatted the way `npm run format` formats the records, and a file the merge does not change is not written, so a second run of the same input changes no file and reports 0 created and 0 changed.

The command prints per file and in total the created, changed (and how many not accepted), unchanged and absent loads. A file whose cartridge folder is no cartridge record is not written and is listed under "waiting for a cartridge record". When an incoming file fails the `publishedLoads` schema (its ids set, its source references resolved from `records/sources/`), nothing is merged and the command exits with 1. `--dry-run` reports and writes nothing. Run `npm run data:validate` after a merge.

## Validation

`npm run data:validate` reports:

- a file whose cartridge is not its folder, names no cartridge record or a maker that is no manufacturer record, or whose name is not the maker's id (`<maker>-customer` for `producedBy: customer`);
- a duplicate load id and loads that are not sorted by id;
- a bullet, powder or primer a load names that is no record (an old bullet or powder id of `renames.json` does not count, so a rename rewrites the loads that name it);
- a printed primer size or magnum that differs from the primer record;
- a `value` that does not follow its `raw`;
- a source without publisher, URL, retrieval date or origin, a kind other than `published`, and a project licence on maker data.
