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
| Manufacturer | `manufacturer.ts` | `records/manufacturers` | catalogue |
| Cartridge | `cartridge.ts` | `records/cartridges` | catalogue, generated from the C.I.P. sheets |
| Bullet | `bullet.ts` | `records/bullets` | catalogue |
| Powder | `powder.ts` | `records/powders` | catalogue |
| Primer | `primer.ts` | `records/primers`, named by `Load.primer.record` | catalogue |
| Case | `case.ts` | `records/cases`, named by `Load.case.record`; user record `case` (a group of the user's cases) | catalogue, user |
| Case capacity | `case-capacity.ts` | `records/capacities`, embedded in `GET /cartridges/:id`; user record `caseCapacity` (step 8) | catalogue, user |
| Load | `load.ts` | `records/loads` (empty), bundle only: no route or web reader | catalogue |
| Chronograph session | `chrono-session.ts` | `records/chrono` (empty), bundle only; user record `session` (step 7) | catalogue, user, importers |
| Firing series, range firings | `firing.ts`, `range.ts` | no folder, bundle only | catalogue |
| Source record | `provenance.ts` | `records/sources`, inlined into records on read | catalogue |
| Federation, discipline, target mapping, target | `federation.ts`, `target-face.ts` | one folder each | catalogue |
| Caliber class | `caliber-class.ts` | `records/caliber-classes` | catalogue |
| Load tables | `load-tables.ts` | `load-tables.json` of a records root | catalogue |
| Firearm | `firearm.ts` | user record `firearm`, in the stored units (step 5) | user |
| Load | `load.ts` | user record `load`, the load file and the catalogue `records/loads` (step 6) | catalogue, user, shared |
| User bullet | `user-data.ts` (`bullet`) | user record: `basedOn` and `overrides` of a Bullet (step 4) | user |
| User cartridge | `user-data.ts` (`cartridge`) | user record: `basedOn` and `overrides` of a Cartridge (step 4) | user |
| Target sheet | `target-sheet.ts` | user record, photos in the store `files` | user |
| Solver bodies | `packages/api/src/compute/interior-schema.ts`, `exterior-schema.ts` | none | solver input |

## Overlaps

Ranked by how much code and visible behavior depends on them.

**Bullet and bullet design (high).** A bullet record is nested, in the stored units (mm, g, degrees), with the manufacturer by id and a provenance. A bullet design is a manufacturer name, a name, three choices as free text and a flat record of dotted keys in SI (m, kg) that no schema checks. The designer (`apps/web/src/lib/bullet-designer.ts`) maps the keys onto the record by path. The link to the catalogue record is a copy plus a title (`parent` in `user-data.ts`), so a catalogue correction never reaches a design. The designer also offered values the record could not hold: the ogive forms `round-nose` and `flat-nose` and a cannelure. Step 1 closes that gap. Step 4 replaces the flat record and the `parent` copy with `basedOn` and `overrides`.

**Cartridge and cartridge design (high).** A design is a table, a list of `specValue` entries in the stored units (while the other user kinds are SI) and a `parent`. It lacks the record's dates, verification, pressure method and provenance. The workbench cannot hold a design as its cartridge: `use-workbench-load.ts` keeps a catalogue cartridge and a design side by side, and a saved load keeps only the catalogue id, so a load made on a design cannot be reopened. Step 4 gives a load a reference to the design and resolves it on opening.

**Load and workbench state (high).** Both are a recipe: cartridge, firearm, bullet, powder, charge, seating, notes. `Load` is validated and bundled but nothing creates or reads one. The workbench state references catalogue ids and keeps a snapshot of every resolved solver value in `siValues`, a record that accepts any key (the API checks the keys, `packages/api/src/compute/load-file.ts`). Whether the catalogue or the snapshot wins on reopening depends on call order in `openLoad`.

**Firearm (medium).** Barrel length, twist and twist hand existed in `Load.firearm` (mm), in the user firearm record (m, twist hand required) and as free text in `firing.ts`. Step 5 leaves one shape; the free text of a firing series stays.

**Measured series and chronograph session (medium).** Both hold the same `chronoShot`. `apps/web/src/lib/measurements.ts` reshaped a session into a series and dropped device kind, firmware, conditions, propellant temperature and provenance. A string in a ladder varies charge, seating depth or temperature while `shotString.load` had no place for the variation. `groupShot.chrono.session` in `target-sheet.ts` named a session that no user record kind held. Step 7 leaves one session entity, with a `variation` on the string and a reference from the sheet.

**Case capacity (medium).** The record (g), `Load.case.waterCapacity` (g) and `workbenchState.measuredWaterCapacity` (m³) described one measurement. Step 8 leaves one entity in g, which a load references.

**Manufacturer (medium).** Catalogue records name a manufacturer by id; loads, sessions, firearms and designs carried free text, merged for display by `productLabel` in `apps/web/src/lib/manufacturers.ts`. Step 9 replaced the text of sessions, firearms and designs by references. `targetFace.federation` and the events' `federation` name a federation by id.

**Units (high).** Catalogue records and cartridge designs use the stored units of `packages/schema/src/units.ts`. Firearm, workbench state, bullet design, target sheet, measured series and every solver body use SI. The same quantity then differs by a factor in different entities: charge in g or kg, barrel length in mm or m, muzzle distance in mm or m. `units` held labels only, so conversion factors were written by hand in many files (one named table, `storedToSi` in `apps/web/src/lib/field-spec.ts`). Step 2 removes this.

**Ids (medium).** Six rules: the kebab-case `recordId`, `localId` (1 to 64 characters, any), the same bound written inline, a 1 to 200 character string for references to catalogue records, the API path pattern and the derived `sheetId`. Step 3 gives user ids a UUID generator and references a scope, see "Step 3: what changed".

**Types and enums (medium).** `apps/web/src/lib/api-types.ts` re-declared the record types of the schema, and the case type list existed in the API route and in the web app. Drift showed in `productNumber` (optional in the copy, required in the schema) and in `ogive.form` (a string). Step 1 removes this.

**Low:** inline bullet, firearm and ammunition descriptions in publication records (`firing.ts`, `range.ts`) repeat part of Bullet and Firearm; `targetMapping.gauge` is stored on the mapping and on the target event.

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
| Firearm | catalogue (later), user, shared | `manufacturer` is a `catalogue:` reference; optics and configurations stay embedded |
| CaseCapacity | catalogue, user | one unit, g |
| Case | catalogue, user | a user group of cases is a Case with `origin` `user`, an optional `basedOn` catalogue product, its measured values and the `capacity` reference |
| Load | catalogue, user, shared | references to cartridge, firearm, bullet, powder, primer and capacity; the case as a component description; seating; charge; a typed `analysis` with `overrides` and the ladder |
| Session | catalogue, user, shared | an event: strings of `{load, variation, shots}`, conditions, device, provenance with the imported file's SHA-256 |
| TargetFace, Federation, Discipline, TargetMapping | catalogue, user (targets) | `organization` is a federation reference |
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
- A field the user did not override follows the catalogue. The user record keeps the base's `revision` seen at save as `basedOnRevision` next to `basedOn`, so the page can say the base changed.
- A `basedOn` that no longer resolves opens the record read only with the error shown. It is never replaced by a copy.

### Units

Stored entities use the stored units of `units.ts` only. SI appears at solver calls. User files of the old SI format are rejected, since no migrations are written before 1.0.

### Components without a catalogue match

A `{manufacturer, model}` description (the maker a `catalogue:` reference) is allowed only in catalogue records of provenance kind `measured` (publications). In user loads the app creates a user Bullet or Powder stub, so every reference resolves.

### Saved recipes

A saved recipe keeps only the solver keys the user typed, under `analysis.overrides`, validated against `workbenchValueKeys`.

### Catalogue and API

- The catalogue holds one record per entity and an index row per record, read in process (`apps/docs/docs/data/catalogue-storage.md`).
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
8. Catalogue reference checks stop at ids that exist: loads name components in text. (`load-tables.json` has a schema and caliber class membership is a data check since step 12.)
9. Powder numbers mix `quantity` objects and plain numbers with a unit in the metadata.

## Steps

Each step lands alone with its model page updated in the same commit. Steps 4 to 6 edit the same files and run one after another.

| Step | Change | Needs |
|---|---|---|
| 1 | Single source of types and vocabularies (done, below) | |
| 2 | One unit table: `toSi` and `fromSi` per quantity kind (done, below) | |
| 3 | Id and reference primitives, `checkUserRefs` (done, below) | |
| 4 | Designs become overrides of Bullet and Cartridge (done, below) | 1, 3 |
| 5 | Firearm in one shape (done, below) | 2 |
| 6 | Load unification: the workbench state becomes Load (done, below) | 2 to 5 |
| 7 | Session unification (done, below) | 3, 6 |
| 8 | CaseCapacity references (done, below) | 6 |
| 9 | Manufacturer references (done, below) | 3 |
| 10 | Replaced by the catalogue storage steps D0 to D6 (`catalogue-storage.md`) | |
| 11 | Browser store hardening: versioned IndexedDB, keep and list invalid records | before 3 and 4 |
| 12 | Catalogue loose ends: schema for load tables (done, below), caliber classes as records (done, below), federation reference of targets (the renames map is part of the catalogue storage, `catalogue-storage.md`) | |

Steps 1, 2 and 11 go first, then 3, then 4 to 6, then 7 to 9. Steps 10 and 12 fit any time; 10 does not run together with other changes to the cartridge routes.

### Step 1: what changed

- The web app imports `Source`, `Provenance`, `SpecValue`, `CaseCapacity`, `Bullet` and `Powder` from `@open-reloading/schema`. `apps/web/src/lib/api-types.ts` keeps the shapes the API adds (list summaries, `CartridgeDetail` as the cartridge plus `caseType` and `capacities`, compute answers).
- `caseTypes` is one enum in `packages/schema/src/cartridge.ts`, used by the cartridges route and the web filter.
- The designer's choice lists are the options of the enums `baseTypes`, `ogiveForms` and `tipTypes` of `packages/schema/src/bullet.ts`. A test checks that each list is a subset of the enum at its path in the bullet schema.
- The bullet schema gains the ogive forms `round-nose` and `flat-nose` and an optional `cannelure` (`start`, `width`, `depth?`, lengths in mm). Existing records stay valid. The drawing reads a record's cannelure.
- A cannelure's `start` is the distance from the base of the bullet to the groove's rear edge, the edge nearer the base. Forensic work gives a cannelure's position as its height above the base of the bullet, measured from the base to the base of the groove (Hudson, Proceedings of the American Academy of Forensic Sciences, 2018, abstract B129); the source does not draw the edge, so the rear edge is the reading taken here. The designer's cannelure start has the same datum and unit, so a record seeds it without conversion. The schema refuses a groove that ends beyond the shank (the length less the nose length, or the length without a nose length), that starts on a boat tail whose length the record gives, or whose depth reaches the radius.

### Step 2: what changed

- `toSi(kind, stored)` and `fromSi(kind, si)` in `packages/schema/src/units.ts` convert between the stored unit of a quantity and SI. `siMaps` holds one entry per `QuantityKind`: `si = stored * factor + offset`. Temperature carries the offset of 273.15 (degC to K), percent is a fraction in SI, the ballistic coefficient is kg/m2.
- The API's record resolution, limit check and bore area, and the web app's field specs, record rows, designers, seating preview and workbench load hook call these functions. No file outside the schema package writes a factor between a stored unit and SI. A test (`apps/web/test/unit-literals.test.ts`) scans the sources of the API and the web app for the literals.
- Display units (inch, grain, psi, ft/s) stay in `apps/web/src/lib/units.ts`, which builds its metric units from the table. The solver package and the drawing package keep their own factors: they have no dependency on the schema.

### Step 3: what changed

- `userId` (`packages/schema/src/ids.ts`) is a lowercase UUID, `ref(kind)` a reference `"catalogue:<record id>"` or `"user:<UUID>"`, `parseRef` splits one into scope and id. The kind only names the entity in the description: the text carries no kind.
- The browser creates the id of every new user record and photo with `crypto.randomUUID()` (`newId` in `apps/web/src/lib/new-id.ts`, with a `crypto.getRandomValues` fallback for origins that are not secure). The record `id` of a user data file keeps its bound (1 to 64 characters), so records saved with an older id open as before, except a bullet, a cartridge, a powder or a case group: its id must be a UUID (`designIdProblem` in `packages/schema/src/user-data.ts`), so that a load can refer to it by `user:<UUID>`.
- `checkUserRefs(records)` (`packages/schema/src/user-data.ts`) returns the references between user records that no record answers: a workbench state's `firearm` (an old id or `user:<id>`) and a target sheet's `load`. Open and Import report them in the status line or the import report, `refNote` in `apps/web/src/lib/user-data.ts`, and drop nothing. A `catalogue:` reference, a catalogue id (`cartridge`, `bullet`, `powder`) are not checked; a group's chronograph session is checked since step 7.
- A target sheet's `face.id` names a catalogue record and uses `recordId`; a design's `parent` was replaced by `basedOn` in step 4. The API path pattern already is `recordIdRegex`.
- Existing fields keep their type: the references of the workbench state and the sheet stay plain ids until the steps that reshape those entities.

### Step 4: what changed

- A user record of kind `bullet` or `cartridge` (`packages/schema/src/user-data.ts`, `userBullet`, `userCartridge`) replaces `bulletDesign` and `cartridgeDesign`. The `{id, kind, name, saved, data}` wrapper of user records stays; the envelope's `origin`, `basedOn` and `overrides` are fields of `data`. `origin` is `user`, `basedOn` is an optional `catalogue:<id>` reference, `overrides` an optional partial of the entity in stored units. The bullet's `manufacturer` is a reference (step 9). Records of the old kinds fail the schema and stay in the store as invalid records, like any other record the format rejects.
- `applyOverrides(base, overrides)` (`packages/schema/src/overrides.ts`) is the one resolution function: objects merge by key, arrays replace, an explicit `null` removes a field or an object, and a cartridge's `values` merge by `(side, symbol, variant)`. Two refinements keep a base's printed text from outliving a changed number: a quantity (an object with its own `value`) is replaced whole, and so is a cartridge value entry, which also drops its tolerance. A `value: null` entry removes that cartridge value. `bulletOverrides` and `cartridgeOverrides` validate the leaves against the entity schemas and allow any field to be omitted or `null`; whether an override result as a whole is a valid record is not checked before step 9.
- The designers resolve `basedOn` through the API (`apps/web/src/lib/variants.ts`), show the base's values, and save only what differs from them: a field cleared against a base value is saved as `null`. A design without a base saves every given field. A save rewrites only the designer's fields: the overrides the design was opened with stay for every field the designer has no input for (a bullet's other record fields, a cartridge's other keys, and the values of a variant or without a side such as a pressure), and a reset or a new design starts without them.
- A `basedOn` the catalogue no longer has opens the design read only with the reason shown, and its stored data is saved as it is. A base the API could not be asked is told apart from a missing one: the browser keeps the last base it read from the API (`localStorage`, `readBase` in `apps/web/src/lib/variants.ts`) and uses it while the API does not answer, so a design still resolves, lists and opens editable offline; a base the catalogue answered 404 for drops that copy. Lists and pickers leave out designs whose base is missing, and keep those whose base could not be asked (a design with no kept base shows only what its overrides give, and a bullet without a diameter override has no row until the API answers once). Delete in the lists and the File menu reads and writes the browser store only.
- A workbench state's `cartridge` and `bullet` take a plain catalogue id (as before) or a reference. A load saved on a design keeps `user:<UUID>` and reopens with the design resolved against its base. `checkUserRefs` also reports such a reference when no user record answers it. A bullet or cartridge whose id is no UUID fails the schema with that reason: a file or link that holds one is rejected as a whole, and a record of the browser stays in the store as an invalid record, listed with Download raw and Delete. No design is left that a load cannot refer to.
- A load file sent to `POST /v1/interior/load-file` and the compute routes take the catalogue reference of a cartridge or bullet and refuse a `user:` reference (400 at `records[i].data.cartridge` or `.bullet`): a user record is resolved in the browser, never on the server. The OpenAPI baseline is rewritten for this.
- `GET /v1/bullets/{id}` and `GET /v1/cartridges/{id}` (and the static site's data files of the same records) answer with `revision`, a hash of the stored record that changes with any field. A user bullet or cartridge keeps the revision of its base at save in the optional `basedOnRevision` (`userBullet`, `userCartridge`), a sibling of `basedOn` so that a saved design stays valid. The OpenAPI baseline is rewritten for the new field.
- The designers compare the base's `revision` with `basedOnRevision` on opening (`baseChanged` in `apps/web/src/lib/variants.ts`) and say in the parameters panel that the base changed since the design was saved. A design saved without a revision, or a base the API answers without one, says nothing. Save writes the revision the design was measured against, so the note goes away with the next save; a read only design keeps its stored data and revision.
- A share link of a load that refers to records of the browser (`user:` in `firearm`, `cartridge`, `bullet` or `capacity`) is refused with the fields named, since the browser that opens it has none of them (`userRefFields` in `packages/schema/src/user-data.ts`, `shareProblem` in `apps/web/src/lib/share-link.ts`). A design's link keeps its `catalogue:` base and carries the user manufacturer record of a bullet next to it. The workbench's Copy link carries the values of a design, not its reference.

### Step 5: what changed

- `firearm` (`packages/schema/src/firearm.ts`) is the one firearm shape. Lengths are `quantity('length')` objects in mm, the mass `quantity('mass')` in g, click value, travel and cant `quantity('angle')` in degrees, a mount's zero air `quantity('temperature')` in degC, `quantity('pressure')` in bar and `quantity('relativeHumidity')` in %. The drag factor, magnifications and round count are plain numbers. The envelope field `origin` (`catalogue`, `user`, `shared`) is required, so a firearm of the old SI format fails the schema instead of reading as a firearm 1000 times too short. The user record of kind `firearm` carries it as `data`; no migration, an old record stays in the store as an invalid one.
- `manufacturer` is a `catalogue:<id>` reference to a manufacturer record, `cartridge` a reference (`catalogue:<id>` or `user:<UUID>`). Since step 9 the maker is a reference of either scope and there is no `manufacturerName`.
- `Load` drops its inline `firearm` (name, barrel length, twist, hand) for an optional `firearm` reference. No catalogue firearm kind exists yet, so no reference check reads it.
- The web app converts at its edges: `siOf`, `storedOf`, `fieldSi` and `fieldStored` (`apps/web/src/lib/firearm.ts`) go through `toSi` and `fromSi`, the sight, click and Gun card values stay SI where the solver forms read them, and the editor stores a field only when it is edited, so values the user did not touch keep the exact stored number. Not part of this step: the workbench's saved `firearm` and `firearmMass` (step 6).

### Step 6: what changed

- `load` (`packages/schema/src/load.ts`) is the one Load: the catalogue record (`records/loads`, read through `catalogueLoad`), the user record of kind `load` and the load file of `POST /v1/interior/load-file`. It replaces the user record `workbenchState` and the catalogue `Load`. Every quantity is a stored-unit object (charge and the measured case capacity in g, seating and measured muzzle distance in mm), the SI values appear at the solver call only.
- References: `cartridge`, `firearm` and `bullet` are `catalogue:<id>` or `user:<UUID>` references, `powder` a `catalogue:` reference (no user powder kind exists, so no stub is created). A catalogue load names catalogue records only and carries `id`, `name`, `provenance`, cartridge, bullet, powder and charge; a user load is named by its record. Only a catalogue load of provenance kind `measured` may describe its bullet or powder by maker and name where no record exists; `primer` is a `catalogue:` reference (`primer.record`, no user primer kind exists) and `case` stays a description.
- `analysis` holds the typed solver values, `overrides`, and the `ladder`. `overrides` is a strict object with one optional number per key of `workbenchValueKeys` but `charge` (the load's own `charge`), each in the stored unit of `analysisKinds` (`volume` in cm3, `propellantTemperature` in degC, pressures in bar). A key outside that list fails the schema. The ladder step is in the stored unit of its kind: g, mm or K. The chronograph sessions of the Measurements tab are `sessions` references since step 7.
- Old format: a record of kind `workbenchState` or a file with `siValues` is not read. The schema's own message for the old kind says so, in Open, Import, the stored-record list and the load file route.
- The workbench saves a key under `overrides` only when the user typed it (`givenKeys` in `apps/web/src/lib/load-record.ts`). A value is left out when a reference gives it again on opening: the powder record's model parameters, the bullet record's or design's mass, a followed default of volume, bore diameter, bore area and twist, the seating's volume and travel (while the barrel length is the default one), the Settings defaults and the mass and twist of a referenced firearm. Opening fills the form like a link (the Settings defaults and the followed defaults for the keys the load leaves out), then the records fill the rest, and the typed values stay.
- A load follows a changed record or changed Settings for every value the user did not type. A value whose source a reference cannot name is saved as typed: a firearm whose id is no UUID. The built-in example rifle has a fixed UUID so that the example load keeps it.
- `POST /v1/interior/load-file` fills the values a load leaves out from the catalogue records it references: the powder's model parameters, the bullet's mass and the cartridge's bore area. The charge is the load's own. A value no record gives (volume, travel, twist, bore diameter without a cartridge record, the charge) is not invented: the route answers one 422 that lists every missing value with its path (`records[i].data.analysis.overrides.<key>`, the charge at `records[i].data.charge`) and its quantity. The workbench's download for the API writes the resolved values, so that file runs as it is.

### Step 7: what changed

- `chronoSession` (`packages/schema/src/chrono-session.ts`) is the one session shape: the catalogue record (`records/chrono`, read through `catalogueSession`), the user record of kind `session` and what an import gives. It carries `origin`. A catalogue session needs its `id`, the `date`, the device's `manufacturer` (a `catalogue:` reference) and `model`, `conditions.airTemperature` and the `load` of every string (a `catalogue:` reference); a user session needs none of them, so a file as the importers read it is a valid session and the Measurements tab holds exactly that. `packages/schema/test/session.test.ts` parses an imported file, the stored user record, a catalogue session, and the references of a load and a target sheet through the same schema. The importers' `missingPaths` still names what a catalogue session requires.
- A shot string has `load` (a reference, absent until the session is attached to a load), `label`, `variation`, `propellantTemperature`, `conditions` (`airTemperature` in degC, `stationPressure` in bar, `windSpeed` in m/s, each optional: the weather at that string, typed by hand at the range), `note` (plain text up to 2000 characters) and `shots` (1 to 5000, a session holds up to 500 strings). `variation` is the charge (g) or the seating length (mm) the string varies against its load; a temperature ladder stays the string's `propellantTemperature`.
- `Load.sessions` (references, up to 50) replaces `Load.measurements`. `measurementSeries`, `MeasurementSeries`, `MeasuredSeries`, `seriesOf` and the series conversions are gone. A group shot's `chrono.session` is a session reference. `checkUserRefs` reports a `user:` session no record answers when a load or a group shot names it, and a session's `user:` device manufacturer or string load.
- The Measurements tab keeps session records. A file read there becomes a user record of kind `session` (`sessionOf` in `apps/web/src/lib/measurements.ts`): the file name is the record name, the device's maker a manufacturer reference of step 9 (`referTo`), a string mapped to a charge carries `variation`, the muzzle distance stays in mm and is converted for display. The workbench stores the records as they change and the load keeps their references in order. Removing a session in the tab drops the reference and leaves the record in the browser, as no screen deletes a user manufacturer. Save writes the load and names it on the mapped strings that name none (`attachLoad`), so Save as shares the sessions of the copy. Opening reads each `user:` reference from the store; one the browser does not answer (a catalogue session, or a session of another browser) stays in the load.
- The strings of the tab are unchanged: the series name (file name, date, device), the strings and the mapping selects, the table, the chart and the flat spots. Only the note under the tab now says the sessions stay in this browser.
- Limits: a load file or a copied JSON carries the references, not the shots, so in another browser the sessions are reported as missing (the same limit as the measured capacity). The workbench does not compute the file's SHA-256 for the provenance source. A target sheet still has no screen that picks a session for a shot.

### Step 8: what changed

- `caseCapacity` (`packages/schema/src/case-capacity.ts`) is the one capacity entity: the catalogue record (`records/capacities`, read through `catalogueCaseCapacity`, which needs `id`, `provenance` and catalogue references only) and the user record of kind `caseCapacity`, the water always in g (`waterCapacity`). It carries `origin`; `cartridge` and `caseManufacturer` are references (`catalogue:` or `user:`). The catalogue's record file leaves `origin` out like every kind, `GET /cartridges/:id` answers it with the capacity. A catalogue capacity of the earlier format (plain `cartridge` id, no `origin`) is rejected: no migration. A test (`packages/schema/test/case-capacity-unit.test.ts`) fails when another entity holds a water mass or when the unit is not g.
- `Load.capacity` is a reference to a capacity, `catalogue:<id>` or `user:<UUID>`, and replaces `Load.case.waterCapacity`. A catalogue load names a catalogue capacity, `data:validate` checks that it exists (`checkLoadCapacityReferences`). `Load.case` is a strict object (maker, lot, `firingCount`), so a load or file with `case.waterCapacity` fails the schema in Open, Import, the stored-record list and the load file route (400 at the key's path). `checkUserRefs` reports a load's `user:` capacity and a capacity's `user:` cartridge or manufacturer that no record answers.
- The workbench keeps its two inputs: the capacity record chosen in the pinned row above the input cards and the measured capacity (water to the mouth, replaces the record's value, the flags and notes of the run are unchanged). A load saved with a typed measured capacity names a user capacity record: its id is a version 8 UUID derived from the cartridge reference and the value in g (`measuredCapacityId` in `apps/web/src/lib/load-record.ts`), so one measurement is one record and a changed value another one, which a load saved earlier keeps. Save writes that record to the browser together with the load (`storeLoad`, the File menu's `store`); opening the load reads it back into the field. A record the browser does not answer stays in the load as asked and is listed as not loaded. A capacity record the user chose from the cartridge's catalogue capacities is saved as `catalogue:<id>` (only when chosen, the first one shown by default is followed). The link parameter `measuredWaterCapacity` is unchanged (m³).
- Limits: a load file or a copied JSON carries the load, not the capacity record, so in another browser the measured value is reported as missing (the same limit as a user cartridge or bullet design); share links never carried it. The load file route names no solver value from a capacity (the volume is a typed override).

- Own cases: the user record of kind `case` (`packages/schema/src/user-data.ts`) holds a `Case` with `origin` `user`. `manufacturer` is required of a catalogue case only. `basedOn` names the catalogue product the group started from; its fields are the group's own values, not overrides of the product. The measured fields are optional: `numberOfFirings`, `trimLength` and `neckWall` (mm), `casesMeasured` and `spread` (g, standard deviation of the capacity over those cases). The measured water capacity stays a `caseCapacity` record that the group names with `capacity`, so a capacity is stored once: the case group editor (`/cases/editor`, `apps/web/src/components/case-group-editor.tsx`) writes it with the id `measuredCapacityId` gives for the cartridge and value, the same record the workbench writes for a typed measured capacity. The record id must be a UUID, so a load can name the group with `case.record` (`user:<UUID>`). `checkUserRefs` reports a group's `user:` cartridge, manufacturer and capacity and a load's `case.record` that no record answers. Export all and Import carry the groups with every other record; a single group's file does not carry its capacity record (the limit of a load file above).
- The workbench lists the groups of the chosen cartridge in the Brass record choice of the pinned row above the input cards. Choosing one fills the measured capacity field from the group's capacity record, which the run already marks as measured, and a saved load keeps `case.record` as the group's reference.

### Step 12: what changed

- `loadTables` (`packages/schema/src/load-tables.ts`) is the schema of `load-tables.json`: row file name to `{ manufacturer, title, url?, retrieved }`, strict, `manufacturer` a record id and `retrieved` an ISO date. `readLoadTables` parses each entry: one that breaks the schema is left out and `data:validate` reports each issue with the row file and field. The manufacturer must still be a record (`checkManufacturerReferences`).

- Caliber classes are records (`records/caliber-classes`, `caliberClass` in `packages/schema/src/caliber-class.ts`), served by `GET /caliber-classes` and `/:id`. `Discipline.caliberClasses.ids` and the `caliberClasses` of a target list item are record ids, checked by `data:validate` (`packages/data/src/caliber-classes.ts`), which also holds the membership rules the former test checked. The `caliberClasses` constant of the schema package is gone: the web app reads class names from the API.

- `TargetFace.federation` and the target events' `federation` are federation record ids (`organization` is gone from the records), a target without `federation` is a user's own design. Every target event has an `id` (a record id, unique within the target) and `TargetMapping.event` holds it. `data:validate` checks the federation references, the mapping against the event's federation and the uniqueness (`checkFaceFederations`, `checkMappings`). The targets API list derives `organization` from the federation. The web app keys the event choice by id, and a target sheet's `face.event` is a record id: a saved sheet that holds an event name is rejected like any record of an older format.

### Step 9: what changed

- A manufacturer typed by the user is a record of kind `manufacturer` (`userManufacturer` in `packages/schema/src/user-data.ts`): `data` holds `origin: 'user'`, the name is the record's `name`. It is referenced as `user:<UUID>`.
- A user bullet's `manufacturer` and a firearm's `manufacturer` are references of either scope (`ref('manufacturer')`) and the free text is gone. Both schemas are strict, so a stored record of the older format with `manufacturerName` is rejected and stays in the store as an invalid record (no migration). The bullet's `manufacturer` is not an override: `bulletOverrides` leaves it out, the user bullet's own field is the one place.
- The designer's and the firearm editor's manufacturer field (`apps/web/src/components/manufacturer-input.tsx`) turns the typed text into a reference when the field is left or an option is chosen: a catalogue or user manufacturer whose name or alias is the same text (`findManufacturer` in `apps/web/src/lib/manufacturers.ts`, catalogue first), else a new user manufacturer (`referTo`), stored in the browser at once and found by the next typed name.
- A chronograph session's `device.manufacturer` is a `catalogue:` reference (sessions are catalogue records), checked by `data:validate`. The importers cannot read the catalogue: `missingPaths` always lists `device.manufacturer`, and a name the file gives stays on the candidate (`device.manufacturerName` of `SessionCandidate`, also the member of the OpenReloading session JSON) for the caller to resolve.
- `packages/schema/test/manufacturer-text.test.ts` fails on a `manufacturerName` property in an entity schema and on a manufacturer property that is not an id or a reference. The components of a load (`bullet` and `powder` descriptions, `case`) hold a `manufacturer` reference too: a user load's is `catalogue:` or `user:`, a catalogue load's `catalogue:`, checked by `data:validate` (`checkManufacturerReferences`). `checkUserRefs` reports a `user:` case manufacturer that no record answers, and a share link of such a load is refused (`userRefFields`). The primer and the case are strict objects, so a load of the older format with `manufacturerName`, or with a primer `manufacturer` and `model`, is rejected. The device maker of a session read in the workbench is a manufacturer reference since step 7.
- `checkUserRefs` also reports a bullet's or a firearm's `user:` manufacturer that no record answers. A bullet's or a firearm's Save and Copy JSON, and a bullet's share link (a firearm has none), carry the user manufacturer record it names next to the record (`makerRecordsOf` in `apps/web/src/lib/user-data.ts`); Open, a shared link and Paste keep that record in the browser unless one of its id is stored, so the maker resolves and shows in another browser. A Save writes back over a file that holds the record and its manufacturer (`ownsFile`). A Save, Copy JSON or share link writes the stored manufacturer, else the one that came with the opened file or link (`makersToCarry`), and stops when the store cannot be read and the opened file has none. A name typed and then changed after leaving the field leaves its first record in the store, listed among the suggestions until it is deleted in Settings, Manufacturers (`manufacturerUses` in `apps/web/src/lib/manufacturers.ts`, `manufacturers-settings.tsx`). That tab lists the user manufacturers with the number of places that name them (a bullet's or firearm's `manufacturer`, a capacity's `caseManufacturer`, a stored record the format rejects, the record open on the page) and deletes one that nothing names at once, with Undo. While the catalogue's list cannot be read, a typed name that matches no user manufacturer gets no reference and no record (`referTo` with `catalogueKnown` false), so it cannot duplicate a catalogue manufacturer.

### Session snapshots on a load

- `Load.snapshots` (`sessionSnapshot` in `packages/schema/src/load.ts`, up to 50, at most one per entry of `Load.sessions`) keeps what the load was at each session: `powderLot`, `primerLot`, `caseLot`, `seating` and the firearm's `roundCount`, and the ids of the notes the user dismissed for that session. `Load.powderLot` is new beside `primer.lot` and `case.lot` (a powder is a bare reference and had no place for a lot); a primer is a `lot` and an optional catalogue `record`, so a lot alone can be stored. `Firearm.noteAtRoundCount` is the count the user sets for the round count note. All are optional additions: no existing record changes.
- The snapshot is shown live until the load is saved with the session, then fixed. The rules and their thresholds are on `apps/docs/docs/models/load-notes.md`.

### Fit of a user powder

A fitted user powder keeps a copy of what it was fitted to in the optional `fit` of its data (`userPowderFit` in `packages/schema/src/user-data.ts`), so deleting or editing a session never changes what the powder rests on. Its `provenanceKind` stays `fitted`. Every quantity is `{ value }` in its stored unit, and every field is required unless marked optional.

| Field | Content | Unit |
| --- | --- | --- |
| `input` | 1 to 40 points, each with every field below | |
| `input[].charge` | powder charge, above 0 | g |
| `input[].muzzleVelocity` | mean muzzle velocity of the string, above 0 | m/s |
| `input[].shots` | shots of the string, a whole number above 0 | 1 |
| `input[].barrelLength` | barrel length, above 0 | mm |
| `input[].temperature` | powder temperature | degC |
| `input[].caseCapacity` | water capacity of the case, above 0 | cm3 |
| `input[].bulletMass` | bullet mass, above 0 | g |
| `parameters` | the parameters the fit freed, each once: `burnRate`, `startPressure`, `volumeFactor`, `energy`, `temperatureFactor` | |
| `options.prior` | optional: per freed parameter a Gaussian prior, `value` (the centre) and `sigma` (of the log parameter) | `value`: burn coefficient 1/s, start pressure bar, energy J/kg, factors 1; `sigma`: 1 |
| `options.loss` | `{ kind: 'quadratic' }` or `{ kind: 'huber', threshold }` | threshold in sigmas of the rows |
| `date` | time of the fit, ISO 8601 in UTC | |
| `model`, `modelVersion` | interior model (such as `m3`) and the version of the code that fitted | |
| `confidence` | width class of the peak-pressure range: `tight`, `moderate` or `loose` | |
| `reasons` | up to 20 reason names of the fit's confidence | |
| `sessions` | up to 50 `user:<UUID>` references to the sessions the points came from, for information only | |
| `previous` | optional: `user:<UUID>` of the powder record this one refits | |

`sessions` and `previous` are never resolved: `checkUserRefs` does not report them and a share link does not count them as user references. The block is part of the user data file baseline (`apps/web/test/golden/user-data.json`, [release](../release.md#contract-baselines)).

## Decisions

- The record attribute is `origin` with the values `catalogue`, `user` and `shared`. The citation's `origin` becomes `standing`.
- User data stays client side. Compute routes accept a reference or an entity.
- Overrides follow the merge rules above, and a catalogue change to a field that is not overridden is followed and shown as "base changed".
- One unit system in stored data. Old SI files are rejected.
- No migration at 1.0.0: the user data file and share links stay version 1, so an alpha file still opens. Export all data before updating. A browser record of an older shape then shows under Open as one of the invalid records, with its error, Download raw and Delete: fix the downloaded record and import it, or delete it.
- Session stays separate from Load. FiringSeries can become a Session after step 7, with a per-string summary for publications that print only a mean.
