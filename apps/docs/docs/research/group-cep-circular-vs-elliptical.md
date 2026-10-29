---
title: Circular against elliptical CEP by axis ratio
description: How far the circular CEP overstates the CEP of an elongated group, and why the elliptical CEP is the value the app shows.
---

# Circular against elliptical CEP by axis ratio

## Question

Groups: by how much does the circular CEP, which assumes equal, uncorrelated axes, overstate the radius that holds half of an elongated group, and does that justify showing the elliptical CEP as the main value?

## Method

Both CEPs of the [groups model](../models/groups.md) were computed for populations with uncorrelated axes and a ratio of major to minor standard deviation of 1, 1.5, 2, 3, 5, 10 and the limit of one axis only. Each population is given exactly by four shots at $(\pm 1, 0)$ and $(0, \pm q)$, with $q$ the inverse of the axis ratio. Two metrics: the circular CEP over the elliptical CEP, and the share of the population inside the circle of the circular CEP, found with a separate midpoint rule of 20000 intervals. The accept rule for the check, set before the run: the elliptical circle holds 0.5 of the population within $10^{-6}$ at every ratio, and the one-axis limit matches its closed form within $10^{-6}$ relative.

## Formulas

The circular CEP is $\sqrt{2 \ln 2}\,\hat\sigma$ with $\hat\sigma^2$ the mean of the two axis variances ([Grubbs 1991](../bibliography.md#grubbs-1991), p. 9). The elliptical CEP is the radius $R$ at which the share outside the circle, integrated over the angle in the principal axes, is one half ([Carlson 2021](../bibliography.md#carlson-2021), section 1.4.2.3), as written on the [groups page](../models/groups.md).

With one axis only, $\hat\sigma = \sigma_1/\sqrt{2}$ and the circular CEP is $\sqrt{\ln 2}\,\sigma_1 = 0.8326\,\sigma_1$. Half of a normal population lies within $z_{0.75}\,\sigma_1$ of its mean, with $z_{0.75} = 0.67449$ the 0.75 quantile of the standard normal, so the ratio tends to $\sqrt{\ln 2} / z_{0.75} = 1.23435$, and the circle of the circular CEP holds $2\Phi(\sqrt{\ln 2}) - 1 = 0.5949$ of the population.

## Numbers

| Axis ratio | Circular over elliptical CEP | Share inside the circular CEP |
| --- | --- | --- |
| 1 | 1 | 0.5 |
| 1.5 | 1.02577 | 0.51725 |
| 2 | 1.0694 | 0.5432 |
| 3 | 1.14228 | 0.57516 |
| 5 | 1.20286 | 0.58992 |
| 10 | 1.22687 | 0.59382 |
| one axis | 1.23435 | 0.5949 |

The elliptical circle holds 0.5 within $10^{-6}$ at every ratio, and the one-axis values match the closed forms above. The overstatement is 2.6 % at an axis ratio of 1.5, 6.9 % at 2 and 14.2 % at 3, and stays below 23.5 % for any ratio.

## Result

No change. The elliptical CEP stays the value shown for a group, with the circular CEP beside it as the value that carries a confidence interval. The size of the overstatement is documented as a limit of the circular CEP.

## Data basis

Analytic: exact populations and a closed-form limit, no measured data.

## Where in the app

- `packages/core/src/groups/statistics.ts`, `groupStatistics` (`cep`, `cepElliptical`).
- `packages/core/test/groups.test.ts`, the tests "circular against elliptical CEP by axis ratio".
- `apps/web/src/lib/group-readouts.ts`, the CEP readout with the circular value beside it.
- Model page: [groups](../models/groups.md).

## Confidence

High: the elliptical CEP holds half of the population to rounding level and the limit agrees with its closed form. The populations are normal; a group with fliers or few shots departs from both values.
