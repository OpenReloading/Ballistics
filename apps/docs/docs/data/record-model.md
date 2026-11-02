---
title: Record model
description: One entity per concept for catalogue records and browser user data, with references, overrides, stored units and where each entity's schema and code live.
---

# Record model

Catalogue records and the records a user keeps in the browser describe the same things: a bullet, a cartridge, a firearm, a load. The model is one entity per concept, with the place a record comes from stored as an attribute (`origin`) instead of a second type. Paths are relative to the repository root.

## Entities

Writers: catalogue (git records, checked by `readRecords`), user (browser, `packages/schema/src/user-data.ts`), importer (a parsed file turned into a record shape), solver input (never stored). Schemas are in `packages/schema/src/`, catalogue folders in `packages/data/records/`.

| Entity | Schema | Catalogue | User record kind |
|---|---|---|---|
| Manufacturer | `manufacturer.ts`, `userManufacturer` | `records/manufacturers` | `manufacturer` |
| Cartridge | `cartridge.ts`, `userCartridge` | `records/cartridges`, generated from the C.I.P. sheets | `cartridge`: `basedOn` and `overrides` of a Cartridge |
| Bullet | `bullet.ts`, `userBullet` | `records/bullets` | `bullet`: `basedOn` and `overrides` of a Bullet |
| Powder | `powder.ts`, `userPowder` | `records/powders` | `powder`: a draft and the fit |
| Primer | `primer.ts` | `records/primers`, named by `Load.primer.record` | none |
| Case | `case.ts` | `records/cases`, named by `Load.case.record` | `case` (a group of the user's cases) |
| Case capacity | `case-capacity.ts` | `records/capacities`, embedded in `GET /cartridges/:id` | `caseCapacity` |
| Load | `load.ts` | `records/loads` (empty), bundle only: no route or web reader | `load`, and the load file |
| Chronograph session | `chrono-session.ts` | `records/chrono` (empty), bundle only | `session`, and what an importer gives |
| Firearm | `firearm.ts` | none | `firearm`, in the stored units |
| Target sheet | `target-sheet.ts` | none | `targetSheet`, photos in the store `files` |
| Target face design | `user-data.ts` (`targetFaceDesign`) | none | `targetFaceDesign` |
| Competition event, shooting log entry | `user-data.ts` (`competitionEvent`, `shootingLogEntry`) | none | `event`, `shootingLogEntry` |
| Firing series, range firings | `firing.ts`, `range.ts` | no folder, bundle only | none |
| Source record | `provenance.ts` | `records/sources`, inlined into records on read | none |
| Federation, discipline, target mapping, target | `federation.ts`, `target-face.ts` | one folder each | none |
| Event type | `event-type.ts` | `records/event-types` | none |
| Caliber class | `caliber-class.ts` | `records/caliber-classes` | none |
| Load tables | `load-tables.ts` | `load-tables.json` of a records root | none |
| Solver bodies | `packages/api/src/compute/interior-schema.ts`, `exterior-schema.ts` | never stored | none |

Session stays separate from Load: a session is an event fixed in time, a load is a recipe reused over many sessions, and merging them would copy recipe data into every event. A target sheet is an event of its own that references both. Solver bodies are derived SI inputs built from resolved entities and are never stored. The designers are separate screens but edit the same entities.

## Envelope and origin

A user record is `{id, kind, name, saved, data}`; the entity, with its `origin`, `basedOn` and `overrides`, is `data`. The entity fields are the same for every origin. A catalogue record file leaves `origin` out, like every kind.

`origin` says where a record lives and who owns it:

| Value | Meaning |
|---|---|
| `catalogue` | the git records, read only for users |
| `user` | the records of this browser's owner |
| `shared` | received through a file or a share link, kept as a copy owned by the receiver, with the sender's file cited in its provenance |

`load`, `caseCapacity`, `chronoSession`, `case` and `firearm` take any of the three; the user records `bullet`, `cartridge`, `powder` and `manufacturer` carry `origin: 'user'`.

The finer standing of a citation (manufacturer, public, community) is `provenance.sources[].origin`. `manufacturer` is data the maker supplied or published: terms it states go in `terms`, and such a source carries no project licence ([Published loads](published-loads.md#sources)).

## References and ids

- A reference is a string `"<scope>:<id>"` with scope `catalogue` or `user`: `ref(kind)` in `packages/schema/src/ids.ts` is `"catalogue:<record id>"` or `"user:<UUID>"`, and `parseRef` splits one into scope and id. The kind only names the entity in the description: the text carries no kind. One string fits URL parameters, form fields and database keys.
- A catalogue id is the kebab-case slug equal to the file name (`recordIdRegex`), unique per kind. A renamed or removed id resolves through `records/renames.json` ([Catalogue storage](catalogue-storage.md)).
- A user id (`userId`) is a lowercase UUID, unique across kinds. The browser creates the id of every new user record and photo with `crypto.randomUUID()` (`newId` in `apps/web/src/lib/new-id.ts`, with a `crypto.getRandomValues` fallback for origins that are not secure).
- The record `id` of a user data file is 1 to 64 characters, so records saved with an older id still open, except a bullet, cartridge, powder, case group, competition event or shooting log entry: its id must be a UUID (`designIdProblem` in `packages/schema/src/user-data.ts`), so that a load can refer to it by `user:<UUID>`. A file or link that holds one with another id is rejected as a whole; a record of the browser stays in the store as an invalid record, listed with Download raw and Delete.
- Local ids (optics, groups, notes) stay local and are never referenced from outside their record.
- A target sheet's `face.id` names a catalogue record and uses `recordId`; its `face.event` is a record id. The API path pattern is `recordIdRegex`.
- `checkUserRefs(records)` (`packages/schema/src/user-data.ts`) returns the `user:` references that no record answers: a load's `firearm`, `cartridge`, `bullet`, `powder`, `capacity`, `case.record`, `case.manufacturer` and `sessions`; a bullet's and a firearm's `manufacturer` and a firearm's `landsBullet`; a capacity's `cartridge` and `caseManufacturer`; a case's `cartridge`, `manufacturer` and `capacity`; a session's `device.manufacturer` and the `load` of its strings; a target sheet's `load` and the `chrono.session` of its group shots; an event's `firearm`, `load` and the `targetSheet` of its ring series; a shooting log entry's `firearm`, `load` and `event`. A `catalogue:` reference and a plain catalogue id are not checked. Open and Import report the result in the status line or the import report (`refNote` in `apps/web/src/lib/user-data.ts`) and drop nothing.

## Variants of a catalogue record

A user bullet or cartridge (`userBullet`, `userCartridge` in `packages/schema/src/user-data.ts`) is `basedOn`, an optional `catalogue:<id>` reference, plus `overrides`, an optional partial of the same entity schema in stored units, never a copy. Without `basedOn` it is standalone and holds every given field. Records of the former kinds `bulletDesign` and `cartridgeDesign` fail the schema and stay in the store as invalid records.

- `applyOverrides(base, overrides)` (`packages/schema/src/overrides.ts`) is the one resolution function, used by the web app, the importers and the compute routes. Objects merge by key, arrays replace as a whole, and an explicit `null` removes a field or an object. A cartridge's `values` merge by `(side, symbol, variant)`, the key that identifies a value. A quantity (an object with its own `value`) is replaced whole, and so is a cartridge value entry, which also drops its tolerance, so a base's printed text never outlives a changed number. A `value: null` entry removes that cartridge value.
- `bulletOverrides` and `cartridgeOverrides` validate the leaves against the entity schemas and allow any field to be omitted or `null`. The bullet's `manufacturer` is not an override: `bulletOverrides` leaves it out, and the user bullet's own `manufacturer` is the one place.
- A field the user did not override follows the catalogue. `GET /v1/bullets/{id}` and `GET /v1/cartridges/{id}` (and the static site's data files of the same records) answer with `revision`, a hash of the stored record that changes with any field. The user record keeps the base's revision at save in the optional `basedOnRevision`, a sibling of `basedOn`. The designers compare the two on opening (`baseChanged` in `apps/web/src/lib/variants.ts`) and say in the parameters panel that the base changed since the design was saved. A design saved without a revision, or a base the API answers without one, says nothing. Save writes the revision the design was measured against, so the note goes away with the next save.
- The designers resolve `basedOn` through the API (`apps/web/src/lib/variants.ts`), show the base's values, and save only what differs from them: a field cleared against a base value is saved as `null`. A save rewrites only the designer's fields: the overrides the design was opened with stay for every field the designer has no input for (a bullet's other record fields, a cartridge's other keys, and the values of a variant or without a side such as a pressure). A reset or a new design starts without them.
- A `basedOn` the catalogue no longer has (the API answers 404) opens the design read only with the reason shown, and its stored data and revision are saved as they are. It is never replaced by a copy. A base the API could not be asked is told apart from a missing one: the browser keeps the last base it read (`localStorage`, `readBase` in `apps/web/src/lib/variants.ts`) and uses it while the API does not answer, so a design still resolves, lists and opens editable offline; a 404 drops that copy.
- Lists and pickers leave out designs whose base is missing and keep those whose base could not be asked. A design with no kept base shows only what its overrides give, and a bullet without a diameter override has no row until the API answers once. Delete in the lists and the File menu reads and writes the browser store only.
- A load's `cartridge` and `bullet` take a reference to a design (`user:<UUID>`) and reopen with the design resolved against its base.

## Units

Stored entities use the stored units of `packages/schema/src/units.ts` only; SI appears at solver calls. `toSi(kind, stored)` and `fromSi(kind, si)` convert between them. `siMaps` holds one entry per `QuantityKind`: `si = stored * factor + offset`. Temperature carries the offset of 273.15 (degC to K), percent is a fraction in SI, the ballistic coefficient is kg/m2.

- The API's record resolution, limit check and bore area, and the web app's field specs, record rows, designers, seating preview and workbench load hook call these functions. No file outside the schema package writes a factor between a stored unit and SI: `apps/web/test/unit-literals.test.ts` scans the sources of the API and the web app for the literals.
- Display units (inch, grain, psi, ft/s) are in `apps/web/src/lib/units.ts`, which builds its metric units from the table. The solver package and the drawing package keep their own factors: they have no dependency on the schema.
- User files of the old SI format are rejected, since no migrations are written before 1.0.

## Manufacturer

A manufacturer typed by the user is a record of kind `manufacturer` (`userManufacturer` in `packages/schema/src/user-data.ts`): `data` holds `origin: 'user'`, the name is the record's `name`. It is referenced as `user:<UUID>`.

- A user bullet's and a firearm's `manufacturer` is a reference of either scope (`ref('manufacturer')`), never free text. Both schemas are strict, so a stored record with `manufacturerName` is rejected and stays in the store as an invalid record (no migration).
- The designer's and the firearm editor's manufacturer field (`apps/web/src/components/manufacturer-input.tsx`) turns the typed text into a reference when the field is left or an option is chosen: a catalogue or user manufacturer whose name or alias is the same text (`findManufacturer` in `apps/web/src/lib/manufacturers.ts`, catalogue first), else a new user manufacturer (`referTo`), stored in the browser at once and found by the next typed name. While the catalogue's list cannot be read, a typed name that matches no user manufacturer gets no reference and no record (`referTo` with `catalogueKnown` false), so it cannot duplicate a catalogue manufacturer.
- A name typed and then changed after leaving the field leaves its first record in the store, listed among the suggestions until it is deleted in Settings, Manufacturers (`manufacturerUses` in `apps/web/src/lib/manufacturers.ts`, `manufacturers-settings.tsx`). That tab lists the user manufacturers with the number of places that name them (a bullet's or firearm's `manufacturer`, a capacity's `caseManufacturer`, a stored record the format rejects, the record open on the page) and deletes one that nothing names at once, with Undo.
- A bullet's or firearm's Save and Copy JSON, and a bullet's share link (a firearm has none), carry the user manufacturer record it names next to the record (`makerRecordsOf` in `apps/web/src/lib/user-data.ts`). Open, a shared link and Paste keep that record in the browser unless one of its id is stored, so the maker resolves and shows in another browser. A Save writes back over a file that holds the record and its manufacturer (`ownsFile`). A Save, Copy JSON or share link writes the stored manufacturer, else the one that came with the opened file or link (`makersToCarry`), and stops when the store cannot be read and the opened file has none.
- `packages/schema/test/manufacturer-text.test.ts` fails on a `manufacturerName` property in an entity schema and on a manufacturer property that is not an id or a reference. A manufacturer record with only a name and the table as its source is valid.

## Bullet

- The designer's choice lists are the options of the enums `baseTypes`, `ogiveForms` and `tipTypes` of `packages/schema/src/bullet.ts`. A test checks that each list is a subset of the enum at its path in the bullet schema. The ogive forms include `round-nose` and `flat-nose`.
- The optional `cannelure` is `start`, `width` and `depth?`, lengths in mm, and the drawing reads it. `start` is the distance from the base of the bullet to the groove's rear edge, the edge nearer the base. Forensic work gives a cannelure's position as its height above the base of the bullet, measured from the base to the base of the groove (Hudson, Proceedings of the American Academy of Forensic Sciences, 2018, abstract B129); the source does not draw the edge, so the rear edge is the reading taken here. The designer's cannelure start has the same datum and unit, so a record seeds it without conversion. The schema refuses a groove that ends beyond the shank (the length less the nose length, or the length without a nose length), that starts on a boat tail whose length the record gives, or whose depth reaches the radius.

### Name-only bullets

A table names a bullet by maker, type and mass, often without a product number, diameter or length. Such a bullet is a record with only what is known: `nameOnly: true`, no `productNumber`, a `mass`, and a `diameter` only where a table prints one (never the cartridge's maximum bullet diameter). The schema checks the marker in both directions: without it `productNumber` and `diameter` are required, so a full record that loses one fails `data:validate`; with it `productNumber` must be absent.

- The name and the id carry the caliber where two records of one maker would otherwise collide (names are unique per maker).
- When a full record of the product appears, the name-only file is deleted, `records/renames.json` maps its id to the new one, and the loads that name it are rewritten in the same change (a load names current ids only).
- A bullet that no table prints a maker for gets no record: the load keeps the printed text.
- The API lists `diameter` as `null` and carries `nameOnly: true`. A trajectory needs a diameter and a ballistic coefficient, which such a record lacks.

## Cartridge

`caseTypes` is one enum in `packages/schema/src/cartridge.ts`, used by the cartridges route and the web filter. A user cartridge overrides the `values` (merge rules in [Variants](#variants-of-a-catalogue-record)).

## Powder

A powder needs no name-only marker: only `id`, `manufacturer`, `name` and `provenance` are required, so a powder with only a name is a valid record.

A user powder (`userPowder` in `packages/schema/src/user-data.ts`) is the powder designer's record: `origin: 'user'`, an optional `provenanceKind` (burn-law parameters need `fitted`), an optional `draft` (`powderDraft` in `packages/schema/src/overrides.ts`: the powder fields entered so far in stored units, each optional, without the powder record's bounds) and an optional `fit`. The record's `name` is the powder's name. The designer builds a `Powder` from the draft and checks it against `powder`.

## Fit of a user powder

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

## Firearm

`firearm` (`packages/schema/src/firearm.ts`) is the one firearm shape; the user record of kind `firearm` carries it as `data`. Catalogue firearm kinds: [Firearm records](firearm-records.md).

- Lengths are `quantity('length')` objects in mm, the mass `quantity('mass')` in g, click value, travel and cant `quantity('angle')` in degrees, a mount's zero air `quantity('temperature')` in degC, `quantity('pressure')` in bar and `quantity('relativeHumidity')` in %. The drag factor, magnifications and round count are plain numbers.
- `origin` (`catalogue`, `user`, `shared`) is required, so a firearm of the old SI format fails the schema instead of reading as a firearm 1000 times too short. An old record stays in the store as an invalid one.
- `manufacturer` is a manufacturer reference of either scope, `cartridge` a reference (`catalogue:<id>` or `user:<UUID>`), `landsBullet` a bullet reference. Optics and configurations stay embedded.
- `noteAtRoundCount` is the count the user sets for the round count note. `roundCountDate` (an ISO 8601 day) is the local day the round count was last set: the firearm editor sets it when the count changes and drops it when the count is cleared, and adding a session's shots to the count (range mode, the Measurements tab) sets it too; other edits of the firearm keep it, so it tells the age of the count, not of the record.
- `countedSessions` (up to 5000, the latest last; a shooting log entry dropped from it would offer its rounds again) lists each session whose rounds were added to `roundCount`, with those rounds, written in the same record write as the count. The offer for a session is its shots minus the rounds counted for it, so a later shot adds only itself and two sessions that began at the same count are both counted. A session without an entry falls back to the snapshot check: no offer when the count is at least the snapshot's `roundCount` plus the session's shots. A competition event's rounds are listed the same way under the event's reference, with no snapshot fallback: an event without an entry offers all its rounds.
- The web app converts at its edges: `siOf`, `storedOf`, `fieldSi` and `fieldStored` (`apps/web/src/lib/firearm.ts`) go through `toSi` and `fromSi`. The sight, click and Gun card values stay SI where the solver forms read them, and the editor stores a field only when it is edited, so values the user did not touch keep the exact stored number.
- `Load.firearm` is an optional reference. No catalogue firearm kind exists, so no reference check reads it.

## Load

`load` (`packages/schema/src/load.ts`) is the one Load: the catalogue record (`records/loads`, read through `catalogueLoad`), the user record of kind `load` and the load file of `POST /v1/interior/load-file`. Every quantity is a stored-unit object (charge and the measured case capacity in g, seating and measured muzzle distance in mm); the SI values appear at the solver call only. A record of kind `workbenchState` or a file with `siValues` is not read: the schema's own message for the old kind (`legacyLoadProblem`) says so in Open, Import, the stored-record list and the load file route.

- References: `cartridge`, `firearm`, `bullet` and `powder` are `catalogue:<id>` or `user:<UUID>` references. `primer` is a lot and an optional catalogue `record` (`primer.record`), so a lot alone can be stored. `capacity` names a case capacity, `case.record` a case group, `sessions` up to 50 chronograph sessions. `Load.case` is a strict object (maker, lot, `firingCount`, `record`); the case maker is a `manufacturer` reference, as is the maker of a bullet or powder description.
- A catalogue load names catalogue records only and carries `id`, `name`, `provenance`, cartridge, bullet, powder and charge; a user load is named by its record. Only a catalogue load of provenance kind `measured` (a publication) may describe its bullet or powder by maker and name (`{manufacturer, model}`, the maker a `catalogue:` reference) where no record exists. `data:validate` checks the component makers (`checkManufacturerReferences`) and the capacity (`checkLoadCapacityReferences`). The primer and the case are strict objects, so a load with `manufacturerName`, a primer `manufacturer` and `model`, or `case.waterCapacity` fails the schema in Open, Import, the stored-record list and the load file route (400 at the key's path).
- `analysis` holds the typed solver values, `overrides` and the `ladder`. `overrides` is a strict object with one optional number per key of `workbenchValueKeys` (`packages/core/src/interior/workbench-keys.ts`) except `charge` (the load's own `charge`), each in the stored unit of `analysisKinds` (`volume` in cm3, `propellantTemperature` in degC, pressures in bar). A key outside that list fails the schema. The ladder step is in the stored unit of its kind: g, mm or K.
- The workbench saves a key under `overrides` only when the user typed it (`givenKeys` in `apps/web/src/lib/load-record.ts`). A value is left out when a reference gives it again on opening: the powder record's model parameters, the bullet record's or design's mass, a followed default of volume, bore diameter, bore area and twist, the seating's volume and travel (while the barrel length is the default one), the Settings defaults, and the mass and twist of a referenced firearm. Opening fills the form like a link (the Settings defaults and the followed defaults for the keys the load leaves out), then the records fill the rest, and the typed values stay.
- A load follows a changed record or changed Settings for every value the user did not type. A value whose source a reference cannot name is saved as typed: a firearm whose id is no UUID. The built-in example rifle has a fixed UUID so that the example load keeps it.
- `POST /v1/interior/load-file` refuses a `user:` cartridge, bullet or powder (400 at `records[i].data.cartridge`, `.bullet` or `.powder`): a user record is resolved in the browser, never on the server. It fills the values a load leaves out from the catalogue records it references: the powder's model parameters, the bullet's mass and the cartridge's bore area. The charge is the load's own. A value no record gives (volume, travel, twist, bore diameter without a cartridge record, the charge) is not invented: the route answers one 422 that lists every missing value with its path (`records[i].data.analysis.overrides.<key>`, the charge at `records[i].data.charge`) and its quantity. It names no solver value from a capacity (the volume is a typed override). The workbench's download for the API writes the resolved values, so that file runs as it is.

## Saved recipes

A saved recipe keeps only the keys the user typed, under `analysis.overrides`, validated against `workbenchValueKeys`: the solver values, the bullet's `bulletDiameter`, `bulletLength`, `bulletBcG1`, `bulletBcG7` and base dimensions `bulletBaseLength` (boat-tail length), `bulletBaseDiameter` (base face) and `bulletCavityDiameter` (hollow base opening) (the bullet mass is `bulletMass`), and three values of the cartridge sheet and the powder record: `pmax` (bar), `caseLength` (the sheet's L3, mm) and `bulkDensity` (g/cm3).

- A typed BC replaces every velocity band of its drag model with one value from 0 m/s.
- The base form chosen over the record's `base.type` is `analysis.bulletBase`. A form keeps only the dimensions it has: a flat base none, a boat tail no cavity. A typed boat-tail length leaves out the record's bearing length, and a typed boat-tail length or base diameter leaves out its boat-tail angle, which the outline derives. The workbench draws the bullet and computes the volume behind the seated bullet with the typed form; the interior route reads `bulletLength` for the bore resistance and ignores the other values.
- The workbench marks a value that differs from the record's with a reset action (`apps/web/src/lib/record-changes.ts`), only when the record supplies that key and the value differs. A value without a record value, one equal to the record's and a typed BC over a record with several bands are not marked; the base form is marked when it differs from the record's `base.type`. A new record pick replaces the card's changed values.
- A typed `pmax` is the user's own limit, not a C.I.P. value: the workbench compares the run with it in place of the sheet's Pmax, labelled "your Pmax" in the readouts, the chart, the charge target, the result line and the print. A typed `caseLength` moves the seating and the cartridge figure. A typed `bulkDensity` replaces the powder record's for the load ratio and the case fill; the solid fill keeps the solid density of the propellant.
- The interior routes take the Pmax as `pressureLimit` (Pa), and `POST /v1/interior/load-file` reads the three keys from the load's overrides.

## Session snapshots on a load

- `Load.snapshots` (`sessionSnapshot` in `packages/schema/src/load.ts`, up to 50, at most one per entry of `Load.sessions`) keeps what the load was at each session: `powderLot`, `primerLot`, `caseLot`, `seating`, the firearm's `roundCount` at the start of the session, and the ids of the notes the user dismissed for that session. `Load.powderLot` sits beside `primer.lot` and `case.lot` (a powder is a bare reference, with no place for a lot). All fields are optional.
- The snapshot is shown live until the load is saved with the session, then fixed. The rules and their thresholds: [Load notes](../models/load-notes.md).

## Chronograph session

`chronoSession` (`packages/schema/src/chrono-session.ts`) is the one session shape: the catalogue record (`records/chrono`, read through `catalogueSession`), the user record of kind `session` and what an import gives. It carries `origin`.

- A catalogue session needs its `id`, the `date`, the device's `manufacturer` (a `catalogue:` reference, checked by `data:validate`) and `model`, `conditions.airTemperature` and the `load` of every string (a `catalogue:` reference). A user session needs none of them, so a file as the importers read it is a valid session and the Measurements tab holds exactly that. The importers cannot read the catalogue: their `missingPaths` names what a catalogue session requires and always lists `device.manufacturer`, and a name the file gives stays on the candidate (`device.manufacturerName` of `SessionCandidate`, also the member of the OpenReloading session JSON) for the caller to resolve. `packages/schema/test/session.test.ts` parses an imported file, the stored user record, a catalogue session, and the references of a load and a target sheet through the same schema.
- A shot string has `load` (a reference, absent until the session is attached to a load), `label`, `variation`, `propellantTemperature`, `conditions` (`airTemperature` in degC, `stationPressure` in bar, `windSpeed` in m/s, each optional: the weather at that string, typed by hand at the range), `note` (plain text up to 2000 characters) and `shots` (1 to 5000; a session holds up to 500 strings). `variation` is the charge (g) or the seating length (mm) the string varies against its load; a temperature ladder stays the string's `propellantTemperature`.
- A load names its sessions in `Load.sessions`; a group shot's `chrono.session` is a session reference.
- The Measurements tab keeps session records. A file read there becomes a user record of kind `session` (`sessionOf` in `apps/web/src/lib/measurements.ts`): the file name is the record name, the device's maker a manufacturer reference (`referTo`), a string mapped to a charge carries `variation`, and the muzzle distance stays in mm and is converted for display. The workbench stores the records as they change and the load keeps their references in order. Removing a session in the tab drops the reference and leaves the record in the browser, as no screen deletes a user manufacturer. Save writes the load and names it on the mapped strings that name none (`attachLoad`), so Save as shares the sessions of the copy. Opening reads each `user:` reference from the store; one the browser does not answer (a catalogue session, or a session of another browser) stays in the load. The note under the tab says the sessions stay in this browser.
- A load file or a copied JSON carries the references, not the shots, so in another browser the sessions are reported as missing.

## Case capacity

`caseCapacity` (`packages/schema/src/case-capacity.ts`) is the one capacity entity: the catalogue record (`records/capacities`, read through `catalogueCaseCapacity`, which needs `id`, `provenance` and catalogue references only) and the user record of kind `caseCapacity`, the water always in g (`waterCapacity`). It carries `origin`; `cartridge` and `caseManufacturer` are references (`catalogue:` or `user:`). `GET /cartridges/:id` answers with the capacity. A catalogue capacity with a plain `cartridge` id and no `origin` is rejected: no migration. `packages/schema/test/case-capacity-unit.test.ts` fails when another entity holds a water mass or when the unit is not g.

- `Load.capacity` is a reference, `catalogue:<id>` or `user:<UUID>`. A catalogue load names a catalogue capacity.
- The workbench has two inputs: the capacity record chosen in the pinned row above the input cards and the measured capacity (water to the mouth, replaces the record's value; the flags and notes of the run are unchanged). A capacity record chosen from the cartridge's catalogue capacities is saved as `catalogue:<id>` only when chosen; the first one shown by default is followed.
- A load saved with a typed measured capacity names a user capacity record whose id is a version 8 UUID derived from the cartridge reference and the value in g (`measuredCapacityId` in `apps/web/src/lib/load-record.ts`), so one measurement is one record and a changed value another one, which a load saved earlier keeps. Save writes that record to the browser together with the load (`storeLoad`, the File menu's `store`); opening the load reads it back into the field. A record the browser does not answer stays in the load as asked and is listed as not loaded. The link parameter `measuredWaterCapacity` is in m³.
- A load file or a copied JSON carries the load, not the capacity record, so in another browser the measured value is reported as missing (the same limit as a user cartridge or bullet design). Share links never carry it.

## Own cases

The user record of kind `case` (`packages/schema/src/user-data.ts`) holds a `Case` with `origin` `user`.

- `manufacturer` is required of a catalogue case only. `basedOn` names the catalogue product the group started from; its fields are the group's own values, not overrides of the product.
- The measured fields are optional: `numberOfFirings`, `trimLength` and `neckWall` (mm), `casesMeasured` and `spread` (g, standard deviation of the capacity over those cases).
- The measured water capacity stays a `caseCapacity` record that the group names with `capacity`, so a capacity is stored once: the case group editor (`/cases/editor`, `apps/web/src/components/case-group-editor.tsx`) writes it with the id `measuredCapacityId` gives for the cartridge and value, the same record the workbench writes for a typed measured capacity.
- A load names the group with `case.record` (`user:<UUID>`). Export all and Import carry the groups with every other record; a single group's file does not carry its capacity record.
- The workbench lists the groups of the chosen cartridge in the Brass record choice of the pinned row above the input cards. Choosing one fills the measured capacity field from the group's capacity record, which the run marks as measured, and a saved load keeps `case.record` as the group's reference.

## Load tables, caliber classes and targets

- `loadTables` (`packages/schema/src/load-tables.ts`) is the schema of `load-tables.json`: row file name to `{ manufacturer, title, url?, retrieved }`, strict, `manufacturer` a record id and `retrieved` an ISO date. `readLoadTables` parses each entry: one that breaks the schema is left out and `data:validate` reports each issue with the row file and field. The manufacturer must be a record (`checkManufacturerReferences`).
- Caliber classes are records (`records/caliber-classes`, `caliberClass` in `packages/schema/src/caliber-class.ts`), served by `GET /caliber-classes` and `/:id`. `Discipline.caliberClasses.ids` and the `caliberClasses` of a target list item are record ids, checked by `data:validate` (`packages/data/src/caliber-classes.ts`), which also holds the membership rules. The web app reads class names from the API.
- `TargetFace.federation` and the target events' `federation` are federation record ids; a target without `federation` is a user's own design. Every target event has an `id` (a record id, unique within the target) and `TargetMapping.event` holds it. `data:validate` checks the federation references, the mapping against the event's federation and the uniqueness (`checkFaceFederations`, `checkMappings`). The targets API list derives `organization` from the federation. The web app keys the event choice by id; a saved target sheet whose `face.event` holds an event name is rejected like any record of an older format.

## Share links

The File menu's Copy share link copies a link to a bullet, a cartridge or a load (`shareable` in `apps/web/src/components/file-menu.tsx`). Opening the link in another browser opens the record there as unsaved work.

- What it carries: the record as a user data file (`shareLink` in `apps/web/src/lib/share-link.ts`). A bullet's link also carries the user manufacturer it names. A design based on a catalogue record carries its `catalogue:` base, not a copy of the base. The workbench's Copy link carries the values of a design, not its reference.
- Where it goes: the record is compressed and written after `#record=` in the address. A browser does not send the part after `#` to a server, so the record is not uploaded; it goes only where the link is pasted or sent. Anyone who has the link can read the record.
- Length: at most 8000 characters (`maxLinkChars` in `apps/web/src/lib/share-link.ts`, the length RFC 9110 recommends every sender and recipient support). A longer record gets no link, with a message to save it to a file instead. A received link over the limit is not opened.
- Refused: a load that names records kept only in this browser (`user:` in its firearm, cartridge, bullet, powder, case capacity, case, case maker or chronograph sessions; `userRefFields` in `packages/schema/src/user-data.ts`, `shareProblem` in `apps/web/src/lib/share-link.ts`). The browser that opens the link has none of them, so the message names those fields: use catalogue records, or save the load and those records to a file.

## Catalogue and API

- The catalogue holds one record per entity and an index row per record, read in process ([Catalogue storage](catalogue-storage.md)).
- User data stays client side. The server holds catalogue records only and needs no `origin` column.
- The web app imports `Source`, `Provenance`, `SpecValue`, `CaseCapacity`, `Bullet` and `Powder` from `@open-reloading/schema`. `apps/web/src/lib/api-types.ts` keeps the shapes the API adds (list summaries, `CartridgeDetail` as the cartridge plus `caseType` and `capacities`, compute answers).

## Decisions

- The record attribute is `origin` with the values `catalogue`, `user` and `shared`.
- User data stays client side. Compute routes accept a reference or an entity: a catalogue reference for a catalogue record, the resolved entity inline for a user record.
- Overrides follow the merge rules above, and a catalogue change to a field that is not overridden is followed and shown as "base changed".
- One unit system in stored data. Old SI files are rejected.
- New record kinds are additive: the web app skips a record of a kind it does not know in a user data file or share link (`withoutUnknownKinds` in `packages/schema/src/user-data.ts`), reads every known record of the file and names each skipped kind with its count in the Open and Import report. It does not keep the skipped records, so a file it saves or exports leaves them out, and Save does not write over a file that holds them. A record of a known kind that is invalid, a record without a `kind` and the old kind `workbenchState` are refused. The JSON Schema of the file lists the kinds of this version and says so on `records`. The load file route (`POST /v1/interior/load-file`) does not skip: it reads one load and refuses any other record that fails the schema.
- No migration at 1.0.0: the user data file and share links stay version 1, so an alpha file still opens. Export all data before updating. A browser record of an older shape then shows under Open as one of the invalid records, with its error, Download raw and Delete: fix the downloaded record and import it, or delete it.
- Session stays separate from Load.

## Open

- One envelope on every entity (`id`, `kind`, `origin`, `name`, `provenance`, `basedOn?`, `overrides?`, `revision`): the catalogue Bullet, Cartridge and Powder schemas carry no `origin`, and `revision` exists only in API answers.
- Rename the citation's `provenance.sources[].origin` to `standing`, so one word has one meaning.
- `origin: 'shared'`: a received record is not yet kept as `shared` with the sender's file in its provenance, and is not re-keyed on import (Import matches by `id`), so ids of different users can meet. Bullet and powder take no `shared` yet.
- A user powder that is `basedOn` a catalogue powder and overrides `interior` and `temperatureSensitivity`, in place of the draft.
- A catalogue Firearm.
- A user Bullet or Powder stub created for a component without a catalogue match, so every reference of a user load resolves.
- Compute routes taking `bullet: Ref | Bullet`, and the same for powder, cartridge and firearm: the exterior route takes an explicit SI projectile or a bullet record id.
- A check that an override result as a whole is a valid record.
- A target sheet's `load` as a `user:` reference (it is a plain local id).
- A user session's provenance with the imported file's SHA-256: the workbench does not compute it.
- FiringSeries becomes a Session, with a per-string summary for publications that print only a mean. `FiringSeries` and `RangeFirings` are validated and bundled but nothing reads them, so they can drift unseen.
- Inline bullet, firearm and ammunition descriptions in publication records (`firing.ts`, `range.ts`) repeat part of Bullet and Firearm.
- `targetMapping.gauge` is stored on the mapping and on the target event.
- The user data file `version` is one integer for the whole file.
- Id rules and an id generator for catalogue records.
- Catalogue reference checks stop at ids that exist: loads name components in text.
- Powder numbers mix `quantity` objects and plain numbers with a unit in the metadata.
