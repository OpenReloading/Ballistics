# What 1.0 needs that no open issue covers

Map for #405 (part of #271). Each of the ten open items gets a verdict, its dependencies, a recommendation, the cost of being wrong and the default that follow-up work uses until the owner overrules it. Nothing here changes release configuration, versions, settings, alerts or records.

Facts read on `main` at `400863a5` on 2026-10-28. Every number has its command under "Facts and commands".

## Map

"Decided" means settled by the owner decision named in the row. "Default" is what follow-up work does until the owner says otherwise.

| # | Item | Verdict | Depends on | Recommendation and default | Cost of being wrong |
|---|---|---|---|---|---|
| 1 | npm setup | Owner-only for the settings; one new ticket for a pack check | Owner steps around the 1.0.0 merge | The npm docs set up a trusted publisher in the package settings ([npm, Trusted publishing](https://docs.npmjs.com/trusted-publishers)), so a package has to exist first; `release.md:51` already says to publish the first version by hand then. The same page says a configuration made after 2026-09-03 allows only `npm stage publish` unless direct publishing is also selected, while `release.yml:253` runs `npm publish`, and a new configuration must complete its first publish within 2 days. Default: no 0.0.x on npm. The owner publishes 1.0.0 of each library by hand from the 1.0.0 tags (the steps of `release.md:51`, at the tag instead of `main`), then adds each trusted publisher with direct publish allowed within 2 days before the next library release and sets `NPM_PUBLISH`. `release.md` gets those two facts in the checklist ticket (item 3). Worker work meanwhile: a CI step that runs `npm pack --dry-run --json` per library and fails on a missing `dist` entry, a stray test or source map, or a file outside `files`. Nothing in CI packs a library today. | Medium: a broken first tarball cannot be replaced under the same version (npm rule, unverified); the pack check removes most of that risk. An expired or stage-only configuration fails the next `publish` job, which a re-run fixes once the setting is corrected. |
| 2 | Version text | Covered by #294 (row 3 and its follow-up 1) | after #294 is accepted | `release.md:12` says the manifest holds 0.0.0; it holds 0.0.3 and 0.0.4 (0.0.0 only for `cli`). `AGENTS.md:85` says packages are set to 0.0.1 at the public release. Fix both in pull request A of #294 (`release-as` 1.0.0), so the text is true at 1.0.0: the 0.0.x bullets go and `AGENTS.md:85` says "until 1.0". If #294 slips, a one-line fix of `release.md:12` alone is worth doing now. | Low: docs text only. |
| 3 | Release checklist and the 1.0.0 mechanism | Mechanism covered by #294; checklist is a new ticket | after #294; #400/PR 406 already merged | `cli` is now in `release-please-config.json:31` and the manifest, and `packages/cli/package.json:4` is `private`, so the "not in the config" part of the item is done. One gap: the manifest holds `cli` at 0.0.0 while `packages/cli/package.json:3` says 0.0.1; with `release-as` 1.0.0 this does not matter. #294 recommends `release-as: "1.0.0"` per package in the config, not a `Release-As:` footer (squash commits here carry only the title), with the label `hold` on the release pull request and a removal pull request right after. Default checklist (a `docs(release)` section in `release.md`): (1) pull request A merged; (2) `hold` on the release pull request; (3) every component reads 1.0.0, else a `docs(<scope>)` commit in that folder (#294, a dependent-only bump gives 0.0.5); (4) pack check green; (5) owner merges by hand; (6) tags, npm, image, Pages, docs in the order of #294 row 8; (7) pull request B removes `release-as` before the next Monday run. | Medium: a missed step leaves a component at 0.0.5 or proposes a second 1.0.0; the checklist and `hold` cover both. |
| 4 | Format freeze beyond the API | Decided by #272 (freeze all four contracts at 1.0); the guard is a new ticket | the check has no dependency; the baseline waits for the last stored-shape change (#373, #374 first slices, #25) | Today only `packages/api/openapi.baseline.json` guards a shape (`npm run api:check`). `packages/schema/src/write-json-schema.ts:23` writes the JSON Schemas into `dist/json-schema` at build (`packages/schema/package.json:28`), which is git-ignored, so nothing compares them. Default: commit a baseline of those JSON Schemas, a golden user data file and a golden share link (`apps/web/src/lib/share-link.ts:37-41`, format, version and the deflate-raw payload), and an export list per published package; a test compares each against the build. Before 1.0 a pull request may rewrite a baseline in the same change; from 1.0 a rewrite needs the `!` marker of `release.md`. | Medium: without it a shape change after 1.0 slips through review; with it too early, every shape change rewrites a file (cheap). |
| 5 | Alpha-era browser data | Decided by #272 (formats stay version 1, migrations start with the first change after 1.0) and #217 (no real users before 1.0) | after the format freeze ticket (4) | No migration at 1.0. Because the format version stays 1, alpha files and share links still pass `versionProblem` (`packages/schema/src/user-data.ts:381-385`), which refuses only another version. Records in the browser store survive too: the store upgrades in place without touching records (`apps/web/src/lib/user-store.ts:17-30`) and keeps records that fail the schema as `invalid` (`user-store.ts:70`). What a user sees: their data, with a stored record of an older shape listed as invalid. Default: the 1.0.0 release notes tell alpha users to use Export all before updating. No code change. | Low: no real users before 1.0. |
| 6 | Real records for 1.0 | Covered by #297 (permission requests) and #244 (bulk import); sending is owner-only | after #297 answers and #244 | Records are 577 cartridges, 376 disciplines, 54 target faces, 418 target mappings, 23 caliber classes, 6 federations and 19 sources from public standards and rule books; components are demo only (2 bullets, 1 powder, 2 primers, 1 case, 4 manufacturers, every id `demo-`). Default: no minimum count for 1.0. 1.0 ships the records that have a written grant or a public source; demo components keep their `demo-` ids and stay as examples. Gate: no record names a source that does not allow it. | Medium: a thin component database at 1.0 disappoints users but harms nothing; a record without permission is a real cost, which the gate prevents. |
| 7 | Targets: browsers, phone sizes, performance, weight | New ticket | none | The web app has no `browserslist`, so Next.js 16.4.2 (`apps/web/package.json:30`) applies its default: Chrome 111, Edge 111, Firefox 111, Safari 16.4 ([Next.js, Supported browsers](https://nextjs.org/docs/architecture/supported-browsers)). Share links use `CompressionStream('deflate-raw')` (`share-link.ts:41`), which MDN lists for Chrome 103, Firefox 113 and Safari 16.4 ([MDN browser compat data](https://github.com/mdn/browser-compat-data/blob/main/api/CompressionStream.json)), A grep for newer built-ins in `apps/web/src` and the sources of core, drawing, schema, api, importers and data (not exhaustive) finds `Array.prototype.toSorted` (for example `apps/web/src/lib/face-disciplines.ts:75`; MDN: Chrome 110, Firefox 115, Safari 16) and `URL.canParse` in `packages/schema/src/provenance.ts:78` (MDN: Chrome 120, Firefox 115, Safari 17), which runs wherever a source record is validated in the browser. Whether the Next.js build polyfills either is unverified. So the real floor today is Chrome and Edge 120, Firefox 115, Safari 17. Default: replace `URL.canParse` with a `new URL` inside `try` (one line), then state Chrome and Edge 111, Firefox 115, Safari 16.4 (iOS too) on a docs page "Supported browsers", with a test that greps for built-ins above that list; phone widths 320 and 390 CSS px (the axe sweeps already run at 320, 390 and 1280, `apps/e2e/AGENTS.md:18-19`); weight budgets stay as `apps/web/weight-budget.json` records them; one Playwright smoke run per engine (Chromium, Firefox, WebKit). No performance number beyond the weight budget for 1.0. | Low: a list on a docs page can widen later; an engine run catches the costly case, a page that does not load. |
| 8 | 1.0 documentation scope and contribution process | Partly decided: guides and tours after 1.0 (#292), German docs after 1.0 (#295) | after #294 | English at 1.0: the model pages, the data pages, the REST reference, the TypeDoc library pages, `release.md`, `cli.md`, `translating.md`, `accessibility.md`. Open: a package page per published library (install, entry points, one example), which the npm pages will link. Contribution: `CONTRIBUTING.md` has Setup, Before a pull request, Rules, Commits, Releases; it lacks how to ask for a record or a permission, translations (`apps/docs/docs/translating.md` exists, not linked from it) and what review means. Default: one ticket for the package pages, one for a `CONTRIBUTING.md` section "Data requests, translations and review". | Low: docs can follow in a minor release. |
| 9 | Feedback gate | Decided by #291 (optional unmoderated task list, general feedback in the community channels, after the navigation and naming issues) | #264 and #265 are closed, so the gate is open | Default: one ticket for the task list text (six tasks from #291, each a page and a goal: first load in the workbench, a chronograph session, truing, a shot group from a photo, an import, a pass through the German UI) as a docs page, and one draft of the channel post. The owner posts. Findings become issues with a label (#291). | Low. |
| 10 | Code-scanning alerts | New ticket; #94 covers only the CodeQL suite | none | 37 open: 29 Grype (9 error, 18 warning, 2 note), 8 Scorecard (all error), none from CodeQL. Grype: 15 for `image-api`, 14 for `image-web`. The web image is no longer built (`release.yml:68-71` builds `api` only; the `image-web` alerts are from the 2026-10-27 release), so those 14 go once the owner dismisses them as "not used". Of the 15 `image-api` alerts, 14 are in the npm that ships inside the Node base image (`/usr/local/lib/node_modules/npm`: brace-expansion, undici, ip-address, postcss-selector-parser) and 1 is in the TypeScript native binary (`@typescript/typescript-linux-x64`), which `npm ci --omit=dev` keeps (`packages/api/Dockerfile:38`) because the lockfile marks it optional, not dev. Default fix: remove npm and that binary from the runtime stage of `packages/api/Dockerfile` after its `npm ci`; the image runs `node dist/server.js` (`Dockerfile:48`) and the compose health check runs `node -e` (`compose.yaml:10`), so neither needs npm. That clears all 15 on the next release scan. Scorecard: SecurityPolicy, SAST, CII best practices, Maintained, CodeReview, Vulnerabilities, PinnedDependencies (an `npm` command not pinned by hash), BranchProtection; list each with the fix or the accepted reason (the Maintained alert says the project was created within the last 90 days; CodeReview and BranchProtection depend on settings). | Low: the npm and tsc findings are not reachable from the API's code, but they show on every release. |

## Owner-only steps

- Create the npm organization `open-reloading`.
- Publish 1.0.0 of schema, core, drawing, importers and data by hand from the 1.0.0 tags (`release.md:51`), or choose another first version.
- Add a trusted publisher (OpenReloading/Ballistics, `release.yml`) for each library with direct `npm publish` allowed, within 2 days before the next library release.
- Set the repository variable `NPM_PUBLISH` to `true` once the trusted publishers exist.
- Accept or overrule the #294 decisions.
- Put `hold` on the 1.0.0 release pull request and merge it by hand.
- Send the permission requests of #297.
- Post the feedback request in the community channels.
- Dismiss the 14 `image-web` alerts and the Scorecard alerts that stay accepted.
- Change branch protection or review settings if the Scorecard rows should clear.

## Proposed order

1. Owner accepts #294 (or overrules it).
2. Pull request A of #294: `release-as` 1.0.0, pre-major keys removed, alpha notice removed, version text (item 2).
3. Format freeze guard (item 4), then its baseline after the last stored-shape change.
4. In parallel with 3: pack check (item 1), browser targets (item 7), API image scan fix (item 10), docs pages (item 8), feedback task list (item 9).
5. Release checklist (item 3), once 2 to 4 exist.
6. Release: owner steps, the 1.0.0 merge, then pull request B of #294.

Owner steps for npm, permissions and the feedback post run in parallel from now; they block only the publish and the real-record count. No step depends on a later one.

## Ticket drafts

One pull request each.

- `ci(release): check the npm tarball of each library with npm pack` (item 1). Blockers: none.
- `docs(release): fix the manifest and version text` (item 2). Blockers: #294 accepted, else only `release.md:12` now.
- `docs(release): 1.0.0 release checklist` (item 3). Blockers: #294 pull request A, the pack check.
- `test(schema): baselines for JSON Schemas, user data file, share link and package exports` (item 4). Blockers: none for the check; the baseline after #373, #374 first slices, #25.
- `docs(release): alpha users export before updating, in the 1.0.0 notes` (item 5). Blockers: item 4.
- `fix(schema): check source links without URL.canParse` (item 7). Blockers: none.
- `docs: supported browsers page, a built-in check and a Playwright run per engine` (item 7). Blockers: the `URL.canParse` fix.
- `docs: a page per published library` (item 8). Blockers: #294.
- `docs(contributing): data requests, translations and review` (item 8). Blockers: none.
- `docs: feedback task list for the 1.0 gate` (item 9). Blockers: none.
- `fix(api): leave npm and the TypeScript binary out of the API image` (item 10). Blockers: none.
- `docs: Scorecard findings with fix or accepted reason` (item 10). Blockers: none.

Item 6 needs no new ticket: #297 and #244 carry it.

## Facts and commands

All run from the repository root at `400863a5`.

| Fact | Command |
|---|---|
| The five libraries are not on npm (404 each) | `curl -s -o /dev/null -w '%{http_code}' https://registry.npmjs.org/@open-reloading%2f<name>` |
| Manifest versions | `cat .release-please-manifest.json` |
| `release.md` and `AGENTS.md` version lines | `grep -n '0\.0\.' apps/docs/docs/release.md AGENTS.md` |
| `cli` in the release config and private | `grep -n cli release-please-config.json`, `grep -n private packages/cli/package.json` |
| Record counts | `ls packages/data/records/<kind> \| wc -l`; `find packages/data/records/<kind> -type f \| wc -l` for nested kinds |
| Demo ids | `grep -rh '"id"' packages/data/records/{bullets,powders,primers,cases,manufacturers}` |
| JSON Schemas are build output only | `git check-ignore -v packages/schema/dist/json-schema/load.json` |
| No browserslist, Next.js version | `grep -n browserslist apps/web/package.json package.json`; `grep -n '"next"' apps/web/package.json` |
| `CompressionStream` support | MDN browser compat data, `api/CompressionStream.json`, `deflate-raw` |
| 37 alerts by tool, severity, category, rule | `gh api --paginate 'repos/OpenReloading/Ballistics/code-scanning/alerts?state=open&per_page=100' --jq '.[] \| [.tool.name, .rule.severity, .rule.id, .most_recent_instance.location.path, .most_recent_instance.category] \| @tsv'` |
| TypeScript binary kept by `--omit=dev` | `package-lock.json`, entry `node_modules/@typescript/typescript-linux-x64`: `optional: true`, no `dev` |
| Images built | `grep -n dockerfile .github/workflows/release.yml` |
| `image-web` alerts date from the 2026-10-27 release | `gh api 'repos/OpenReloading/Ballistics/code-scanning/alerts?state=open&tool_name=Grype' --jq 'map(select(.most_recent_instance.category=="image-web"))[0].most_recent_instance.commit_sha'`, then `git log -1 --format='%ad %s' --date=short <sha>` |
| Newer built-ins in browser code | `grep -rnE 'toSorted\(\|findLast\|URL\.canParse\|Object\.groupBy\|withResolvers' apps/web/src packages/{core,drawing,schema,api,importers,data}/src`; MDN browser compat data for each |
| npm trusted publishing rules | [npm, Trusted publishing](https://docs.npmjs.com/trusted-publishers), read 2026-10-28 |
