# Agent manual

Ballistics: a web app, a REST API, a CLI and libraries for handloading, whose results are simulations, not load data. The full process is in [CONTRIBUTING.md](CONTRIBUTING.md); this file holds what an agent needs on every change.

## Commands

Run them in the dev container (`.devcontainer/`): `devcontainer exec --workspace-folder . <command>`.

- Install: `pnpm install` (also the pre-commit hook: Oxlint and Biome on the staged files).
- Build: `pnpm run build`. The workspaces import each other's `dist/`, so build before a typecheck or a test.
- Typecheck `pnpm run typecheck`, lint `pnpm run lint`, format and safe fixes `pnpm run format`.
- Tests: `pnpm test` (all but the browser tests). End-to-end: `pnpm run static:build`; then, each left running, `pnpm run pages:serve` (the export, port 3003) and `pnpm --filter @open-reloading/api start` (the API, port 3000); then `pnpm run test:e2e`.
- Records `pnpm run data:validate`; API contract `pnpm run api:check`, and `pnpm run api:conformance` against a running API.
- Changed-files check: `pnpm run check:changed` (after `git fetch origin`): build, typecheck and lint, the tests of the workspaces changed since `origin/main` and of those that depend on them, and the e2e unit tests.

## Before you push

- Run `pnpm run check:changed` after your last edit, right before every push. Never use `--no-verify`.
- Don't poll CI: wait with `gh run watch <run-id> --compact --exit-status` or `gh pr checks --watch`.
- `main` stays releasable. A red `main` is fixed before anything else merges.

## Code

- Reuse before reimplementing: before you write new logic, look for code that already does it, and extend or generalize that instead of building a parallel version.
- Don't reinvent the wheel: when a well-maintained open-source package solves the problem (recent releases, a license in `allow-licenses` of [`.github/dependency-review-config.yml`](.github/dependency-review-config.yml), a size that fits the [weight budget](apps/web/weight-budget.json)), use it instead of writing our own, and name it and the reason in the pull request. A few lines of our own still beat a new dependency.
- Comments only where the code cannot say it: one line, the why, not the how.
- Names: never call a file, folder or module `utils`, `helpers`, `common`, `misc` or `shared`. Name it after what it contains. A file that wants such a name has more than one job: split it.
- UI: colors, spacing and sizes come from the tokens, the CSS custom properties of [`apps/web/src/app/globals.css`](apps/web/src/app/globals.css) and the control sizes of [`apps/web/src/lib/theme.ts`](apps/web/src/lib/theme.ts), on Mantine components. No new colors, font sizes, spacing or shadows when a token already covers the role.
- Wording: results are simulations, not load data. No text calls a load or a result safe.

## Tests

- Do not add tests by default. Add one only when it fails if your change is reverted, hardcodes its expected values (never computed by production code, locale files or mocks), and runs at the single layer that owns the behavior.
- Never test copy or translations, CSS classes, constants, third-party libraries, private state, timing or call counts. When you touch such a test, delete it instead of updating it.
- There are no coverage thresholds.

## Every change considers

- Current browsers and phones: the versions and widths of [Supported browsers](apps/docs/docs/browsers.md) (320 and 390 CSS px).
- Offline use: the app is a PWA ([`apps/web/src/app/manifest.ts`](apps/web/src/app/manifest.ts)) whose service worker keeps it working without a network (the offline layer: [`apps/web/src/lib/offline.ts`](apps/web/src/lib/offline.ts), [`apps/web/src/service-worker.js`](apps/web/src/service-worker.js)).
- English and German: every interface text goes through the catalogs of [Translating the interface](apps/docs/docs/translating.md).

Footguns, read before changing the area:

- [e2e: clicks, hovers and timing](docs/agents/footguns/e2e-clicks.md)
- [The pinned Playwright image](docs/agents/footguns/playwright-image.md)
- [Releases (release-please)](docs/agents/footguns/release-please.md)

## Pointers

- [CONTRIBUTING.md](CONTRIBUTING.md): setup, rules, commits and pull requests, releases.
- [GLOSSARY.md](GLOSSARY.md) and [docs/agents/domain.md](docs/agents/domain.md): the terms to use.
- [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md): where work items live.
- [CI tools](apps/docs/docs/ci-tools.md) and [Releases and versions](apps/docs/docs/release.md).
