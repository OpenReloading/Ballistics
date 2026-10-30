# @open-reloading/api

Fastify HTTP API exposing `@open-reloading/core` and the data records from the in-process catalogue (`src/catalogue/`, design in `apps/docs/docs/data/catalogue-storage.md`). `src/app.ts` builds the app, `src/server.ts` opens the catalogue and listens. The routes and their bodies are documented in the OpenAPI document (`GET /v1/openapi.json`, viewer at `/v1/reference/`).

## Commands (this directory, or `-w @open-reloading/api` from the root)

- Build: `npm run build` (`dist/`, with the catalogue files in `dist/catalogue/`)
- Dev server: `npm run dev`. Start: `npm start` (`HOST`, `PORT`, default `0.0.0.0:3000`).
- Test: `npm test` (Vitest, `app.inject` over a catalogue of synthetic records). Single test: `npx vitest run <file> -t "<name>"`
- Type check: `npm run typecheck`
- Contract: `npm run api:check` and `npm run api:conformance` at the root (`tools/AGENTS.md`). A breaking change rewrites `openapi.baseline.json` in the same pull request.
- Image: `docker build -f packages/api/Dockerfile .` (context is the repository root).

## Rules

- Every route is under `API_PREFIX` (`/v1`, `src/version.ts`) except the liveness probe `GET /`. `info.version` is `API_VERSION`, this package's version.
- `buildOpenApi` (`src/openapi.ts`) builds the document from each route's `config`: `body` and `query` (zod, every field with a `.describe()` text and its unit), `response` (the zod schema of the 200 body), `errors` (the route's own error statuses), `summary`, `description`, `example`. A new route sets all of them.
- Errors: a 4xx answer keeps its message. Any other error answers 500 with `message: 'internal server error'` and the `requestId`, never the error's text. Core `InputError` (and subclasses) is 422, a compute deadline or full queue 503.
- Read endpoints leave out null fields (absent means unknown). Compute responses keep the core result shape, where `null` means "not defined".
- An id `records/renames.json` replaces answers 308 to the current record.
- Every 200 compute answer carries `inputHash`, `apiVersion` and `dataHash` (`src/routes/identity.ts`). Interior answers carry `notice: "simulation, not load data"`; never a statement that a load is safe.
- Compute bodies are core arguments in SI, validated by the strict zod schemas in `src/compute/`. The step and count caps in `src/compute/schemas.ts` bound the work of a request.
- Trajectory, truing and interior run on a `node:worker_threads` pool (`src/compute/pool.ts`) with a 5 s deadline per task; tests that mock core pass `buildApp({ catalogue, compute: inlineRunner })`.
- Edit records in `packages/data`, never in the catalogue files.

## Entries

- `@open-reloading/api/compute` (`src/compute/browser.ts`): `operations` (each compute `POST` route's schemas, example and run; the routes and the command line read it) and the run functions, without Fastify or Node APIs. The web app runs it in the browser.
- `@open-reloading/api/catalogue` (`src/catalogue/browser.ts`): the catalogue without Node APIs.
- Both import only core, schema and zod at run time (`test/compute-imports.test.ts`).
- `@open-reloading/api/static` (`src/static.ts`, build time only): `startBundleApi` and `writeStaticApi` (the static site's data files). `apps/web/test/static-api.test.ts` checks that the browser answers equal the API's.
