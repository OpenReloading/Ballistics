---
title: Range string fit on synthetic strings
description: Whether the range string fit recovers known parameters, whether its 95 percent intervals cover the truth at their stated rate, and whether the plan predicts the fit's standard errors.
---

# Range string fit on synthetic strings

## Question

Truing from range strings: does `fitTruingStrings` recover muzzle velocity, drag factor and click value from strings made by the solver, do its intervals cover the true values at the stated 95 percent, and does `planTruingStrings` predict the standard errors the fit reports?

## Method

Strings come from `trajectory` with true factors of 1.015 on the muzzle velocity (790 m/s nominal), 0.96 on the drag and 1.02 on the 0.1 mrad click value. Impacts at 300, 600 and 900 m, dialled corrections at 400, 700 and 1000 m, 5 shots per entry with 0.2 mrad dispersion, and a chronograph string. Accept rules, set in the tests:

- Exact strings: all three parameters identified and within $10^{-6}$ relative, standardized residuals below $10^{-5}$, the residual check passed.
- Coverage: 300 seeded noise draws, with and without the zero offset fitted. Each 95 percent interval covers the truth in a share within 3 binomial standard deviations of 0.95; the residual check at 0.99 rejects fewer than 1 percent plus 3 binomial standard deviations of the fits.
- Plan against fit: the relative standard uncertainty the plan gives for each parameter within 10 percent of the one a noisy fit reports.
- Identifiability: strings at one distance, two distances alike in effect, a chronograph with one close distance, and dialled corrections alone must name the parameters they cannot separate as weak or unresolved.

## Formulas

The fit is the weighted least squares on log parameters of [least squares](../models/least-squares.md) ([Levenberg 1944](../bibliography.md#levenberg-1944), [Marquardt 1963](../bibliography.md#marquardt-1963)). The covariance is the inverse of the weighted Jacobian information at the solution ([Bard 1974](../bibliography.md#bard-1974), chapter unverified); an interval is the estimate plus or minus a Student's t quantile times its standard uncertainty ([Abramowitz 1964](../bibliography.md#abramowitz-1964), 26.7.3 and 26.7.4, page unverified). Coverage of $n$ intervals at level 0.95 is binomial, with standard deviation $\sqrt{0.95 \cdot 0.05 / n}$; for $n = 300$ the accepted band is 0.95 plus or minus 0.038. The residual check compares $\chi^2$ with its 0.99 quantile.

## Numbers

- Exact strings: the three parameters within $10^{-6}$, four degrees of freedom, the check passed.
- Coverage over 300 seeds: every interval's coverage inside 0.912 to 0.988, for three and for four fitted parameters; the residual check inconsistent in fewer than 2.7 percent of the fits.
- Plan: within 10 percent of the fit for every parameter, seven observations.
- More data: twelve shots instead of three at 300 and 600 m divide the drag factor's planned standard uncertainty by more than 1.9; a third distance at 900 m lowers it.
- Not tested: real range strings, and coverage when the drag curve's shape differs from the true one, where the intervals rest on the model being right.

## Result

No change. The tests are adopted as regression tests.

## Data basis

Analytic: synthetic strings from the solver with seeded noise.

## Where in the app

- `packages/core/test/exterior-truing-strings.test.ts`, `packages/core/test/exterior-truing-strings-failures.test.ts`, `packages/core/test/range-strings-fixtures.ts`.
- `packages/core/src/exterior/range-strings.ts`.
- Model page: [truing from range strings](../models/exterior-truing-strings.md).

## Confidence

Medium: the intervals hold their stated coverage on strings the model generates itself; on real strings, where the drag curve and the noise model are only approximate, coverage is unverified.
