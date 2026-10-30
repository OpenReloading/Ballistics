---
title: Velocity flat spots of a charge ladder
description: The slope of mean velocity against charge between neighbouring ladder strings, its confidence band by string count, and the charge ranges whose band includes zero.
---

# Velocity flat spots of a charge ladder

A charge ladder fires one string per charge. The mean velocity of each string rises with charge, and where it rises least the velocity depends least on the charge. The analysis takes the mean, sample standard deviation and shot count of each string and returns the slope between neighbouring charges with a confidence band, and the charge ranges where that band includes zero. The result is a statistical observation about the strings fired, not a recommendation of a charge.

## Equations

For neighbouring strings $a$ and $b$ with charges $c_a \lt c_b$, means $\bar v$, sample standard deviations $s$ and shot counts $n$, the slope is

$$
m = \frac{\bar v_b - \bar v_a}{c_b - c_a}
$$

Code: `packages/core/src/interior/velocity-ladder.ts`, `ladderFlatSpots` (`slope`).

The standard error of the difference of two independent means, without assuming equal variances, gives the half width of the band, with the two-sided Student's t quantile $t_{\gamma,\nu}$ at confidence level $\gamma$:

$$
u_a = \frac{s_a^2}{n_a}, \quad u_b = \frac{s_b^2}{n_b}, \qquad h = \frac{t_{\gamma,\nu}\sqrt{u_a + u_b}}{c_b - c_a}
$$

Code: `packages/core/src/interior/velocity-ladder.ts`, `ladderFlatSpots` (`va`, `vb`, `halfWidth`). The t quantile is `studentTwoSidedQuantile` of the [shot group](groups.md) statistics.

The degrees of freedom follow the Welch-Satterthwaite approximation, rounded down to a whole number (at least 1), and are $n_a + n_b - 2$ where both deviations are 0:

$$
\nu = \frac{(u_a + u_b)^2}{\dfrac{u_a^2}{n_a - 1} + \dfrac{u_b^2}{n_b - 1}}
$$

Code: `packages/core/src/interior/velocity-ladder.ts`, `ladderFlatSpots` (`df`).

The segment is flat when $|m| \le h$, that is when its band $m \pm h$ includes zero. A flat spot is a run of neighbouring flat segments. It spans the charges from the lowest to the highest string of the run.

Code: `packages/core/src/interior/velocity-ladder.ts`, `ladderFlatSpots` (`flat`, `flatSpots`).

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $c$ | Charge of a string | g | kg |
| $\bar v$ | Mean velocity of a string | m/s | m/s |
| $s$ | Sample standard deviation of a string | m/s | m/s |
| $n$ | Shots of a string | 1 | 1 |
| $m$ | Slope of mean velocity against charge | no kind | m/s per kg |
| $h$ | Half width of the confidence band of the slope | no kind | m/s per kg |
| $\gamma$ | Confidence level, 0.95 by default | 1 | 1 |
| $\nu$ | Degrees of freedom | 1 | 1 |

## Assumptions

- The velocities of a string are independent and roughly normal. The mean of a few shots is only approximately so.
- The strings are independent: one barrel and one day have their own drift that the bands do not include.
- The charge is exact. Its scatter (powder thrown or weighed) adds to the velocity scatter of a string and is not separated.

## Limits

- Each string needs at least two shots, and the standard deviation of two shots is itself very uncertain. The band is wide for few shots: a flat segment can mean only that the strings were too short to tell.
- Neighbouring segments are tested one by one at the stated level, with no correction for the number of segments, so a ladder of many steps shows a flat segment by chance more often than the level suggests.
- A flat spot is where the mean velocity did not change measurably over the strings fired. It says nothing about pressure, accuracy or whether a charge may be loaded.

## Sources

- [NIST/SEMATECH](../bibliography.md#nist-sematech): 1.3.5.3 (two-sample t-test for equal means, the Welch-Satterthwaite degrees of freedom, section number unverified).
- [Abramowitz 1964](../bibliography.md#abramowitz-1964): 26.7.3 and 26.7.4 (Student's t distribution for whole degrees of freedom), page numbers unverified.
- Research log: [point of impact per charge in a ladder](../research/ladder-impact-per-charge.md).
