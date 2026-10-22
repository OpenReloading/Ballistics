# @openreloading/tools

Command line tools of the application. Never imported by the API or the web app. ESM, run with Node directly (no build).

## Commands (this directory, or `-w @openreloading/tools` from the root)

All of them need `npm run build` at the root (`src/openapi.ts` imports `@openreloading/api/openapi` from `dist`). They run in the dev container, which has `oasdiff` and `schemathesis` (`.devcontainer/Dockerfile`).

- `node src/openapi.ts <file>`: writes the API document of the current routes (`buildOpenApi`).
- API contract check: `npm run api-check` (root: `npm run api:check`)
  - `oasdiff breaking` of `packages/api/openapi.baseline.json` against the current document. Fails on any `ERR` finding.
  - A breaking change passes only after `npm run api-baseline` writes the current document to the baseline in the same pull request, so the baseline diff shows the break in review.
- API conformance: `npm run api-conformance` (root: `npm run api:conformance`)
  - Schemathesis against the running API at `API_URL` (default `http://localhost:3000`). From the dev container, a stack on the host is `http://host.containers.internal:3000`.
  - Checks: no 5xx answer, status codes, content types and response bodies as the document declares them.
- Pages site: `npm run pages` (root: `npm run pages:build`, `src/pages.ts`) with `PAGES_BASE_PATH`, and `npm run pages:serve` (`src/pages-serve.ts`). What they write and serve: `apps/web/AGENTS.md`, Pages edition.
- Dependency audit: `node src/audit.ts` (CI `check` job). Fails on every high or critical `npm audit` advisory except those in `allowed`, each with a reason. An allowed advisory fails again once npm reports a fix for its package, and an entry npm no longer reports fails too. Needs no build.
- Test: `npm test` (Vitest, `test/`)
- Type check: `npm run typecheck`
