---
title: Flier screen for a string of shots
description: An advisory flag for one shot far from the rest of a string of 10 to 30 shots, its factor per string length for a false-flag rate of 1 percent, and how often a planted flier is found, from a seeded simulation.
---

# Flier screen for a string of shots

## Question

Velocity strings (and groups per axis): can one shot that lies far from the others be flagged with a known false-flag rate on clean normal strings, for which string lengths does the flag have enough power to be shown, and what does it say about the standard deviation with and without the shot?

## Method

Decided before the run.

- Statistic: for a string of $N$ shots, take the shot farthest from the string mean; its distance from the mean of the other $N - 1$ shots, in sample standard deviations of those $N - 1$ shots. The shot is flagged above a factor $k$. For the high end only the statistic is taken for the highest shot.
- Calibration: for each $N$ from 5 to 30, 1 000 000 clean normal strings (the rule asks for at least 300 000) give $k$ for a false-flag rate per string of 5, 1 and 0.1 percent, either end and high end only.
- False-flag check: the 1 percent either-end $k$ is applied to 300 000 further clean strings of an independent seed for each $N$, so the 1 percent is not true by construction.
- Detection: one shot of the 300 000 strings (per $N$ and size) is moved up by 4, 6 or 8 true standard deviations; it counts as found when the flagged shot is that shot.
- Rule: build only for $N$ of 10 or more, with the 1 percent either-end $k$, when the false-flag rate on the independent seed is from 0.5 to 1.5 percent for $N$ = 8 to 30 and the planted 8 SD flier is found in more than 90 percent of strings for $N$ of 10 or more. At $N = 5$ the screen shows nothing.
- The flag is advisory: it never sets the `excluded` flag of a shot, the standard deviation is shown with and without the flagged shot, and a cold-bore shot is a real effect.

Reproduce: `node tools/research/string-flier-flag.ts` (about 65 s), from commit `15a57e29ad802a10481a21d1188dc1844736f91b` (on the branch `research/group-statistics`; the script and the core functions it imports are in that commit, the seeds are in the script).

## Formulas

With $x_1, \dots, x_N$ the shots, $\bar{x}$ their mean and $j$ the index of the largest $\lvert x_i - \bar{x} \rvert$, the statistic is

$$
T = \frac{\lvert x_j - \bar{x}_{(j)} \rvert}{s_{(j)}}
$$

