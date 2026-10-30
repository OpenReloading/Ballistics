---
title: Point of impact per charge in a ladder
description: Whether the vertical centre of ladder groups, corrected for the drop caused by velocity, shows an injected oscillation with the charge at 3 or 4 five-shot groups per charge, and how often a flat residual raises a false note, from seeded ladders.
---

# Point of impact per charge in a ladder

## Question

Charge ladder: with 3 or 4 five-shot groups per charge over 4 grains in half-grain steps, does the vertical centre of each charge, with the effect of the shot velocity removed, show an oscillation of 0.1 in with the charge, and how often does a flat residual raise a note?

## Method

Decided before the run; the first three items fix what the issue leaves open.

- Ladder: 9 charges over 4 grains in half-grain steps; 25 ft/s per grain from 2800 ft/s; velocity standard deviation of a shot 8 ft/s; vertical standard deviation of a shot 0.06 in. The height of a shot is the drop slope 0.04 in per 30 ft/s times its velocity less the mean velocity of the ladder, plus the injected oscillation, plus the vertical scatter. The slope is known exactly in the main rows and wrong by 20 percent in one row.
- Oscillation: amplitude 0.1 in, exactly one cycle over the charge range, phase uniformly random for each ladder. A row with 0.05 in and rows without oscillation are run for the false notes.
- Statistic: for each charge the mean of the corrected shot heights (the residual centre) with the standard deviation of those heights; the note is shown when the heterogeneity statistic over the charges exceeds the chi-square quantile at the 99 percent level with 8 degrees of freedom. A false flag is a note shown with no oscillation injected.
- Phase recovery: an ordinary least squares fit of a constant, a cosine and a sine of one cycle over the range to the 9 residual centres; the phase counts as recovered when it is within 45 degrees of the injected phase (chance level: 25 percent).
- Flat spots: the existing `ladderFlatSpots` (95 percent bands) on the residual centres, counted as a second display check.
- Rule: build as a note on the ladder only when the phase is recovered in more than 70 percent of 20 000 seeded ladders at 3 groups per charge and false flags stay under 5 percent. Otherwise nothing is built and the entry says the method did not meet its criteria (a statement about the method, not about the detectable size of a shift).

Reproduce: `node tools/research/ladder-impact-per-charge.ts` (about 7 s), from commit `15a57e29ad802a10481a21d1188dc1844736f91b` (on the branch `research/group-statistics`; the script and the core functions it imports are in that commit, the seeds are in the script).

## Formulas

For shot $j$ of charge $i$ with height $y_{ij}$ and velocity $v_{ij}$, and $b$ the change of height per velocity from two flown trajectories:

$$
z_{ij} = y_{ij} - b \left( v_{ij} - \bar{v} \right), \qquad r_i = \bar{z}_i, \qquad Q = \frac{\sum_i n_i \left( r_i - \bar{r} \right)^2}{s_p^2}
$$

