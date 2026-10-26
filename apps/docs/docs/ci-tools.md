---
title: CI tools
sidebar_position: 3
---

# CI, quality and supply-chain tools

One tool per job, each free for a public repository. Terms checked on 2026-10-20 on the pages linked (oasdiff and Schemathesis on 2026-10-21, dependency-cruiser, swc, knip and yaml on 2026-10-26). Recheck a term before use.

| Job | Tool | Runs in | Free terms (public repository) |
|---|---|---|---|
| CI runners | GitHub Actions, standard hosted runners | `.github/workflows/` | Free and unlimited minutes. 6 h per job, 20 concurrent jobs. [Billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [limits](https://docs.github.com/en/actions/reference/limits) |
| Lint and format | Biome: the recommended rules plus the errors and warnings in `biome.json` | `ci.yml` `check` | MIT, local. [biomejs.dev](https://biomejs.dev/) |
| Static analysis for security | CodeQL default setup (JavaScript/TypeScript, Actions) | repository settings | Free for public repositories. [Security features](https://docs.github.com/en/code-security/getting-started/github-security-features), [default setup](https://docs.github.com/en/code-security/how-tos/scan-code-for-vulnerabilities/configure-code-scanning/configuring-default-setup-for-code-scanning) |
| AI review | CodeRabbit, OSS plan (`.coderabbit.yaml`) | GitHub App | Free for public repositories. 1 to 10 reviews per hour by star count. Below 10 stars a review starts with `@coderabbitai review`. Code goes to the model providers and is not used for training. [Plans](https://docs.coderabbit.ai/management/plans), [FAQ](https://docs.coderabbit.ai/faq) |
| Dependency updates | Dependabot (`.github/dependabot.yml`) | GitHub | Free on all plans. [Options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference) |
| Dependency review | `actions/dependency-review-action`, licence list in `.github/dependency-review-config.yml` | `ci.yml` `dependency-review` | Free for public repositories. [About](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review) |
| Secrets | Secret scanning with push protection | repository settings | Free for public repositories. [About](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning) |
| Licence policy | `tools/src/licences.ts` (Node, `yaml` 2, ISC) over package-lock.json | `ci.yml` `check` (`static`) | Local. [yaml](https://github.com/eemeli/yaml), [license](https://github.com/eemeli/yaml/blob/main/LICENSE) |
| Import rules | dependency-cruiser, parsing TypeScript with @swc/core | `ci.yml` `check` (`static`) | MIT and Apache-2.0, local. [dependency-cruiser](https://github.com/sverweij/dependency-cruiser), [license](https://github.com/sverweij/dependency-cruiser/blob/main/LICENSE), [swc](https://github.com/swc-project/swc), [license](https://github.com/swc-project/swc/blob/main/LICENSE) |
| Unused files, exports and dependencies | knip 6 (`knip.jsonc`) | `ci.yml` `check` (`static`) | ISC, local. [knip](https://github.com/webpro-nl/knip), [license](https://github.com/webpro-nl/knip/blob/main/LICENSE) |
| Web JavaScript budget | `apps/web/scripts/check-weight.mts` (Node, no dependency) over `.next` and `apps/web/weight-budget.json` | `ci.yml` `e2e`, after the web build | Local. |
| Workflow lint and security | actionlint 1.7.12, zizmor 1.31.1 | `ci.yml` `workflows` | MIT, local. [actionlint](https://github.com/rhysd/actionlint), [zizmor](https://github.com/zizmorcore/zizmor) |
| Image vulnerabilities | Grype (`anchore/scan-action`), fails on fixable critical findings | `release.yml` `images` | Apache-2.0, local. [scan-action](https://github.com/anchore/scan-action) |
| Image registry | GitHub Container Registry | `release.yml` `images` | Public packages free (storage and transfer). [Billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages) |
| Pages site and the preview of `develop` | GitHub Pages, deployed by `actions/deploy-pages` | `pages.yml` | Free for public repositories. 1 GB site, 100 GB bandwidth a month (soft limits). [Limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) |
| Build provenance | `actions/attest` (Sigstore public instance) | `release.yml` `images` | Free for public repositories. [Artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) |
| Releases and changelog | release-please 17.6.0 through `release-please-action` 5.0.0 (`release-please-config.json`, manifest mode) | `release.yml` | Apache-2.0. [release-please](https://github.com/googleapis/release-please) |
| API breaking changes | oasdiff 1.33.0 (`oasdiff breaking --fail-on ERR`) | `ci.yml` `check`, dev container | Apache-2.0, local. [oasdiff](https://github.com/oasdiff/oasdiff), [license](https://github.com/oasdiff/oasdiff/blob/main/LICENSE) |
| API conformance | Schemathesis 4.29.4 | `ci.yml` `e2e`, dev container | MIT, local. [Schemathesis](https://github.com/schemathesis/schemathesis), [license](https://github.com/schemathesis/schemathesis/blob/master/LICENSE) |
| Repository health | OpenSSF Scorecard | `scorecard.yml` | Apache-2.0, free. [scorecard-action](https://github.com/ossf/scorecard-action) |

Not used: a hosted quality gate and coverage service (SonarQube Cloud, Codecov), jscpd, Trivy (its action tags were rewritten in March 2026, [GHSA-69fq-xp46-6x23](https://github.com/aquasecurity/trivy/security/advisories/GHSA-69fq-xp46-6x23)).

## Rules for workflows

- Every action is pinned to a full commit SHA with its version in a comment. Dependabot updates both.
- `permissions`: none at the workflow level, set per job. `persist-credentials: false` on every checkout.
- Every job has a `timeout-minutes` of about three times its median run.
- `ci.yml` and `pr-title.yml` cancel a superseded pull request run (`concurrency`).
- `ci.yml` runs on pushes to `develop` and on pull requests. The promotion pull request (develop into main) skips its jobs, because the push to develop already ran them on the same commit; a skipped required check passes.
- Tool images of `docker run` steps are set in the `env` block of `ci.yml`. Dependabot does not read them: update them by hand.
- Jobs that publish or need secrets run only in `OpenReloading/Ballistics` (`if: github.repository == ...`).

## Repository settings (maintainers)

- Settings, General: Discussions on. Pull requests: squash merging only, default message "Pull request title". "Automatically delete head branches" on.
- Settings, Actions, General: "Require actions to be pinned to a full-length commit SHA" on. Workflow permissions read-only, "Allow GitHub Actions to create and approve pull requests" on (release-please opens its release pull request).
- Settings, Pages: source "GitHub Actions". Settings, Environments, `github-pages`: deployment branches `main` and `develop` (the preview of `develop` under `develop/`).
- Settings, Advanced Security: dependency graph, Dependabot alerts and security updates, secret scanning with push protection, private vulnerability reporting, CodeQL default setup.
- Rules, ruleset on `main`: pull request required (maintainers may bypass), linear history, no force push or deletion, required checks `check`, `e2e`, `workflows`, `conventional` once each has run.
- After the first release: both packages (`ballistics-api`, `ballistics-web`) set to public in their package settings.
