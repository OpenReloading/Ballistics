# OpenReloading

Details per folder are in the `AGENTS.md` of `apps/web`, `apps/e2e`, `tools` and each package. Setup and the pre-commit hook: `CONTRIBUTING.md`. CI jobs, tools and their rules: `apps/docs/docs/ci-tools.md`. Releases: `apps/docs/docs/release.md`.

## Commands (repository root)

- Install: `npm ci`. It also installs the pre-commit hook (`hooks/install.mjs`, `hooks/pre-commit`): Biome on the staged files, the checkout's `node_modules/.bin/biome` run on the host. It never sets `core.hooksPath` and leaves a foreign hook alone; where the binary does not run, it lets the commit through, so run `npm run lint` in the dev container. `tools/test/hooks.test.ts` covers it. Never `--no-verify`.
- Lint and format check: `npm run lint` (Biome). Apply fixes: `npm run format`.
- Build: `npm run build` (the packages in dependency order). Run it before `typecheck`, `test`, `data:validate`, `deps:check`, `knip`, `pack:check` and `docs:check`: workspaces import each other's `dist/`. The web app is not part of it, it builds as the static export (below).
- Type check: `npm run typecheck`
- Test: `npm test` (schema, core, importers, drawing, data, api, cli, web, the docs checks, the tools, the e2e script helpers).
  - Schema, core, importers, drawing, data, api and cli run `vitest run --coverage` with floors in `packages/<name>/vitest.config.ts`. A floor is the measured value rounded down, minus one: raise it when coverage rises, never lower it to pass. One file without coverage: `npx vitest run <file>` in the package.
  - Web, docs and tools coverage without a threshold: `npm run test:coverage -w @open-reloading/<web|docs|tools>`.
  - Contract baselines (`test/contracts.test.ts` of schema, web and tools, files in `test/golden/`): `npm run baselines` rewrites them in the same pull request as the change; the golden user data file is edited by hand.
