---
title: Coverage factor and leave-one-trace-out check of the fitted pressure exponent
description: Which coverage factor gives the pressure exponent of the joint curve fit a 90 % interval on synthetic traces, and whether refitting without each trace shows model error that the residuals hide.
---

# Coverage factor and leave-one-trace-out check of the fitted pressure exponent

## Question

Interior curve fit: which factor on the relative standard uncertainty of the pressure exponent of `fitPressureCurves` gives an interval that covers the true exponent in 90 % of fits, and does the spread of the exponent refitted without each trace show the model error (heat loss, bore friction) that the residuals hide?

## Method

The shipped `fitPressureCurves` at its default limits, with the traces, truths and starts of the [study of the exponent](interior-curve-fit-exponent.md): breech traces of the load of the [curve fit page](../models/interior-curve-fit.md) every 10 µs on a clock offset by 0.2 to 0.4 ms, Gaussian noise of a fixed fraction of the peak, the true burn coefficient scaled with the exponent so every truth has the same burn rate at 130 MPa, start values 3 % off for the burn coefficient, 5 % for the form and 20 % above the truth for the exponent, fall fraction 0.5.

Grid, 40 replicates per cell, seeds $1000\,(r + 1) + 16\,k$ for replicate $r$ and trace $k$:

- Noise only: $K$ = 2, 3, 5 traces at charges evenly spaced from 2.4 to 3.0 g, exponent 0.3, 0.5, 0.8, noise 0.1, 0.5 and 2 % of the peak (27 cells).
- Model error: convective heat loss (flame temperature 2800 K, factor 0.5) and bore friction (2.5 MPa) in the truth, which the fitted model lacks, $K$ = 2, 3, 5, exponent 0.5, noise 0.5 %.

Each run records the fitted over the true exponent, its relative standard uncertainty $u_\text{rel}$, its status and the exponents of the leave-one-out refits. Only runs with the exponent fitted (not `fixed`, no failure) count.

Rules:

- Coverage factor: the 90th percentile of $\lvert \ln(\hat n / n) \rvert / u_\text{rel}$ over the noise-only runs of the even replicates, rounded to one decimal, checked on the odd replicates. The split was fixed before the run.
- Check: the threshold was chosen from the table below after the run, as the comparison with the interval that names about 3 % of the noise-only fits. The check is said to show model error only when it names clearly more of the model-error fits than of the noise-only fits.

## Formulas

The interval is symmetric in the log exponent, as the fit works on log parameters, with a coverage factor $k$ in place of the normal 1.645 ([JCGM 100:2008](../bibliography.md#jcgm-100-2008), coverage factor):

$$
n_\text{low,high} = n\, e^{\mp k\, u_\text{rel}(n)}
$$

The spread of the $K$ exponents $n_{(k)}$ refitted without trace $k$ is their jackknife standard error on the log exponent, which estimates the standard error of the fit with all traces from how much each trace moves it ([Efron 1982](../bibliography.md#efron-1982)):

$$
s_J = \sqrt{\frac{K-1}{K} \sum_k \bigl(\ln n_{(k)} - \overline{\ln n_{(\cdot)}}\bigr)^2}
$$

A refit starts from the fitted load, fits the same parameters and keeps the exponent whatever its variance inflation: dropping an end trace narrows the peak range, and at the limit of the full fit such a refit held the exponent on a model-error case of three traces, so no spread was left to compare.

## Numbers

Raw runs and the script: `spikes/566/` on the branch `spike/566-exponent-interval`.

Coverage factor, noise only. 535 fitted runs on the even replicates give a 90th percentile of 2.20, so $k = 2.2$. On the 535 odd ones:

| factor | coverage, pooled | cells at 90 % or more | lowest cell |
| --- | ---: | ---: | ---: |
| 1.645 | 85 % | - | - |
| 2.2 | 91.4 % | 18 of 27 | 75 % |
| 2.5 | 94.0 % | 21 of 27 | 80 % |

The 90th percentile is 1.5 for two traces, 2.0 for three and 2.3 for five. 9 of 1200 runs failed to converge, one held the exponent.

Leave-one-out check, $K$ = 3 and 5: share of fits named for $s_J > T\,u_\text{rel}$:

| $T$ | noise only (700 fits) | model error, 3 traces | model error, 5 traces |
| ---: | ---: | ---: | ---: |
| 2.2 (half-width of the interval) | 16 % | 18 of 40 | 14 of 40 |
| 3 | 7.3 % | 10 of 40 | 8 of 40 |
| 4.4 (full width) | 2.9 % | 2 of 40 | 3 of 40 |
| 6 | 1.6 % | 1 of 40 | 3 of 40 |

At $T$ = 4.4 the most named noise-only cell is 12.5 % (5 of 40). The median $s_J / u_\text{rel}$ is 1.0 to 1.7 without model error and 1.9 to 2.1 with it.

Model error: the exponent came out 0.978 to 0.983 of the truth (median per cell, 0.96 to 1.01 over all runs) at $u_\text{rel}$ 0.006 to 0.007. The interval with $k = 2.2$ covered 9, 7 and 8 of 40 runs with two, three and five traces (18 to 23 %), with $\chi^2/\nu$ at 1.09 to 1.14.

A trace whose powder burns 5 % faster than the others (a different lot), three traces at 0.5 % noise, gave refitted exponents of 0.21, 0.50 and 0.63 and was named.

## Result

Improved, adopted: the interval with $k = 2.2$ and the leave-one-trace-out check at $s_J$ above the full width of the interval, which names 2.9 % of noise-only fits. Documented as a limit: neither shows heat loss and bore friction. The check names model-error fits at about the rate of noise-only fits, because the missing physics biases every trace the same way, and the interval covers 18 to 23 % of them. The check does show a trace that disagrees with the others. A lower threshold names more model-error fits but as many noise-only fits more, so it was not taken.

## Data basis

Analytic: synthetic traces from the M3 model, no measured data.

## Where in the app

- `packages/core/src/interior/curve-fit.ts`, `fitPressureCurves`, `checkSpread`, `refits`, `jackknife`.
- `packages/core/test/interior-curve-fit.test.ts`.
- Model page: [burn form and exponent from a pressure-time curve](../models/interior-curve-fit.md).

## Confidence

Medium: 1200 runs over 30 cells of one synthetic load; the factor varies with the number of traces (1.5 to 2.3) and covered 75 % in the worst cell, and real traces (sensor resonance, shot start) were not tested.
