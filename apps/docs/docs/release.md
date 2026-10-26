---
title: Releases and versions
sidebar_position: 2
---

# Releases and versions

## Versions

- Each released part has its own version, [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html), in its `package.json`, and its own tag `<component>-vX.Y.Z` and `CHANGELOG.md`: `packages/schema` (`schema`), `packages/core` (`core`), `packages/drawing` (`drawing`), `packages/importers` (`importers`), `packages/data` (`data`), `packages/api` (`api`), `apps/web` (`web`) and `apps/docs` (`docs`), listed in `release-please-config.json`. `apps/e2e` and `tools` are not versioned. `schema`, `core`, `drawing`, `importers` and `data` are published to npmjs.com as `@open-reloading/<name>`, each release as that version. `api` and `web` are published as container images, `docs` to GitHub Pages. They are `private` workspaces, as are `apps/e2e` and `tools`.
- A component gets a new version only when a commit since its last release touched its folder. The `node-workspace` plugin also raises the patch version of every listed workspace that depends on a changed one and writes the new version into the dependency entries of `package.json` and `package-lock.json`.
- 0.0.1 is the first version of every component: with no release tag, `initial-version` in `release-please-config.json` sets it. `.release-please-manifest.json` holds 0.0.0 for each (nothing released yet).
- Early alpha: 0.0.x, breaking changes are to be expected (README). Before 1.0.0, `feat` and `fix` raise the patch version (`bump-patch-for-minor-pre-major`), and commits carry no breaking marker. From 1.0.0 on, a breaking change (`!` or a `BREAKING CHANGE:` footer) raises the major version. 1.0.0 is a maintainer decision.
- The HTTP API has one version: the version of `@open-reloading/api`. The API document carries it as `info.version` (`packages/api/src/version.ts`), and the REST API page of this site shows it. Every public route is under `/v1`.

## Flow

1. Work lands on `develop` by squash-merged pull requests with a Conventional Commits title (CONTRIBUTING.md); that title is the changelog line. The `Promote` workflow (`.github/workflows/promote.yml`) opens and updates one pull request from `develop` to `main` on every push to `develop`. Merge it with a merge commit, not a squash, so release-please reads the squashed commits from `develop` and the next promotion lists only new commits.
2. On every push to `main`, `release.yml` runs release-please: it opens or updates one release pull request with the next version of each changed component, its `CHANGELOG.md` section and the versions in `package.json` and `package-lock.json`. Only `feat`, `fix`, `perf`, `revert` and `docs` commits appear in the changelogs.
3. The workflow turns on auto-merge for the release pull request, so it is squashed once its required checks pass. Merging the release pull request tags each released component `<component>-vX.Y.Z` and publishes its GitHub Release with that changelog section, marked as a pre-release while the version is below 1.0.0.
4. When `api` or `web` is released, the same workflow builds `ghcr.io/openreloading/ballistics-api` or `ghcr.io/openreloading/ballistics-web` from that tag, then:
   - scans it with Grype (a fixable critical finding stops the publish)
   - pushes the tags `X.Y.Z`, `X.Y` and `sha-<commit>` (the version of that component)
   - attests its build provenance (`gh attestation verify oci://ghcr.io/openreloading/ballistics-api:X.Y.Z -R OpenReloading/Ballistics`)
   - generates an SPDX SBOM of the image with Syft (a pinned container image, run on the saved image before the registry login), attests it for the pushed digest (`gh attestation verify oci://ghcr.io/openreloading/ballistics-api:X.Y.Z -R OpenReloading/Ballistics --predicate-type https://spdx.dev/Document/v2.3`), and the `sbom-release` job attaches it to the component's GitHub Release as `ballistics-<api|web>-X.Y.Z.spdx.json` (a job apart from the image build, so no step that runs image code holds `contents: write`)
5. When `schema`, `core`, `drawing`, `importers` or `data` is released, the `publish` job builds those five libraries from the release commit and runs `npm publish` for each released one, `schema` first (`importers` and `data` depend on it). It uses npm trusted publishing (OIDC, `id-token: write`, npm 11.5.1 or later), so the repository holds no npm token, and npm records a provenance statement with each version. A version already on the registry is skipped, so a failed run can be re-run.

release-please writes the release pull request with the workflow token, so GitHub signs its commits (`main` requires signed commits). Its CI runs wait for a maintainer's approval (Approve workflows to run on the pull request), because github-actions opened it; auto-merge, turned on with the `RELEASE_PLEASE_TOKEN` secret (a fine-grained token for this repository with Contents and Pull requests read and write), then squashes it once its checks pass. Without the secret, merge it by hand once its checks pass. It changes only versions and changelogs.

## npm packages

Settings outside the repository, once per library (see the [npm documentation on trusted publishers](https://docs.npmjs.com/trusted-publishers)):

1. The npm organization `open-reloading` exists. If npm offers trusted publishing only for an existing package, publish the first version by hand from a clean checkout of `main`: `npm ci && npm run build`, then `npm publish -w @open-reloading/<name>` for `schema`, `core`, `drawing`, `importers` and `data`, signed in with two-factor authentication. The `publish` job skips that version.
2. On npmjs.com, package Settings, Trusted Publisher, GitHub Actions: organization `OpenReloading`, repository `Ballistics`, workflow `release.yml`.
3. Publishing access: "Require two-factor authentication and disallow tokens".

`npm pack --dry-run -w @open-reloading/<name>` lists the package contents: `dist` without source maps and the license files (`data`: `LICENSE` for CC BY 4.0 and `LICENSE-MIT`), no sources, tests or records folder.

## API contract

- `npm run api:check` compares the API document of the current routes with `packages/api/openapi.baseline.json` through `oasdiff breaking` and fails on any `ERR` finding. The CI `check` job writes the API document and runs the same oasdiff version in its container (`docker run`), not the npm script.
- A breaking change passes only when the same pull request rewrites the baseline: `npm run api-baseline -w @open-reloading/tools`. The baseline diff then shows the break in review. From 1.0.0 on, the pull request title also marks it (`feat(api)!:`), so release-please raises the major version.
- `npm run api:conformance` runs Schemathesis against the running API: no 5xx answer, and status codes, content types and response bodies as the document declares them. The CI `e2e` job runs the same Schemathesis version and checks in its container (`docker run`) against the compose stack, not the npm script.
