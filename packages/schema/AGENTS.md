# @open-reloading/schema

Zod schemas for records, ESM. The build writes JSON Schema files to `dist/json-schema/` (generated, not committed).

- Units, provenance, `Load`, `ChronoSession`, `FiringSeries`, `RangeFirings`, standards and components, user data files, `TargetSheet` (shot groups on a target, m).
- `TargetFace`: rule-book target faces for ring scoring. Optional ring colours, paper size, bulls, ovals, square rings and event category. Strict events.
- `TargetFaceDesign` (user record kind `targetFaceDesign`, `src/user-data.ts`): the draft of the web app's face designer, every field optional. The designer builds a `TargetFace` from it and checks that against `targetFace`.
- `Federation`, `Discipline` and `TargetMapping` (`src/federation.ts`): strict objects, `apps/docs/docs/data/federations.md`.
- `Manufacturer` (`src/manufacturer.ts`): strict object, referenced by id from powders and bullets, `apps/docs/docs/data/manufacturers.md`.
- Default order of federations, disciplines, target faces, face events and mappings (`src/competition-order.ts`): the API sorts its lists with it and the web app imports it, rules in `apps/docs/docs/data/federations.md`.
- Ids and references (`src/ids.ts`): `recordId` for catalogue records, `userId` (UUID) for new user records, `ref(kind)` for `"catalogue:<id>"` or `"user:<UUID>"`. `checkUserRefs` (`src/user-data.ts`) lists the dangling references among user records (a load's `firearm`, `cartridge` and `bullet` when they are `user:` references, a sheet's `load`).
- Variants (`src/overrides.ts`): `applyOverrides(base, overrides)` is the one resolution function (objects merge by key, arrays replace, `null` removes, cartridge `values` merge by `(side, symbol, variant)`, a quantity or value entry replaces whole). `bulletOverrides` and `cartridgeOverrides` are generated from the entity schemas with every field optional and nullable. The user records `bullet` and `cartridge` (`src/user-data.ts`) are `basedOn` plus `overrides`. Model: `apps/docs/docs/data/record-model.md`, step 4.
- `Firearm` (`src/firearm.ts`): one shape for every `origin` in stored units (mm, g, degrees, zero air in degC, bar and %), the maker a `catalogue:` reference with `manufacturerName` as free text beside it. The user record `firearm` and a load's `firearm` reference use it. Model: `apps/docs/docs/data/record-model.md`, step 5.
- Search and list order (`src/search.ts`, `src/order.ts`, `apps/docs/docs/data/catalogue-storage.md`): `searchKey` is built once per row, `score` ranks a query against it (words in any order, spaces, hyphens, decimal comma and a leading point ignored; exact name 4, word start 2, substring 1). `sortKey` is one precomputed key per row (folded, digit runs padded), `compareKeys` compares by code unit. The web lists, and later the API and the static edition, use these and no other matcher or order.
- `renames` (`src/renames.ts`): the shape of `records/renames.json`, old record ids per kind directory with the id that replaced each (`apps/docs/docs/data/catalogue-storage.md`).
- Caliber class vocabulary `caliberClasses` (`src/caliber-class.ts`).
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
