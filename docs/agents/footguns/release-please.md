# Releases (release-please)

Read before writing a pull request title or touching versions, changelogs or `release-please-config.json`. The full flow: [Releases and versions](../../../apps/docs/docs/release.md).

- The pull request title becomes the squash commit on `main` and the changelog line; only the types `feat`, `fix`, `perf`, `revert` and `docs` reach a changelog.
- The folders a commit touches decide which components release, not the scope in the title; dependents get a patch release too (the `node-workspace` plugin, dev dependencies included).
- `tools/src/catalog` writes the bundle of `catalog` but lies outside its folder: a change there that alters `bundle.json` releases nothing until a commit under `packages/catalog` does (release-please's package options take no extra paths).
- No breaking marker (`!`, `BREAKING CHANGE:`) before 1.0.0.
- Never edit `.release-please-manifest.json`, a component's `CHANGELOG.md` or the `version` in its `package.json`: release-please writes them in the release pull request.
- Leave the release pull request alone: a scheduled workflow merges it, and releases, tags and publishes are the owner's.
