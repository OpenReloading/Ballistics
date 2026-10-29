---
title: Hole detection tuning candidates
description: One-setting changes of the hole detector measured against the quality bar on a tuning set of target photos, and the sealed holdout that waits for a label check.
---

# Hole detection tuning candidates

## Question

Hole detection: does a change of one detector setting (or the confidence tier) bring the corrections per photo to the quality bar of the [hole detection](../models/hole-detection.md) page on real target photos, so that it can go to a holdout check?

## Method

Decided before the runs.

- Tuning set: 566 third-party target photos that earlier measurements have already scored. Every candidate is measured on it, and it decides which candidates go on.
- Holdout: 62 new target photos from 39 source posts that no earlier measurement or candidate has used. A cropped re-post of a tuning photo, and photos of the same shooter and setup as a tuning photo, were left out. They are stratified by target type and photo quality and sealed. No candidate reads them until a person has checked their labels. A candidate set may look at them at most three times in total, with the aggregates logged after each look.
- Labels: visible hole centres, unresolved regions and photo quality are model-made visual annotations, not human-verified. A photo counts as complete when every visible centre is marked. On a partial photo, unmarked areas are not negatives. The holdout labels come from a different annotating model than the tuning labels, so the two sets are not labelled alike.
- Flow per photo, as in the web worker: the photo quality check, then the face search, with the first fit taken whether it is sure or not. Detection then runs on the face (or on the whole photo when no face fits), with the median marked hole diameter as the hole size and a contrast of 0.15. The hole size is therefore taken from the labels, not from the bullet or a learned size as in the app.
- Metrics, from the quality bar: one-to-one matching, nearest pairs first, within half a hole diameter. A proposal below the confidence tier is a maybe and is not counted. An unmatched proposal inside a marked unresolved region is unknown, not false. Corrections per photo, the median and the 90th percentile, count only usable complete photos. On usable partial photos only found and missed are counted.
- Candidates: one constant per run, each against the same baseline. In a second round, the confidence tier is varied, and the settings that removed the most false holes in the first round are combined. Top-hat share (295 false proposals) and seed peaks per polarity (295) tied; the combined row takes the top-hat share and the fill share (308) and leaves the seed peaks out. The rule that broke the tie was not recorded, so the combined row is not reproducible from this entry alone.
- Accept rule: a candidate goes to the holdout only when it meets the bar on the tuning set (median of 1 correction or fewer, 90th percentile of 3 or fewer). Without holdout evidence no limit or threshold changes.

Measured at commit 4665ed01. A later change to the face search is not included, and the runner has to follow it before the first holdout look.

The photos, their labels, the runner and the per-photo results stay outside the repository. Only aggregates are given here.

## Formulas

Corrections on a usable complete photo, as defined on the [hole detection](../models/hole-detection.md#quality-bar) page:

$$
c = \max(n_\mathrm{false},\, n_\mathrm{missed})
$$

Found share over a set: $r = \sum n_\mathrm{found} / \sum n_\mathrm{ref}$. Share of true proposals: $p = \sum n_\mathrm{found} / \sum (n_\mathrm{found} + n_\mathrm{false})$. The 90th percentile is the nearest rank, the value at rank $\lceil 0.9\, n \rceil$ of the sorted corrections.

## Numbers

Tuning set: 566 photos. The quality check stops 62 of them (not the holdout of the same size). The face search fits a face on 251 (34 of them sure) and none on 315. There are 51 complete photos: 6 are stopped by the quality check and 1 has no marked hole size, which leaves 44 usable complete photos with 434 reference holes. Of the 459 partial photos the quality check lets through, 381 are counted as usable partial photos with 2638 marked holes; the exclusion that removes the other 78 was not recorded.

Usable complete photos (44) and usable partial photos (381):

| Candidate | Found | Missed | False | Median | 90th pct. | Max | Photos with 1 or fewer | Partial found of 2638 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | 271 | 163 | 357 | 5 | 26 | 54 | 10 | 1593 |
| Peak strength share 0.35 to 0.5 | 268 | 166 | 363 | 5 | 26 | 54 | 10 | 1617 |
| Peak strength share 0.35 to 0.25 | 270 | 164 | 384 | 5 | 27 | 59 | 8 | 1599 |
| Top-hat share 0.35 to 0.5 | 269 | 165 | 295 | 5 | 25 | 53 | 10 | 1593 |
| Least top-hat contrast 40 to 60 | 270 | 164 | 353 | 5 | 25 | 55 | 9 | 1582 |
| Least top-hat contrast 40 to 25 | 271 | 163 | 358 | 5 | 26 | 54 | 10 | 1586 |
| Largest part per peak 3 to 2 D | 251 | 183 | 332 | 5 | 25 | 46 | 9 | 1556 |
| Largest run hole size 1.4 to 1.2 | 257 | 177 | 345 | 5 | 26 | 54 | 8 | 1598 |
| Seed peaks per polarity 4 to 2 | 249 | 185 | 295 | 5 | 26 | 55 | 9 | 1462 |
| Fill share 0.3 to 0.45 | 273 | 161 | 308 | 5 | 25 | 39 | 8 | 1582 |
| Print polarity confidence 0.8 to 0.6 | 274 | 160 | 362 | 5 | 26 | 54 | 10 | 1656 |
| Confidence tier 0.5 to 0.6 | 247 | 187 | 212 | 5 | 14 | 35 | 10 | 1487 |
| Confidence tier 0.5 to 0.7 | 217 | 217 | 125 | 5 | 11 | 21 | 9 | 1334 |
| Confidence tier 0.5 to 0.8 | 168 | 266 | 71 | 5 | 11 | 23 | 6 | 1135 |
| Tier 0.7, top-hat 0.5, fill 0.45 | 213 | 221 | 109 | 5 | 13 | 20 | 8 | 1383 |

Baseline shares: 62 % of the reference holes found on complete photos, 43 % of proposals true, 60 % of marked holes found on partial photos. Median run time is about 1.9 s per photo.

Holdout: 62 photos (32 complete, 30 partial, 471 marked centres). By target type and quality (usable / limited): printed rings with a black centre 20 / 3, rings on light paper 12 / 3, grid or square marks 10 / 1, plain paper or card 6 / 2, reactive or splatter faces 4 / 1. Looks taken: 0 of 3.

Face search (right, wrong, found but not first, not found): not measured, because the labels give no face to compare with.

## Result

no change. No candidate meets the bar on the tuning set: the median stays at 5 corrections in every run. A higher confidence tier trades false proposals for missed holes (357 to 125 false and 163 to 217 missed at 0.7), and its 90th percentile (11 at 0.7) is still far above 3. The detector settings stay as they are, and the holdout was not opened, because no candidate qualified and its labels wait for a person's check. False proposals outnumber missed holes in the baseline (357 against 163), and most settings that remove false proposals also lose found holes; the fill share is the exception (357 to 308 false, 271 to 273 found) and is still far from the bar. A further candidate is therefore a new step, not a different constant. The causes of the corrections were not classified in this run.

## Data basis

measured. Third-party target photos and model-made annotations kept outside the repository; aggregates only.

## Where in the app

- `apps/web/src/lib/hole-detection.ts` (the detector constants; unchanged).
- `apps/web/src/lib/hole-proposals.ts` (the confidence tier; unchanged).
- [Hole detection](../models/hole-detection.md), Quality bar: no measured result meets the default bar.

## Confidence

low. The labels are model-made and not yet checked by a person, the hole size is taken from the labels, the face search takes its first fit even when unsure, and only 44 tuning photos are complete.
