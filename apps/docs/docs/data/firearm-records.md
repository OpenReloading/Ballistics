---
title: Firearm records
description: Recommended record kinds for firearm manufacturers, models, variants and builds, their import path, workbench integration and the decisions the owner takes.
---

# Firearm records

A shooter picks a gun in the workbench and its barrel length, twist, chamber and mass come with it. This page recommends how to model that, how values are imported, and ends with a decision brief. Nothing described here exists yet: no schema, importer or record is written, and no third-party data is in the repository.

Results are simulations, not load data; a firearm record holds facts about the gun.

## Recommendation

Add two catalogue record kinds, `firearmModel` (the identity of a gun) and `firearmVariant` (one chambering and barrel of a model, self-contained, no inheritance). Reuse the `manufacturer` record. Keep builds as user records: the existing `firearm` record plus an optional parts list and an optional catalogue reference. The workbench Gun card copies a picked variant into the browser library.

The first records are invented demo records. The choices are in the [decision brief](#decision-brief).

## What exists today

- A firearm is one schema, `firearm`, for every origin: lengths in mm, mass in g, angles in degrees, each as a `quantity` object, with the maker as a manufacturer reference (`catalogue:` or `user:`), and `model` (`packages/schema/src/firearm.ts`). Optics are children of it (`optic`). The optic as mounted carries the sight height and zero (`opticMount`, `opticConfiguration`). The browser keeps it as the user record `firearm` (`packages/schema/src/user-data.ts`).
- The workbench keeps the gun on the load: `Load.firearm` (`packages/schema/src/load.ts`) is an optional reference to such a user record, no copy.
- The Gun card is a picker over the browser library (`GunPicker` in `apps/web/src/components/workbench-inputs.tsx`). `chooseFirearm` copies twist and mass into the form (`apps/web/src/components/use-workbench-load.ts`). The barrel length reaches the seating preview through the record (`LoadFigure` in `workbench-inputs.tsx`) and the defaults (`suggestDefaults` in `apps/web/src/lib/input-defaults.ts`), not through the form.
- Catalogue records are one JSON file per record, the id equals the file name, ids are unique across roots (`checkRecordId` in `packages/data/src/read-kind.ts`). Every record has `provenance` (`packages/schema/src/provenance.ts`), whose sources (`source`) carry `origin` (`sourceOrigin`), `license`, `terms`, `page`, `retrieved` and `sha256`. A source cited by several records is stored once in `packages/data/records/sources/`. Kinds are read by `readRecords` in `packages/data/src/records.ts`. Stored units: length mm, mass g, angle deg, count 1 (`units` in `packages/schema/src/units.ts`).
- `manufacturer` has `id`, `name`, `website`, `aliases` and `provenance`, and is documented as a maker of powders or bullets (`packages/schema/src/manufacturer.ts`, [Manufacturers](manufacturers.md)). Powder and bullet records reference it by id. Demo records use an invented name and a source of `synthetic-test-data`.
- No field of `packages/core/src` or `packages/schema/src` mentions a gas port or gas system (search for `gas port`, `gasPort`, `gas system`). It has no effect on any computed quantity.
- Sight height lives on the optic mount, not on the gun. A catalogue gun cannot supply it unless the record includes optic and mount.
- `freebore`, `baseToOgiveAtLands` and `overallLengthAtLands` of the user firearm (`firearm.ts`) are measured values of one barrel. The two lands lengths need `landsBullet`, the reference to the bullet they were measured with; the workbench uses them for the jump only with that bullet. No source of the table below was seen to print them, so the catalogue does not carry them.

## Recommended schema

Catalogue records are `packages/data/records/<kind>/<id>.json`, stored units mm, g, deg, count, each with `provenance`. `quantity(kind)` means `{ value, raw? }` in the stored unit, as in `packages/schema/src/load.ts`.

| Kind | Field | Type, unit | Notes |
|---|---|---|---|
| `manufacturer` (existing, extended) | `country` | ISO 3166-1 alpha-2, optional | needs a source with `fields: ["country"]`, as `needsCountrySource` (`packages/schema/src/shared.ts`) requires for powders and bullets; the doc comment "makes powders or bullets" is widened |
| | other fields | unchanged | one record serves powder, bullet and firearm makers; a renamed maker keeps its id and the old name goes to `aliases` |
| `firearmModel` | `id` | record id | `<manufacturer-id>-<model-slug>`; never changes |
| | `manufacturer` | id of a `manufacturer` | required |
| | `name` | text | as the maker prints it |
| | `aliases` | text[] | regional and former names of the same gun; searched, unique per manufacturer |
| | `category` | enum: rifle, carbine, pistol, revolver, shotgun, combination, other | for filters |
| | `action` | enum: bolt, semi-auto, lever, pump, single-shot, break, revolver, other; optional | |
| | `country` | ISO 3166-1 alpha-2, optional | country of manufacture; needs a source with `fields: ["country"]` |
| | `production` | `{ from?, to? }` years, count 1 | `to` absent: in production when the source was retrieved |
| | `successor` | id of a `firearmModel`, optional | a discontinued model points to its replacement |
| | `provenance` | provenance | |
| `firearmVariant` | `id` | record id | `<model-id>-<designation-slug>` |
| | `model` | id of a `firearmModel` | required |
| | `designation` | text, optional | the maker's catalogue name or item number as printed |
| | `chamber.name` | text | chambering as printed; always stored |
| | `chamber.cartridge` | id of a `cartridge`, optional | set only when the printed name resolves to a record; the repository holds C.I.P. cartridges only, so many chamberings stay unresolved |
| | `barrel.length` | quantity length, mm | `barrel.measuredFrom`: enum boltFace, breech, unstated (makers differ on where the length starts) |
| | `barrel.twist` | quantity length, mm per turn | 1:7 in is 177.8 mm; matches the user record's length per turn |
| | `barrel.twistHand` | enum right, left | |
| | `barrel.grooves` | count 1, optional | |
| | `barrel.grooveDiameter`, `barrel.boreDiameter` | quantity length, mm, optional | rarely published; the cartridge sheet gives the nominal values |
| | `mass` | quantity mass, g, optional | `massBasis` text (empty, without magazine or optic) |
| | `overallLength` | quantity length, mm, optional | |
| | `sightRadius` | quantity length, mm, optional | iron sights, printed for pistols |
| | `verification` | enum verified, unverified | every value checked by hand against the cited page, as `cartridge.verification` (`packages/schema/src/cartridge.ts`) |
| | `provenance` | provenance | page citation, `retrieved`, `sha256`, `origin`, `license` or `terms` |
| `firearmBarrel` (phase 2) | `id`, `manufacturer`, `name`, `chamber` | as variant | an aftermarket barrel is a catalogue part; the only part that carries ballistic data |
| | `length`, `twist`, `twistHand`, `grooves`, diameters | as variant `barrel` | plus `profile` text, `mass` g |

User records (browser and files) use the same shape and stored units as catalogue records (`packages/schema/src/firearm.ts`, [Record model](record-model.md) step 5). Changes to `firearm`:

| Field | Type, unit | Notes |
|---|---|---|
| `catalogue` | `{ variant: id, retrieved: date }`, optional | where the values were copied from; nothing reads it back |
| `parts` | array of `{ kind, name, manufacturer?, mass? }`, at most 20, optional | `kind`: receiver, barrel, gasSystem, handguard, stock, muzzleDevice, other; `mass` a quantity in g; descriptive, no solver reads it |
| `barrelLength`, `twist`, `twistHand`, `grooveDiameter`, `boreDiameter`, `firearmMass`, `cartridge`, optics | unchanged | these stay the only values the solvers read; the solvers get them in SI |

Properties that matter for ballistics: barrel length, twist and hand, chamber (through the cartridge), bore and groove diameter where known, mass (recoil), sight height (optic mount, typed by the user). The gas system length matters for nothing the app computes, so it is a descriptive part, not a number. Receiver, handguard and stock are descriptive text.

Rules:

- Ids are slugs and never change. A renamed maker or model keeps its id, the old name goes to `aliases`.
- A model sold under different names in different regions is one model with the names as aliases.
- A variant has one chamber: a model made in three calibers has three variants. A variant offered in two barrel lengths has two variants.
- A discontinued model keeps its record with `production.to` set.
- New kinds are added to the `Bundle` and the reader of `packages/data/src/records.ts` and checked in `packages/data/src/references.ts`.

## Rejected alternatives

| Alternative | Why not |
|---|---|
| Variant inherits fields from its model and overrides some | The API, the web app, the validator and the importer would each need a merge step; a partial record cannot be validated alone; a source cites a value for one variant, not for the model. Repeating a value in three variants is cheaper than resolving inheritance. |
| Variants nested as an array in the model file | One record per file is the convention (`checkRecordId` in `packages/data/src/read-kind.ts`); nested variants cannot carry their own provenance and ids, make files large and a re-import diff noisy. |
| One flat record per model (chamber and barrel as fields) | Cannot list several calibers or barrel lengths of one model without repeating its identity; the model page and aliases would repeat. |
| New `firearmManufacturer` kind | Duplicates names and ids; a company that makes bullets and rifles would have two records; reference check, search and API for `manufacturer` already exist. |
| Every part of a build (receiver, handguard, stock, gas system) as a catalogue record | Only the barrel carries ballistic data; the other parts would be records no solver reads, with far more sources to find and keep current. They stay descriptive fields of the user's build. A barrel record is a phase 2 option. |
| A build as its own record kind next to `firearm` | The `firearm` user record already holds barrel, twist, optics and configurations, and `Load.firearm` is tied to it. A second kind would double the picker, the file format and the editor. |
| Compute the sight height from receiver, mount and optic heights | The bore axis height over the rail is unverified for most receivers, so the sum would carry unknown offsets. Sight height stays a measured input of the optic mount. |
| A live reference from the workbench to the catalogue id | A saved workbench file would dangle when a record is removed or unavailable offline. A copy into the user record keeps files self-contained. |
| Chamber only as a cartridge id | Many chamberings have no cartridge record; a required id would drop those guns. The printed name is stored, the id is optional. |

## Import path

- Shape: a pure parser in `packages/importers` (no I/O, no Node imports), `parseFirearmSpecs(text, options)`. Input is a delimited text file in an OpenReloading template, one row per variant: manufacturer, model, designation, chamber as printed, barrel length with unit, twist as `1:7`, `1 in 7` or `178 mm`, mass with unit, source page. Output is `FirearmVariantCandidate[]`. Like the chronograph parsers it returns `{ candidates, missingPaths, warnings }`; the caller reads the file and computes the `sha256`.
- Who produces the file: a person who transcribes values from a cited page, or a maker who supplies a file. No parser reads a website.
- Mapping: units to mm, g, deg (inch and mm accepted, any other unit rejected); twist forms to length per turn; the chamber name is matched to `cartridge` names and aliases after normalizing case, spaces and the `.` prefix, and an unmatched one stays `chamber.name` with a warning; the manufacturer is matched to `manufacturer` names or aliases, an unknown one is reported, not created.
- Validation: schema validation of each candidate; plausibility bounds (barrel length 20 to 1500 mm, twist 100 to 1000 mm per turn, mass 0.1 to 20000 g) as warnings, labelled as assumptions; duplicate ids within the file and against existing records.
- Re-import review: a maintainer script outside the package matches by id and writes a report: created, changed (field by field, old value to new value), unchanged, unresolved chamber names. It never overwrites a record. Changed values go into a pull request as a diff, `data:validate` runs on it, and a record with `verification: verified` changes only by a hand edit. The `retrieved` date and `sha256` of the cited file make the diff attributable.

## Workbench integration

- Pick a catalogue gun: the Gun card gets a search over variants next to the library select, built like the powder search (`RecordSearch` in `apps/web/src/components/record-search.tsx`), listing manufacturer, model, designation and chamber. When a cartridge is chosen the list is filtered to variants whose `chamber.cartridge` equals it, and a variant with another chamber shows a warning.
- Pick a variant: choosing a model shows its variants (barrel length, twist, chamber) in one select.
- Copy, not link: "Use" creates a user `firearm` record in the browser library (name, manufacturer name, model, cartridge, `barrelLength`, `twist`, `twistHand`, `grooveDiameter`, `boreDiameter`, `firearmMass`, `catalogue`) and sets `Load.firearm` to the reference `user:<UUID>` of that record (`packages/schema/src/load.ts`, unchanged). The existing `chooseFirearm` then runs (`use-workbench-load.ts`). It must also copy the barrel length to the form: today it reaches the figure only through the record. Files stay self-contained. The static site reads data files the API writes at build time (`writeStaticApi` in `packages/api/src/static.ts`), so the static output must include the model and variant lists for the search to have data there.
- Build: the firearm editor gets a "Build" section with the parts list. Choosing or typing the barrel fills barrel length, twist and chamber. Optics and mounts stay as they are, and the sight height stays a typed value of the optic mount.
- The user's own firearms stay unchanged and listed first. A record without `catalogue` and `parts` behaves as now. No migration (pre-1.0).
- API and data: `GET /v1/firearm-models` and `/v1/firearm-variants` filtered by `q`, `manufacturer` and `cartridge`, like the powder list ([Manufacturers](manufacturers.md), section API). A new model page in `apps/docs/docs/data/` documents the kinds once they exist.

## Follow-up issues

Proposed, in order, each with acceptance criteria a test can check.

1. **schema: firearm model and variant records.** Add `firearmModel`, `firearmVariant`, `manufacturer.country`. Accept: a valid example of each parses; `chamber.cartridge` is optional; twist and length are stored in mm, mass in g, years as counts; a variant without `model` is rejected; `verification` is required; the JSON Schema is written; `npm run docs:check` passes for the exports.
2. **data: read and validate the new kinds.** Accept: `readRecords` reads `firearm-models` and `firearm-variants` folders; `data:validate` fails for a variant naming no model, a model naming no manufacturer, a `chamber.cartridge` naming no cartridge, a duplicate alias per manufacturer and a duplicate designation per model; demo records with invented names validate.
3. **api: list and get endpoints.** Accept: `GET /v1/firearm-models` and `/v1/firearm-variants` with `q`, `manufacturer`, `cartridge`, paging, and `GET .../:id`; `npm run api:check` passes with the baseline rewritten in the same pull request; a test fixes the search order; the static API output (`writeStaticApi`) includes both lists.
4. **importers: variant spec table parser.** Accept: tests for twist forms (`1:7`, `1 in 7`, `178 mm`), inch and mm lengths, the unmatched chamber warning, an unknown manufacturer reported, bounds warnings and duplicate ids; no Node imports in `src/`.
5. **tools: re-import report.** Accept: a script reads a file and the records root and writes created, changed and unchanged counts and a field diff; it never writes over an existing record; tested with fixtures.
6. **web: catalogue pick in the Gun card.** Accept: a Vitest of the copy mapping (every field and unit); a picked variant creates a library record and sets `Load.firearm`; the barrel length reaches the form; a chamber mismatch shows the warning; the search works in the browser (static lists); an e2e assertion only if a stack is needed.
7. **schema and web: build parts of the user firearm.** Accept: `parts` and `catalogue` are optional on `firearm`; an old file without them still loads; a part kind outside the enum is rejected; the editor adds, edits and removes parts; the data card prints them.
8. **docs: firearm records model page.** Accept: a new firearms page in `apps/docs/docs/data/` holds the record tables; docs checks and tests pass.
9. **phase 2, optional: barrel records.** `firearmBarrel` kind and a barrel picker in the build; accept as issues 1 to 3 for barrels.

## Decision brief

**Question 1, scope of the first release.** Recommended: **B**.

- **A. Names only.** Keep the user firearm as it is; offer the manufacturer list in the editor as a suggestion. Smallest; the shooter still types barrel length and twist.
- **B. Models and variants, build as a user record (recommended).** The schema of this page without barrel records, copy into the library, parts list on the user firearm. Delivers barrel length, twist, chamber and mass with the gun; later steps follow without breaking files.
- **C. B plus barrel, receiver, handguard, stock and optic as catalogue records.** Far more sources to find and maintain; only the barrel carries ballistic data.

With B chosen, follow-up issues 1 to 8 can start.

## Not verified

Bore axis heights of receivers.
