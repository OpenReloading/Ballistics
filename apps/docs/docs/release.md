---
title: Releases and versions
sidebar_position: 2
---

# Releases and versions

## Versions

- Each released part has its own version, [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html), in its `package.json`, and its own tag `<component>-vX.Y.Z` and `CHANGELOG.md`: `packages/schema` (`schema`), `packages/core` (`core`), `packages/drawing` (`drawing`), `packages/importers` (`importers`), `packages/data` (`data`), `packages/api` (`api`), `packages/cli` (`cli`), `apps/web` (`web`) and `apps/docs` (`docs`), listed in `release-please-config.json`. `apps/e2e` and `tools` are not versioned. `schema`, `core`, `drawing`, `importers` and `data` are published to npmjs.com as `@open-reloading/<name>`, each release as that version, once the repository variable `NPM_PUBLISH` is `true` (step 5 below). `cli` is versioned and not published; `api` is published as a container image, `web` and `docs` are part of the Pages site below (`web` has a version, a tag and a changelog but no image). They are `private` workspaces, as are `apps/e2e` and `tools`.
- A component gets a new version only when a commit since its last release touched its folder. The `node-workspace` plugin also raises the patch version of every listed workspace that depends on a changed one and writes the new version into the dependency entries of `package.json` and `package-lock.json`.
- 0.0.1 is the first version of every component: with no release tag, `initial-version` in `release-please-config.json` sets it. `.release-please-manifest.json` holds 0.0.0 for each (nothing released yet).
- Early alpha: 0.0.x, breaking changes are to be expected (README). Before 1.0.0, `feat` and `fix` raise the patch version (`bump-patch-for-minor-pre-major`), and commits carry no breaking marker. From 1.0.0 on, a breaking change (`!` or a `BREAKING CHANGE:` footer) raises the major version. 1.0.0 is a maintainer decision.
- The HTTP API has one version: the version of `@open-reloading/api`. The API document carries it as `info.version` (`packages/api/src/version.ts`), and the REST API page of this site shows it. Every public route is under `/v1`.

## Flow

1. Work lands on `main` by squash-merged pull requests with a Conventional Commits title (CONTRIBUTING.md); that title is the changelog line.
2. On every push to `main`, `release.yml` runs release-please: it opens or updates one release pull request with the next version of each changed component, its `CHANGELOG.md` section and the versions in `package.json` and `package-lock.json`. Only `feat`, `fix`, `perf`, `revert` and `docs` commits appear in the changelogs.
3. Every `main` merge is releasable, but only merging the release pull request releases. `release-weekly.yml` merges it (squash, auto-merge, so it waits for its required checks) every Monday at 14:00 Europe/Berlin, then dispatches `release.yml`. The owner can run it by hand on any other day (Actions, Release weekly, Run workflow), merge the pull request by hand, or put the label `hold` on the pull request to skip a week. A push to `main` that is not that merge tags and publishes nothing. Merging it tags each released component `<component>-vX.Y.Z` and publishes its GitHub Release with that changelog section, marked as a pre-release while the version is below 1.0.0. The images and libraries below are built in the run of that merge.
4. When `api` is released, the same workflow builds `ghcr.io/openreloading/ballistics-api` from that tag, then:
   - scans it with Grype (a fixable critical finding stops the publish)
   - pushes the tags `X.Y.Z`, `X.Y` and `sha-<commit>` (the version of that component)
   - attests its build provenance (`gh attestation verify oci://ghcr.io/openreloading/ballistics-api:X.Y.Z -R OpenReloading/Ballistics`)
   - generates an SPDX SBOM of the image with Syft (a pinned container image, run on the saved image before the registry login), attests it for the pushed digest (`gh attestation verify oci://ghcr.io/openreloading/ballistics-api:X.Y.Z -R OpenReloading/Ballistics --predicate-type https://spdx.dev/Document/v2.3`), and the `sbom-release` job attaches it to the component's GitHub Release as `ballistics-api-X.Y.Z.spdx.json` (a job apart from the image build, so no step that runs image code holds `contents: write`)
5. When `schema`, `core`, `drawing`, `importers` or `data` is released and the repository variable `NPM_PUBLISH` is `true`, the `publish` job builds those five libraries from the release commit and runs `npm publish` for each released one, `schema` first (`importers` and `data` depend on it). It uses npm trusted publishing (OIDC, `id-token: write`, npm 11.5.1 or later), so the repository holds no npm token, and npm records a provenance statement with each version. A version already on the registry is skipped, so a failed run can be re-run. While `NPM_PUBLISH` is unset (npm is not set up yet) the job does not run and a library release publishes nothing to npm.

The release pull request is opened with the token of the organization's release GitHub App (`RELEASE_APP_CLIENT_ID`, `RELEASE_APP_PRIVATE_KEY`, [repository settings](ci-tools.md)). GitHub signs the App's API commits (`main` requires signed commits), and a pull request of the App starts its required checks without anyone approving them. Without the App (the variable is unset or the App is not installed on the repository) release-please falls back to the workflow token: the run says so in a warning, and the owner approves the pull request's workflow runs (Approve workflows to run on the pull request). It changes only versions and changelogs.

