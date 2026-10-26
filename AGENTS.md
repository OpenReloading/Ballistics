# OpenReloading

## Commands (repository root)

- Install: `npm ci`
- Lint and format check: `npm run lint` (Biome). Apply fixes: `npm run format`
- Build all: `npm run build`, before `typecheck`, `test` and `data:validate` (workspaces import each other's `dist/`)
- Type check all: `npm run typecheck`
- Package import rules: `npm run deps:check` (after `build`: workspace imports resolve to `dist/`)
  - dependency-cruiser with the rules of `.dependency-cruiser.cjs`, each named in its failure. It reads the sources of schema, core, drawing, importers, data, api and `apps/web/src` (not tests, scripts or configuration files), and the compiled files of importers, where a type import is erased, so any import of schema there is a runtime one.
  - Rules: core imports only itself; drawing's folders import the folders of the matrix in the config (core; cartridge and bullet with core; seating with core, cartridge and bullet; target alone) and nothing outside `src`; importers import schema only, and only for types; schema imports no workspace package; data imports schema only; api imports core, data and schema only; the web app imports no `node:` module, and of data and api only `data/plausibility` and `api/compute` and `api/catalogue`; no import may be unresolvable (else a rule would pass without seeing it).
  - The swc parser reads the TypeScript (dependency-cruiser supports TypeScript below 7): it does not tell `import type` from an import, so a type import counts too.
  - `tools/test/deps.test.ts` runs the config over `tools/test/fixtures/deps-rules.json`, a mirror of the layout with the rule each forbidden import breaks. A new rule gets a violating and an allowed file there.
- Doc comments: `npm run docs:check` (after `build`)
  - TypeDoc `validation.notDocumented`, warnings as errors, on every export of schema, core, drawing, importers, data and api. Not on properties, constructors, parameters and references. Without `notExported`.
  - Configured in `packages/<name>/typedoc.json`, the shared options in `packages/typedoc.base.json`.
  - A variable type, parameter type or return type of an exported variable or function that renders longer than 100 characters fails (`apps/docs/check.mjs`): give it a named type or interface. Zod schemas are exempt, their doc comment links the inferred type.
- Test schema, core, importers, drawing, data, api, web, the docs checks, the tools and the e2e script helpers: `npm test`
  - Coverage: the `test` script of schema, core, importers, drawing, data and api is `vitest run --coverage` (v8, summary in the log, so the CI `test` groups run it). The floors (`coverage.thresholds`) and the excluded files, each with its reason, are in `packages/<name>/vitest.config.ts`. A floor is the measured value rounded down, minus one: raise it in the same pull request when coverage rises, never lower it to make a check pass.
  - A single file or test runs without coverage: `npx vitest run <file>` in the package.
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
  - `npm run test:e2e`: API running on `API_URL` (default `http://localhost:3000`), web app on `WEB_URL` (default `http://localhost:3001`).
  - In `apps/e2e/`: install the browser once with `npx playwright install --with-deps chromium`.
  - `npm run e2e:smoke`: the smoke spec (home, a cartridge record, the workbench, the forwarding route) against an already running API and web app, no build.
- Pages edition (GitHub Pages, no server): `apps/web/AGENTS.md`, Pages edition.
- One workspace: `npm run <script> -w @open-reloading/<name>`
- CI (`.github/workflows/ci.yml`) runs the checks above except the docs site build and the Pages edition.
  - The required check `check` is the job that waits for `static` (lint, build, typecheck, import rules, docs check, data validation, API breaking changes, audit) and `test (drawing)`, `test (web)`, `test (packages)`, which run in parallel and together run what `npm test` runs. Add a workspace's tests to one of the `test` groups in `ci.yml` when the root `test` script gains it.
  - `e2e` runs against `docker compose up api web`, runs the drawing pixel baseline in the Playwright image (`npm run drawing-baseline -w @open-reloading/e2e`), builds the web app against that API, then runs `node apps/web/scripts/check-prerender.mts` and `npm run e2e:smoke` against that build.
  - On a pull request the `changes` job (`apps/web/scripts/ci-plan.mts`) can skip the `check` job (only prose changed), the `e2e` job (no change to what the API, the web app or the e2e specs read) or that web build (no change to the web app or what it builds from). It can build with `PRERENDER=sample` (no change to record data, record page code or the packages they read). The Turbopack cache (`apps/web/.next/cache/turbopack`) is restored.
  - A push to the default branch or any doubt builds from nothing, every record page prerendered and checked in full.
- Other workflows: `release.yml` (release-please, images, `apps/docs/docs/release.md`), `pages.yml` (Pages edition from `main`, the preview of `develop` under `develop/`), `pr-title.yml`, `scorecard.yml`. Tools, rules and their free terms: `apps/docs/docs/ci-tools.md`.
- Commits and pull request titles: Conventional Commits (`CONTRIBUTING.md`).

## Conventions

- Changes start from a GitHub issue. Branches are cut from `develop` and merged back into it; `main` only receives the pull request from `develop` and the release pull request.
- Published to npmjs.com: schema, core, drawing, importers, data (`apps/docs/docs/release.md`). Every other workspace stays `private`.
- Package rules:
  - `packages/core`: no runtime dependencies, no I/O, no database, no HTTP.
  - `packages/importers`: no I/O. Depends on `@open-reloading/schema` for types only.
  - `packages/drawing`: no runtime dependencies, no I/O, no React, DOM or Next.js. Values in stored mm and degrees.
  - `packages/data`: git is the source of truth for records.
  - `packages/api`: depends on core, data and schema.
  - `apps/web`: reads from the API, renders the figure models of `@open-reloading/drawing`. No database access or solver logic in route handlers.
    - The Pages edition's web app runs the API's compute entry (`@open-reloading/api/compute`) in the browser and reads data files the API wrote at build time. The server edition still reads from the API only.
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

- `API_URL`: base URL of the API for e2e tests, the web app (read at build time for static pages and at run time) and the link of the docs REST API page (site build).
- `WEB_URL`: base URL of the web app for the e2e browser tests.
- `NEXT_PUBLIC_REPOSITORY_URL`: URL of the public source repository, inlined at web build time (no Dockerfile `ARG`). Unset (`apps/web/src/lib/repository-url.ts`): no repository link in the header or the drawer. Set only by `pages.yml`, to the repository the workflow runs in.
- `NEXT_PUBLIC_DOCS_URL`: URL of the docs site, inlined at web build time (no Dockerfile `ARG`). Unset (`apps/web/src/lib/docs-url.ts`): no Docs link in the sidebar or the drawer, except in the Pages edition, which links its own `docs/` folder.
- `APP_URL`: URL of the web app, read at docs site build time for the docs navbar's Web app link (`ARG` of `apps/docs/Dockerfile`, set by `compose.yaml`; `tools/src/pages.ts` sets it to the Pages site root from `PAGES_URL`). A full URL; unset: no link.
- `PAGES_BASE_PATH`, `PAGES_URL`, `PAGES_PREVIEW`: Pages edition (`apps/web/AGENTS.md`).
- `PRERENDER`:
  - `sample`: a web build prerenders the records selected in `apps/web/src/lib/prerender-sample.ts`. Every other record renders on its first visit.
  - Unset or any other value: every record.
  - The dev container sets `sample` (`.devcontainer/compose.yaml`). The deploy image, releases and the default branch build in full.
  - Set `PRERENDER=full` for the web build of the full verify (Review and land, step 4), and pass the same value to `check-prerender.mts`.

## Containers

- `compose.yaml`: `api` (`packages/api/Dockerfile`, port 3000), `web` (`apps/web/Dockerfile`, port 3001) and `docs` (`apps/docs/Dockerfile`, the static site on nginx, port 3002). Build context is the repository root. Run: `docker compose up` or `podman compose up`.
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
   - Start the API and the web app: `npm run build -w @open-reloading/web` with `API_URL` set (it also writes `public/sw.js`), then `next start`.
   - Run `WEB_URL=<web app> npm run visual-check -w @open-reloading/e2e -- --preset drawing` (or `--preset calculators`, or page paths such as `/workbench`). It starts no server.
   - Look at `apps/e2e/visual-check-out/sheet.png` (git-ignored, 390 and 1280 px, light and dark).
   - The dev container image holds the e2e Chromium. An older container needs `cd apps/e2e && npx playwright install --only-shell chromium` once.
4. Full verify once, in the dev container: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` and the drawing baseline (`npm run drawing-baseline -w @open-reloading/e2e`).
   - A change to the `exports` of a package the web app imports, to the web app's imports of a package, or to a Dockerfile: also the image build on the host, `podman compose build web` (or `docker compose build web`). CI builds the web image from the Dockerfile with only the files it copies, so a local build over the whole workspace does not show a missing one.
5. Commits signed (`commit.gpgsign` with an SSH key). Never `git filter-branch` (it drops signatures). Re-sign with `git rebase -f --exec 'git commit --amend --no-edit -S' <base>`. Never `--no-verify`.
6. Push, then CI green on the pushed commit.

<!-- benchkeeper:project start -->
- The agent, Git and file edits run on the host. Installs, builds, lint, tests and local MCP or browser tools run in the dev container: prefix `devcontainer exec --workspace-folder .`, compound commands as `devcontainer exec --workspace-folder . sh -lc '...'`. If the container cannot start, report it and stop that command.
- UI screens and user-facing text: load the designing-technical-uis skill first.
<!-- benchkeeper:project end -->
