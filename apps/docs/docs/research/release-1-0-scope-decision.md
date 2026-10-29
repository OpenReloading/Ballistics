---
title: What the 1.0 release covers
description: The accepted decision table on the scope, versions, alpha notice, changelog, support policy and publishing order of the 1.0 release, and why the change that would make it stays unbuilt while everything remains a 0.x pre-release.
---

# What the 1.0 release covers

## Question

Release process: what the 1.0 release covers (components, version numbers, the alpha notice, the changelog, the support policy, the order of publishing), and whether the change that makes it is built now.

## Method

A decision table on the issue ([decision table](https://github.com/OpenReloading/Ballistics/issues/294#issuecomment-6462356621)) gives each of eight questions its options, a recommended default, the reasoning and the cost of being wrong. The way to reach the version was read from the release-please documentation and its source, not from a dry run. Each row was then accepted or overruled ([recorded decision](https://github.com/OpenReloading/Ballistics/issues/294#issuecomment-6506294350)).

## Formulas

None: a release process decision, no model equation.

## Numbers

Eight rows; six accepted as written, two (3 and 8) accepted with one change: no `hold` label.

| # | Question | Decision |
| --- | --- | --- |
| 1 | What the tag covers | Every versioned component (`schema`, `core`, `drawing`, `importers`, `data`, `api`, `cli`, `web`, `docs`) leaves 0.0.x together in one release pull request. Data format versions stay 1. |
| 2 | Version numbers | The same number for every component of row 1; the API contract version follows `@open-reloading/api`, routes stay under `/v1`. |
| 3 | How to reach the version | A `release-as` key per package in `release-please-config.json`, removed again by a second pull request right after the release. A `Release-As` commit footer does not survive the squash merge (the squash commit carries only the pull request title). No `hold` label. |
| 4 | Pre-major flags | `bump-minor-pre-major`, `bump-patch-for-minor-pre-major` and `prerelease` are removed in the same pull request as the `release-as` keys. |
| 5 | Alpha notice | Removed in that same pull request: `alphaNote`, the badge, the README line and the test that ties them together. |
| 6 | Changelog | The per-component `CHANGELOG.md` and GitHub Release text of release-please; one hand-written summary on the `web` release; no root changelog. |
| 7 | Support policy | Only the latest release gets fixes. No breaking change inside `/v1`; a break ships as `/v2` next to `/v1` for one minor series. A data format change raises the format version and reads the previous version for one major. |
| 8 | Order of publishing | The release pull request is merged by hand, then tags and GitHub Releases, the npm libraries (`schema` first), the API image, the Pages edition from the newest tag, and last a check of the release notes and a docs rebuild. No `hold` label: the weekly release stays as it is. |

## Result

no change. Documented as a decision, not adopted in code: no release week is picked, and the pull request that would carry rows 3 to 5 (`release-as` per package, the pre-major keys removed, the alpha notice removed) stays unbuilt. Every component stays on 0.x and is called pre-release until the owner plans the release; the table above is the reference for that day. The release configuration, the manifest, the versions and the labels are unchanged.

## Data basis

public: the decision table and the recorded decision on the public issue, and the repository's release configuration and workflows.

## Where in the app

- `release-please-config.json`: the packages and the pre-major keys rows 3 and 4 would change.
- `.release-please-manifest.json`: the last released version of each component.
- `apps/web/src/lib/alpha.ts`: `alphaNote`, which row 5 would remove.
- `.github/workflows/release-weekly.yml`: the weekly merge of the release pull request that row 8 keeps.
- [Releases and versions](../release.md): the flow and the release notes paragraph.

## Confidence

high: the decision is the recorded answer on the issue, and nothing in the repository changes with it.
