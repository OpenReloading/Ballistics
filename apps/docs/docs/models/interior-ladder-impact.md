---
title: Point of impact per charge in a ladder
description: The height of impact of each charge's shots with the effect of their velocity removed, the mean per charge and a heterogeneity test across charges.
---

# Point of impact per charge in a ladder

A charge ladder fires several shots per charge, and the velocity of a shot changes where it lands: a faster shot drops less. The analysis takes the height of each shot above the point of aim and its velocity, removes the part of the height that the velocity explains with a given slope, and averages what is left per charge. It then tests whether those averages differ between charges by more than the scatter of the shots. The result is a statistical observation about the shots fired, not a recommendation of a charge.

## Equations

For shot $j$ of charge $i$ with height $y_{ij}$ and velocity $v_{ij}$, $b$ the change of height per velocity and $\bar v$ the mean velocity of all shots of the ladder, the corrected height and the residual centre of the charge are

$$
z_{ij} = y_{ij} - b \left( v_{ij} - \bar v \right), \qquad r_i = \bar z_i = \frac{1}{n_i} \sum_j z_{ij}
$$

Code: `packages/core/src/interior/ladder-impact.ts`, `ladderImpactResiduals` (`z`, `mean`). The sample standard deviation of the $z_{ij}$ of a charge (`standardDeviation`) and the shot count (`count`) are returned in the shape of `LadderStep`, so [`ladderFlatSpots`](interior-velocity-ladder.md) reads the steps.

With $m$ charges, $N$ shots in all, the count-weighted mean $\bar r$ of the $r_i$ and the variance $s_p^2$ of the $z_{ij}$ pooled over the charges, the heterogeneity statistic is

$$
Q = \frac{\sum_i n_i \left( r_i - \bar r \right)^2}{s_p^2}, \qquad s_p^2 = \frac{\sum_i (n_i - 1) s_i^2}{N - m}
$$

Code: `packages/core/src/interior/ladder-impact.ts`, `ladderImpactResiduals` (`between`, `within`, `pooled`, `statistic`).

The note is raised when $Q$ exceeds the chi-square quantile at level $\gamma$ (0.99 by default) with $m - 1$ degrees of freedom. When every shot of every charge has one height, $Q$ is 0 if the centres agree and infinite otherwise.

Code: `packages/core/src/interior/ladder-impact.ts`, `ladderImpactResiduals` (`degrees`, `varies`). The quantile is `chiSquareQuantile` of the [shot group](groups.md) statistics.

### Drop slope

The slope $b$ comes from two trajectories of the exterior [point-mass model](exterior-point-mass.md) in ICAO standard air without wind, at the distance of the groups. The bore angles are those of the zero (range, air and drag factor of the load) at the muzzle velocity $v_0$ of the load, and stay fixed. The two trajectories differ only in the muzzle velocity, $v_0 - d$ and $v_0 + d$ with $d$ = 10 m/s, and $h$ is the height above the line of sight at the distance:

$$
b = \frac{h(v_0 + d) - h(v_0 - d)}{2d}
$$

Code: `apps/web/src/lib/ladder-slope.ts`, `dropSlope` (`zero`, `at`, `slope`). The drag is the G7 ballistic coefficient of the bullet record, as one band set, or the G1 for a bullet without a G7; a bullet whose coefficients need a choice gives no slope.

### Which shots enter

Code: `apps/web/src/lib/ladder-impact.ts`, `ladderImpact` (`usableShots`, `steps`). A group of a charge enters with its included shots that have a chronograph velocity (a shot linked to a chronograph shot that is excluded has none), and only with five or more of them and a point of aim; the height of a shot is its $y$ minus the $y$ of the point of aim. A charge enters with three or more such groups. The note needs three or more charges and one distance for all ladder groups.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $y$ | Height of a shot above the point of aim | mm | m |
| $v$ | Velocity of a shot | m/s | m/s |
| $b$ | Change of height per velocity | no kind | m per m/s |
| $z$ | Height with the velocity effect removed | mm | m |
| $r_i$ | Residual centre of charge $i$ | mm | m |
| $n_i$ | Shots of charge $i$ | 1 | 1 |
| $Q$ | Heterogeneity statistic | 1 | 1 |
| $\gamma$ | Level of the test, 0.99 by default | 1 | 1 |

## Assumptions

- The heights of the shots of a charge are independent with one common variance across charges, and roughly normal.
- Over the velocity range of the ladder the height of impact is linear in velocity with the slope $b$.
- The point of aim is the same for every shot.
- The slope is the same at every charge, which holds over the velocity range of a ladder but not over a wide one.

## Limits

- It needs three or more charges with at least two shots each. Seeded ladders with 9 charges, 3 groups of 5 shots per charge and an exact slope raised the note in 1.4 percent of ladders with no oscillation of the height, and in every ladder with an oscillation of 0.1 in; with a slope 20 percent off the false-note rate was 6.6 percent (see the [research entry](../research/ladder-impact-per-charge.md)). Other slope errors and fewer groups were not tested.
- The chi-square reference is approximate because the pooled variance is itself estimated.
- A trend of the residual with the charge can come from a wrong slope as well as from the rifle. The slope is a simulation of the load's bullet, zero and standard air, not a measurement of the rifle; it is not given for a load without a sight height or a zero range.
- The link between a group's shots and a chronograph string is by order: it holds while the shots of the group are not added, removed or reordered after it is set.
- The test says the centres differ. It names no charge as better or worse and does not say whether a load may be fired.

## Sources

- [NIST/SEMATECH](../bibliography.md#nist-sematech): one-way analysis of variance, the large-sample chi-square form of its F test (section number unverified).
- Research log: [point of impact per charge in a ladder](../research/ladder-impact-per-charge.md).
