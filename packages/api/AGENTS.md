# @openreloading/api

Fastify HTTP API (TypeScript, ESM) exposing `@openreloading/core` and the data records, with PostgreSQL through Drizzle ORM.

- `src/app.ts` builds the app (plugins and routes registered explicitly).
- `src/server.ts` waits for the database, builds the tables (`src/db/build.ts`), loads the data bundle (skipped when its hash is unchanged) and starts listening.

## Endpoints

- Every route below is served under `API_PREFIX` (`/v1`, `src/version.ts`) except the liveness probe `GET /`. Paths below omit the prefix. `src/app.ts` registers the route plugins under it.
- `buildOpenApi` (`src/openapi.ts`) reads the route's `config`:
  - `body`, `query`: the zod schema of a request, every field with a `.describe()` text and its unit. A query number is parsed from its text and documented as the number.
  - `response`: the zod schema of the 200 body. The read routes build theirs from the record schemas of `@openreloading/schema`, the compute routes from `src/compute/*-response.ts` (loose objects: a field core adds does not break the document).
  - `errors`: the error statuses of the route's own code.
  - `summary`, `description`: what the route answers. `example`: a valid request body.
  - Fastify JSON-schema parameters carry their `description` in the property schema.
  - Tags by the first path segment: Records, Competition, Exterior, Interior.
- `GET /v1/openapi.json`: the document. `GET /v1/reference/`: the Scalar viewer of it (`@scalar/fastify-api-reference`, its script from the package at `/v1/reference/js/scalar.js`). Both only when `buildApp` gets `openApi` (`src/server.ts`), so they are not part of the document.
- `buildOpenApi` adds 400, 413, 414, 415 and 500 where Fastify answers them, every error with the shared `Error` body.
- The document's `info.version` is `API_VERSION`, the version of this package (`package.json`, set by release-please), the one contract version.
- `npm run api:check` at the root compares the document with `openapi.baseline.json` (oasdiff, `tools/AGENTS.md`). `npm run api:conformance` tests a running API against it (Schemathesis).
- `GET /cartridges?q=&table=&limit=&offset=`: `{ total, items: [{ id, name, aliases, table, maxBulletDiameter?, boreDiameter?, grooveDiameter?, caseLength?, cartridgeLength?, pmax?, caseType?, country? }] }`.
  - A cartridge is one C.I.P. sheet. `q` searches names and aliases. `table` is the C.I.P. table (`I` to `XI` in the records).
  - `maxBulletDiameter` (mm): the smallest cartridge-side G1 of its sheet. `boreDiameter` and `grooveDiameter` (mm): the smallest chamber-side F and Z, each absent when none.
  - `caseLength` and `cartridgeLength` (mm): the smallest cartridge-side L3 and L6 (the shortest variant). `pmax` (bar): the highest Pmax.
  - `caseType` (`rimless`, `semi-rimmed`, `rimmed`, `rebated`, `belted`) from its cartridge R1, P1 and R3 (`caseType` in `src/db/queries.ts`): an R3 is a belt, R1 more than 0.7 mm over P1 a rim, more than 0.3 mm a semi-rim, more than 0.25 mm under it a rebated rim. Absent without R1 and P1 (the table VII shotshells among them).
  - `country`: the sheet's `country` text, as printed.