- Import rules: `npm run deps:check` (dependency-cruiser, `.dependency-cruiser.cjs`, each rule with a comment). A type import counts as an import. A new rule gets a violating and an allowed file in `tools/test/fixtures/deps-rules.json`.
- Unused code: `npm run knip` (`knip.jsonc`). A new entry file (package export, worker, script run by Node or CI) is listed there; every `ignore*` entry carries a reason. Fix a finding, do not ignore it.
- npm tarballs: `npm run pack:check` (`tools/src/pack-check.ts`).
- Doc comments: `npm run docs:check`. Every export of schema, core, drawing, importers, data and api needs one. A type of an exported variable or function that renders longer than 100 characters fails: give it a named type (Zod schemas exempt).
- Data records: `npm run data:validate`
- API contract (dev container, details in `tools/AGENTS.md`): `npm run api:check` (breaking changes against `packages/api/openapi.baseline.json`; a break passes only with the baseline rewritten by `npm run api-baseline -w @open-reloading/tools` in the same pull request), `npm run api:conformance` (Schemathesis against `API_URL`). The contract version is the `@open-reloading/api` version; every public route is under `/v1`.
- Interior model on load rows and offline compute: `packages/cli/AGENTS.md`. Rows are passed by path and never committed.
- Docs site: `npm run site:build -w @open-reloading/docs` (`apps/docs`). Pages go in `apps/docs/docs/`. A research log entry (`apps/docs/docs/research/`) has every section of the template (`npm test -w @open-reloading/docs`).
- Static site and loop (`apps/web/AGENTS.md`, Static site): `npm run dev:static` (develop), `npm run static:build` (sample export into `pages/`), `npm run pages:build` (full export), `npm run pages:serve` (http://localhost:3003).
- Web JavaScript budget: `npm run check-weight -w @open-reloading/web` after an export build.
- E2E (`apps/e2e/AGENTS.md`): `npm run test:e2e` against the export on `WEB_URL` and the API on `API_URL` (`node packages/api/dist/server.js`); `npm run e2e:smoke` for the smoke spec only. Once in `apps/e2e/`: `npx playwright install --with-deps chromium`.
- One workspace: `npm run <script> -w @open-reloading/<name>`
- Commits and pull request titles: Conventional Commits (`CONTRIBUTING.md`).

## CI

- `.github/workflows/ci.yml` runs the checks above except the docs site build and the Pages site. Required checks of `main`: `check`, `e2e`, `workflows`, `conventional`, `dependency-review`, `SonarCloud Code Analysis`. Pull requests are squash-merged, no merge queue.
- `check` also runs lychee offline over the tracked Markdown files (relative links and anchors, `lychee.toml`) and typos (`_typos.toml`, each accepted term with its reason). A workspace's tests added to the root `test` script also go into one of the `test` groups of `ci.yml`.
- On a pull request the `changes` job (`apps/web/scripts/ci-plan.mts`) can skip `check` (prose only) or `e2e`, and can export with `PRERENDER=sample`. A spec that opens a cartridge record has it in the sample (`apps/web/src/lib/prerender-sample.ts`).
- Other workflows (`apps/docs/docs/ci-tools.md`): `links.yml`, `release.yml`, `release-weekly.yml` (label `hold` skips a week), `pages.yml` (`apps/web/AGENTS.md`, Static site), `pr-title.yml`, `scorecard.yml`.

## Conventions

- Changes start from a GitHub issue. `main` is the only long-lived branch; branches are cut from it and squash-merged back.
- Published to npm (off until the repository variable `NPM_PUBLISH` is `true`): schema, core, drawing, importers, data. Every other workspace stays `private`.
- Package rules (`npm run deps:check` checks them):
  - `packages/core`: no I/O, no database, no HTTP.
  - `packages/importers`: no I/O. Depends on `@open-reloading/schema` for types only.
  - `packages/drawing`: no I/O, no React, DOM or Next.js. Values in stored mm and degrees.
  - A runtime dependency of core or drawing needs a permissive, MIT-compatible licence listed in `allow-licenses` of `.github/dependency-review-config.yml` (also checked by `tools/src/licences.ts`). It is added only for a concrete benefit and only when the library is maintained, widely used and not archived; the change states the benefit and the stars, last commit and weekly downloads. Its import rule in `.dependency-cruiser.cjs` then allows it by name.
  - `packages/data`: git is the source of truth for records.
  - `packages/api`: depends on core, data and schema.
  - `packages/cli`: depends on core, data, drawing, schema and the API's browser entries `@open-reloading/api/compute` and `@open-reloading/api/catalogue` only. No model logic of its own.
  - `apps/web`: a static export that runs `@open-reloading/api/compute` in the browser and reads data files the API wrote at build time; only the build reads the API. Renders the figure models of `@open-reloading/drawing`. No database access or solver logic in route handlers.
- Docs: Mantine https://mantine.dev/llms.txt, ECharts https://echarts.apache.org/en/llms.txt.
- Reference material (books, papers, other programs' code) is never copied: describe equations in your own words with a citation. Exceptions: measurement data released under CC BY 4.0 is imported as values with authors, DOI and `license`; reports by US Government employees approved for unlimited release are public domain in the US (17 U.S.C. 105, outside the US unverified).
- TypeScript 7, ESM, Vitest, Biome (2 spaces, single quotes, no semicolons) in every workspace. `apps/docs` uses TypeScript 6 and `node --test`.
- `exactOptionalPropertyTypes` is on: an optional property that may be given as `undefined` says `| undefined`, else the call site leaves it out. Options merged over defaults take `Settings<T>` and merge with `overlay` of `@open-reloading/core`, not a spread.
- `noUncheckedIndexedAccess`, `noImplicitOverride` and `noFallthroughCasesInSwitch` are on. An indexed read is restructured, guarded, or read through `nth` (core, web) or a test `defined`/`nth` helper; a `!` or cast needs a one-line invariant comment.
- Relative imports end in `.ts`. Only erasable TypeScript syntax, so Node runs sources directly.
- Comments, docs, test names and commit messages never say who asked for something, who decided it or when. A comment explains why only where the code cannot show it.
- No migrations before 1.0: databases are rebuilt, files of an older format are rejected. No package or data format version bump and no breaking marker in commits before 1.0 (data formats are version 1).
- Every record carries provenance. One stored unit per quantity (`packages/schema/src/units.ts`).
- A change to a model's code updates its model page in `apps/docs/docs/models/` in the same commit.
- Results are simulations, not load data. No "safe" claims (`README.md`), on screen and in docs. Printed pages and downloaded files carry no Safety text and no notice.

## Environment

- `API_URL`: the API for e2e tests, the web build and dev server, and the docs REST API page's link.
- `WEB_URL`: the static export for the e2e tests (default `http://localhost:3003`).
- `NEXT_PUBLIC_REPOSITORY_URL`, `NEXT_PUBLIC_DOCS_URL`, `NEXT_PUBLIC_NO_DOCS`: web build time; unset leaves out the repository link and the docs link (`apps/web/src/lib/repository-url.ts`, `docs-url.ts`). `pages.yml` sets the repository URL; `static:build` and `dev:static` set `NEXT_PUBLIC_NO_DOCS`.
- `APP_URL`: the docs navbar's Web app link (set by `tools/src/pages.ts`). `DOCS_URL`, `DOCS_BASE_URL`: the docs site's origin and path. `GITHUB_TOKEN`: lifts the rate limit of the docs build's repository facts.
- `PAGES_BASE_PATH`, `PAGES_EDITION`, `PAGES_URL`: `apps/web/AGENTS.md`, Static site.
- `PRERENDER=sample`: a web build prerenders only the records of `apps/web/src/lib/prerender-sample.ts`; other cartridge pages answer 404. Unset or anything else: every record. The dev container sets it; the export takes the mode from `--sample`, never from the variable. `check-prerender.mts` needs the mode of the export it checks.

## Containers

- `compose.yaml`: `api` (`packages/api/Dockerfile`, port `API_PORT`, default 3000) and `docs` (`apps/docs/Dockerfile`, port `DOCS_PORT`, default 3002). Build context is the repository root. `docker compose up` or `podman compose up`. The API image is the only published image.
- `.devcontainer/`: Node 26, rootless podman only (`userns_mode: keep-id`). `initializeCommand` writes `.devcontainer/.env` so a git worktree's shared git directory is mounted too.
  - The image holds the Mantine MCP server, Playwright MCP and the Chromium headless shell of the e2e `@playwright/test` version. When `@playwright/test` changes in `package-lock.json`, change the version in `.devcontainer/Dockerfile` too.
- Agents run on the host; edits and git stay there. Start the container with `devcontainer up --docker-path podman --workspace-folder .`, run install, build, lint, tests and e2e in it with `devcontainer exec --docker-path podman --workspace-folder . <command>` (compound commands through `sh -lc '...'`). Host services are at `host.containers.internal`.
- Node 26 (`.nvmrc`, `engines`, images).

## Review and land

1. Every acceptance criterion of the issue met.
2. The diff reviewed by a second reader; unfixed findings become issues.
3. UI change: `npm run static:build`, `npm run pages:serve`, then `npm run visual-check -w @open-reloading/e2e -- --preset drawing` (or `calculators`, or page paths) and look at `apps/e2e/visual-check-out/sheet.png`.
4. Full verify once, in the dev container: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, the full export (`npm run pages -w @open-reloading/tools -- --no-docs`) served by `npm run pages:serve`, `npm run check-weight -w @open-reloading/web`, `PRERENDER=full node apps/web/scripts/check-prerender.mts`, `npm run test:e2e` with the API running, `npm run drawing-baseline -w @open-reloading/e2e`.
   - A change to the `exports` of a package the web app imports, to the web app's imports of a package, or to a Dockerfile: also build that image on the host (`podman compose build api` or `docs`). CI builds the API image only, from the files its Dockerfile copies.
5. Commits signed (`commit.gpgsign` with an SSH key). Never `git filter-branch`. Re-sign with `git rebase -f --exec 'git commit --amend --no-edit -S' <base>`. Never `--no-verify`.
6. Push, then CI green on the pushed commit.
