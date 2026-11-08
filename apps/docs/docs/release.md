---

title: Releases and versions
sidebar_position: 2
---

# Releases and versions

## Versions

- Each released part has its own version, [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html), in its `package.json`, and its own tag `<component>-vX.Y.Z` and `CHANGELOG.md`: `packages/schema` (`schema`), `packages/drawing` (`drawing`), `packages/importers` (`importers`), `packages/catalog` (`catalog`), `packages/api` (`api`), `packages/cli` (`cli`), `apps/web` (`web`) and `apps/docs` (`docs`), listed in `release-please-config.json`. `apps/e2e`, `tools`, `tooling/test-kit`, `packages/units`, `packages/locale-format`, `packages/statistics`, `packages/ballistics`, `packages/shot-groups` and `packages/use-cases` are not versioned. `schema`, `drawing`, `importers` and `catalog` are published to npmjs.com as `@open-reloading/<name>`, each release as that version, once the repository variable `NPM_PUBLISH` is `true` (step 5 below). `cli` is versioned and not published; `api` is published as a container image, `web` and `docs` are part of the Pages site below (`web` has a version, a tag and a changelog but no image). They are `private` workspaces, as are `apps/e2e` and `tools`.
- A component gets a new version only when a commit since its last release touched its folder. A change only in `packages/units`, `packages/locale-format`, `packages/design-tokens`, `packages/ui`, `packages/statistics`, `packages/ballistics`, `packages/shot-groups` or `packages/use-cases` releases nothing until a listed component that depends on them releases (usually `web`), and it gets no changelog line of its own. The `node-workspace` plugin also raises the patch version of every listed workspace that depends on a changed one. Workspace dependencies are `workspace:*` ranges, which it leaves as they are, so `pnpm-lock.yaml` needs no change on the release branch; `pnpm pack` writes the released version into each tarball.
- The plugin counts dev dependencies as release edges too, also those only tests read (CI selects a test by them): a `catalog` release also releases `drawing`, and a `web` or `cli` release also releases `docs`, each with a changelog note that names only the dependency.
- Every component is released as 1.0.0 in one release pull request: `"release-as": "1.0.0"` on each entry of `packages` in `release-please-config.json` sets that version, and the keys are removed right after that release pull request is merged, so no component is proposed as 1.0.0 a second time. `.release-please-manifest.json` holds the last released version of each component.
- From 1.0.0 on, `fix` raises the patch version, `feat` the minor version, and a breaking change (`!` or a `BREAKING CHANGE:` footer) the major version. Until 1.0.0, commits carry no breaking marker.
- The HTTP API has one version: the version of `@open-reloading/api`. The API document carries it as `info.version` (`packages/api/src/version.ts`), and the REST API page of this site shows it. Every public route is under `/v1`.

## Flow

1. Work lands on `main` by squash-merged pull requests with a Conventional Commits title (CONTRIBUTING.md); that title is the changelog line.
2. On every push to `main`, `release.yml` runs release-please: it opens or updates one release pull request with the next version of each changed component, its `CHANGELOG.md` section and the version in its `package.json`. Only `feat`, `fix`, `perf`, `revert` and `docs` commits appear in the changelogs.
3. Every `main` merge is releasable, but only merging the release pull request releases. `release-weekly.yml` merges it (squash, auto-merge, so it waits for its required checks) every Monday at 14:00 Europe/Berlin, then dispatches `release.yml`. The owner can run it by hand on any other day (Actions, Release weekly, Run workflow), merge the pull request by hand, or put the label `hold` on the pull request to skip a week. A push to `main` that is not that merge tags and publishes nothing. Merging it tags each released component `<component>-vX.Y.Z` and publishes its GitHub Release with that changelog section, marked as a pre-release while the version is below 1.0.0. The images and libraries below are built in the run of that merge.
4. When `api` is released, the same workflow builds `ghcr.io/openreloading/ballistics-api` from that tag, then:
   - scans it with Grype (a fixable critical finding stops the publish)
   - pushes the tags `X.Y.Z`, `X.Y` and `sha-<commit>` (the version of that component)
   - attests its build provenance (`gh attestation verify oci://ghcr.io/openreloading/ballistics-api:X.Y.Z -R OpenReloading/Ballistics`)
   - generates an SPDX SBOM of the image with Syft (a pinned container image, run on the saved image before the registry login), attests it for the pushed digest (`gh attestation verify oci://ghcr.io/openreloading/ballistics-api:X.Y.Z -R OpenReloading/Ballistics --predicate-type https://spdx.dev/Document/v2.3`), and the `sbom-release` job attaches it to the component's GitHub Release as `ballistics-api-X.Y.Z.spdx.json` (a job apart from the image build, so no step that runs image code holds `contents: write`)
