# Reconciled map of the 1.0 milestone (pre-release)

Map issue: https://github.com/OpenReloading/Ballistics/issues/271. Read on 2026-10-30 from the tracker and from `integration/0.x-next-5` at 62b5d6a6. Everything stays on 0.x and is called pre-release; no release week is picked (#294 owner decision). Nothing here was built, labelled or edited except the milestone of #25 (decision below).

Commands used:

```sh
gh issue view 271 -R OpenReloading/Ballistics --json body -q .body
gh issue list -R OpenReloading/Ballistics --state all -L 600 --json number,state,labels,milestone,title,closedAt
gh api repos/OpenReloading/Ballistics/issues/271/sub_issues
gh issue view <n> -R OpenReloading/Ballistics --comments
```

Open issues today: 39 (101 on 2026-10-28). All 31 sub-issues of the map but #283 and #297 are closed.

## Decision taken on this pass

#25 lot shape: lots stay plain strings for the pre-release freeze (`lot` of the primer and case, `powderLot`, and the snapshot fields in `packages/schema/src/load.ts`). A lot record and its optional reference come after 1.0 as a format version change, because those objects are `z.strictObject` and a new key would make a newer file fail in an older reader. #25 moves to the after milestone; nothing is built. This agrees with `apps/docs/docs/research/lot-batch-traceability.md`, except that the reference beside the string is not reserved now.

## 1. Verdict table

One row per issue linked from the body (76). "Still": holds, stale (the line no longer describes the state) or superseded (a later decision replaced the plan).

