---
title: Truing against closed forms and round trips
description: Whether the muzzle velocity and drag factor fits recover known values and reproduce the closed forms of a vacuum parabola and of velocity decay in one dimension.
---

# Truing against closed forms and round trips

## Question

Truing: do `trueMuzzleVelocity` and `trueDrag` recover the parameters that generated their observations, and do the fits and their standard uncertainties match the closed forms of a vacuum and of velocity decay at a constant drag coefficient?

## Method

The tests generate observations with `trajectory` at tight tolerances ($10^{-10}$ relative) and fit them back. Accept limits, set in the tests:

- Round trip: muzzle velocity 2 percent above and drag 5 percent below a 790 m/s, G7 0.3 shot; three heights (300, 600, 700 m) and one velocity (800 m). Both parameters within $10^{-6}$ relative at fixed bore angles, within $10^{-4}$ when every candidate is re-zeroed at 100 m. The modified point mass fit of the muzzle velocity alone within $10^{-6}$.
- Vacuum parabola: no drag, no Coriolis term, one height of -0.4 m at 500 m with a 0.01 rad bore angle and 0.05 m sight height. The fitted velocity within $10^{-9}$ relative of the closed form.
- One dimension: no gravity, a flat drag curve with $c_d$ 0.3 scaled by 1.1. Two exact velocities at 200 and 700 m: the factor within $10^{-8}$. Five velocities at 100 to 900 m with fixed noise and $\sigma$ = 2 m/s: factor and its standard uncertainty within $10^{-3}$ of the weighted regression of $\ln v$ on distance. Five exact velocities: the standard uncertainty within $10^{-6}$ of its closed form.

## Formulas

In a vacuum the height at distance $s$ is $s \tan e - g s^2 / (2 v_0^2 \cos^2 e) - h_s$, solved here for $v_0$ ([Kneubuehl 2018](../bibliography.md#kneubuehl-2018), the trajectory without drag, section unverified).

With a constant drag coefficient and no gravity the speed falls as $v = v_0 e^{-f k x}$, $k = \rho \pi d^2 c_d / (8 m)$, so $\ln v$ is linear in $x$ with slope $-f k$ ([McCoy 1999](../bibliography.md#mccoy-1999), flat-fire chapter, equation numbers unverified). A velocity with standard uncertainty $\sigma$ gives $\ln v$ the weight $v^2/\sigma^2$; the weighted least-squares slope through the known $\ln v_0$ is $f = \sum w x (\ln v_0 - \ln v) / (k \sum w x^2)$ with standard uncertainty $1 / (k \sqrt{\sum w x^2})$. For exact data the same follows from $\partial v / \partial \ln f = -f k x v$ ([Bard 1974](../bibliography.md#bard-1974), covariance from the Jacobian, chapter unverified).

## Numbers

- Round trips at fixed bore angles: both parameters within $10^{-6}$, residuals below $10^{-6}$, two degrees of freedom; the velocity observation at 800 m lies above Mach 1.
- Re-zeroed at 100 m: within $10^{-4}$. Holding the bore angles of the nominal zero instead biases the muzzle velocity by more than $10^{-3}$, so the zero is recomputed per candidate.
- Vacuum parabola: within $10^{-9}$, no standard uncertainty and no correlation with zero degrees of freedom.
- One dimension: the limits above hold for the factor and its standard uncertainty.
- Mach-dependent factors: a constant factor is recovered at every knot, and a factor varying between knots is recovered at the knots (same test file).
- Not tested: real firing data.

## Result

No change. The tests are adopted as regression tests.

## Data basis

Analytic: closed forms and synthetic observations from the solver.

## Where in the app

- `packages/core/test/exterior-truing.test.ts`.
- `packages/core/src/exterior/truing.ts`.
- Model pages: [truing](../models/exterior-truing.md), [least squares on log parameters](../models/least-squares.md).

## Confidence

High: each closed form is exact for its case and the fits agree within the test limits.