5. When `schema`, `drawing`, `importers` or `catalog` is released and the repository variable `NPM_PUBLISH` is `true`, the `publish` job builds those four libraries from the release commit, packs each released one with `pnpm pack` (which writes the version of each `workspace:` dependency into the tarball) and publishes the tarball with `npm publish`, `schema` first (`importers` and `catalog` depend on it). It uses npm trusted publishing (OIDC, `id-token: write`, npm 11.5.1 or later), so the repository holds no npm token, and npm records a provenance statement with each version. A version already on the registry is skipped, so a failed run can be re-run. While `NPM_PUBLISH` is unset the job does not run.

The release pull request is opened with the token of the organization's release GitHub App (`RELEASE_APP_CLIENT_ID`, `RELEASE_APP_PRIVATE_KEY`, [repository settings](ci-tools.md)). GitHub signs the App's API commits (`main` requires signed commits), and a pull request of the App starts its required checks without anyone approving them. Without the App (the variable is unset or the App is not installed on the repository) release-please falls back to the workflow token: the run says so in a warning, and the owner approves the pull request's workflow runs (Approve workflows to run on the pull request). It changes only versions and changelogs.

## Home page news

The web app's home page lists the newest five items of `apps/web/news/`, newest first. Each item is one file `YYYY-MM-DD-slug.md` (the date of the item, a slug of lowercase letters, digits and hyphens) with a front matter of `title` and `link` (an app path such as `/workbench` or a docs URL) and a text of two sentences below it. A file that breaks this format fails the web build. A pull request that adds a user-visible feature adds its item. Release notes stay in the changelogs of each component above.

## Pages site

`pages.yml` builds one site from two sources and deploys it in one deployment (a deployment replaces the whole site):
- The root shows the latest release: the checkout of the newest GitHub Release's tag, built with `pnpm run pages:build`.
- `/next/` shows `main`, built with `PAGES_EDITION=next` (`tools/src/pages.ts`).
- Until the first release exists the root is a page that forwards to `/next/`.

It runs on every push to `main`, when a release is published and on `workflow_dispatch`. A release created with the workflow token starts no workflow of its own, so `release.yml` then dispatches `pages.yml` itself (with the App token, the `release: published` event does).

Both editions share one origin, so the next edition keeps its data under other names: its IndexedDB database, local storage keys and caches are prefixed `next:`, and its service worker has the scope `<site>/next/`. What the next edition stores in the browser is not carried over to the stable edition, and a database that a pre-release version wrote is not read: the app offers to delete it. The stable edition's service worker leaves `/next/` to the network.

## Self-hosting

- The web app is the static `pages/` folder that `pnpm run pages:build` writes (`PAGES_BASE_PATH` is the path the site is served under, empty for a site root). Any static host serves it: the calculations run in the browser, so there is no server process.
- The REST API is the container image `ghcr.io/openreloading/ballistics-api`, one per `api` release (`docker run -p 3000:3000 ghcr.io/openreloading/ballistics-api:X.Y.Z`). `compose.yaml` builds the same image from the repository, next to the docs site.

## npm packages

