---
title: CI tools
sidebar_position: 3
---

# CI, quality and supply-chain tools

One tool per job, each free for a public repository. Terms checked on 2026-10-20 on the pages linked (oasdiff and Schemathesis on 2026-10-21, dependency-cruiser, swc, knip, yaml and lychee, Syft and typos on 2026-10-26, SonarQube Cloud on 2026-10-26). Recheck a term before use.

| Job | Tool | Runs in | Free terms (public repository) |
|---|---|---|---|
| CI runners | GitHub Actions, standard hosted runners | `.github/workflows/` | Free and unlimited minutes. 6 h per job, 20 concurrent jobs. [Billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [limits](https://docs.github.com/en/actions/reference/limits) |
| Lint and format | Biome: the recommended rules plus the errors and warnings in `biome.json` | `ci.yml` `check` | MIT, local. [biomejs.dev](https://biomejs.dev/) |
| Pre-commit hook | `hooks/pre-commit` (POSIX shell) runs the Biome above on the staged files, installed by `hooks/install.mjs` (Node, no dependency) into the repository's hooks folder | contributors' machines, `npm ci` | Local. No dependency added. |
| Static analysis for security | CodeQL default setup (JavaScript/TypeScript, Actions) | repository settings | Free for public repositories. [Security features](https://docs.github.com/en/code-security/getting-started/github-security-features), [default setup](https://docs.github.com/en/code-security/how-tos/scan-code-for-vulnerabilities/configure-code-scanning/configuring-default-setup-for-code-scanning) |
| Code quality gate | SonarQube Cloud, check `SonarCloud Code Analysis`: quality gate on the new code (reliability, security and maintainability rating A, all new security hotspots reviewed) | GitHub App, no workflow or scanner file in the repository; required check of the `main` ruleset | Free for public projects, any number of them. The Free plan analyses the main branch and pull requests that target it; an OSS plan for open-source organizations lifts that limit. Which of the two this organization is on: unverified. [Plans](https://www.sonarsource.com/plans-and-pricing/sonarcloud/), [subscription plans](https://docs.sonarsource.com/sonarcloud/administering-sonarcloud/managing-subscription/subscription-plans) |
| AI review | CodeRabbit, OSS plan (`.coderabbit.yaml`) | GitHub App | Free for public repositories. 1 to 10 reviews per hour by star count. Below 10 stars a review starts with `@coderabbitai review`. Code goes to the model providers and is not used for training. [Plans](https://docs.coderabbit.ai/management/plans), [FAQ](https://docs.coderabbit.ai/faq) |
| Dependency updates | Dependabot (`.github/dependabot.yml`) | GitHub | Free on all plans. [Options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference) |
| Dependency review | `actions/dependency-review-action`, licence list in `.github/dependency-review-config.yml` | `ci.yml` `dependency-review` | Free for public repositories. [About](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review) |
| Secrets | Secret scanning with push protection | repository settings | Free for public repositories. [About](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning) |
| Licence policy | `tools/src/licences.ts` (Node, `yaml` 2, ISC) over package-lock.json | `ci.yml` `check` (`static`) | Local. [yaml](https://github.com/eemeli/yaml), [license](https://github.com/eemeli/yaml/blob/main/LICENSE) |
| Import rules | dependency-cruiser, parsing TypeScript with @swc/core | `ci.yml` `check` (`static`) | MIT and Apache-2.0, local. [dependency-cruiser](https://github.com/sverweij/dependency-cruiser), [license](https://github.com/sverweij/dependency-cruiser/blob/main/LICENSE), [swc](https://github.com/swc-project/swc), [license](https://github.com/swc-project/swc/blob/main/LICENSE) |
| Unused files, exports and dependencies | knip 6 (`knip.jsonc`) | `ci.yml` `check` (`static`) | ISC, local. [knip](https://github.com/webpro-nl/knip), [license](https://github.com/webpro-nl/knip/blob/main/LICENSE) |
| Link check | lychee 0.24.2 (`lychee.toml`): relative links and anchors of the Markdown files offline in every pull request, external links in a scheduled run that keeps one issue | `ci.yml` `check`, `links.yml` | Apache-2.0 or MIT, local. [lychee](https://github.com/lycheeverse/lychee), [license](https://github.com/lycheeverse/lychee/blob/master/LICENSE-APACHE) |
| Spell check | typos 1.51.1, release binary checked against its SHA-256 (`_typos.toml`): tracked text files except the records, lockfile, snapshots and golden files; the accepted terms and their reasons are in the config | `ci.yml` `check` | MIT or Apache-2.0, local. [typos](https://github.com/crate-ci/typos), [license](https://github.com/crate-ci/typos/blob/master/LICENSE-APACHE) |
| Web JavaScript budget | `apps/web/scripts/check-weight.mts` (Node, no dependency) over the export build's `.next` and `apps/web/weight-budget.json` | `ci.yml` `e2e`, after the export build | Local. |
| Workflow lint and security | actionlint 1.7.12, zizmor 1.31.1 | `ci.yml` `workflows` | MIT, local. [actionlint](https://github.com/rhysd/actionlint), [zizmor](https://github.com/zizmorcore/zizmor) |
| Image vulnerabilities | Grype (`anchore/scan-action`), fails on fixable critical findings | `release.yml` `images` | Apache-2.0, local. [scan-action](https://github.com/anchore/scan-action) |
| Image registry | GitHub Container Registry | `release.yml` `images` | Public packages free (storage and transfer). [Billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages) |
| Pages site | GitHub Pages, deployed by `actions/deploy-pages`: the latest release at the root and `main` at `/next/` in one deployment | `pages.yml` | Free for public repositories. 1 GB site, 100 GB bandwidth a month (soft limits). [Limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) |
| Image SBOM | Syft 1.55.0 (`anchore/syft` container, SPDX JSON), attested with `actions/attest` and attached to the GitHub Release | `release.yml` `images`, `sbom-release` | Apache-2.0, local. [syft](https://github.com/anchore/syft), [license](https://github.com/anchore/syft/blob/main/LICENSE) |
| Build provenance | `actions/attest` (Sigstore public instance) | `release.yml` `images` | Free for public repositories. [Artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) |
| Releases and changelog | release-please 17.6.0 through `release-please-action` 5.0.0 (`release-please-config.json`, manifest mode) | `release.yml` | Apache-2.0. [release-please](https://github.com/googleapis/release-please) |
| API breaking changes | oasdiff 1.33.0 (`oasdiff breaking --fail-on ERR`) | `ci.yml` `check`, dev container | Apache-2.0, local. [oasdiff](https://github.com/oasdiff/oasdiff), [license](https://github.com/oasdiff/oasdiff/blob/main/LICENSE) |
| API conformance | Schemathesis 4.29.4 | `ci.yml` `e2e`, dev container | MIT, local. [Schemathesis](https://github.com/schemathesis/schemathesis), [license](https://github.com/schemathesis/schemathesis/blob/master/LICENSE) |
| Repository health | OpenSSF Scorecard | `scorecard.yml` | Apache-2.0, free. [scorecard-action](https://github.com/ossf/scorecard-action) |

Not used: a hosted coverage service (Codecov), jscpd, Trivy (its action tags were rewritten in March 2026, [GHSA-69fq-xp46-6x23](https://github.com/aquasecurity/trivy/security/advisories/GHSA-69fq-xp46-6x23)).

## Rules for workflows

- Every action is pinned to a full commit SHA with its version in a comment. Dependabot updates both.
- `permissions`: none at the workflow level, set per job. `persist-credentials: false` on every checkout.
- Every job has a `timeout-minutes` of about three times its median run, except `publish` in `release.yml`.
- `ci.yml` and `pr-title.yml` cancel a superseded pull request run (`concurrency`).
- `ci.yml` and `pr-title.yml` run on pull requests and on `merge_group` (for a merge queue on `main`, not enabled yet), and `ci.yml` also on push to `main`. Every required check that a workflow produces reports under its own name on both events (`dependency-review` and `conventional` check the pull request only and succeed on `merge_group`). `SonarCloud Code Analysis` is a GitHub App check, not a workflow, and it does not report on `merge_group` (checked on the queue commit of a test merge, 2026-10-27), so a merge queue needs it removed from the required checks.
- Tool images of `docker run` steps are set in the `env` block of `ci.yml` and `release.yml`. Dependabot does not read them: update them by hand.
- Jobs that publish or need secrets run only in `OpenReloading/Ballistics` (`if: github.repository == ...`).

## Repository settings (maintainers)

- Settings, General: Discussions on. Pull requests: squash merge only, default squash message "Pull request title". "Automatically delete head branches" on.
- Settings, Actions, General: "Require actions to be pinned to a full-length commit SHA" on. Workflow permissions read-only, "Allow GitHub Actions to create and approve pull requests" on (release-please opens its release pull request).
- Release GitHub App (organization variable `RELEASE_APP_CLIENT_ID`, secret `RELEASE_APP_PRIVATE_KEY`), installed on the repository with Contents, Issues and Pull requests read and write: `release.yml` opens the release pull request with its token, so the required checks run without anyone approving them. Without the App the pull request is opened with the workflow token and its workflow runs wait for a maintainer's approval. The secret `RELEASE_PLEASE_TOKEN` is no longer used and can be deleted.
- Settings, Pages: source "GitHub Actions". Settings, Environments, `github-pages`: deployment branches `main` and the release tags (`*-v*`), no other entry.
- Settings, Advanced Security: dependency graph, Dependabot alerts and security updates, secret scanning with push protection, private vulnerability reporting, CodeQL default setup.
- Rules, ruleset on `main`: pull request required (squash merge only, no approval count, review threads resolved), signed commits, linear history, no force push or deletion, required checks `check`, `e2e`, `workflows`, `conventional`, `dependency-review` and `SonarCloud Code Analysis`. Organization admins may bypass through a pull request.
- After the first release: the package `ballistics-api` set to public in its package settings.
