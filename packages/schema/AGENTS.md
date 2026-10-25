# @open-reloading/schema

Zod schemas for records, ESM. The build writes JSON Schema files to `dist/json-schema/` (generated, not committed).

- Units, provenance, `Load`, `ChronoSession`, `FiringSeries`, `RangeFirings`, standards and components, user data files, `TargetSheet` (shot groups on a target, m).
- `TargetFace`: rule-book target faces for ring scoring. `federation` is a federation record id (absent: a user's own design). Events carry an `id` unique within the face and an optional `federation`. Optional ring colours, paper size, bulls, ovals, square rings and event category. Strict events.
- `TargetFaceDesign` (user record kind `targetFaceDesign`, `src/user-data.ts`): the draft of the web app's face designer, every field optional. The designer builds a `TargetFace` from it and checks that against `targetFace`.
- `Federation`, `Discipline` and `TargetMapping` (`src/federation.ts`): strict objects, `apps/docs/docs/data/federations.md`.
- `Manufacturer` (`src/manufacturer.ts`): strict object, referenced by id from powders and bullets, `apps/docs/docs/data/manufacturers.md`. A user manufacturer is the user record kind `manufacturer` (`userManufacturer`, `src/user-data.ts`); a user bullet's and a firearm's `manufacturer` are `ref('manufacturer')`, both strict, so a record of the older format with `manufacturerName` fails.
- `CaseCapacity` (`src/case-capacity.ts`): one shape for the catalogue record (`catalogueCaseCapacity`, `records/capacities`) and the user record kind `caseCapacity`, the water in g. `cartridge` and `caseManufacturer` are references (a catalogue capacity names catalogue records only, and carries `id` and `provenance`). Model: `apps/docs/docs/data/record-model.md`, step 8.
- Default order of federations, disciplines, target faces, face events and mappings (`src/competition-order.ts`): the API sorts its lists with it and the web app imports it, rules in `apps/docs/docs/data/federations.md`.
- Ids and references (`src/ids.ts`): `recordId` for catalogue records, `userId` (UUID) for new user records, `ref(kind)` for `"catalogue:<id>"` or `"user:<UUID>"`. `checkUserRefs` (`src/user-data.ts`) lists the dangling references among user records (a load's `firearm`, `cartridge` and `bullet` when they are `user:` references, a bullet's and a firearm's `manufacturer` and a capacity's `cartridge` and `caseManufacturer` when they are `user:` references, a sheet's `load`).
- Variants (`src/overrides.ts`): `applyOverrides(base, overrides)` is the one resolution function (objects merge by key, arrays replace, `null` removes, cartridge `values` merge by `(side, symbol, variant)`, a quantity or value entry replaces whole). `bulletOverrides` and `cartridgeOverrides` are generated from the entity schemas with every field optional and nullable. The user records `bullet` and `cartridge` (`src/user-data.ts`) are `basedOn` plus `overrides`. Model: `apps/docs/docs/data/record-model.md`, step 4.
- `Load` (`src/load.ts`): one shape for the catalogue record (`catalogueLoad`), the user record `load` and the load file, in stored units. References to cartridge, firearm, bullet, powder and case capacity (`capacity`, replaces `case.waterCapacity`); `analysis.overrides` holds only the solver values the user typed, one optional number per workbench key (`analysisKinds` gives each one's stored quantity, a test in the API package checks the key set against `workbenchValueKeys` of core); `analysis.ladder` the ladder; `measurements` the chronograph series. Model: `apps/docs/docs/data/record-model.md`, step 6.
- `Firearm` (`src/firearm.ts`): one shape for every `origin` in stored units (mm, g, degrees, zero air in degC, bar and %), the maker a manufacturer reference (`catalogue:` or `user:`), no name text. The user record `firearm` and a load's `firearm` reference use it. Model: `apps/docs/docs/data/record-model.md`, step 5.
- Search and list order (`src/search.ts`, `src/order.ts`, `apps/docs/docs/data/catalogue-storage.md`): `searchKey` is built once per row, `score` ranks a query against it (words in any order, spaces, hyphens, decimal comma and a leading point ignored; exact name 4, word start 2, substring 1). `sortKey` is one precomputed key per row (folded, digit runs padded), `compareKeys` compares by code unit. The web lists, and later the API and the static edition, use these and no other matcher or order.
- `renames` (`src/renames.ts`): the shape of `records/renames.json`, old record ids per kind directory with the id that replaced each (`apps/docs/docs/data/catalogue-storage.md`).
- Load tables (`src/load-tables.ts`): the schema of `load-tables.json`, strict entries.
- `CaliberClass` (`src/caliber-class.ts`): a record in `records/caliber-classes`, named by id in `Discipline.caliberClasses`, membership checked by `data:validate`.
- Vocabularies the API and the web app share are exported once: `caseTypes` (`src/cartridge.ts`), `baseTypes`, `ogiveForms` and `tipTypes` (`src/bullet.ts`). The web app imports record types from here and keeps no copy; the bullet designer's choice lists are the options of these enums. Model overview and plan: `apps/docs/docs/data/record-model.md`.

## Commands (this directory, or `-w @open-reloading/schema` from the root)

- Build: `npm run build` (output `dist/`, `dist/json-schema/*.schema.json`)
- Test: `npm test` (Vitest)
- Single test: `npx vitest run <file> -t "<name>"`
- Type check: `npm run typecheck`

## Facts

- Each quantity has one stored unit (`src/units.ts`). `quantity(kind, value?)` stores `value` in that unit and the source text in `raw`.
- `toSi(kind, stored)` and `fromSi(kind, si)` (`src/units.ts`) are the only stored-to-SI conversion (`siMaps`: a factor and an offset per quantity). Display units such as inch and grain stay in the web app's `lib/units.ts`.
- Put a field's bounds on the optional value schema (`quantity('angle', z.number().gt(0).lt(90))`), so the generated JSON Schema carries them as `minimum`/`maximum` or their exclusive forms. Keep only rules across fields in `superRefine`.
- `SourceRecord` and `SourceReference` (`src/provenance.ts`): a source stored once and a record's citation of it by id, resolved by `@open-reloading/data` before the record schemas run.
- Every record carries `provenance`: a kind (`published`, `measured`, `derived`, `fitted`, `computed`) and at least one source. Fact sources such as C.I.P. sheets and rule books carry no `license` or `terms`. Other third-party data names its `publisher` and what allows the use: `license` (SPDX id, or `LicenseRef-<name>` with `terms` for the publisher's own terms or a written permission).
- Imports and syntax: root `AGENTS.md`.
