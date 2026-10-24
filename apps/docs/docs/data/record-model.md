---
title: Record model
description: One entity per concept for catalogue records and browser user data, the overlaps the code has today and the steps that remove them.
---

# Record model

Catalogue records and the records a user keeps in the browser describe the same things: a bullet, a cartridge, a firearm, a load. Today some of them have two shapes, with different units, id rules and field names. The target is one entity per concept, with the place a record comes from stored as an attribute instead of a second type. This page lists the entities, the overlaps found in the code, the target model and the order of the steps that get there. Paths are relative to the repository root. Evidence is named by file and symbol, because line numbers move.

## Entities today

Writers: catalogue (git records, checked by `readRecords`), user (browser, `packages/schema/src/user-data.ts`), importer (a parsed file turned into a record shape), solver input (never stored).

| Entity | Schema | Stored | Written by |
|---|---|---|---|
| Manufacturer | `manufacturer.ts` | `records/manufacturers`, table `manufacturers` | catalogue |
| Cartridge | `cartridge.ts` | `records/cartridges`, tables `cartridges` and `spec_values` (columns, no `record` blob) | catalogue, generated from the C.I.P. sheets |
| Bullet | `bullet.ts` | `records/bullets`, table `bullets` (`record` jsonb) | catalogue |
| Powder | `powder.ts` | `records/powders`, table `powders` (`record` jsonb) | catalogue |
| Case capacity | `case-capacity.ts` | `records/capacities`, table `case_capacities`, embedded in `GET /cartridges/:id` | catalogue |
| Load | `load.ts` | `records/loads` (empty), bundle only: no table, route or web reader | catalogue |
| Chronograph session | `chrono-session.ts` | `records/chrono` (empty), bundle only | catalogue, importers |
| Firing series, range firings | `firing.ts`, `range.ts` | no folder, bundle only | catalogue |
| Source record | `provenance.ts` | `records/sources`, inlined into records on read | catalogue |
| Federation, discipline, target mapping, target face | `federation.ts`, `target-face.ts` | one folder and one table each | catalogue |
| Caliber class | `caliber-class.ts` | code only (a constant) | developer |
| Load tables | none | `load-tables.json` of a records root | catalogue |
| Firearm | `firearm.ts` | user record `firearm` | user |
| Workbench state | `workbench.ts` | user record `workbenchState`, called "loads" in the UI | user |
| Bullet design | `user-data.ts` (`bulletDesign`) | user record | user |
| Cartridge design | `user-data.ts` (`cartridgeDesign`) | user record | user |
| Target sheet | `target-sheet.ts` | user record, photos in the store `files` | user |
| Measured series | `workbench.ts` (`measuredSeries`) | inside the workbench state | user, reshaped from importer output |
| Solver bodies | `packages/api/src/compute/interior-schema.ts`, `exterior-schema.ts` | none | solver input |

## Overlaps

Ranked by how much code and visible behavior depends on them.

**Bullet and bullet design (high).** A bullet record is nested, in the stored units (mm, g, degrees), with the manufacturer by id and a provenance. A bullet design is a manufacturer name, a name, three choices as free text and a flat record of dotted keys in SI (m, kg) that no schema checks. The designer (`apps/web/src/lib/bullet-designer.ts`) maps the keys onto the record by path. The link to the catalogue record is a copy plus a title (`parent` in `user-data.ts`), so a catalogue correction never reaches a design. The designer also offered values the record could not hold: the ogive forms `round-nose` and `flat-nose` and a cannelure. Step 1 closes that gap.

**Cartridge and cartridge design (high).** A design is a table, a list of `specValue` entries in the stored units (while the other user kinds are SI) and a `parent`. It lacks the record's dates, verification, pressure method and provenance. The workbench cannot hold a design as its cartridge: `use-workbench-load.ts` keeps a catalogue cartridge and a design side by side, and a saved load keeps only the catalogue id, so a load made on a design cannot be reopened.

