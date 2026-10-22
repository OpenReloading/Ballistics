---
title: Releases and versions
sidebar_position: 2
---

# Releases and versions

## Versions

- Each released part has its own version, [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html), in its `package.json`, and its own tag `<component>-vX.Y.Z` and `CHANGELOG.md`: `packages/schema` (`schema`), `packages/core` (`core`), `packages/drawing` (`drawing`), `packages/importers` (`importers`), `packages/data` (`data`), `packages/api` (`api`), `apps/web` (`web`) and `apps/docs` (`docs`), listed in `release-please-config.json`. `apps/e2e` and `tools` are not versioned. The packages are not published to a registry.
- A component gets a new version only when a commit since its last release touched its folder. The `node-workspace` plugin also raises the patch version of every listed workspace that depends on a changed one and writes the new version into the dependency entries of `package.json` and `package-lock.json`.
- 0.0.1 is the first version of every component: with no release tag, `initial-version` in `release-please-config.json` sets it. `.release-please-manifest.json` holds 0.0.0 for each (nothing released yet).
- Early alpha: 0.0.x, breaking changes are to be expected (README). Before 1.0.0, `feat` and `fix` raise the patch version (`bump-patch-for-minor-pre-major`), and commits carry no breaking marker. From 1.0.0 on, a breaking change (`!` or a `BREAKING CHANGE:` footer) raises the major version. 1.0.0 is a maintainer decision.
- The HTTP API has one version: the version of `@openreloading/api`. The API document carries it as `info.version` (`packages/api/src/version.ts`), and the REST API page of this site shows it. Every public route is under `/v1`.

## Flow

1. Pull requests are squash-merged into `main` with a Conventional Commits title (CONTRIBUTING.md).
2. On every push to `main`, `release.yml` runs release-please: it opens or updates one release pull request with the next version of each changed component, its `CHANGELOG.md` section and the versions in `package.json` and `package-lock.json`. Only `feat`, `fix`, `perf`, `revert` and `docs` commits appear in the changelogs.
3. The workflow turns on auto-merge for the release pull request, so it is squashed once its required checks pass. Merging the release pull request tags each released component `<component>-vX.Y.Z` and publishes its GitHub Release with that changelog section, marked as a pre-release while the version is below 1.0.0.
4. When `api` or `web` is released, the same workflow builds `ghcr.io/openreloading/ballistics-api` or `ghcr.io/openreloading/ballistics-web` from that tag, then:
   - scans it with Grype (a fixable critical finding stops the publish)
   - pushes the tags `X.Y.Z`, `X.Y` and `sha-<commit>` (the version of that component)
   - attests its build provenance (`gh attestation verify oci://ghcr.io/openreloading/ballistics-api:X.Y.Z -R OpenReloading/Ballistics`)

The release pull request is opened with the `RELEASE_PLEASE_TOKEN` secret (a fine-grained token for this repository with Contents and Pull requests read and write), so CI runs on it like on any pull request. Without the secret it is opened with the workflow token, and its CI waits for approval. It changes only versions and changelogs.

## API contract

- `npm run api:check` compares the API document of the current routes with `packages/api/openapi.baseline.json` through `oasdiff breaking` and fails on any `ERR` finding. The CI `check` job writes the API document and runs the same oasdiff version in its container (`docker run`), not the npm script.
- A breaking change passes only when the same pull request rewrites the baseline: `npm run api-baseline -w @openreloading/tools`. The baseline diff then shows the break in review. From 1.0.0 on, the pull request title also marks it (`feat(api)!:`), so release-please raises the major version.
- `npm run api:conformance` runs Schemathesis against the running API: no 5xx answer, and status codes, content types and response bodies as the document declares them. The CI `e2e` job runs the same Schemathesis version and checks in its container (`docker run`) against the compose stack, not the npm script.