with $\bar{v}$ the mean velocity of the ladder, $\bar{r}$ the count-weighted mean of the $r_i$ and $s_p^2$ the variance of the $z_{ij}$ pooled over the charges. Under a constant height $Q$ is close to chi-square distributed with $m - 1$ degrees of freedom for $m$ charges, a heuristic: the large-sample form of the one-way analysis of variance, whose F statistic times $m - 1$ tends to chi-square with $m - 1$ degrees of freedom as the error degrees of freedom grow (no page of [NIST/SEMATECH](../bibliography.md#nist-sematech) was checked: unverified). The pooled variance is estimated, so the reference is approximate and only the measured false-note rate below is relied on.

## Numbers

Results of 20 000 seeded ladders per row, 9 charges. "Note" is the share with the 99 percent test exceeded; "phase" the share with the fitted phase within 45 degrees; "non-flat" the share with at least one non-flat segment of `ladderFlatSpots`; "run at extremum" the share where a flat run holds the step nearest a true trough or crest.

| Groups per charge | Oscillation | Slope error | Note | Phase, all ladders | Phase, with note | Non-flat segment | Run at extremum |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 0.10 in | 0 % | 100.0 % | 100.0 % | 100.0 % | 100.0 % | 99.2 % |
| 4 | 0.10 in | 0 % | 100.0 % | 100.0 % | 100.0 % | 100.0 % | 98.5 % |
| 3 | 0.10 in | 20 % | 100.0 % | 100.0 % | 100.0 % | 100.0 % | 99.3 % |
| 3 | 0.05 in | 0 % | 99.7 % | 100.0 % | 100.0 % | 91.1 % | 99.9 % |
| 3 | none | 0 % | 1.4 % | 25.0 % | 25.0 % | 29.9 % | not meaningful |
| 4 | none | 0 % | 1.1 % | 24.9 % | 24.8 % | 30.0 % | not meaningful |
| 3 | none | 20 % | 6.6 % | 25.1 % | 24.6 % | 31.1 % | not meaningful |

The standard error of a residual centre at 3 groups (15 shots) is $0.06 / \sqrt{15} = 0.016$ in, a tenth of the injected amplitude; the drop correction itself moves a centre by at most 0.13 in over the 100 ft/s of the ladder. The phase of the 25 percent rows is chance. With no oscillation and the exact slope the note is shown in 1.4 percent of ladders at 3 groups and 1.1 percent at 4; with the slope 20 percent off it is shown in 6.6 percent, because the uncorrected part of the drop is a trend with the charge and the test sees it. A flat spot display alone would show a non-flat segment in about 30 percent of flat ladders (eight segments at 95 percent bands), so it is shown only beside the note.

Not explored: oscillation amplitudes below 0.05 in, periods other than one cycle over the range, group size or velocity spread that change with the charge, and fewer than 3 groups per charge.

## Result

improved. Rule met on the stated assumptions: the phase is recovered in 100 percent of 20 000 ladders at 3 groups per charge (limit 70 percent), false notes are 1.4 percent (limit 5 percent). Adopted in a reduced form, a note on the ladder with the warning that it needs 3 to 4 groups per charge and a drop slope. Tested false-note rates: 1.4 percent with an exact slope and 6.6 percent with a slope 20 percent off; slope errors in between were not tested. The function `ladderImpactResiduals(charges, slope, level)` (per charge the residual centre, its standard deviation and shot count in the shape of `LadderStep`, the heterogeneity statistic, its degrees of freedom and the flag; SI units) and its tests are on the unmerged branch `research/group-statistics`, ready to cherry-pick. The test requires the note in more than 99 percent of 400 ladders with a 0.1 in oscillation and in under 5 percent of 400 without, and covers the input checks.

Web wiring, not built (at most ten lines):

- On the ladder view, only for a ladder whose target-sheet groups carry the same `ladderStep` set with at least 3 groups of 5 shots per charge and a velocity for each shot, build the `ImpactStep`s and the slope from two flown trajectories (`verticalPerMetre` in `apps/web/src/lib/hit-probability.ts`).
- Call `ladderImpactResiduals`; when `varies` is false show nothing.
- When it is true show one note under the ladder: "The vertical centre of the groups changes with the charge by more than the drop from velocity explains (chart of the residual centre per charge with its standard error)." Mark the flat runs of `ladderFlatSpots(result.steps)` on that chart.
- Add the warning "Needs 3 to 4 groups of 5 shots per charge and a good drop slope; a trend in the residual can also come from the slope." The note names no charge as better or worse and gives no advice.

## Data basis

analytic. Seeded ladders from assumed values (the numbers of the issue for the drop slope, vertical scatter and oscillation size); no measured ladder is used. Whether a given rifle shows such an oscillation is unknown in advance.

## Where in the app

- `packages/core/src/interior/velocity-ladder.ts` (`ladderFlatSpots`, velocity only; unchanged, the residual steps fit its input).
- `apps/web/src/components/ladder-flat-spots.tsx` and `apps/web/src/components/ladder-target.tsx` (where the note sits).
- `packages/schema/src/target-sheet.ts` (`ladderStep` of a group).
- `apps/web/src/lib/hit-probability.ts` (`verticalPerMetre`).
- [Velocity flat spots of a charge ladder](../models/interior-velocity-ladder.md): the note is not built, so the page says only that the ladder shows velocity; the note, its warning and the drop-slope limit follow with the feature ([issue #711](https://github.com/OpenReloading/Ballistics/issues/711)).

## Confidence

low: the detectability follows from assumed scatter and an assumed oscillation of one cycle, which the issue reports for one stiff test rifle only. The false-note rate is measured and robust to the group count, but not to a wrong drop slope.
