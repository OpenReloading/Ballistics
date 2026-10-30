# @open-reloading/core

Pure TypeScript ballistics solver, ESM. Headless: no I/O, no network, no database. A runtime dependency follows the rule of the root `AGENTS.md`, Conventions (Package rules).

## Commands (this directory, or `-w @open-reloading/core` from the root)

- Build: `npm run build` (output `dist/`)
- Test: `npm test` (Vitest). Single test: `npx vitest run <file> -t "<name>"`
- Type check: `npm run typecheck`

## Rules

- Model pages: `apps/docs/docs/models/` describes each model with its equations. The `Code:` line under each equation names the file and function that compute it: update it after renaming or moving such a function. `npm test -w @open-reloading/docs` fails on a file or name that no longer exists and on a source file no page names. A change to a model's code updates its page in the same commit.
- SI in and out (temperatures in K, angles in rad; groups in target-plane m, x right, y up).
- Errors (`src/errors.ts`): `InputError` (extends `RangeError`) for inputs outside the model and computations that do not finish within their limits; `TruingError`, `PowderFitError`, `MixedPressureBasisError` and `ValueError` extend it. Any other error is a defect (the API answers 500). `need(ok, message)` throws an `InputError`.
- `nth(array, index)` returns the entry or throws. The integrator and the interior model keep a module-local unchecked `el` for state vectors: a call into another module does not inline in Vitest and slowed the Monte Carlo tests several times.
- Options merged over defaults take `Settings<...>` and merge with `overlay`, never a spread (a spread lets an `undefined` entry replace its default).
- `src/drag-tables.ts` is generated: never edit it by hand. A new drag model is its table in a regenerated file and its name in `dragModels` (`src/exterior/drag.ts`, key order pinned by a test).
- `bisect` (`src/bisect.ts`, internal) is shared by several callers, each with its own iteration count and stop rule, which keeps their results bit-identical. Do not unify them.
- Advisories (`src/advisories.ts`, `advisoryRules`): the one registry of what a run tells a user; messages state facts about inputs only, `warn` and `info` never change a result. The API warning enum and the workbench's names are derived from it. A new rule is an entry, its test (fires, does not fire) and its line on the model page.
- A fit or range states what its uncertainty covers (parameter or input tolerances only, no model error); keep that in results and docs.
- `src/index.ts` is the public surface. From `src/errors.ts` it re-exports only `InputError`, `overlay` and `Settings`; `bisect` and `studentTwoSidedQuantile` stay internal.