| Issue | State and labels (2026-10-30) | Verdict in the body | Still | Replacement or note |
|---|---|---|---|---|
| #18 | closed [enhancement, data, priority:medium, ready-for-agent] m:Next | Kept, ready (rule facts) | stale | Built and closed. |
| #22 | open [enhancement, web, priority:medium] m:Next | After 1.0 (#292), label removed | holds |  |
| #25 | open [enhancement, web, priority:medium] m:Next | Keep for the lots, picker waits for #296 | stale | See stale line L2. |
| #27 | closed [enhancement, core, web, priority:medium] m:Next | Full scope in 1.0, decided by #285 and #286 | stale | Decided by #285 and #286 and closed. |
| #28 | closed [enhancement, web, priority:medium, ready-for-human] m:Next | Merge into #289 | stale | Closed as merged into #289. |
| #29 | closed [enhancement, web, priority:medium, ready-for-human] m:Next | Merge into #289 | stale | Closed as merged into #289. |
| #32 | closed [bug, web, priority:medium, ready-for-agent] m:Next | Kept, open part decided in comments | stale | Built and closed. |
| #33 | closed [enhancement, web, priority:medium, ready-for-agent] m:Next | Kept, unblocked, stored result open | stale | Built and closed. |
| #36 | closed [enhancement, data, api, web, priority:low, ready-for-human] m:Next | Code done, close after #297 | superseded | Closed before #297 answered; real primer data still comes through #297. |
| #43 | closed [accessibility, enhancement, web, priority:low] m:Later | Close after #288 | superseded | Closed; #288 was closed as not planned (local photographs only). |
| #51 | closed [enhancement, web, priority:low] m:Later | Close after #288 | superseded | Closed; #288 was closed as not planned (local photographs only). |
| #54 | closed [enhancement, core, priority:high, ready-for-agent] m:Next | Split, criteria into #279 | stale | Closed; validation numbers come from local runs (#278 decision). |
| #63 | open [enhancement, web, spike, priority:low, ready-for-human] m:Later | After 1.0, kept open | holds |  |
| #94 | open [enhancement, needs-triage, tools, priority:low] m:after | Keep, owner setting | holds | Milestone after; owner step unchanged. |
| #184 | open [bug, priority:medium, ready-for-human] m:1.0 | Keep, owner steps | stale | See stale line L5. |
| #216 | closed [enhancement, area: other, needs-triage, web, spike, priority:medium] | Graduates into #290 | holds |  |
| #217 | closed [enhancement, web, spike, priority:medium] m:1.0 | Sync part after 1.0 | holds | Spike closed; offline part decided, sync after 1.0. |
| #218 | open [enhancement, area: shot groups, area: disciplines, web, spike, priority:medium] m:after | After 1.0, kept open | holds |  |
| #219 | open [enhancement, spike, priority:low] m:after | After 1.0, kept open | holds |  |
| #221 | open [enhancement, web, spike, priority:low] m:after | After 1.0, kept open | holds |  |
| #222 | open [enhancement, area: shot groups, area: disciplines, web, priority:medium] m:after | After 1.0, kept open | holds |  |
| #227 | closed [enhancement, core, spike, priority:high, ready-for-agent] m:Next | Keep, synthetic study | stale | Closed (study done, see the research log). |
| #236 | closed [tools, ready-for-agent] | Landed, closed | holds |  |
| #242 | open [enhancement, web, importers, priority:medium, ready-for-human] m:1.0 | Build issue, not ready until #282, #283, #284 close | stale | See stale line L6. |
| #243 | open [enhancement, web, importers, priority:medium, ready-for-human] m:1.0 | Build issue, not ready until #282, #283, #284 close | stale | See stale line L6. |
| #244 | closed [enhancement, web, importers, priority:medium, ready-for-agent] m:1.0 | Build issue, not ready until #282, #283, #284 close | stale | Built and closed. |
| #245 | open [enhancement, web, importers, priority:low, ready-for-human] m:1.0 | Build issue, not ready until #282, #283, #284 close | stale | See stale line L6. |
| #246 | open [enhancement, web, priority:low, ready-for-agent] m:after | Keep, rewritten, not ready until the owner agrees | stale | See stale line L4. |
| #256 | closed | Landed, closed | holds |  |
| #264 | closed [enhancement, web, ready-for-agent] m:1.0 | Kept, ready | stale | Built and closed. |
| #265 | closed [enhancement, web, ready-for-agent] m:1.0 | Kept, ready | stale | Built and closed. |
| #266 | closed [enhancement, web, ready-for-agent] m:1.0 | Kept, ready | stale | Built and closed. |
| #269 | pull request, merged | develop commits landed on main (pull request) | holds | Pull request, merged. |
| #272 | closed [wayfinder:grilling] | Decision: all four contracts freeze at 1.0 | holds |  |
| #273 | closed [wayfinder:research] | Decision: next-intl with a locale prefix | superseded | Superseded by #295 (no URL prefix); body already says so under #295. |
| #274 | closed [wayfinder:research] | Decision: 177 sourced terms | holds |  |
| #275 | closed [wayfinder:research] | Decision: audit method | holds |  |
| #276 | closed [wayfinder:grilling] | Decision: accessibility gate | holds |  |
| #277 | closed [wayfinder:research] | Decision: almost no open data | holds |  |
| #279 | closed [priority:high, ready-for-agent, wayfinder:grilling] m:1.0 | Validation protocol decides pooled fit criteria | stale | Closed; protocol is apps/docs/docs/models/validation.md. |
| #280 | closed [wayfinder:research] | Decision: no maker allows publishing without a grant | holds |  |
| #281 | closed [wayfinder:grilling] | Decision: permission requests plus user import | holds |  |
| #282 | closed [wayfinder:research] | Decision: load files are readable formats | holds |  |
| #283 | open [wayfinder:task] m:1.0 | Blocks #242, #243, #245 | holds | Still open, owner material. |
| #284 | closed [wayfinder:prototype] m:1.0 | Decides the import entry | stale | Closed; `imported` field is in packages/schema/src/user-data.ts. |
| #285 | closed [wayfinder:prototype] m:1.0 | Decides powder tuning screen | stale | Closed. |
| #286 | closed [wayfinder:grilling] m:1.0 | Decides user powders | stale | Closed; `fit` block is in packages/schema/src/user-data.ts. |
| #287 | closed [wayfinder:research] | Decision: few open photos | holds |  |
| #288 | closed [wayfinder:task] m:1.0 | Real-photo check, then close #43, #51 | superseded | Closed as not planned: local photographs only, nothing committed. |
| #289 | closed [wayfinder:grilling] m:1.0 | Decides photo flow, then splits #28, #29 | stale | Closed. |
| #290 | closed [wayfinder:prototype] m:1.0 | Homepage variants | stale | Closed. |
| #291 | closed [wayfinder:grilling] | Decision: unmoderated task list | holds |  |
| #292 | closed [wayfinder:grilling] | Decision: guides after 1.0 | holds |  |
| #293 | closed [wayfinder:grilling] | Decision: server edition removed | holds |  |
| #294 | closed [wayfinder:grilling] m:1.0 | Release checklist after #294 | stale | See stale line L7. |
| #295 | closed [wayfinder:grilling] | Decision: German UI policy | holds |  |
| #296 | closed [wayfinder:prototype] m:1.0 | Decides workbench layout | stale | Closed. |
| #297 | open [wayfinder:task] m:1.0 | Permission requests, real data | holds | Still open, owner sends the letters. |
| #298 | closed [wayfinder:research] | Research: record page weight | holds |  |
| #299 | closed [wayfinder:grilling] | Decision: small file per record | holds |  |
| #300 | closed [ready-for-agent] | Spec: remove server edition | holds | Done. |
| #301 | closed [ready-for-agent] | Ticket of #300 | holds | Done. |
| #304 | closed [ready-for-agent] | Ticket of #300 | holds | Done. |
| #305 | closed [ready-for-agent] | Ticket of #300 | holds | Done. |
| #306 | closed [ready-for-agent] | Spec: record pages | holds | Done. |
| #307 | closed [ready-for-agent] | Pilot | holds | Done. |
| #308 | closed [ready-for-agent] | Rollout | holds | Done. |
| #309 | open m:1.0 | Spec: accessibility gate | holds | Open until the #313 report. |
| #310 | closed [ready-for-agent] | Ticket of #309 | holds | Done. |
| #313 | open [ready-for-human] m:1.0 | Owner pass | holds | Open, owner. |
| #315 | closed [ready-for-agent] m:1.0 | Spec: German UI | holds | Done. |
| #316 | closed [ready-for-agent] | Ticket of #315 | holds | Done. |
| #322 | closed [ready-for-agent] | Ticket of #315 | holds | Done. |
| #331 | closed [wayfinder:research] | Research: practical shooting bodies | holds |  |
| #332 | closed [wayfinder:research] | Research: national federations | holds |  |
| #405 | closed [wayfinder:map] m:1.0 | Gaps map | stale | Closed; its open items are #469, #470, #472, #476, #481. |

