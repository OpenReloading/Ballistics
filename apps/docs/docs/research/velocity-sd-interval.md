---
title: Interval for the standard deviation of a velocity string
description: Coverage of the chi-square interval for the standard deviation of a velocity string on normal, skewed, heavy-tailed and stray-shot strings, against a percentile bootstrap, and the shots needed for a given interval width, from a seeded simulation.
---

# Interval for the standard deviation of a velocity string

## Question

Velocity strings: does the chi-square interval for the standard deviation of a string of 3 to 50 shots keep its stated coverage when the velocities are not normal, does a bootstrap do better, and how many shots make the interval narrow enough to compare two strings?

## Method

- Five velocity distributions with a known population standard deviation: normal, skewed (gamma, shape 4), strongly skewed (lognormal, $\sigma$ = 0.5), heavy-tailed (Student t, 5 degrees of freedom) and stray shots (95 percent $N(0, 1)$ and 5 percent $N(0, 3^2)$).
- For $n$ = 3, 5, 10, 20, 30 and 50 shots, 20 000 strings per cell (seed 338). Each string gives the sample standard deviation (divisor $n - 1$, as the session summary) and two intervals at 90 and 95 percent: the chi-square interval and a percentile bootstrap of the sample standard deviation with 1000 resamples.
- Metric: the share of strings whose interval holds the population standard deviation, with the misses below and above; and the median half-width over the true standard deviation. The Monte Carlo standard error of a coverage near 95 percent is 0.2 points.
- Check of the code: the normal rows must land at the stated level within the Monte Carlo error. The shots needed for a relative half-width of 50, 30 and 20 percent are computed exactly from the chi-square quantiles, without simulation.

Reproduce: `node spikes/sd-interval/simulate.ts 20000 1000` (about 2 minutes), from commit `1dbfe96119871748fdc5d73902642c9f2704cbaa` (on the branch `spike/338-sd-interval`; the script imports `chiSquareQuantile` of core, the seed is in the script).

## Formulas

With $s$ the sample standard deviation of $n$ shots, $(n - 1)s^2 / \sigma^2$ follows a chi-square distribution with $n - 1$ degrees of freedom when the velocities are normal ([NIST/SEMATECH](../bibliography.md#nist-sematech), 1.3.5.8). Inverting it gives the two-sided interval at level $1 - \alpha$:

$$
s \sqrt{\frac{n - 1}{\chi^2_{1 - \alpha/2,\, n - 1}}} \le \sigma \le s \sqrt{\frac{n - 1}{\chi^2_{\alpha/2,\, n - 1}}}
$$

with $\chi^2_{p,\, \nu}$ the quantile of probability $p$. This is the one-axis form of the interval `confidenceOf` already uses for groups. The relative half-width is half the difference of the two factors.

The percentile bootstrap resamples the string with replacement, computes the sample standard deviation of each resample and takes the $\alpha/2$ and $1 - \alpha/2$ percentiles of those values as the interval.

## Numbers

Coverage of the true standard deviation by a 95 percent interval (percent):

| Case | Method | $n$ = 3 | 5 | 10 | 20 | 30 | 50 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| normal | chi-square | 95.0 | 95.1 | 95.0 | 95.0 | 94.8 | 95.1 |
| normal | bootstrap | 43.9 | 65.4 | 78.0 | 85.7 | 88.6 | 90.8 |
| skewed (gamma) | chi-square | 92.8 | 91.9 | 90.2 | 88.0 | 87.9 | 86.6 |
| strongly skewed (lognormal) | chi-square | 91.0 | 87.3 | 83.1 | 77.5 | 75.7 | 74.0 |
| heavy-tailed (t, 5 df) | chi-square | 92.8 | 90.8 | 87.2 | 84.0 | 82.7 | 80.8 |
| stray shots | chi-square | 92.7 | 90.9 | 87.1 | 82.4 | 80.1 | 77.1 |

At 90 percent the pattern is the same: chi-square 89.7 to 90.4 on normal strings, 65 to 87 on the others, falling with $n$. The bootstrap is below chi-square for every $n$ up to 20 in every case, and its misses are almost all above the interval. At $n$ = 30 and 50 on non-normal strings the two methods are within 1 to 4 points of each other, both far below the stated level.

Chi-square interval as factors of the sample standard deviation, 95 percent:

| $n$ | Lower | Upper | Half-width |
| --- | --- | --- | --- |
| 3 | 0.52 | 6.28 | 288 % |
| 5 | 0.60 | 2.87 | 114 % |
| 10 | 0.69 | 1.83 | 57 % |
| 20 | 0.76 | 1.46 | 35 % |
| 30 | 0.80 | 1.34 | 27 % |
| 50 | 0.84 | 1.25 | 21 % |

Shots needed for a relative half-width of the interval:

| Half-width | 90 % | 95 % |
| --- | --- | --- |
| 50 % | 9 | 12 |
| 30 % | 19 | 26 |
| 20 % | 38 | 53 |

## Result

improved. Adopted with a caveat, as described in [Groups](../models/groups.md#velocity-strings):

- The chi-square interval, not a bootstrap: it is exact for normal strings and uses the existing quantile. Caveat shown with it: it assumes roughly normal velocities; a stray shot or a skewed string makes it too narrow, so the real level is lower than the stated one (simulated: 76 to 90 percent for a stated 95 percent at 10 to 30 shots on such strings).
- 95 percent by default (the default level of the group intervals), the level stated next to the interval.
- Too few shots to rank below 10 shots: two strings whose intervals do not overlap are ranked only when each has 10 shots or more. Overlapping intervals read as a difference smaller than the uncertainty at any count. At 10 shots the intervals of two strings separate only when their standard deviations differ by a factor of 2.7 (1.83 / 0.69). No interval below 3 shots.
- No interval for the extreme spread, which was not examined.
- A kurtosis-adjusted interval (Bonett 2006, Computational Statistics & Data Analysis 50, unverified) is the candidate if a later change needs coverage closer to the stated level on non-normal strings; not implemented.

## Data basis

analytic: a seeded simulation of stated distributions. The repository holds no shot-level velocity series, so the five distributions are stand-ins, not measured from any string.

## Where in the app

- `packages/core/src/groups/velocity-statistics.ts` (`velocityStatistics`, the interval of the standard deviation, and `shotsNeeded`).
- `packages/core/src/groups/chi-square.ts` (`chiSquareQuantile`, used by the script and the interval).
- `apps/web/src/lib/string-comparison.ts` (`compareSd`, the comparison of two strings and the 10-shot rule).
- [Groups](../models/groups.md), Velocity strings and Limits.

## Confidence

medium: the normal rows hold the stated level within 0.3 points and the chi-square factors are exact, but the non-normal coverage depends on stand-in distributions, and device rounding, drift within a string and the exclusion of shots by the user were not simulated.
