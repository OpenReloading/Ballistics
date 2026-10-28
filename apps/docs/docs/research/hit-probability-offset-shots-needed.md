---
title: Hit probability with a point-of-impact offset and shots needed
description: Whether an optional offset of the group centre in the zone integral matches a seeded Monte Carlo within 0.5 percentage points, and whether the shots needed for a wanted chance of a hit follow from the single-shot probability.
---

# Hit probability with a point-of-impact offset and shots needed

## Question

Hit probability (`hit-probability.md`): does the zone integral with an optional offset of the point of impact from the aim point reproduce a seeded Monte Carlo within 0.5 percentage points, and is the number of shots for a wanted chance of one hit given by the single-shot probability alone?

## Method

Accept rules, decided before any run. Offset: build when the integral agrees with a seeded Monte Carlo within 0.5 percentage points over $\delta/\sigma$ from 0 to 4 and $R/\sigma$ from 0.25 to 4, and it shows an interior maximum over $\sigma$ for $\delta > R$. Shots needed: build when a test reproduces the formula (no new input). The offset takes its default from the measured group's `AimOffset` (group centre minus point of aim, `packages/core/src/groups/statistics.ts`) when a group is selected, otherwise zero, so no typed field is added.

Implementation: the offset shifts the density of $x$ and the interval of $y$ in the same composite Simpson rule of 2000 intervals as the centred integral, with the $x$ range cut to $[-a, a] \cap [\delta_x \pm 8\sigma_x]$. The Marcum Q function is used only as a circular cross-check in the tests, as the noncentral chi-square distribution of two degrees of freedom written as a Poisson mixture of central ones (a sum of known terms, no special function).

Monte Carlo: a circular normal of standard deviation 1 (lengths in units of $\sigma$) centred $d$ from the aim point on a circle of radius $R$; $d = 0, 0.5, 1, 1.5, 2, 3, 4$ and $R = 0.25, 0.5, 1, 2, 3, 4$ (42 cases), 400 000 shots per case from a fixed seed (mulberry32, Box-Muller); the sampling error is at most 0.08 percentage points. The unit tests add five cases with unequal standard deviations, elliptical zones and offsets along both axes (200 000 shots, same tolerance).

Run: `node packages/core/scripts/hit-probability-offset.mts`; the unit tests are `packages/core/test/hit-probability-offset.test.ts`.

## Formulas

For a circular zone of radius $R$, circular normal dispersion $\sigma$ and centre offset $d$ the probability is $1 - Q_1(d/\sigma,\ R/\sigma)$ with the Marcum Q function of order 1 (source not in the bibliography, unverified). With independent shots of single-shot probability $p$ the chance of at least one hit in $n$ shots is $1 - (1-p)^n$, so the smallest whole $n$ for a wanted chance $P$ is $\lceil \ln(1-P)/\ln(1-p) \rceil$ (the geometric distribution, no source). The mean number of shots to the first hit is $1/p$, and the chance after that many shots tends to $1 - 1/e = 63.2$ percent as $p$ becomes small. The integral with an offset is written out on the model page.

## Numbers

Monte Carlo against the integral: the largest difference over the 42 cases is 0.126 percentage points (at $d = 0$, $R = \sigma$, where the closed form is $1 - e^{-1/2} = 0.39347$ and the simulation 0.39221, 1.6 standard errors); every other case is within 0.11. The cross-check against the Poisson mixture in the tests agrees to 7 decimals for $d/\sigma$ of 0.5, 1, 2, 3, 4 and $R/\sigma$ of 0.25, 0.5, 1, 2, 4.

Interior maximum. A zone of radius $R$, offset $d$, the probability against $\sigma/R$ (scan step 0.05):

| $d/R$ | Maximum | At $\sigma/R$ | Probability at $\sigma/R$ = 0.25, 1, 4 |
| --- | --- | --- | --- |
| 0.5 | 1 (tends to 1 as $\sigma \to 0$) | none | 0.966, 0.357, 0.031 |
| 1 | 0.49 at the lowest $\sigma$ scanned (tends to 0.5) | none | 0.450, 0.267, 0.030 |
| 1.5 | 0.166 | 0.90 | 0.018, 0.164, 0.029 |
| 2 | 0.092 | 1.30 | 0.000, 0.082, 0.027 |
| 3 | 0.041 | 2.05 | 0.000, 0.011, 0.023 |

For $d > R$ a tighter group lowers the probability below the maximum; for $d \le R$ it only rises with a smaller $\sigma$.

Size of the centred assumption, $d = 0.5\sigma$: probability with the offset against the centred one, by $R/\sigma$: 0.25: 0.0272 against 0.0308 (-0.36 points); 0.5: 0.1045 against 0.1175 (-1.30); 1: 0.3573 against 0.3935 (-3.62); 2: 0.8309 against 0.8647 (-3.38); 3: 0.9822 against 0.9889 (-0.67); 4: 0.9993 against 0.9997 (-0.04). The largest change is 3.6 points, a ratio of 0.91.

Shots needed (wanted chance 0.5, 0.9, 0.99): $p = 0.02$: 35, 114, 228; $p = 0.1$: 7, 22, 44; $p = 0.3$: 2, 7, 13; $p = 0.9$: 1, 1, 2. The mean number of shots to the first hit is 50, 10, 3.33 and 1.11. The unit tests check 22 shots for $p = 0.1$ and 0.9 (21.85 rounded up), whole results such as $p = 0.5$ and 0.75 (2 shots), the limit $1 - (1-p)^{1/p} \to 1 - e^{-1}$, and $p = 0$ and 1.

## Result

Improved. Both adopted. The offset is an optional argument of `ellipseProbability` and `hitProbability`; without it the result is bit for bit the centred one. `shotsToHit` returns the whole shots and the mean number of shots from the single-shot probability. The rules held: 0.126 against 0.5 percentage points, an interior maximum for $d > R$, and the formula reproduced. The model page Limits gain "An offset is the same for every shot. A centre that changes from group to group, and an offset that is not measured, are not modelled."; its assumption "the zero is right" now reads "unless an offset is given".

The offset is an input of a prediction, not a setting of the sight: the text beside it describes where the measured group centre lies against the point of aim and what that does to the probability, and gives no direction to move anything.

Web wiring, not built (at most ten lines): an optional "Group centre against point of aim" pair in the hit-probability form, shown when a group is selected and prefilled from its `aimOffset` (`dx`, `dy`; `centre` gives zero), editable, empty meaning zero, passed to `hitProbability` as `offset`. A "Shots for a chance of at least one hit" readout beside the hit probability, with a wanted-chance choice of 50, 90 and 99 percent, from `shotsToHit(result.hit, wanted)`, and the mean shots to the first hit; no new typed field for the shots. A note when `dx` or `dy` exceeds the zone half-width that a tighter group lowers the probability there.

## Data basis

Analytic. Synthetic cases, closed forms and a seeded Monte Carlo; no measured data.

## Where in the app

- `packages/core/src/groups/hit-probability.ts` (`ellipseProbability`, `hitProbability`, `shotsToHit`)
- `packages/core/src/groups/statistics.ts` (`AimOffset`)
- [Hit probability](../models/hit-probability.md)

## Confidence

High for the integral and the formula (a deterministic cross-check to 7 decimals and a Monte Carlo within 0.13 percentage points); medium for the wiring, which depends on how the form presents the offset.