**Load and workbench state (high).** Both are a recipe: cartridge, firearm, bullet, powder, charge, seating, notes. `Load` is validated and bundled but nothing creates or reads one. The workbench state references catalogue ids and keeps a snapshot of every resolved solver value in `siValues`, a record that accepts any key (the API checks the keys, `packages/api/src/compute/load-file.ts`). Whether the catalogue or the snapshot wins on reopening depends on call order in `openLoad`.

**Firearm (medium).** Barrel length, twist and twist hand exist in `Load.firearm` (mm), in the user firearm record (m, twist hand required) and as free text in `firing.ts`.

**Measured series and chronograph session (medium).** Both hold the same `chronoShot`. `apps/web/src/lib/measurements.ts` reshapes a session into a series and drops device kind, firmware, conditions, propellant temperature and provenance. A string in a ladder varies charge, seating depth or temperature while `shotString.load` has no place for the variation. `groupShot.chrono.session` in `target-sheet.ts` names a session that no user record kind holds.

**Case capacity (medium).** The record (g), `Load.case.waterCapacity` (g) and `workbenchState.measuredWaterCapacity` (m³) describe one measurement.

**Manufacturer (medium).** Catalogue records name a manufacturer by id; loads, sessions, firearms and designs carry free text, merged for display by `productLabel` in `apps/web/src/lib/manufacturers.ts`. `targetFace.organization` is a third form, compared with `federation.abbreviation` by hand.

**Units (high).** Catalogue records and cartridge designs use the stored units of `packages/schema/src/units.ts`. Firearm, workbench state, bullet design, target sheet, measured series and every solver body use SI. The same quantity then differs by a factor in different entities: charge in g or kg, barrel length in mm or m, muzzle distance in mm or m. `units` holds labels only, so conversion factors are written by hand in many files (one named table, `storedToSi` in `apps/web/src/lib/field-spec.ts`).

**Ids (medium).** Six rules: the kebab-case `recordId`, `localId` (1 to 64 characters, any), the same bound written inline, a 1 to 200 character string for references to catalogue records, the API path pattern and the derived `sheetId`. Step 3 gives user ids a UUID generator and references a scope, see "Step 3: what changed".

**Types and enums (medium).** `apps/web/src/lib/api-types.ts` re-declared the record types of the schema, and the case type list existed in the API route and in the web app. Drift showed in `productNumber` (optional in the copy, required in the schema) and in `ogive.form` (a string). Step 1 removes this.

**Low:** inline bullet, firearm and ammunition descriptions in publication records (`firing.ts`, `range.ts`) repeat part of Bullet and Firearm; caliber classes are a constant while the discipline schema enumerates their ids; `targetMapping.event` points at a face event by name, and `gauge` is stored on both.

## Target model

### Envelope

One envelope on every entity: `id`, `kind`, `origin`, `name`, `provenance`, `basedOn?`, `overrides?`, `revision`. The entity fields are the same for every origin.

`origin` says where a record lives and who owns it:

| Value | Meaning |
|---|---|
| `catalogue` | the git records, read only for users |
| `user` | the records of this browser's owner |
| `shared` | received through a file or a share link, kept as a copy owned by the receiver, with the sender's file cited in its provenance |

The finer standing of a citation (manufacturer, public, community) stays in `provenance.sources[].origin`. That field is renamed `standing` so one word has one meaning.

### Entities

| Entity | Origins | Notes |
|---|---|---|
| Manufacturer | catalogue, user | a user one is an id and a name, created when a new name is typed |
| Cartridge | catalogue, user | a user cartridge is `basedOn` plus `overrides` of the `values`, or standalone |
| Bullet | catalogue, user, shared | the designer edits a Bullet |
| Powder | catalogue, user, shared | a user powder overrides `interior` and `temperatureSensitivity`, which replaces the powder values hidden in `siValues` |
| Firearm | catalogue (later), user, shared | optics and configurations stay embedded |
| CaseCapacity | catalogue, user | one unit, g |
| Load | catalogue, user, shared | references to cartridge, firearm, bullet, powder and capacity; primer and case as component descriptions; seating; charge; a typed `analysis` with `overrides` and the ladder |
| Session | catalogue, user, shared | an event: strings of `{load, variation, shots}`, conditions, device, provenance with the imported file's SHA-256 |
| TargetFace, Federation, Discipline, TargetMapping | catalogue, user (faces) | `organization` becomes a federation reference |
| TargetSheet | user, shared | the photo stays a file; `load` and `session` are references |