### Issues opened after the body (#338 onwards)

207 of them are closed. The 21 open ones:

| Issue | Milestone | Verdict |
|---|---|---|
| #351 reference books | after | after 1.0 |
| #367 propellant temperature spike | Next | after 1.0 (model work, covered by #401, closed) |
| #402 photo quality gate | 1.0 | 1.0 gate; waits for #588 |
| #464 calibrated face confidence | 1.0 | after 1.0 recommended on the issue (owner moves the milestone) |
| #468 coloured faces per colour | 1.0 | after 1.0 recommended on the issue (owner moves the milestone) |
| #469 npm setup | 1.0 | 1.0, owner steps, waits for a release week (#294) |
| #470 npm pack check in CI | 1.0 | 1.0, owner adds one CI line |
| #472 release checklist | 1.0 | 1.0, last item of the order |
| #476 supported browsers | 1.0 | 1.0, owner adds the CI lines |
| #481 scanner and Scorecard alerts | 1.0 | 1.0, owner dismisses; Scorecard part after the first run on `main` (2026-11-02) |
| #496 printable grid target | after | after 1.0 |
| #588 hole detection holdout | 1.0 | 1.0, waits for the owner's labels and second sealed batch |
| #626 impact note on the ladder page | none | after 1.0; waits for the feature to be built (its own comment) |
| #630 text spacing leftovers | none | known list: WCAG 1.4.12 is level AA, not a level A blocker under #276; needs triage |
| #631, #634 to #639 | Later | after 1.0, from the maps #373 and #374 (closed) |

## 2. Stale and superseded lines, replacement text

Each block replaces the named line of the body. Cost of being wrong and the default are given per line.

