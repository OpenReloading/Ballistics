# Decisions for the target photo flow of 1.0

Question (issue 289): which face colours the photo search supports, what quality bar the face search and the hole detection must meet, what the one-step proposal and one Accept decide for the user, where the discipline to caliber table comes from, and which of issues 28 and 29 become build issues.

Short answer: support stays "a black aiming area on light paper" until real photos open a gate per colour. The quality bar is a definition plus default numbers, measured later in issue 402 on the photos of issue 288. The one-step proposal applies the face, the scale and the confident holes on upload and leaves the hole size, ties and every low-confidence hole to the user. There is no hand-kept discipline to caliber table: candidates are derived from `Discipline.caliberClasses`, the hole size and the user's own records. Issues 28 and 29 merge into this decision and into six build issue drafts. No measured result is claimed anywhere in this note.

## What exists today (checked on `main`, 2026-10-28)

- Face search: `findFace`, `matchFaces` and `scoreMatch` in `apps/web/src/lib/target-face.ts`. It looks for a black area, fits ring lines around it, ranks faces and keeps those within `TIE` (0.5) of the best score. `sure` means one fit with enough matched rings and a good score. A face record with `photoSearch: false` is skipped (`target-face.ts`, `matchFaces`).
- Face records: 54 in `packages/data/records/target-faces`. 32 are searched. 22 carry `photoSearch: false`: 14 BDMP, 5 DSU, 2 ISSF moving-target faces and 1 DSB running-target face. Ring fills in the records are black, white and green; green occurs only on the 5 DSU faces, which the search skips. So every searched face is black and white.
- Hole detection: `autoDetect` and the pipeline in `apps/web/src/lib/hole-detection.ts` give each proposal a `confidence` between 0 and 1 (response over the median response of the five strongest peaks, `hole-detection.ts`, `shotsFromParts`). The editor lists proposals and can accept one (`onAccept` of the proposal list in `hole-detection.tsx`) or all (`Accept all`). Proposals stay apart from the shots until accepted (`apps/docs/docs/models/hole-detection.md`).
- Photo quality: `photoQuality` and `belowMinimum` in `apps/web/src/lib/photo-quality.ts`. A bad-level problem holds the one-click run after the face is applied; the button then reads Detect anyway.
- Hole size: `expectedHoleSize` in `apps/web/src/lib/hole-proposals.ts` takes the typed size, else the median of 3 or more confirmed holes, else the bullet diameter, else the marker diameter, else none. On `/groups` without a bullet or marker the size is none.
- Caliber: `Discipline.caliberClasses` (`ids`, `basis` `stated` or `derived`) in `packages/schema/src/federation.ts`; 23 `caliber-classes` records; 376 `disciplines` records. In `apps/web/src` the classes are read only by the discipline record page and its list (`discipline-record-page.tsx`, `disciplines.ts`, `api.ts`, `static-api.ts`). The photo flow shows no caliber candidates today.
- Federations in the data: BDMP, BDS, DSB, DSU, VdRBw (all Germany) and ISSF.
- Rendered cases: `apps/web/test/face-photos.ts` draws seven photo kinds (whole, insert, zoom, corner, cut, skewed, poor) with known holes. Three faces use them: `face-photos-air-rifle.test.ts` (ISSF 10 m air rifle), `face-photos-pistol.test.ts` (ISSF 25 m precision pistol) and `face-photos-bdmp.test.ts`. That is the face-search coverage today. Hole detection has eight drawn fixtures in `apps/web/test/fixtures/target-photos/` (`hole-detection-photos.test.ts`), among them an orange disc on a black diamond (`scan-orange.jpg`): the detector reads that face, the face search has no case for it. `photo-quality.test.ts` has 28 cases.
- Real photographs: issue 288 (owner task). Validation of the quality check and the detector: issue 402 (owner). Federation scope beyond Germany and the ISSF: issue 333. Faces whose rings are equal and no scale: issue 32.

## Decisions

