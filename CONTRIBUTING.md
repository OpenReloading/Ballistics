# Contributing

Where questions, ideas, bugs and record requests go: [README](README.md#community-and-contributing).

## Setup

- Node 26 (`.nvmrc`) and npm, or the dev container in `.devcontainer/` (Node 26, PostgreSQL, Playwright Chromium, oasdiff, Schemathesis). The dev container runs with rootless podman only (`userns_mode: keep-id` in `.devcontainer/compose.yaml`, which Docker Engine does not accept).
- `npm ci`, then `npm run build` (workspaces import each other's `dist/`).
- Every command, environment variable and container: [AGENTS.md](AGENTS.md).

## Before a pull request

- `npm run build`, `npm run typecheck`, `npm run lint` (`npm run format` applies the fixes), `npm test`.
- Record changes: `npm run data:validate`.
- API changes, in the dev container (the checks need oasdiff and Schemathesis): `npm run api:check` (a breaking change also rewrites the baseline: `npm run api-baseline -w @openreloading/tools`) and `npm run api:conformance` against a running API.
- CI (`.github/workflows/ci.yml`) also runs `npm run docs:check`, `npm audit` (`tools/src/audit.ts`: high and critical advisories, except the allowlisted ones without a fix), the API contract checks, the e2e tests, the drawing baseline, the workflow lint (actionlint, zizmor) and the dependency review.

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
- Branches:
  - `main` holds released code. It takes only the pull request from `develop` and the release pull request.
  - `develop` is where work lands. Cut a branch from it, named `<type>/<issue>-<slug>` (for example `fix/123-powder-search`), and open the pull request against `develop`. `develop` cannot be deleted or force-pushed.
- Pull requests are squash-merged into `main`. The title becomes the commit on `main` and the changelog line, so the `PR title` check enforces the format.
- Reference the issue in the description (`Closes #123`).

## Releases

- [Releases and versions](apps/docs/docs/release.md)
- CI tools and their settings: [CI tools](apps/docs/docs/ci-tools.md)