Publishing is off until the settings below exist, `pnpm run pack:check` passes and the repository variable `NPM_PUBLISH` is set to `true`. `pnpm run pack:check` fails while a published library depends on a private workspace package that npm does not have: today `schema` depends on `@open-reloading/units` and `@open-reloading/statistics`, and `importers` on both as well. Settings outside the repository, once per library (see the [npm documentation on trusted publishers](https://docs.npmjs.com/trusted-publishers)):
1. The npm organization `open-reloading` exists. If npm offers trusted publishing only for an existing package, publish the first version by hand from a clean checkout of `main`: `pnpm install && pnpm run build`, then `pnpm --filter @open-reloading/<name> publish` for `schema`, `drawing`, `importers` and `catalog`, signed in with two-factor authentication. The `publish` job skips that version.
2. On npmjs.com, package Settings, Trusted Publisher, GitHub Actions: organization `OpenReloading`, repository `Ballistics`, workflow `release.yml`.
3. Publishing access: "Require two-factor authentication and disallow tokens".

`pnpm --filter @open-reloading/<name> pack --dry-run` lists the package contents: `dist` without source maps and the license files (`catalog`: `LICENSE` for CC BY 4.0 and `LICENSE-MIT`), no sources, tests or records folder.

## Contract baselines

The stored and published contracts besides the API each have a committed baseline that a test compares with the build (`pnpm test`, the CI `test` groups `packages` and `web`):
- The JSON Schemas the schema build writes: `packages/schema/test/golden/json-schema/`.
- The export list (values and types) of each published package: `tools/test/golden/exports/<name>.txt`, one line per entry point and name.
- The user data file of the current format version (`user-data-v<version>.json`, replaced when the version changes; no older version is read): a file with a record of each kind, which the current code must read and write back unchanged, and which the next version refuses as a whole; share links of its records, one with text beyond ASCII (`share-link-v<version>.txt`, `share-link-text-v<version>.txt`): `apps/web/test/golden/`.

`pnpm run baselines` (after `pnpm run build`) rewrites the JSON Schemas, the export lists and the share links from the build. The user data file is edited by hand, so its diff shows the change of the format. Before 1.0.0 a pull request may rewrite a baseline in the same change. From 1.0.0 on, a rewrite is a breaking change and its pull request title carries the `!` marker.

## Validation results

The [results](models/validation.md#results) of the validation page are a local run on load rows that are not in the repository, updated by hand at each release. After the update, `pnpm run build`, then `VALIDATION_ROWS=<rows file> BALLISTICS_RECORDS=<records roots> pnpm --filter @open-reloading/cli exec vitest run test/published-validation.test.ts` reruns `verify` on the validation split with the run's records and checks every velocity line of the page and its pressure line at their printed decimals. Without `VALIDATION_ROWS` the test is skipped, so CI never reads the rows; the command line tests check the arithmetic of the evaluation on synthetic rows. No run on the real input has passed it yet: the rows and records of the published run are not yet kept in a form the command line reads, so until they are, the step can fail for its inputs, not for the model.

## 1.0.0 release

Release notes paragraph, pasted into the release:

> Export all your data before updating (Save options, Export all). Records saved by an alpha version whose shape has changed show as invalid records under Open, with the reason. Download one raw to fix it and import it again, or delete it.

## API contract

- `pnpm run api:check` compares the API document of the current routes with `packages/api/openapi.baseline.json` through `oasdiff breaking` and fails on any `ERR` finding. The CI `check` job writes the API document and runs the same oasdiff version in its container (`docker run`), not the npm script.
- A breaking change passes only when the same pull request rewrites the baseline: `pnpm --filter @open-reloading/tools run api-baseline`. The baseline diff then shows the break in review. From 1.0.0 on, the pull request title also marks it (`feat(api)!:`), so release-please raises the major version.
- `pnpm run api:conformance` runs Schemathesis against the running API: no 5xx answer, and status codes, content types and response bodies as the document declares them. The CI `e2e` job runs the same Schemathesis version and checks in its container (`docker run`) against the compose stack, not the npm script.
