# Contributing

Where questions, ideas, bugs and record requests go: [README](README.md#community-and-contributing).

## Setup

- Node 26 (`.nvmrc`) and pnpm 12 next to it (`npm install --global pnpm@12.16.1`, the version of `.github/pnpm/package.json`; the scripts in `tools/` look for pnpm in Node's folder, not on the `PATH`), or the dev container in `.devcontainer/` (Node 26, Playwright Chromium, oasdiff, Schemathesis). The dev container runs with rootless podman only (`userns_mode: keep-id` in `.devcontainer/compose.yaml`, which Docker Engine does not accept).
- `pnpm install`, then `pnpm run build` (workspaces import each other's `dist/`).
- `pnpm install` also installs a pre-commit hook (`hooks/install.mjs`, shared by every git worktree). It runs Oxlint and Biome with the rules of `pnpm run lint` on the staged files and refuses the commit on a finding; `pnpm run format` applies the safe fixes. It runs no tests or type checks.
  - The hook runs the checkout's `node_modules/.bin/oxlint` and `node_modules/.bin/biome`. With `pnpm install` run in the dev container on a Linux host, the container need not be running. Where those binaries do not run on the host (another operating system, no `pnpm install` yet), the hook says so and the commit goes on unchecked: run `devcontainer exec --workspace-folder . pnpm run lint` before the pull request.
  - An own `core.hooksPath` or an existing `pre-commit` hook is left alone. The hook is not installed in CI.

## Before a pull request

- `pnpm run build`, `pnpm run typecheck`, `pnpm run lint` (`pnpm run format` applies the fixes), `pnpm test`.
- Record changes: `pnpm run data:validate`.
- A change to the exports of `packages/units`, `packages/locale-format`, `packages/statistics` or `packages/ballistics`: `pnpm exec api-extractor run --local` in that folder rewrites its API report (`<name>.api.md`), which the build compares and the pull request shows.
- API changes, in the dev container (the checks need oasdiff and Schemathesis): `pnpm run api:check` (a breaking change also rewrites the baseline: `pnpm --filter @open-reloading/tools run api-baseline`) and `pnpm run api:conformance` against a running API.
- CI (`.github/workflows/ci.yml`) also runs `pnpm run docs:check`, `pnpm audit` (`tools/src/audit.ts`: high and critical advisories, except the allowlisted ones without a fix), the licence policy (`tools/src/licences.ts`: licences of the production dependencies of the API image and the web app, and the list of them in `NOTICE`), the API contract checks, the e2e tests, the drawing baseline, the workflow lint (actionlint, zizmor) and the dependency review.

## Rules

- Every record carries its source (provenance), and the terms where the source states them; values taken as facts carry a page citation.
- Results are simulations, not load data: no wording that calls a load or a result safe.
- Names of the record fields, the user data files and the API bodies, with the terms to avoid: [GLOSSARY.md](GLOSSARY.md).
- A pull request that adds a major user-visible feature adds a news item (`apps/web/news/YYYY-MM-DD-slug.md`: front matter `title` and `link`, two sentences) for the home page's What's new list, reviewed like any file; smaller changes are in the changelogs only.
- Every spike and model-change issue ends with an entry in the [research log](apps/docs/docs/research/index.md) (negative or null results too), from the template on that page, and is closed with a link to it. `pnpm --filter @open-reloading/docs test` fails on an entry that misses a section.

## Data requests, translations and review

- A missing record or wrong data: open an issue with the [data or record request](.github/ISSUE_TEMPLATE/data.yml) form, or with Report an issue in the web app ([report form](.github/ISSUE_TEMPLATE/user-report.yml), type Wrong data). Bugs and features have their own forms ([bug](.github/ISSUE_TEMPLATE/bug.yml), [feature](.github/ISSUE_TEMPLATE/feature.yml)).
- A component record (cartridge, bullet, powder, case, primer) needs a source: name the document or URL.
- Translations: the interface texts, the catalogue files and how to add a language are in [Translating the interface](apps/docs/docs/translating.md).
- Review: every pull request is read by a second reader, a person or a review agent, and enters `main` only with the required checks green: `check`, which waits for every CI job, and `e2e` and `workflows` ([CI tools](apps/docs/docs/ci-tools.md)). A finding that is not fixed in the pull request becomes an issue.

## Commits and pull requests

- Commit messages and pull request titles follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/): `<type>(<scope>): <summary>`.
  - Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`, `style`.
  - Scope (optional): the workspace or area, for example `core`, `api`, `web`, `data`, `schema`, `drawing`, `importers`, `tools`, `e2e`.
  - Breaking change: no marker before 1.0.0. From 1.0.0 on, `!` after the type or scope, or a `BREAKING CHANGE:` footer.
- Commits are signed (SSH or GPG key).
- Branches: `main` is the only long-lived branch. Branch from it as `<type>/<issue>-<slug>` (for example `fix/123-powder-search`) and open the pull request against `main`.
- Pull requests are squash-merged into `main`. The title becomes the commit on `main` and the changelog line; the `PR title` check enforces its format.
- Reference the issue in the description (`Closes #123`).

## Releases

- The release pull request is merged automatically every Monday at 14:00 Europe/Berlin; the label `hold` skips a week ([Releases and versions](apps/docs/docs/release.md)).
- CI tools and their settings: [CI tools](apps/docs/docs/ci-tools.md).
