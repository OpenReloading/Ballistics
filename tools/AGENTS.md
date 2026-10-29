# @open-reloading/tools

Command line tools of the application. Never imported by the API or the web app. ESM, run with Node directly (no build).

## Commands (this directory, or `-w @open-reloading/tools` from the root)

All of them need `npm run build` at the root (`src/openapi.ts` imports `@open-reloading/api/openapi` from `dist`). They run in the dev container, which has `oasdiff` and `schemathesis` (`.devcontainer/Dockerfile`).

- `node src/openapi.ts [baseline]`: writes the API document of the current routes (`buildOpenApi`) to `openapi.json` in the temporary directory (`TMPDIR`), or with `baseline` to `packages/api/openapi.baseline.json`. No path argument.
- API contract check: `npm run api-check` (root: `npm run api:check`)
  - `oasdiff breaking` of `packages/api/openapi.baseline.json` against the current document. Fails on any `ERR` finding.
  - A breaking change passes only after `npm run api-baseline` writes the current document to the baseline in the same pull request, so the baseline diff shows the break in review.
- API conformance: `npm run api-conformance` (root: `npm run api:conformance`)
  - Schemathesis against the running API at `API_URL` (default `http://localhost:3000`). From the dev container, a stack on the host is `http://host.containers.internal:3000`.
  - Checks: no 5xx answer, status codes, content types and response bodies as the document declares them.
- Pages site: `npm run pages` (root: `npm run pages:build`, `src/pages.ts`) with `PAGES_BASE_PATH` (default `''`, the site root) and `PAGES_EDITION`, and `npm run pages:serve` (`src/pages-serve.ts`). What they write and serve: `apps/web/AGENTS.md`, Static site.
- Static loop: `npm run dev:static` (root, `src/static-dev.ts`), and `npm run static:build` (root: `pages` at the site root with `--sample`). Both in `apps/web/AGENTS.md`, Static site.
  - `src/pages.ts` flags: `--sample` (the sample's cartridge pages, no docs site), `--no-docs` (every record, no docs site). `apps/web/.next` stays after a build, for the CI cache and `check-weight`. The CI `e2e` job builds the export with `npm run pages -w @open-reloading/tools -- --no-docs` (or `--sample`).
- Dependency audit: `node src/audit.ts` (CI `check` job). Fails on every high or critical `npm audit` advisory except those in `allowed`, each with a reason. An allowed advisory fails again once npm reports a fix for its package, and an entry npm no longer reports fails too. Needs no build.
- Licence policy: `node src/licences.ts` (CI `check` job, `static`). Reads package-lock.json for the production dependencies of the API image and the web app (`packages/api`, `apps/web`, whose bundles ship in the static site; the packages `notShipped` names left out, platform packages Linux never installs left out). Fails on a licence outside `allow-licenses` of `.github/dependency-review-config.yml` (the file the dependency review step reads) unless the package is in its `allow-dependencies-licenses`, each with a reason on its line, and on a package without a declared licence. Fails when the block between `BEGIN GENERATED` and `END GENERATED` in `NOTICE` differs from the shipped packages: `node src/licences.ts --write` rewrites it. The licence table goes to the job summary. Needs no build.
- npm tarballs: `npm run pack-check` (root: `npm run pack:check`, `src/pack-check.ts`). Runs `npm pack --dry-run --json` in each published library (schema, core, drawing, importers, data) and fails on a missing entry point of `exports`, `main` or `types`, a test file, a source map without its sources, a file outside the `files` field, or a bare import in a packed `.js` or `.d.ts` file that is not in `dependencies` or `peerDependencies` (Node built-ins excepted). Needs `npm run build`.
- Test: `npm test` (Vitest, `test/`)
- Type check: `npm run typecheck`