- `GET /cartridges/:id`: the cartridge record (`id`, `name`, `aliases`, `table`, `country?`, `published`, `revised?`, `pressureMethod?`, `verification`, `exceptions?`, `values` in file order, `provenance`), its `caseType` (as in the list) and its case capacities. 404 when unknown.
- `GET /manufacturers`: `{ total, items: [{ id, name, aliases?, website? }] }` ordered by name and id. `GET /manufacturers/:id`: the whole record (`apps/docs/docs/data/manufacturers.md`).
- `GET /powders?q=&manufacturer=&limit=&offset=`, `GET /bullets?...&cartridge=`: summaries with `manufacturer` (the manufacturer id), ordered by manufacturer name, name and id (joined with `manufacturers`).
  - `q` matches the manufacturer name or one of its aliases followed by the product name. `manufacturer` is an exact manufacturer id.
  - `cartridge` (a cartridge id) keeps the bullets that fit its C.I.P. G1, F and Z by `bulletFits` of core (above the middle of F and Z, up to G1 plus 0.005 mm). None for an unknown cartridge or one without the three values (`cartridgeFit` in `src/db/queries.ts`).
  - `ballisticCoefficientG1` and `ballisticCoefficientG7` of a bullet: the record's first coefficient of that drag model, null without one.
  - Absent without a value: `country` (ISO code of the manufacturer's country) of a powder or bullet, the bullet's `tipType` (the record's tip type) and `construction` (the record's construction structure, else the core material as `<material>-core`).
  - `GET /powders/:id`, `GET /bullets/:id`: the whole record.
- `GET /target-faces`: `{ total, items: [{ id, organization, name, caliberClasses, categories }] }`, every face. `caliberClasses`: the caliber classes of the disciplines mapped to it. `categories`: those of its events and those disciplines. `GET /target-faces/:id`: the whole record.
- `GET /federations`, `GET /disciplines?federation=`, `GET /target-mappings?discipline=&face=` and their `/:id` routes (`src/routes/federations.ts`): summaries and records as `apps/docs/docs/data/federations.md` lists them. An unknown filter id gives no items.

Compute (`src/routes/compute.ts`):

- `POST /exterior/trajectory`, `POST /exterior/truing`.
- `POST /exterior/range-strings/plan` and `/fit` (core `comparePlanCandidates`, `fitTruingStrings`). Infinite numbers are `null` at the whitelisted paths in `src/routes/compute.ts`, 422 at any other. A zero-offset prior without `fitZeroOffset` is 400.
- `POST /interior` (`model` `m3`).
- `POST /interior/load-file`: the workbench load file as body, results as JSON (`src/compute/load-file.ts`, `src/compute/simulate.ts`). The field mapping is `interiorLoad` of core, shared with the workbench. 400 issues carry the path in the file.
- `GET /exterior/stability` (`muzzleVelocity` in the query).
- A compute answer carries its result under `result`, except `POST /interior` with a `ladder` (each of `ladderSteps` has its `result`) and `POST /interior/load-file` (`summary`, `points`, `ladderSteps`).
- Bodies are the `@openreloading/core` arguments in SI, validated by the strict zod schemas in `src/compute/*-schema.ts` (400). `bullet` and `powder` ids are resolved in `src/compute/resolve.ts` and echoed under `resolved` with `suppliedFields`, the request values the record supplied.
- 422: core `InputError` (and its subclass `TruingError`), unusable records and invalid interior results.
- 503: a compute deadline (`reason` `timeout`), a full queue or a worker that cannot be created (`reason` `busy`).
- 500: other errors.
- Documented NaN result fields are written as `null`.
- Interior 200 responses carry `pressureRange` and `warnings`. A `limitExceeded` warning names its limit: the sheet id (`spec`), `symbol`, `variant` and `method`. A `ladder` (`chargeStep` kg, `stepCount`) answers `ladderSteps`. An optional `cartridge` id adds `limits` (the Pmax values of its sheet, `src/compute/limits.ts`): each carries `cartridge` (its id) and `revised` (the date of the sheet revision, `revised` or else `published`). `resolved.cartridge` is `{ id, name, provenance }`.
- Interior responses with status 200, 422, 503 or a schema 400 carry `notice: "simulation, not load data"`.

`POST /interior/charge-target` (`src/routes/charge-target.ts`, the run in `src/compute/charge-run.ts`, `src/compute/charge-schema.ts`):

- The charge at which an M3 run reaches a target (peak pressure in Pa or as a percentage of the compared CIP limit, muzzle velocity, load ratio, barrel time, bullet lead time). Core `solveCharge` as the compute task `chargeSolve`.
- The body takes the bulk density in `load.propellant.bulkDensity`.
- 200 carries the charge, `achievedValue`, `relativeTolerance`, `evaluationCount`, its run, the range and the warnings of `POST /interior`.
- 422: a target outside the reachable values, with `reason` and `reachable` (`minValue` and `maxValue`, each with its charge). `noValidRun` carries the `failure` of the first scanned run.
- `options.maxSteps` is capped at `caps.chargeSteps` (the solver runs up to 152 times in one task).
- Every answer carries the notice.

## Commands (this directory, or `-w @openreloading/api` from the root)

- Build: `npm run build` (output `dist/`, with `dist/schema.json`: the DDL of `src/db/schema.ts` from `drizzle-kit export --output json`)
- Dev server: `npm run dev` (Node runs `src/server.ts` directly, restarts on change)
- Start: `npm start` (`HOST`, `PORT`, default `0.0.0.0:3000`)
- Test: `npm test` (Vitest, `app.inject`, in-memory PostgreSQL through PGlite, no server needed)
- Single test: `npx vitest run <file> -t "<name>"`
- Type check: `npm run typecheck`

## Facts

- Relative imports end in `.ts`. `tsc` rewrites them to `.js`. Only erasable TypeScript syntax (no enums, no namespaces), because Node strips types without compiling.
- Requires `DATABASE_URL` in the process environment. `npm start` loads it from the root `.env` when the environment does not set it.
- Errors (`src/app.ts`): a 4xx answer keeps its message. Any other error answers 500 `{ statusCode, error, message: 'internal server error', requestId }`, without the error's text. The error goes to the server log under that `reqId`.
- Schema: `src/db/schema.ts`. Client: `src/db/index.ts`. At start `ensureTables` (`src/db/build.ts`) compares the sha256 of the statements in `dist/schema.json` with the one in `bundle_state`. On a mismatch, or a database without it, it drops the tables the statements create (other tables stay) and runs the statements in one transaction. The seed loads the bundle. After a schema change, run the root `npm run build`. Nothing else is committed.
- The tables are a query layer: `src/db/seed.ts` replaces them from `@openreloading/data/bundle.json`. Edit records in `packages/data`, never rows.
- Read endpoints leave out null fields, as records do (absent means unknown). Compute responses keep the core result shape, where `null` means "not defined".
- Trajectory, truing and interior run on a `node:worker_threads` pool (`src/compute/pool.ts`, tasks in `src/compute/tasks.ts`, entry `src/compute/worker.ts`) with a 5 s deadline per task from submit. The worker of a task past its deadline is terminated. Stability runs on the main thread. Errors cross the thread boundary as plain objects and are rebuilt into `TruingError`, `InputError` or `Error`. Tests that mock core pass `buildApp({ db, compute: inlineRunner })`.
- The step and count caps in `src/compute/schemas.ts` (per integration, for truing also the iteration cap and the step total over all its trajectories) bound the work of a request. An interior run is at most 13 model runs with its range. A ladder runs that per step, up to 21 steps, in batches of 4 within 14 s and at most 100000 output points: no batch starts once the steps run so far are above it (`compute/interior-run.ts`).
- `@openreloading/api/compute` (`src/compute/browser.ts`): `runInterior`, `runChargeTarget` (record lookups passed in), the body schemas, `errorAnswer` and the task runner without Fastify, the database or Node APIs. The web app's Pages edition runs it in the browser. At run time it imports only core, schema and zod (`test/compute-imports.test.ts`). The web image builds only it (`tsconfig.compute.json`).
- `@openreloading/api/static` (`src/static.ts`, build time only, PGlite is a dev dependency): `startBundleApi` (this API on PGlite seeded from the bundle, compute in its thread) and `writeStaticApi` (the read answers as the Pages edition's data files).
- Dockerfile build context is the repository root: `docker build -f packages/api/Dockerfile .`