**L1, Kept (#18, #32, #33, #264, #265, #266, #227).** Replace the five bullets with:
> - Built and closed: [#18](https://github.com/OpenReloading/Ballistics/issues/18), [#32](https://github.com/OpenReloading/Ballistics/issues/32), [#33](https://github.com/OpenReloading/Ballistics/issues/33), [#264](https://github.com/OpenReloading/Ballistics/issues/264), [#265](https://github.com/OpenReloading/Ballistics/issues/265), [#266](https://github.com/OpenReloading/Ballistics/issues/266) and the pressure exponent study [#227](https://github.com/OpenReloading/Ballistics/issues/227).

Cost if wrong: none, the states are read from the tracker. Default: paste.

**L2, #25 lots.** Replace with:
> - [Own cases and component lots as user records](https://github.com/OpenReloading/Ballistics/issues/25): after 1.0. Lots stay plain strings in the pre-release freeze; a lot record and its reference come later as a format version change (strict objects reject a new key in older readers).

Cost if wrong: if a lot record is wanted at 1.0 after all, adding it after the freeze costs a format version. Default: strings only (decision above).

**L3, #296, #27, #285, #286, #28, #29, #289, #216, #290, #54, #279.** Replace the "Decided by a ticket first" bullets for these with:
> - Decided and closed: workbench layout [#296](https://github.com/OpenReloading/Ballistics/issues/296), powder tuning [#27](https://github.com/OpenReloading/Ballistics/issues/27) with [#285](https://github.com/OpenReloading/Ballistics/issues/285) and [#286](https://github.com/OpenReloading/Ballistics/issues/286), photo flow [#289](https://github.com/OpenReloading/Ballistics/issues/289) (with #28 and #29 merged), homepage [#290](https://github.com/OpenReloading/Ballistics/issues/290), pooled fit [#54](https://github.com/OpenReloading/Ballistics/issues/54) and the validation protocol [#279](https://github.com/OpenReloading/Ballistics/issues/279) (`apps/docs/docs/models/validation.md`).

Cost if wrong: none. Default: paste.

**L4, #246 version line.** Replace with:
> - [Show the web app version, commit and edition](https://github.com/OpenReloading/Ballistics/issues/246): after 1.0 milestone, `ready-for-agent`.

Cost if wrong: low, a settings line. Default: paste.

**L5, #184 SonarCloud.** Replace the #184 half of its bullet with:
> - [SonarCloud: mass range regex and dependency risks](https://github.com/OpenReloading/Ballistics/issues/184): regex and deepmerge done; 11 code findings and 8 dependency risks remain. Owner: swap the label to `ready-for-agent`, allow accepting the four keyboard-reach findings, paste the signed-in dependency risks.

Cost if wrong: a red quality signal at release; no product effect. Default: the recommendation on #184.

**L6, imports #242, #243, #244, #245.** Replace with:
> - Generic bulk import [#244](https://github.com/OpenReloading/Ballistics/issues/244) built and closed; #282 and #284 closed. The load-file imports [#242](https://github.com/OpenReloading/Ballistics/issues/242), [#243](https://github.com/OpenReloading/Ballistics/issues/243) and [#245](https://github.com/OpenReloading/Ballistics/issues/245) wait for owner answers: files in a local folder (#283), the yes for a container run of the free program (#245), the licence answer and a copy for #243 (else #243 moves after 1.0).

Cost if wrong: an import without real sample files can mis-map fields; the issues keep invented fixtures only. Default: the recommendations on #242, #243, #245.

**L7, release checklist after #294.** Replace with:
> - The 1.0 release checklist: [#472](https://github.com/OpenReloading/Ballistics/issues/472). #294 is decided (table accepted, no `hold` label, no release week picked, everything stays on 0.x and is called pre-release until the owner says otherwise).

Cost if wrong: none until a week is picked. Default: paste.

**L8, photographs #43, #51, #288 and #36 with #297.** Replace with:
> - [#43](https://github.com/OpenReloading/Ballistics/issues/43), [#51](https://github.com/OpenReloading/Ballistics/issues/51) and [#288](https://github.com/OpenReloading/Ballistics/issues/288) closed: detection checks use local photographs only, aggregates reported, nothing committed; the real-photo gate is [#402](https://github.com/OpenReloading/Ballistics/issues/402) with [#588](https://github.com/OpenReloading/Ballistics/issues/588). [#36](https://github.com/OpenReloading/Ballistics/issues/36) closed; real primer data still comes through [#297](https://github.com/OpenReloading/Ballistics/issues/297).

Cost if wrong: none. Default: paste.

**L9, Decisions so far, #273.** Append to its line:
> Superseded by #295: no URL prefix, one page tree.

Cost if wrong: none. Default: paste.

## 3. Not yet specified, resolved

| Bullet | Covered by |
|---|---|
| German UI | #315 with #316 to #322, closed |
| Accessibility audit and fixes | #309 with #310 to #313; only #313 (owner pass) open |
| Removing the server edition | #300 with #301 to #305, closed |
| Real data: how many records, fate of demo records | #297; recommendation there: ship the values granted by then plus invented demo records marked as such |
| Importer details | #242, #243, #245 after #283; mapper and `imported` field done in #244 and #284 |
| Pooled fit and exponent study in 1.0 | #54 and #227 closed; validation numbers from local runs (#278 decision) |
| Model coverage gaps | #401, closed (CLI `verify` and `compare` on `main`, #400) |
| Feedback | #479, closed (`apps/docs/docs/feedback-tasks.md`); the channel post is the owner's |
| Browsers, phones, performance | #476 (`apps/docs/docs/browsers.md`), CI lines with the owner |
| Documentation for 1.0 | #477 (a docs page per published library), closed; German docs after 1.0 (#295) |
| Community and contribution process | #478 (`CONTRIBUTING.md` section), closed |
| Release checklist | #472 after #294 |
| Gaps no issue covered | #405, closed; open remainder #469, #470, #472, #476, #481 |

## 4. One order (open work of the 1.0 milestone)

No item blocks an earlier one.

1. #297 send the permission letters. Blockers: none (owner). 1.0 does not wait for answers.
2. #283 sample load files, #245 yes for the container run, #243 licence answer. Blockers: none (owner).
3. Freeze check: the contract baselines (`packages/schema/test/golden`, the web golden user data file, the export lists in `tools/test/golden`) are the frozen shapes; no stored-shape change is open after the #25 decision. Blockers: none.
4. #245 load-file import. Blocker: 2.
5. #242 load-file import. Blockers: 2 (files from #283 or the run of #245).
6. #243 load-file import. Blocker: 2 (licence answer and files); else after 1.0.
7. #588 hole detection holdout and tuning. Blocker: owner labels (61 of 62 done) and the second sealed batch.
8. #402 photo quality gate. Blocker: 7.
9. #184 SonarCloud findings. Blocker: owner label swap and acceptance answer.
10. #313 keyboard and screen reader pass, then #309 closes. Blocker: none (owner); repeat changed steps before a release.
11. #470 npm pack check in CI. Blocker: owner adds the line to `ci.yml`.
12. #476 browser smoke run in CI. Blocker: owner adds the lines to `ci.yml`.
13. #481 alert triage. Blocker: owner dismissals; Scorecard part after 2026-11-02.
14. #469 npm setup. Blocker: a release week from the owner (#294).
15. #472 release checklist. Blockers: 11, 14.

Milestone moves recommended on the issues, owner: #464 and #468 to after 1.0.

Difference from the order of the gaps map #405: #405 put #294 first; #294 is now decided, so release work sits at the end here, as both orders already agreed.

## 5. Owner-only steps

One line each; details in the linked issue.

- #294: pick a release week when wanted; until then nothing leaves 0.x.
- #297: review and send the letters, record each answer.
- #283, #245, #243: local files, the container-run yes, the licence answer.
- #588: finish the labels and the second sealed batch.
- #184: label swap, the acceptance answer, the signed-in dependency risks.
- #313: the manual pass.
- #470, #476: the CI lines in `.github/workflows/ci.yml`.
- #481: dismiss the 14 image alerts; triage Scorecard after its first run on `main`.
- #469: npm organization, first publish, trusted publishers, `NPM_PUBLISH`.
- #464, #468: move the milestones.
- #94: the CodeQL setting (after milestone).
