# OpenReloading

## Commands (repository root)

- Install: `npm ci`
- Lint and format check: `npm run lint` (Biome). Apply fixes: `npm run format`
- Build all: `npm run build` (the packages, in dependency order), before `typecheck`, `test` and `data:validate` (workspaces import each other's `dist/`). The web app is not part of it: it builds as the static export (`npm run static:build`, `npm run pages -w @open-reloading/tools`), which starts the API over the data bundle for the build.
- Pre-commit hook: `npm ci` (root `postinstall`, `hooks/install.mjs`) writes a stub into the repository's own hooks folder (shared by every worktree) that runs `hooks/pre-commit`: Biome on the staged files (`biome check --staged --error-on-warnings`), nothing else, skipped in CI.
  - It never sets `core.hooksPath` and leaves a `core.hooksPath` or a foreign `pre-commit` hook alone (one message line at install). Re-run `npm install` after you unset your own.
  - It runs the checkout's `node_modules/.bin/biome` on the host, where git runs. `npm ci` in the dev container fills the bind-mounted `node_modules`, so the container itself need not run. Where that binary does not run (no install yet, not Linux), the hook prints one line and lets the commit through: run `npm run lint` in the dev container.
  - `tools/test/hooks.test.ts` covers the install and the hook. Never `--no-verify`.
- Type check all: `npm run typecheck`
- Package import rules: `npm run deps:check` (after `build`: workspace imports resolve to `dist/`)
  - dependency-cruiser with the rules of `.dependency-cruiser.cjs`, each named in its failure. It reads the sources of schema, core, drawing, importers, data, api and `apps/web/src` (not tests, scripts or configuration files), and the compiled files of importers, where a type import is erased, so any import of schema there is a runtime one.
  - The rules for core, drawing, importers, schema, data, api and the web app are in `.dependency-cruiser.cjs`, each with a comment. No import may be unresolvable (else a rule would pass without seeing it).
  - The swc parser reads the TypeScript, because dependency-cruiser 18.7.0 lists TypeScript below 7 as its supported range (`depcruise --info`). It does not tell `import type` from an import, so a type import counts too.
  - `tools/test/deps.test.ts` runs the config over `tools/test/fixtures/deps-rules.json`, a mirror of the layout with the rule each forbidden import breaks. A new rule gets a violating and an allowed file there.
- Unused code: `npm run knip` (after `build`)
  - knip over every workspace, configured in `knip.jsonc`. Fails on an unused file, export, exported type or dependency, and on an unlisted binary.
  - The `exports` of a package point into `dist`, which knip cannot map back to `src`, so each entry file of a package is listed in `knip.jsonc`. A new entry file (a package export, a worker, a script run by Node or CI) is added there. Every `ignore*` entry carries a one-line reason.
  - A finding is fixed: drop the `export` of a symbol used only in its file, delete code nothing uses. `tools/test/knip.test.ts` checks that knip fails on each kind.
- Research log entries (`apps/docs/docs/research/`): `npm test -w @open-reloading/docs` checks that each has every section of the template (`apps/docs/scripts/research-log.mts`). A spike or model-change issue ends with an entry and is closed with its link (`CONTRIBUTING.md`, Rules).
- Doc comments: `npm run docs:check` (after `build`)
  - TypeDoc `validation.notDocumented`, warnings as errors, on every export of schema, core, drawing, importers, data and api. Not on properties, constructors, parameters and references. Without `notExported`.
  - Configured in `packages/<name>/typedoc.json`, the shared options in `packages/typedoc.base.json`.
  - A variable type, parameter type or return type of an exported variable or function that renders longer than 100 characters fails (`apps/docs/check.mjs`): give it a named type or interface. Zod schemas are exempt, their doc comment links the inferred type.
- Test schema, core, importers, drawing, data, api, web, the docs checks, the tools and the e2e script helpers: `npm test`
  - Coverage: the `test` script of schema, core, importers, drawing, data and api is `vitest run --coverage` (v8, summary in the log, so the CI `test` groups run it). The floors (`coverage.thresholds`) and the excluded files, each with its reason, are in `packages/<name>/vitest.config.ts`. A floor is the measured value rounded down, minus one: raise it in the same pull request when coverage rises, never lower it to make a check pass.
  - A single file or test runs without coverage: `npx vitest run <file>` in the package.
- Web JavaScript budget per route: `npm run check-weight -w @open-reloading/web` (after `npm run static:build`, which leaves `.next` for it; details in `apps/web/AGENTS.md`). CI runs it in the `e2e` job after the export build.
- Evaluate the interior model on load rows (after `build`, details in `packages/cli/AGENTS.md`): `node packages/cli/dist/bin.js verify --rows <path>`, `node packages/cli/dist/bin.js compare ...`. Rows are passed by path and never committed.
- Validate data records: `npm run data:validate`
- Docs site (Docusaurus, `apps/docs`): `npm run site:build -w @open-reloading/docs` (after `build`)
  - Generated, git-ignored: the TypeDoc site of the six packages (`static/library/`, configured by `apps/docs/typedoc.config.mjs` with the landing page `apps/docs/library.md`), served at `/library/`, the REST API page (`static/rest/`: the API document, the Scalar viewer and its page, `scripts/openapi.mts`), served at `/rest/`. Its link to the API's own reference (`/v1/reference/`) uses `API_URL`, no link when it is unset.
  - Search: after the build, `scripts/search.mts` writes the Pagefind index of the docs pages, the TypeDoc pages and one record per REST operation to `build/pagefind/` (the TypeDoc pages in `build/pagefind-library/`, merged with a lower weight). The navbar search (`src/theme/SearchBar.tsx`) reads it, so `docusaurus start` has no search.
  - Hand-written pages go in `apps/docs/docs/`. Navbar sections are the sidebars of `sidebars.ts`: Models, Data, Contributing.
  - The navbar's repository widget (`src/components/RepoWidget.tsx`) shows the release tag, stars and forks that `scripts/repo-facts.mts` reads from the GitHub API once per build (`GITHUB_TOKEN` lifts the rate limit, `pages.yml` sets it). The browser makes no request to GitHub. A failed request leaves the facts out of the build, they are as fresh as the last deploy.
  - `DOCS_URL` and `DOCS_BASE_URL` set the origin and the path for a sub directory on GitHub Pages.
- API contract (after `build`, details in `tools/AGENTS.md`):
  - Both need the dev container, which installs oasdiff and Schemathesis.
  - `npm run api:check`: breaking changes against `packages/api/openapi.baseline.json`. A break passes only with the baseline rewritten by `npm run api-baseline -w @open-reloading/tools` in the same pull request.
  - `npm run api:conformance`: Schemathesis against the running API at `API_URL`.
  - The contract version is the `@open-reloading/api` version. Every public route is under `/v1`.
- E2E (projects and when to run which: `apps/e2e/AGENTS.md`):
  - `npm run test:e2e`: the static export served on `WEB_URL` (default `http://localhost:3003`: `npm run static:build`, then `npm run pages:serve`) and the API on `API_URL` (default `http://localhost:3000`, `node packages/api/dist/server.js`), which the smoke spec's comparison and the load file spec read.
  - In `apps/e2e/`: install the browser once with `npx playwright install --with-deps chromium`.
  - `npm run e2e:smoke`: the smoke spec (the pages, the exported data files and the workbench's example run against the API's answers) against an already running export and API, no build.
- The static site (GitHub Pages, no server): `apps/web/AGENTS.md`, Static site.
- Static loop (the web app on data files, no API to start; details in `apps/web/AGENTS.md`, Static site, and `apps/e2e/AGENTS.md`), after `npm run build`:
  - Develop: `npm run dev:static` (http://localhost:3000, `PORT` for another).
  - Review and test: `npm run static:build` (sample export of the site root into `pages/`), `npm run pages:serve` (http://localhost:3003, the default `WEB_URL`), then `npm run visual-check -w @open-reloading/e2e -- --preset drawing`, `npm run drawing-baseline -w @open-reloading/e2e` and `npm run test:e2e` (the last with the API on `API_URL`).
- One workspace: `npm run <script> -w @open-reloading/<name>`
- CI (`.github/workflows/ci.yml`) runs the checks above except the docs site build and the Pages site.
  - The required checks of the `main` ruleset are `check`, `e2e`, `workflows`, `conventional`, `dependency-review` and the SonarQube Cloud check `SonarCloud Code Analysis` (a GitHub App, no workflow in the repository) (`apps/docs/docs/ci-tools.md`). Pull requests enter `main` through a squash merge queue, so `ci.yml` and `pr-title.yml` also run on `merge_group` (no push run). `check` is the job that waits for `static` (lint, build, typecheck, import rules, docs check, data validation, API breaking changes, audit, licence policy) and `test (drawing)`, `test (web)`, `test (packages)`, which run in parallel and together run what `npm test` runs. `check` itself also runs lychee offline over the tracked Markdown files (relative links and anchors, `lychee.toml`), on every run including a prose-only one (the command is in `ci.yml`), and runs typos over the tracked text files (`_typos.toml`, which typos skips itself: the records, lockfile, snapshots and golden files are excluded, each accepted term has its reason there; run `typos` from the repository root with a binary from https://github.com/crate-ci/typos/releases). Add a workspace's tests to one of the `test` groups in `ci.yml` when the root `test` script gains it.
  - `e2e` starts the API from `docker compose up api` and runs Schemathesis against it. It builds the static export (`npm run pages -w @open-reloading/tools`, with `--sample` or `--no-docs`) and runs `npm run check-weight -w @open-reloading/web` and `node apps/web/scripts/check-prerender.mts` on it. It serves the export with `tools/src/pages-serve.ts` at `WEB_URL`, runs `npm run test:e2e` (project `full`) and the drawing pixel baseline in the Playwright image (`npm run drawing-baseline -w @open-reloading/e2e`).
  - On a pull request the `changes` job (`apps/web/scripts/ci-plan.mts`) can skip the `check` job (only prose changed) or the `e2e` job (no change to what the API, the web app, the export scripts or the e2e specs read). It can export with `PRERENDER=sample` (no change to record data, record page code or the packages they read): the cartridge pages of the sample only. A spec that opens a cartridge record has it in the sample (`apps/web/src/lib/prerender-sample.ts`). The Turbopack cache (`apps/web/.next/cache/turbopack`, key prefix `next-export`) is restored.
  - A merge queue run or any doubt builds from nothing, every record page prerendered and checked in full.
- Other workflows: `links.yml` (daily lychee run over the external links of the Markdown files, one open issue "Broken external links" with the report), `release.yml` (release-please, the API image with provenance and SBOM, `apps/docs/docs/release.md`), `release-weekly.yml` (merges the release pull request every Monday 14:00 Europe/Berlin, or when started by hand; the label `hold` skips a week), `pages.yml` (the Pages site: root = latest release built from its tag, `/next/` = `main`, `apps/web/AGENTS.md`, Static site), `pr-title.yml`, `scorecard.yml`. Tools, rules and their free terms: `apps/docs/docs/ci-tools.md`.
- Commits and pull request titles: Conventional Commits (`CONTRIBUTING.md`).

## Conventions

- Changes start from a GitHub issue. `main` is the only long-lived branch: branches are short-lived, cut from `main` and squash-merged back into it; the release pull request of release-please also targets `main`.
- To be published to npmjs.com (off until the repository variable `NPM_PUBLISH` is `true`): schema, core, drawing, importers, data (`apps/docs/docs/release.md`). Every other workspace stays `private`.
- Package rules (`npm run deps:check` checks them):
  - `packages/core`: no runtime dependencies, no I/O, no database, no HTTP.
  - `packages/importers`: no I/O. Depends on `@open-reloading/schema` for types only.
  - `packages/drawing`: no runtime dependencies, no I/O, no React, DOM or Next.js. Values in stored mm and degrees.
  - `packages/data`: git is the source of truth for records.
  - `packages/api`: depends on core, data and schema.
  - `packages/cli`: depends on core, data, drawing and schema, never on the API or the web app. No model logic of its own.
  - `apps/web`: reads from the API, renders the figure models of `@open-reloading/drawing`. No database access or solver logic in route handlers.
    - The web app is a static export: it runs the API's compute entry (`@open-reloading/api/compute`) in the browser and reads data files the API wrote at build time. Only the build reads the API itself, for the record pages.
- Mantine docs: the Mantine MCP server (`.mcp.json`, `.codex/config.toml`) or the docs index https://mantine.dev/llms.txt.
- ECharts docs (interior chart): the docs index https://echarts.apache.org/en/llms.txt.
- Reference material (books, papers, other programs' code): never copied. Describe equations in your own words with a citation. Exceptions:
  - Measurement data a publication releases under CC BY 4.0 is imported as values, with authors, DOI and `license` in the source.
  - Values from reports written by US Government employees and approved for unlimited release are public domain in the US (17 U.S.C. 105, outside the US unverified).
- TypeScript 7, ESM, Vitest, Biome (2 spaces, single quotes, no semicolons) in every workspace. `apps/docs` uses TypeScript 6 and `node --test`.
- `exactOptionalPropertyTypes` is on in `tsconfig.base.json` and `apps/web/tsconfig.json`. An optional property that may be given as `undefined` says `| undefined`, else the call site leaves it out (a spread of the prop when it has a value, for a component prop that rejects `undefined`). Options merged over defaults take `Settings<T>` and merge with `overlay` of `@open-reloading/core`, not a spread.
- `noUncheckedIndexedAccess`, `noImplicitOverride` and `noFallthroughCasesInSwitch` are on in `tsconfig.base.json`, `apps/web/tsconfig.json` and `apps/docs/tsconfig.json`. An indexed read is restructured so the loop proves it, guarded, or read through `nth` (core, web) or a test `defined`/`nth` helper that throws; a `!` or cast needs a one-line invariant comment.
- Relative imports end in `.ts` (rewritten to `.js` by `tsc`). Only erasable TypeScript syntax, so Node runs sources directly.
- Comments, docs, test names and commit messages never say who asked for something, who decided it or when. A comment explains why only where the code cannot show it.
- No migrations before 1.0: databases are rebuilt, files of an older format are rejected.
- Before 1.0 no package or data format version is bumped (data formats are version 1, packages are set to 0.0.1 at the public release), and commits carry no breaking marker.
- Every record carries provenance. One stored unit per quantity (`packages/schema/src/units.ts`).
- A change to a model's code updates its model page in `apps/docs/docs/models/` in the same commit.
- Results are simulations, not load data. No "safe" claims (see `README.md`), on screen and in docs. Printed pages and downloaded files carry no Safety text and no notice.

## Environment

- `API_URL`: base URL of the API for e2e tests, the web app (read at build time for the record pages, and by the dev server) and the link of the docs REST API page (site build).
- `WEB_URL`: base URL of the static export for the e2e browser tests (default `http://localhost:3003`).
- `NEXT_PUBLIC_REPOSITORY_URL`: URL of the public source repository, inlined at web build time. Unset (`apps/web/src/lib/repository-url.ts`): no repository link in the header or the drawer. Set only by `pages.yml`, to the repository the workflow runs in.
- `NEXT_PUBLIC_DOCS_URL`: URL of the docs site, inlined at web build time. Unset (`apps/web/src/lib/docs-url.ts`): no Docs link in the sidebar or the drawer, except where the site has its own `docs/` folder, which the link then opens.
- `NEXT_PUBLIC_NO_DOCS`: set by `npm run static:build` and `npm run dev:static`, which build no docs site: the link to the site's own `docs/` folder is left out.
- `APP_URL`: URL of the web app, read at docs site build time for the docs navbar's Web app link. Set only by `tools/src/pages.ts` for the docs of the Pages site, to the app's root (`<site root>/next/` for the next edition, from `PAGES_URL`). A full URL; unset (the docs image, a local docs build): no link.
- `PAGES_BASE_PATH` (default `''`, the site root), `PAGES_EDITION`, `PAGES_URL`: the static site (`apps/web/AGENTS.md`, Static site).
- `PRERENDER`:
  - `sample`: a web build prerenders the records selected in `apps/web/src/lib/prerender-sample.ts` and leaves out the other cartridge pages, which a static host answers with 404. The export (`pages.ts`) takes the mode from `--sample` and never from this variable.
  - Unset or any other value: every record.
  - The dev container sets `sample` (`.devcontainer/compose.yaml`). Releases, the Pages deployment and the default branch build in full.
  - `check-prerender.mts` reads it too: give it the mode of the export it checks (`full` for the full verify, Review and land, step 4, built with `npm run pages -w @open-reloading/tools -- --no-docs`).

## Containers

- `compose.yaml`: `api` (`packages/api/Dockerfile`, port 3000) and `docs` (`apps/docs/Dockerfile`, the static site on nginx, port 3002). Build context is the repository root. Run: `docker compose up` or `podman compose up`.
- The API image is the only image `release.yml` publishes. The web app has none: it is the static export, which any static host serves (README, Try it).
- `.devcontainer/`: Node 26 dev container.
  - Rootless podman only: the `app` service sets `userns_mode: keep-id`, which Docker Engine does not accept.
  - `initializeCommand` writes `.devcontainer/.env` (git-ignored), so the workspace and, in a git worktree, the shared git directory are mounted at their host paths.
- The image adds the Mantine MCP server, Playwright MCP with Chromium and the Chromium headless shell of the e2e `@playwright/test` version, both in `/ms-playwright`.
  - When `@playwright/test` changes in `package-lock.json`, change the version in `.devcontainer/Dockerfile` too. Else `postCreateCommand` downloads the build into each new container.
  - `.mcp.json` and `.codex/config.toml` start these MCP servers in the container through `devcontainer exec`.
- Agents (Claude Code, Codex) run on the host in the repository or worktree. Host file edits and git stay on the host.
  - Start the container: `devcontainer up --docker-path podman --workspace-folder .`
  - Run install, build, lint, tests and e2e inside it: `devcontainer exec --docker-path podman --workspace-folder . <command>`, compound commands as `... sh -lc 'npm run build && npm test'`.
  - Services on the host (for example the `compose.yaml` stack) are reached from the container at `host.containers.internal`.
- Node version: 26 (`.nvmrc`, `engines`, images).

## Review and land

In order, before a change reaches the default branch:

1. Issue done: every acceptance criterion met.
2. Review of the diff by a second reader, a person or a review agent. Findings left unfixed become issues.
3. UI change:
   - Build and serve the export: `npm run static:build`, then `npm run pages:serve` (http://localhost:3003).
   - Run `npm run visual-check -w @open-reloading/e2e -- --preset drawing` (or `--preset calculators`, or page paths such as `/workbench`), with `WEB_URL` set for another address. It starts no server.
   - Look at `apps/e2e/visual-check-out/sheet.png` (git-ignored, 390 and 1280 px, light and dark).
   - The dev container image holds the e2e Chromium. An older container needs `cd apps/e2e && npx playwright install --only-shell chromium` once.
4. Full verify once, in the dev container: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, the full export (`npm run pages -w @open-reloading/tools -- --no-docs`) served by `npm run pages:serve`, `npm run check-weight -w @open-reloading/web`, `PRERENDER=full node apps/web/scripts/check-prerender.mts`, `npm run test:e2e` with the API running, and the drawing baseline (`npm run drawing-baseline -w @open-reloading/e2e`).
   - A change to the `exports` of a package the web app imports, to the web app's imports of a package, or to a Dockerfile: also that image's build on the host, `podman compose build api` or `docs` (or `docker compose build ...`). CI builds the API image only (the `e2e` job and `release.yml`), from the files its Dockerfile copies, so a local build over the whole workspace does not show a missing one.
5. Commits signed (`commit.gpgsign` with an SSH key). Never `git filter-branch` (it drops signatures). Re-sign with `git rebase -f --exec 'git commit --amend --no-edit -S' <base>`. Never `--no-verify`.
6. Push, then CI green on the pushed commit.
