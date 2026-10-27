# Contributing

Where questions, ideas, bugs and record requests go: [README](README.md#community-and-contributing).

## Setup

- Node 26 (`.nvmrc`) and npm, or the dev container in `.devcontainer/` (Node 26, Playwright Chromium, oasdiff, Schemathesis). The dev container runs with rootless podman only (`userns_mode: keep-id` in `.devcontainer/compose.yaml`, which Docker Engine does not accept).
- `npm ci`, then `npm run build` (workspaces import each other's `dist/`).
- `npm ci` also installs a pre-commit hook into this repository's hooks folder (`hooks/install.mjs`, shared by every git worktree). A commit runs Biome on the staged files, the rules of `npm run lint`, and is refused with Biome's message on a finding; `npm run format` applies the safe fixes. It runs no tests or type checks, and CI runs the same Biome check on every pull request.
  - The hook runs `node_modules/.bin/biome` of the checkout. With git on the host and `npm ci` run in the dev container, that is the container's install on the bind-mounted checkout (Linux host): the container need not be running. Where that binary does not run on the host (another operating system, no `npm ci` yet), the hook says so and the commit goes on unchecked: run `devcontainer exec --workspace-folder . npm run lint` before the pull request.
  - A `core.hooksPath` of your own, or a `pre-commit` hook already in the hooks folder, is left alone and the install says so in one line. The hook is not installed in CI.
- Every command, environment variable and container: [AGENTS.md](AGENTS.md).

## Before a pull request

- `npm run build`, `npm run typecheck`, `npm run lint` (`npm run format` applies the fixes), `npm test`.
- Record changes: `npm run data:validate`.
- API changes, in the dev container (the checks need oasdiff and Schemathesis): `npm run api:check` (a breaking change also rewrites the baseline: `npm run api-baseline -w @open-reloading/tools`) and `npm run api:conformance` against a running API.
- CI (`.github/workflows/ci.yml`) also runs `npm run docs:check`, `npm audit` (`tools/src/audit.ts`: high and critical advisories, except the allowlisted ones without a fix), the licence policy (`tools/src/licences.ts`: licences of the production dependencies of the API image and the web app, and the list of them in `NOTICE`), the API contract checks, the e2e tests, the drawing baseline, the workflow lint (actionlint, zizmor) and the dependency review.

## Rules

- Every record carries its source (provenance), and the terms where the source states them; values taken as facts carry a page citation.
- Results are simulations, not load data: no wording that calls a load or a result safe.
- Code conventions, stored units and package rules: [AGENTS.md](AGENTS.md#conventions).

## Commits and pull requests

- Commit messages and pull request titles follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/): `<type>(<scope>): <summary>`.
  - Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`, `style`.
  - Scope (optional): the workspace or area, for example `core`, `api`, `web`, `data`, `schema`, `drawing`, `importers`, `tools`, `e2e`.
  - Breaking change: no marker before 1.0.0. From 1.0.0 on, `!` after the type or scope, or a `BREAKING CHANGE:` footer.
- Commits are signed (`git commit -S`, or `commit.gpgsign` with an SSH or GPG key).
- Branches: `main` is the only long-lived branch and cannot be deleted or force-pushed. Cut a short-lived branch from it, named `<type>/<issue>-<slug>` (for example `fix/123-powder-search`), and open the pull request against `main`. Delete the branch after the merge.
- Pull requests are squash-merged into `main`, so history stays linear. The title becomes the commit on `main` and the changelog line, so the `PR title` check enforces the format.
- Reference the issue in the description (`Closes #123`).

## Releases

- The release pull request is merged automatically every Monday at 05:00 UTC (the label `hold` skips a week; the owner can also start the merge by hand): [Releases and versions](apps/docs/docs/release.md)
- CI tools and their settings: [CI tools](apps/docs/docs/ci-tools.md)