Session stays separate from Load: a session is an event fixed in time, a load is a recipe reused over many sessions, and merging them would copy recipe data into every event. A target sheet is an event of its own that references both. Solver bodies stay derived SI inputs built from resolved entities and are never stored. The designers stay separate screens but edit the same entities.

### References and ids

- A reference is a string `"<scope>:<id>"` with scope `catalogue` or `user`. One string fits URL parameters, form fields and database keys.
- A catalogue id stays the kebab-case slug equal to the file name, unique per kind. A renamed or removed id resolves through `records/renames.json`.
- A user id is a UUID, unique across kinds. A shared record is re-keyed on import, so the ids of different users never meet.
- Local ids (optics, groups, notes) stay local and are never referenced from outside their record.

### Variants of a catalogue record

A user variant is `basedOn` plus `overrides`, a partial of the same entity schema in stored units, never a copy.

- The resolved record is the base with the overrides applied, by one pure function used by the web app, the importers and the compute routes.
- Objects merge by key and arrays replace as a whole. Cartridge `values` merge by `(side, symbol, variant)`, the key that already identifies a value. An explicit `null` removes a field.
- A field the user did not override follows the catalogue. `basedOn` carries the build hash seen at save, so the page can say the base changed.
- A `basedOn` that no longer resolves opens the record read only with the error shown. It is never replaced by a copy.

### Units

Stored entities use the stored units of `units.ts` only. SI appears at solver calls. User files of the old SI format are rejected, since no migrations are written before 1.0.

### Components without a catalogue match

A `{manufacturerName, model}` description is allowed only in catalogue records of provenance kind `measured` (publications). In user loads the app creates a user Bullet or Powder stub, so every reference resolves.

### Saved recipes

A saved recipe keeps only the solver keys the user typed, under `analysis.overrides`, validated against `workbenchValueKeys`.

### Database and API

- One table per entity: `id`, index columns and a `record` jsonb with the whole entity, as manufacturers, powders and bullets already have. Cartridge gets the same, with `spec_values` as a derived index, so `GET /cartridges/:id` answers the record plus computed fields.
- User data stays client side. The server holds catalogue records only and needs no `origin` column.
- Compute routes accept a reference or an entity (`bullet: Ref | Bullet`, and the same for powder, cartridge and firearm): a catalogue reference for a catalogue record, the resolved entity inline for a user record.

## Other findings

Ranked by impact.

1. User data the schema rejects is hidden: the store lists only valid records, an invalid one stays in IndexedDB, appears nowhere and is left out of Export all. A schema change makes data vanish from the user's view.
2. The browser store has no version, so a new object store cannot be added to an existing database. The file `version` is one integer for the whole file.
3. References in user data were never checked on open: the workbench's firearm, a sheet's load, a group's chronograph session and a design's `parent`. Step 3 checks the first two.
4. The unit split above is the largest regression risk: about 150 hand-written conversions.
5. Schema, designer and web types drifted apart where copied (step 1).
6. `Load`, `ChronoSession`, `FiringSeries` and `RangeFirings` are validated and bundled but nothing reads them, so they can drift unseen.
7. Id rules and the generator, and no id stability beyond manufacturers.
8. Catalogue reference checks stop at ids that exist: loads name components in text, `load-tables.json` has no schema, caliber class membership is a test only.
9. Cartridge is stored in columns, every other kind as a blob, so the cartridge answer differs from the stored record.
10. List and search routes lack indexes on the manufacturer keys, `bullets.diameter` and `cartridges.cip_table`, and `q` uses `ilike '%...%'`. Harmless at hundreds of records, relevant at thousands.
11. `spec_values.quantity` has no check constraint although `quantityKind` is an enum.
12. Two API replicas that start together can both seed, because the state row is read without a lock.
13. Search logic exists three times: SQL, the static `search.json` and the client lists.
14. Powder numbers mix `quantity` objects and plain numbers with a unit in the metadata.

