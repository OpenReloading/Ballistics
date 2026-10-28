---
title: Expected extreme spread per shot count
description: The mean extreme spread of a circular normal group against its shot count, the range that holds 90 percent of single groups, and the spread of a series of five-shot groups, from a seeded simulation.
---

# Expected extreme spread per shot count

## Question

Groups: how large is the extreme spread of a group of $n$ shots in units of the standard deviation $\sigma$ of one axis, how much does a single group vary around it, and how far apart are the largest and smallest of a series of five-shot groups from one rifle?

## Method

Decided before the run.

- Seeded simulation of circular normal groups (the same $\sigma$ on both axes, no correlation), with the generator and seeds fixed in the script: 1 000 000 groups for each $n$ from 2 to 20 (the rule asks for at least 200 000), the mean extreme spread and its 5th and 95th percentile.
- Coverage: the range from the 5th to the 95th percentile is applied to 200 000 further groups of an independent seed for each $n$; it should hold 90 percent of them within 2 points.
- Series: 4 000 000 five-shot groups are cut into series of $k$ = 8, 12 and 20 groups; the mean of the largest and of the smallest group of a series is given relative to the expected extreme spread of one group and relative to the mean of its own series.
- Ratio of the mean extreme spread of 3 shots to that of 5 shots.
- Rule: build when the means for $n$ = 2, 3, 5 and 10 agree with the values 1.77, 2.41, 3.07 and 3.81 $\sigma$ named in the issue within 2 percent. The values are this simulation's own; no published table is used.

Reproduce: `node tools/research/group-extreme-spread-per-shot-count.ts` (about 26 s), on the branch `research/group-statistics`.

## Formulas

The extreme spread of a group is the largest distance between two of its shots ([Grubbs 1991](../bibliography.md#grubbs-1991), extreme spread). For two shots the distance is $\sqrt{2}\sigma$ times a Rayleigh variable (each coordinate difference is normal with variance $2\sigma^2$), so its mean is $\sqrt{\pi}\,\sigma = 1.7725\,\sigma$, which fixes the $n = 2$ row analytically. For more shots no closed form is used here: the mean is the average of the simulated groups.

A source of dispersion that carries a share $f$ of the total variance, removed, leaves a group size of $\sqrt{1 - f}$ times the old one (variances add): $f = 0.3$ gives 0.837, a reduction of 16 percent. This is analytic, not simulated.

## Numbers

Mean extreme spread and the range that holds 90 percent of single groups, in units of $\sigma$ (selected rows; the script prints all of 2 to 20):

| $n$ | Mean | 5th percentile | 95th percentile | Share of independent groups inside |
| --- | --- | --- | --- | --- |
| 2 | 1.770 | 0.45 | 3.46 | 90.0 % |
| 3 | 2.408 | 1.07 | 3.99 | 89.9 % |
| 4 | 2.792 | 1.49 | 4.30 | 90.1 % |
| 5 | 3.066 | 1.80 | 4.51 | 89.9 % |
| 6 | 3.277 | 2.05 | 4.68 | 89.9 % |
| 8 | 3.585 | 2.41 | 4.93 | 90.0 % |
| 10 | 3.812 | 2.68 | 5.11 | 90.0 % |
| 12 | 3.988 | 2.89 | 5.25 | 90.1 % |
| 15 | 4.197 | 3.14 | 5.42 | 89.9 % |
| 20 | 4.452 | 3.44 | 5.63 | 90.1 % |

The coverage is 89.9 to 90.1 percent for every $n$ from 2 to 20, inside the 2 points allowed. The simulated $n = 2$ mean differs from $\sqrt{\pi}$ by 0.14 percent.

Against the issue's values: 1.770 against 1.77 (+0.03 percent), 2.408 against 2.41 (-0.08 percent), 3.066 against 3.07 (-0.14 percent), 3.812 against 3.81 (+0.04 percent).

Mean 3-shot over mean 5-shot extreme spread: 0.786. One five-shot group lies between 0.59 and 1.47 times its expected size in 90 percent of cases (1.80 and 4.51 over 3.066).

Largest and smallest of a series of five-shot groups, relative to the expected extreme spread of one group (relative to the series' own mean in brackets):

| $k$ | Series | Largest | Smallest |
| --- | --- | --- | --- |
| 8 | 500 000 | 1.407 (1.408) | 0.643 (0.642) |
| 12 | 333 333 | 1.472 (1.473) | 0.598 (0.598) |
| 20 | 200 000 | 1.549 (1.550) | 0.549 (0.548) |

## Result

improved. Rule met: all four means are within 0.15 percent of the issue's values (limit 2 percent), and the stated range holds 89.9 to 90.1 percent of independent groups. Adopted as a table and a one-line comparison; the function `expectedExtremeSpread(n)` (a table of 19 rows, mean, 5th and 95th percentile in units of $\sigma$) and its test are on the unmerged branch `research/group-statistics`, ready to cherry-pick. The test reruns a seeded simulation of 20 000 groups for $n$ = 2, 3, 5, 10 and 20 and requires the table mean within 2 percent and the range to hold 88 to 92 percent of the groups, and checks $n = 2$ against $\sqrt{\pi}$.

Proposed text for the Limits of [Groups](../models/groups.md), replacing the sentence "Mean radius, extreme spread, width, height, the pair distances and the elliptical CEP carry no interval. Their small-sample distributions exist only as tables, not reproduced here." with:

> Mean radius, width, height, the pair distances and the elliptical CEP carry no interval. The extreme spread carries none either, but its expected size for 2 to 20 shots and the range that holds 90 percent of single groups are given in units of $\sigma$ (table from a seeded simulation of circular normal groups).

Web wiring, not built (at most ten lines):

- In the groups tab, next to the extreme spread of a group of $n$ shots with $2 \le n \le 20$ and a radial or per-axis $\sigma$ estimate, a line: "For this shot count a group of this load is typically X to Y (mean Z), 90 percent range" with $X$, $Y$, $Z$ the table values times the estimated $\sigma$.
- Where groups of different shot counts are compared, one line: "Groups of 3 shots average 0.79 of groups of 5 shots from the same rifle; compare groups of the same shot count." The ratio is `mean(n) / mean(m)` of the table.
- Where several groups of one load are listed, one line: "The largest of 8 five-shot groups is about 1.4 times the mean, the smallest about 0.6 times, from chance alone." The numbers come from this entry for $k$ = 8, 12, 20 and are static text.
- No other change; the shipped statistics stay as they are. The text states what chance does, no group size is called good or bad.

## Data basis

analytic. Seeded simulation of a stated distribution; no measured group is used.

## Where in the app

- `packages/core/src/groups/statistics.ts` (`groupStatistics`, `pooledGroupStatistics`, extreme spread and its mean over groups; unchanged).
- `apps/web/src/components/groups-tab.tsx` (where the lines are shown).
- [Groups](../models/groups.md), Limits: the replaced sentence above.

## Confidence

high: the simulation is large, the $n = 2$ row matches the closed form, the coverage holds on an independent seed, and the means match the issue's values to 0.15 percent. The circular normal assumption is the usual one for a rifle; real groups with unequal axes are not covered.