## Home page news

The web app's home page lists the newest five items of `apps/web/news/`, newest first. Each item is one file `YYYY-MM-DD-slug.md` (the date of the item, a slug of lowercase letters, digits and hyphens) with a front matter of `title` and `link` (an app path such as `/workbench` or a docs URL) and a text of two sentences below it. A file that breaks this format fails the web build. A pull request that adds a user-visible feature adds its item. Release notes stay in the changelogs of each component above.

## Pages site

`pages.yml` builds one site from two sources and deploys it in one deployment (a deployment replaces the whole site):

- The root shows the latest release: the checkout of the newest GitHub Release's tag, built with `npm run pages:build`.
- `/next/` shows `main`, built with `PAGES_EDITION=next` (`tools/src/pages.ts`).
- Until the first release exists the root is a page that forwards to `/next/`.

It runs on every push to `main`, when a release is published and on `workflow_dispatch`. A release created with the workflow token starts no workflow of its own, so `release.yml` then dispatches `pages.yml` itself (with the App token, the `release: published` event does).

Both editions share one origin, so the next edition keeps its data under other names: its IndexedDB database, local storage keys and caches are prefixed `next:`, and its service worker has the scope `<site>/next/`. What the next edition stores in the browser is not carried over to the stable edition, and an earlier preview database is not migrated. The stable edition's service worker leaves `/next/` to the network.

## Self-hosting

- The web app is the static `pages/` folder that `npm run pages:build` writes (`PAGES_BASE_PATH` is the path the site is served under, empty for a site root). Any static host serves it: the calculations run in the browser, so there is no server process.
- The REST API is the container image `ghcr.io/openreloading/ballistics-api`, one per `api` release (`docker run -p 3000:3000 ghcr.io/openreloading/ballistics-api:X.Y.Z`). `compose.yaml` builds the same image from the repository, next to the docs site.

## npm packages

Publishing is off until the settings below exist and the repository variable `NPM_PUBLISH` is set to `true`. Settings outside the repository, once per library (see the [npm documentation on trusted publishers](https://docs.npmjs.com/trusted-publishers)):

1. The npm organization `open-reloading` exists. If npm offers trusted publishing only for an existing package, publish the first version by hand from a clean checkout of `main`: `npm ci && npm run build`, then `npm publish -w @open-reloading/<name>` for `schema`, `core`, `drawing`, `importers` and `data`, signed in with two-factor authentication. The `publish` job skips that version.
2. On npmjs.com, package Settings, Trusted Publisher, GitHub Actions: organization `OpenReloading`, repository `Ballistics`, workflow `release.yml`.
3. Publishing access: "Require two-factor authentication and disallow tokens".

`npm pack --dry-run -w @open-reloading/<name>` lists the package contents: `dist` without source maps and the license files (`data`: `LICENSE` for CC BY 4.0 and `LICENSE-MIT`), no sources, tests or records folder.

## Contract baselines

The stored and published contracts besides the API each have a committed baseline that a test compares with the build (`npm test`, the CI `test` groups `packages` and `web`):

- The JSON Schemas the schema build writes: `packages/schema/test/golden/json-schema/`.
- The export list (values and types) of each published package: `tools/test/golden/exports/<name>.txt`, one line per entry point and name.
- A user data file with a record of each kind, which the current code must read and write back unchanged, and a share link of two of its records: `apps/web/test/golden/`.

`npm run baselines` (after `npm run build`) rewrites the JSON Schemas, the export lists and the share link from the build. The user data file is edited by hand, so its diff shows what an older file needs. Before 1.0.0 a pull request may rewrite a baseline in the same change. From 1.0.0 on, a rewrite is a breaking change and its pull request title carries the `!` marker.

## 1.0.0 release

Release notes paragraph, pasted into the release:

> Export all your data before updating (Save options, Export all). Records saved by an alpha version whose shape has changed show as invalid records under Open, with the reason. Download one raw to fix it and import it again, or delete it.

## API contract

- `npm run api:check` compares the API document of the current routes with `packages/api/openapi.baseline.json` through `oasdiff breaking` and fails on any `ERR` finding. The CI `check` job writes the API document and runs the same oasdiff version in its container (`docker run`), not the npm script.
- A breaking change passes only when the same pull request rewrites the baseline: `npm run api-baseline -w @open-reloading/tools`. The baseline diff then shows the break in review. From 1.0.0 on, the pull request title also marks it (`feat(api)!:`), so release-please raises the major version.
- `npm run api:conformance` runs Schemathesis against the running API: no 5xx answer, and status codes, content types and response bodies as the document declares them. The CI `e2e` job runs the same Schemathesis version and checks in its container (`docker run`) against the compose stack, not the npm script.
