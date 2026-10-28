---
title: Zone probability against the closed form
description: Whether the numerical integral of the hit-probability model reproduces the exact result for a circular zone and a circular dispersion.
---

# Zone probability against the closed form

## Question

Hit probability: does the numerical integral that gives the probability of a shot inside a scoring zone reproduce the exact value in the one case where a closed form exists, a circular zone and equal standard deviations on both axes?

## Method

The integral of the [hit-probability model](../models/hit-probability.md) was compared with the closed form for four pairs of zone radius and standard deviation, chosen to cover a zone about as wide as the dispersion, a zone wider than the integration cut, and a zone much smaller than the dispersion. The accept rule, set before the run: an absolute difference below $5 \cdot 10^{-9}$ in every pair, the tolerance of the unit test.

## Formulas

With equal standard deviations the squared distance from the aim point, in units of $\sigma^2$, follows the chi-square distribution with 2 degrees of freedom, whose distribution function is $1 - e^{-x/2}$ (the circular normal, or Rayleigh, distribution, treated for shooters in [Grubbs 1991](../bibliography.md#grubbs-1991), pages unverified). The probability inside a circle of radius $r$ is then

$$
P(r) = 1 - e^{-r^2/(2\sigma^2)}
$$

The model computes $P(a, b)$ with $a = b = r$ as the integral over $t$ of the density of $x = a \sin t$ times $\operatorname{erf}\!\left(b \cos t / (\sigma_y \sqrt{2})\right)$, cut at $\lvert x \rvert = 8\sigma_x$ and summed with a composite Simpson rule of 2000 intervals ([hit probability](../models/hit-probability.md)).

## Numbers

| $r$ (m) | $\sigma$ (m) | closed form | model | model minus closed form |
| --- | --- | --- | --- | --- |
| 0.01 | 0.01 | 0.39346934028737 | 0.39346934028737 | $2.8 \cdot 10^{-16}$ |
| 0.05 | 0.02 | 0.95606306637659 | 0.95606306637659 | $4.4 \cdot 10^{-16}$ |
| 0.003 | 0.02 | 0.01118695538877 | 0.01118695538877 | $1.9 \cdot 10^{-17}$ |
| 0.2 | 0.01 | 1 | 0.99999999999998 | $-2.2 \cdot 10^{-15}$ |

The largest difference is $2.2 \cdot 10^{-15}$, about $4.4 \cdot 10^{-7}$ of the accept limit.

## Result

No change. The integral agrees with the closed form far inside the accept limit, so the Simpson rule with 2000 intervals and the cut at $8\sigma$ stay as they are.

## Data basis

Analytic: a closed form compared with the model, no measured data.

## Where in the app

- `packages/core/src/groups/hit-probability.ts`, `ellipseProbability`.
- `packages/core/test/hit-probability.test.ts`, the test "reduces to the closed form for a circular zone and a circular dispersion".
- Model page: [hit probability](../models/hit-probability.md).

## Confidence

High: the reference is exact, and the differences are at the rounding level of double precision. The check does not cover elliptical zones or unequal standard deviations, which have no closed form.