with $\bar{x}_{(j)}$ and $s_{(j)}$ the mean and sample standard deviation of the string without shot $j$. Up to the factor $\sqrt{(N-1)/N}$ (leverage $1/N$ of a constant-only model) this is the externally studentized deleted residual of regression diagnostics ([Belsley 1980](../bibliography.md#belsley-1980); page unverified, the factor is derived here and the calibration absorbs it). The shot farthest from the full mean is also the one with the largest $T$, because $T$ rises with the distance from the full mean. The factor $k_N$ is the 99th percentile of $T$ for clean normal strings of $N$ shots; no distribution formula is used, so the factors are simulated values.

A rule that flags a shot when fewer than 0.5 shots are expected beyond it, counted across both ends, flags one end of a clean string with probability $1 - (1 - 1/(4N))^N$ (analytic: 0.23 at $N = 5$, 0.22 for large $N$), about one clean string in five: unfit.

## Numbers

Factor $k$ for a false-flag rate per clean string (selected rows; the script prints $N$ = 5 to 30):

| $N$ | Either end, 5 % | 1 % | 0.1 % | High end only, 5 % | 1 % | 0.1 % |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | 6.52 | 11.42 | 24.51 | 5.08 | 8.99 | 19.67 |
| 8 | 4.40 | 6.10 | 9.36 | 3.76 | 5.32 | 8.22 |
| 10 | 4.04 | 5.32 | 7.53 | 3.53 | 4.74 | 6.76 |
| 15 | 3.71 | 4.60 | 5.93 | 3.33 | 4.21 | 5.53 |
| 20 | 3.60 | 4.34 | 5.43 | 3.28 | 4.02 | 5.09 |
| 25 | 3.56 | 4.22 | 5.17 | 3.27 | 3.94 | 4.91 |
| 30 | 3.54 | 4.16 | 5.03 | 3.26 | 3.90 | 4.76 |

The issue's factors (either end 1 percent: 11.5, 5.3, 4.3, 4.2 at $N$ = 5, 10, 20, 30) agree with these to the digits it gives.

False-flag rate at the 1 percent either-end $k$ on the independent seed: 0.969 to 1.038 percent for every $N$ from 8 to 30 (0.968 percent at $N = 5$). Planted flier found, 1 percent either-end $k$:

| $N$ | 4 SD | 6 SD | 8 SD |
| --- | --- | --- | --- |
| 5 | 6.2 % | 16.6 % | 31.5 % |
| 8 | 18.3 % | 54.3 % | 85.5 % |
| 10 | 25.1 % | 69.6 % | 95.1 % |
| 15 | 35.7 % | 86.1 % | 99.4 % |
| 20 | 41.5 % | 91.5 % | 99.8 % |
| 30 | 45.7 % | 94.7 % | 100.0 % |

Factors for $N$ = 10 to 30 at 1 percent, either end: 5.32, 5.09, 4.92, 4.78, 4.68, 4.60, 4.53, 4.47, 4.42, 4.38, 4.34, 4.31, 4.28, 4.26, 4.23, 4.22, 4.21, 4.20, 4.17, 4.16, 4.16.

## Result

improved. Rule met: the false-flag rate is inside 0.5 to 1.5 percent for every $N$ from 8 to 30, and the planted 8 SD flier is found in 95.1 percent of strings at $N = 10$ and more above (the smallest value for $N$ of 10 or more). Proposed for $N$ = 10 to 30 only; nothing is shown at $N = 5$ (an 8 SD flier is found in 31.5 percent of strings, and a flag needs about 11 standard deviations) or for $N$ of 6 to 9 (8 SD found in 55 to 92 percent), and none is calibrated above 30. The function `flierScreen(values)` (the factors for 10 to 30 as data; returns the farthest shot, its distance, the factor, the flag and the standard deviation with and without that shot; `undefined` outside 10 to 30) and its tests are on the unmerged branch `research/group-statistics`, ready to cherry-pick. The tests require 0.5 to 1.5 percent flagged on 100 000 clean strings each of 10, 20 and 30 shots and more than 90 percent found for a planted 8 SD flier at 10 and 20.

The count of flags on real strings is not part of this entry: it waits for measured strings (issue 278). If real strings are flagged far more than 1 percent (heavy tails), the SD interval of the [Groups](../models/groups.md) assumes a normal string and the flag is not shown.

Web wiring, not built (at most ten lines):

- In the velocity statistics of a string of 10 to 30 shots, when `flierScreen` flags a shot, a line under the standard deviation: "Shot N (value) is far from the others (D standard deviations of the rest; a clean normal string shows this about once in a hundred). Standard deviation with it: A, without it: B." The shot stays in all numbers; the shot table marks it.
- No flag, no line, for fewer than 10 or more than 30 shots; the line says nothing about cause (a cold-bore shot is a real effect).
- The flag never sets `excluded` and never changes the extreme spread or the standard deviation shown first.

## Data basis

analytic. Seeded simulation of clean normal strings and of one planted shift; no measured string is used.

## Where in the app

- `packages/schema/src/chrono-session.ts` (the `excluded` reason and `coldBore` flag of a shot, set by hand only; unchanged).
- `packages/core/src/groups/velocity-statistics.ts` (the string statistics the line sits beside).
- `packages/core/src/groups/statistics.ts` (`velocityCorrelationOf`, the group statistics).
- [Groups](../models/groups.md), Limits: add that a flagged shot is advisory, the factors are for normal strings of 10 to 30 shots, and the interval of the standard deviation is not changed by the flag.

## Confidence

high for the numbers on clean normal strings: 1 000 000 strings for calibration and an independent seed for the rate. low for use on real strings, whose tails are unknown until measured strings are counted.
