# @open-reloading/schema

Zod schemas for records, user data files and the shared vocabularies, ESM. The build writes JSON Schema files to `dist/json-schema/`, which `test/contracts.test.ts` compares with `test/golden/json-schema/` (`npm run baselines` at the root rewrites it). Record model and field pages: `apps/docs/docs/data/`.

## Commands (this directory, or `-w @open-reloading/schema` from the root)

- Build: `npm run build` (output `dist/`, `dist/json-schema/*.schema.json`)
- Test: `npm test` (Vitest). Single test: `npx vitest run <file> -t "<name>"`
- Type check: `npm run typecheck`

## Rules

- Each quantity has one stored unit (`src/units.ts`). `quantity(kind, value?)` stores the value in that unit and the source text in `raw`. `toSi` and `fromSi` are the only stored-to-SI conversion; display units stay in the web app.
- Put a field's bounds on the value schema (`quantity('angle', z.number().gt(0).lt(90))`) so the JSON Schema carries them. Keep only rules across fields in `superRefine`.
- One shape per record kind for the catalogue record, the user record and the file (`Load`, `ChronoSession`, `Case`, `CaseCapacity`, `Firearm`); catalogue variants only require more. Record schemas are strict: a field of an older format fails, there is no migration.
- Ids and references (`src/ids.ts`): `recordId` for catalogue records, `userId` (UUID) for user records, `ref(kind)` for `"catalogue:<id>"` or `"user:<UUID>"`. A new field that points at a user record goes into `userRefFields` and `checkUserRefs` (`src/user-data.ts`).
- Variants: `applyOverrides` (`src/overrides.ts`) is the one resolution function; the override schemas are generated from the entity schemas.
- Search and order: `searchKey`, `score`, `sortKey` and `compareKeys` (`src/search.ts`, `src/order.ts`) and the competition order (`src/competition-order.ts`) are the only matcher and order; the API and the web app use these.
- Vocabularies the API and the web app share (`caseTypes`, `baseTypes`, `ogiveForms`, `tipTypes`, ...) are exported once from here; the web app keeps no copy.
- Every record carries `provenance`: a kind (`published`, `measured`, `derived`, `fitted`, `computed`) and at least one source. Fact sources (C.I.P. sheets, rule books) carry no `license` or `terms`; other third-party data names its `publisher` and `license` (SPDX id, or `LicenseRef-<name>` with `terms`).
- `analysis.overrides` of `Load` holds one optional number per workbench key; a test in the API package checks the key set against `workbenchValueKeys` of core.