| # | Question | Options | Recommendation and reasoning | Cost of being wrong | Default until overruled |
|---|---|---|---|---|---|
| 1 | Supported face colours | (a) black only, (b) add orange and tinted aiming areas now, (c) a gate per colour | (c). Support means a rendered case passes and real photos agree. A colour enters only with: a rendered case for each of the seven photo kinds that passes; five real photos from issue 288 of faces of that colour for which the search returns the right face first; and no change of the first choice on any existing rendered case. Without real photos, nothing is extended at 1.0. Reactive and coated faces stay on the manual scale step, which already works for every face. Adding a colour blind risks a wrong face applied with a wrong scale, which is worse than the manual step. | low | black only, manual scale for the rest |
| 2 | Faces covered | (a) shipped federations only, (b) add NRA, ICFRA, NBRSA and sport faces now, (c) follow the federation order of issue 333 | (a) at 1.0, (c) after. The faces of the shipped federations (Germany and the ISSF) are the ones with records and rendered cases. The faces issue 28 names (NRA, ICFRA, NBRSA, several bulls on a sheet, oval faces, two scoring zones, lever-action classes) follow the order that issue 333 settles. 22 of the 54 records are not searched yet: moving-target, running-target and the DSU green faces; each needs its own rendered case before `photoSearch` is lifted. | low | as stated |
| 3 | Quality bar | (a) a recall figure on holes, (b) corrections per photo, (c) both with face-search rates | (c), with corrections as the headline. Definitions in the next section. Defaults: median corrections 1 or fewer, 90th percentile 3 or fewer, first-choice face right on 90 percent of usable photos and wrong on 2 percent or fewer. A false hole weighs as much as a miss. The numbers are defaults; issue 402 measures and may move them by editing one number. | the bar moves by editing a number | as stated |
| 4 | What the one-step proposal decides | (a) face only, (b) face, scale, holes, caliber candidates, (c) also the hole size and the discipline | (b). Proposed and applied on upload: the first-choice face when `sure`, the scale it gives, the holes at or above the confidence tier, the caliber candidates. Left manual: faces with equal ring ratios and no scale (issue 32), the discipline when several map to the face, the caliber when two candidates share a hole size, the hole size when no bullet or marker gives it (asked in one field in the result line, not a step), and every low-tier hole, shown as "maybe" and never counted. One Accept confirms; nothing enters the statistics before it. Every applied item has a change link. | low | as stated |
| 5 | Discipline to caliber table | (a) a curated table of discipline and face to caliber, (b) derive from existing data | (b). Candidates come from `Discipline.caliberClasses` (the classes a rule book states or our expansion of a stated range), the hole size in the photo (separates .22, 9 mm and .45) and the user's own firearms and loads for ties (9 mm against .357). One source of truth, views derived. Rejected: a second hand-kept table, which would drift from the 23 class records and the 376 discipline records. | low | as stated |
| 6 | Issues 28 and 29 | (a) keep both, (b) merge into this decision and the build issues below | (b). Issue 28's goal (upload to scored target in one step, caliber candidates) is build drafts 1, 3 and 4. Issue 29's gap analysis and coloured faces are drafts 5 and 6; its "new faces are out of scope" matches row 2. Close both as merged once the build issues exist. | none | as stated |

## The quality bar as definitions

Reference sets: a set is photos with a hand-marked reference (face id, hole centres in target millimetres). The rendered cases of `face-photos.ts` are a set; the real photos of issue 288 are another. Sets are reported separately and never pooled.

- Usable photo: a photo with no bad-level problem in `photoQuality`. Photos held by a bad-level problem are counted per set as held, and reported beside the corrections (they are not hidden in them). A user who chooses Detect anyway moves a photo into the usable count of the session data, not of the reference sets.
- Matching: a proposal at or above the confidence tier matches a reference hole when they lie within half a hole diameter of each other, one to one, nearest pairs first. Found: matched. False: a proposal with no reference hole. Missed: a reference hole with no proposal.
- Corrections per usable photo: the operations a user needs to reach the reference: add, move or delete. With moves allowed this is `max(false, missed)`: each false hole paired with a miss is one move, the rest are deletes or adds. In field sessions it is counted as the add, move and delete actions after the proposal.
- Face search, per set: right first choice, wrong first choice, found but not first, not found (no fit), and `sure` against not `sure`. The bar counts a wrong first choice that is `sure` as the worst case.
- Statistics: median and 90th percentile of corrections. A 90th percentile needs 20 or more usable photos in the set; below that the maximum is reported and labelled with the set size.
- Default bar: median 1 or fewer, 90th percentile 3 or fewer, right first choice on 90 percent of usable photos with a wrong first choice on 2 percent or fewer. Never reported as "the detection is right" or "the photo is good" (as in `photo-quality.ts` today).

## Clicks and decisions today

