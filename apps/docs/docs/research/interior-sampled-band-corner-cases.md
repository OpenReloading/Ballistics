---
title: Sampled band against the corner cases
description: Whether the 5th and 95th percentiles of the sampled band meet the corner-case range when one input varies and lie inside it when several combine.
---

# Sampled band against the corner cases

## Question

Interior ballistics: with one input varied, do the 5th and 95th percentiles of `interiorSampledBand` land on the corner-case range of the same model within the sampling error, and with several inputs varied, does the band lie inside that range?

## Method

A tolerance is read as the 90 percent interval of a normal input, so for a response linear in one input the 5th and 95th percentiles of the output sit at the ends of the tolerance, where the corner cases are. Accept limit, set in the tests: 4 standard errors of a sampled percentile.

- Toy model: pressure $7 q^2 b / v$, burn rate $b$ varied by 5 percent, 4000 draws, seed 7. The 5th, 50th and 95th percentiles of the pressure against $1 - 0.05$, 1 and $1 + 0.05$ times the nominal pressure.
- M3 model: the load of the test fixtures, charge varied by 5 percent, 1000 draws, against `interiorPressureRange` with the same tolerance.
- M3 model, every default tolerance at once, 60 draws: the 5th percentile above the low corner, the 95th below the high corner.
- The same seed must give the same band and another seed another band.

## Formulas

The inputs are drawn and the model run once per draw, the percentiles read from the sorted outputs ([JCGM 101:2008](../bibliography.md#jcgm-101-2008), propagation of distributions, section numbers unverified). The standard error of the $p$ percentile of $N$ draws is $\sqrt{p(1-p)/N} / \varphi(z_p)$ in standard deviations of the output, with $\varphi$ the standard normal density and $z_{0.95} = 1.645$, so the limit of 4 errors is about 0.13 standard deviations for $N = 4000$ and 0.27 for $N = 1000$ (the asymptotic variance of a sample quantile, a standard result; no reference is cited).

## Numbers

- Toy model: the three percentiles within 4 standard errors of the corner values; no failed draw.
- M3 model with the charge varied: both percentiles within 4 standard errors of the corners.
- M3 model with every tolerance: the band strictly inside the corner range.
- Not tested: whether the input tolerances describe real lot-to-lot spread; the band covers input tolerances only and is not a confidence interval of the model.

## Result

No change. The tests are adopted as regression tests.

## Data basis

Analytic: a closed-form toy model and the M3 model on a fixture load, compared with the corner cases of the same model.

## Where in the app

- `packages/core/test/interior-monte-carlo.test.ts`.
- `packages/core/src/interior/monte-carlo.ts`.
- Model pages: [sampled band](../models/interior-sampled-band.md), [peak-pressure range](../models/interior-pressure-range.md).

## Confidence

High: the sampling meets the corner cases within its own sampling error; the check says nothing about the M3 model itself.