## Steps

Each step lands alone with its model page updated in the same commit. Steps 4 to 6 edit the same files and run one after another.

| Step | Change | Needs |
|---|---|---|
| 1 | Single source of types and vocabularies (done, below) | |
| 2 | One unit table: `toSi` and `fromSi` per quantity kind | |
| 3 | Id and reference primitives, `checkUserRefs` (done, below) | |
| 4 | Designs become overrides of Bullet and Cartridge | 1, 3 |
| 5 | Firearm in one shape | 2 |
| 6 | Load unification: the workbench state becomes Load | 2 to 5 |
| 7 | Session unification | 3, 6 |
| 8 | CaseCapacity references | 6 |
| 9 | Manufacturer references | 3 |
| 10 | Database tidy: `record` jsonb on cartridges, indexes, check constraint, seed lock | |
| 11 | Browser store hardening: versioned IndexedDB, keep and list invalid records | before 3 and 4 |
| 12 | Catalogue loose ends: schema for load tables, caliber classes as records, renames map | |

Steps 1, 2 and 11 go first, then 3, then 4 to 6, then 7 to 9. Steps 10 and 12 fit any time; 10 does not run together with other changes to the cartridge routes.

### Step 1: what changed

- The web app imports `Source`, `Provenance`, `SpecValue`, `CaseCapacity`, `Bullet` and `Powder` from `@openreloading/schema`. `apps/web/src/lib/api-types.ts` keeps the shapes the API adds (list summaries, `CartridgeDetail` as the cartridge plus `caseType` and `capacities`, compute answers).
- `caseTypes` is one enum in `packages/schema/src/cartridge.ts`, used by the cartridges route and the web filter.
- The designer's choice lists are the options of the enums `baseTypes`, `ogiveForms` and `tipTypes` of `packages/schema/src/bullet.ts`. A test checks that each list is a subset of the enum at its path in the bullet schema.
- The bullet schema gains the ogive forms `round-nose` and `flat-nose` and an optional `cannelure` (`start`, `width`, `depth?`, lengths in mm). Existing records stay valid. The drawing reads a record's cannelure.

### Step 3: what changed

- `userId` (`packages/schema/src/ids.ts`) is a lowercase UUID, `ref(kind)` a reference `"catalogue:<record id>"` or `"user:<UUID>"`, `parseRef` splits one into scope and id. The kind only names the entity in the description: the text carries no kind.
- The browser creates the id of every new user record and photo with `crypto.randomUUID()` (`newId` in `apps/web/src/lib/new-id.ts`, with a `crypto.getRandomValues` fallback for origins that are not secure). The record `id` of a user data file keeps its bound (1 to 64 characters), so records saved with an older id open as before.
- `checkUserRefs(records)` (`packages/schema/src/user-data.ts`) returns the references between user records that no record answers: a workbench state's `firearm` (an old id or `user:<id>`) and a target sheet's `load`. Open and Import report them in the status line or the import report, `refNote` in `apps/web/src/lib/user-data.ts`, and drop nothing. A `catalogue:` reference, a catalogue id (`cartridge`, `bullet`, `powder`, a design's `parent`) and a group's chronograph session (no user record holds one before step 7) are not checked.
- A design's `parent.id` and a target sheet's `face.id` name catalogue records and use `recordId`. The API path pattern already is `recordIdRegex`.
- Existing fields keep their type: the references of the workbench state and the sheet stay plain ids until the steps that reshape those entities.

## Decisions

- The record attribute is `origin` with the values `catalogue`, `user` and `shared`. The citation's `origin` becomes `standing`.
- User data stays client side. Compute routes accept a reference or an entity.
- Overrides follow the merge rules above, and a catalogue change to a field that is not overridden is followed and shown as "base changed".
- One unit system in stored data. Old SI files are rejected.
- Session stays separate from Load. FiringSeries can become a Session after step 7, with a per-string summary for publications that print only a mean.