An action is a click, a file choice or a value typed. A decision is something only the user can supply or confirm. Counts are read from the specs and the code; none was timed.

| Flow | Actions | Decisions | Rests on |
|---|---|---|---|
| Rendered face, no bullet or marker known, `/groups` (the common case) | 6: choose the photo; click Detect holes (face found, scale and centre applied, run stops with "Enter the hole size"); open the Example step; type the hole size; click Detect holes; click Accept all. Plus an optional Distance typed, which makes the face's event the discipline | hole size (typed), distance for the discipline (optional), Accept | `apps/e2e/tests/web/groups-face.spec.ts`, "one click finds the face" (the spec also opens the Scale and Detect steps to check them; whether those two clicks are needed was not checked) |
| Same, hole size known (bullet or marker diameter present) | 3: choose the photo; Detect holes; Accept all | Accept | from `expectedHoleSize` and `start` in `hole-detection.tsx`; no spec runs this variant |
| Photo with a bad-level problem | one more click: Detect anyway, then as above | read the named problem, retake or continue | `groups-face.spec.ts`, "a photo below the minimum quality" |
| Several faces with equal rings, or none fits | one more selection in Target face (or a typed black diameter and Enter), then as above | the face | `groups-face.spec.ts`, "no face fits", `target-face.ts` `fits` |
| No black area (any other target) | scale by hand: known length typed, Mark on photo, two clicks on the photo, then the face for scoring, the Example step, hole size, Detect holes, Accept all: about 12 including the photo and the Calibrate popover | scale, face, hole size, Accept | `groups-face.spec.ts`, "a face chosen for scoring on a sheet calibrated by a line" |

Of the decisions in the common case, the face, the scale and the centre are already automatic; the hole size and the Accept are not, and no caliber is offered at all. The target after the build issues for the common case is two actions (choose the photo, Accept) and one decision (Accept), with the hole size taken from a caliber candidate or typed once in the result line.

## Build issue drafts (none opens now)

Each is one pull request.

1. Web: detection starts when the photo is added. Result line: face, scale, hole count, caliber candidates, each with a change link; the hole size is one field in that line, not a step; no slider on the main path. Acceptance: in a Playwright count on a rendered face with a known bullet, photo to Accept is 2 actions; with an unknown size, 3 (the typed size). Needs nothing.
2. `target-face.ts`: a calibrated confidence on the ranked faces. Acceptance: `findFace` returns a confidence per fit; on the 21 rendered cases (7 kinds, 3 faces) the first choice does not change and the test prints the right/wrong counts. The structure can land first; the calibration needs the numbers of issue 402.
3. `hole-detection.ts`: confidence tiers on `HoleProposal.confidence`, the "maybe" display. Acceptance: proposals below the tier are shown as maybe, are left out of Accept all and of the statistics, and a Vitest case on the eight drawn fixtures keeps the recall and the false count it has now. Needs nothing; the tier value is tuned in issue 402.
4. Caliber candidate chips from `Discipline.caliberClasses`, the measured hole size and the user's records. Acceptance: a discipline with two classes shows both; two classes of equal hole size are both offered and left to the user; unconfirmed proposals stay out of the statistics; no data change. Needs nothing.
5. Counted clicks and decisions, before and after, in the pull request text and in `apps/docs/docs/models/hole-detection.md`, with the quality-bar definitions above. Acceptance: the doc table matches a spec assertion on the action count; `npm test -w @open-reloading/docs` passes. Needs nothing; the measured bar waits for issue 402.
6. Coloured face support, one pull request per colour, only through the gate of row 1. Acceptance: the gate's three conditions are met and linked in the pull request. Needs issue 288 (real photos).

## Dependencies and blockers

- Measured numbers of the bar (the tier value, the face confidence calibration, the 90th percentile): issue 402 on the photos of issue 288. Both stay with the owner.
- Face records beyond Germany and the ISSF, and lifting `photoSearch: false` on moving, running and green faces: after issue 333, each with its rendered case.
- Not checked here: no photo was opened, no test was run for this note; counts are read from the files named above.

## Provenance and licences

No row proposes code, models or data under a licence the project cannot ship. Real photographs enter the repository only with a documented open licence or the owner's written permission (`research/open-photos` on its branch lists what is available); a photo set of unclear provenance is not used, not even locally for a bar that is published. The drawn fixtures are generated by the repository's own scripts. No rule here speaks to the safety of a load or recommends a charge.
