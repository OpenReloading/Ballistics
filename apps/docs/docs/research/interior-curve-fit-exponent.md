---
title: Pressure exponent of the curve fit from several traces or a known time shift
description: Whether fitting several pressure traces of one powder together, or fixing the time shift from a second signal, resolves the pressure exponent of the curve fit, and how honest its uncertainty is.
---

# Pressure exponent of the curve fit from several traces or a known time shift

## Question

Interior curve fit: what lets the fit resolve the pressure exponent that one trace almost never resolves (variance inflation above the default limit of 10): several traces of different peak pressures fitted together, a time shift fixed from a known sensor delay, or a second signal (muzzle velocity, muzzle-exit time), and what uncertainty is honest to report?

## Method

Synthetic breech pressure traces of the load of the [curve fit page](../models/interior-curve-fit.md) (0.6 m barrel, 6.9 mm bore, two-stage form $a = 0.8$, $z_1 = 0.3$), sampled every 10 µs on a clock with a random offset of 0.2 to 0.4 ms, with Gaussian noise of a fixed fraction of the peak. The true burn coefficient is scaled with the exponent so every truth has the same burn rate at 130 MPa, so the peaks stay comparable across exponents. Start values: burn coefficient 3 % off, form parameters 5 % off, exponent 20 % above the truth.

The fit is a joint version of `fitPressureCurve`: the burn coefficient (stated at the geometric mean of the trace peaks), $a$, $z_1$ and $n$ are shared, every trace has its own fitted time shift, the window and the rule that holds an unresolved form parameter are those of `fitPressureCurve`. With one trace it reproduces `fitPressureCurve` to the printed digits (exponent, variance inflation and uncertainty on 6 seeds). The condition limit was relaxed so that the variance inflation, the condition number and the relative uncertainty are recorded and every limit is applied afterwards.

Grid, 50 replicates per cell, seeds $1000\,(r + 1) + 16\,k$ for replicate $r$ and trace $k$, the same traces in every mode of a cell:

- Several traces: $K$ = 1, 2, 3, 5 traces at charges evenly spaced from 2.4 to 3.0 g (one trace: 2.8 g; the highest peak is 1.3 to 1.5 times the lowest), exponent 0.3, 0.5, 0.8, noise 0.1, 0.5 and 2 % of the peak, time shift fitted.
- Time shift: $K$ = 1 and 3, noise 0.5 %, the shift fixed at the truth plus a common delay error of 0, 2, 5 and 10 µs; or fitted with one muzzle velocity per trace (3 m/s) or one muzzle-exit time on the trace clock (5 µs).
- Model error: physics the fitted model lacks in the truth, convective heat loss (flame temperature 2800 K, factor 0.5) and bore friction (2.5 MPa), exponent 0.5, $K$ = 1, 3, 5, shift fitted or known.

Metrics per cell: share of runs in which the exponent would be fitted (converged, variance inflation and condition number below the limit, relative uncertainty below 0.25), the median and 5 to 95 % range of fitted over true exponent, and the coverage of the 90 % interval ($1.645\,u$ on the log exponent) with the factor on $u$ that 90 % coverage needs. 50 replicates give about 4 points of standard error near 90 %. Accept rule, set in advance: an option is adopted when it lifts the share of fitted exponents above 90 % at a limit whose interval still covers within about 10 points of the nominal, without a bias above its uncertainty.

## Formulas

The fitted model, the window and the variance inflation are those of the [curve fit page](../models/interior-curve-fit.md). The joint cost stacks the weighted residuals of all traces, with one time shift $t_{\text{shift},k}$ per trace and the burn coefficient restated at the geometric mean of the peaks:

$$
\chi^2 = \sum_k \sum_{i \in W_k} \left(\frac{\hat p(t_{k,i} - t_{\text{shift},k};\ \theta) - p_{k,i}}{\sigma_k}\right)^2, \qquad
p_\text{ref} = \Bigl(\prod_k p_{\text{pk},k}\Bigr)^{1/K}
$$

A trace at another peak pressure sees the burn rate change as $(p/p_\text{ref})^n$ while the form function and the time shift do not change with the charge, so the traces together separate the exponent from the shape of the rise. Coverage factor: the 90th percentile of $\lvert \ln(\hat n / n) \rvert / u_\text{rel}(\hat n)$ over the replicates.

## Numbers

All tables: `spikes/227/tables.md` on the spike branch. Variance inflation of the exponent (median), share fitted at the limits 10 and 100 (condition number below $10^3$), median relative uncertainty $u_\text{rel}$, coverage of the 90 % interval and the factor for 90 %, noise 0.5 %:

| traces | exponent | VIF | fitted at 10 | fitted at 100 | $u_\text{rel}$ | coverage | factor |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0.3 | 141 | 0 % | 6 % | 0.037 | 86 % | 1.89 |
| 1 | 0.5 | 160 | 0 % | 0 % | 0.018 | 83 % | 1.87 |
| 1 | 0.8 | 350 | 0 % | 4 % | 0.011 | 92 % | 1.47 |
| 2 | 0.5 | 39 | 0 % | 98 % | 0.006 | 86 % | 1.92 |
| 3 | 0.3 | 45 | 4 % | 98 % | 0.010 | 82 % | 3.00 |
| 3 | 0.5 | 51 | 0 % | 100 % | 0.006 | 90 % | 1.71 |
| 3 | 0.8 | 61 | 2 % | 100 % | 0.003 | 84 % | 2.00 |
| 5 | 0.5 | 60 | 0 % | 100 % | 0.005 | 82 % | 2.26 |

- Several traces: over all noise levels and exponents, one trace gives a variance inflation of 125 to 365 and is fitted at the limit 100 in 0 to 22 % of the runs. Two or more traces give 17 to 68 and are fitted at 100 in 90 to 100 %; the rest did not converge (up to 5 of 50 at 2 % noise). The relative uncertainty falls by a factor of 2 to 5. Two traces give most of the gain, three and five add little.
- Known time shift: the variance inflation falls to 7 to 12, but a delay error biases the exponent by more than its uncertainty. With 3 traces at exponent 0.5 the fitted exponent is 0.991, 0.979 and 0.957 of the truth at 2, 5 and 10 µs, with $u_\text{rel}$ 0.002, and the coverage falls from 78 % (no error) to 0 %. One trace at exponent 0.3: 0.973, 0.936, 0.866.
- Muzzle velocity or muzzle-exit time per trace: no change in the variance inflation (one trace: 143 to 195 against 141 to 160 without), a few more failed fits. A velocity constrains the burn, not the clock, and a 5 µs exit time is weaker than the trace itself.
- Coverage without model error: 70 to 100 % over the cells with fitted shifts, the factor for 90 % 1.4 to 3.6 (median about 2.2) instead of 1.645. A held transition point at its 5 % wrong start value adds to this.
- Model error (heat loss and bore friction, exponent 0.5): the fitted exponent is 1.068 (one trace), 0.981 (3 traces) and 0.982 (5 traces) of the truth with $u_\text{rel}$ 0.018, 0.007 and 0.006, coverage 8 to 22 %. $\chi^2/\nu$ stays at 1.04 to 1.14, so the residuals do not show it. With the shift known the exponent is 1.03 of the truth and coverage 0 to 4 %.

## Result

Improved, documented as a decision for build issues; nothing in `packages/` changed. Adopted for the build: a joint fit of two or more traces of the same powder lot, rifle and sensor at different charges (highest peak at least about 1.3 times the lowest), with one fitted time shift per trace and an exponent limit of 100 on the variance inflation in the joint fit. One trace keeps the default limit 10, so its exponent stays held. Not adopted: fixing the time shift from a sensor delay (it would have to be known to well under 2 µs), and muzzle velocity or exit-time rows (no effect on the exponent). The uncertainty of the exponent holds the noise only: it is reported as such, and the interval is widened by a coverage factor of 2.5 (instead of 1.645 for 90 %), with a leave-one-trace-out spread as the check for model error with three or more traces.

## Data basis

Analytic: synthetic traces from the M3 model, no measured data.

## Where in the app

- `packages/core/src/interior/curve-fit.ts`, `fitPressureCurve`.
- `packages/core/src/least-squares.ts`, `logLeastSquares` (stacked runs), `identifiability`.
- Model page: [burn form and exponent from a pressure-time curve](../models/interior-curve-fit.md).

## Confidence

Medium: the gain of several traces is large and consistent across 36 cells, but the model-error world shows a bias of 2 to 7 % that the residuals hide, and real traces (sensor resonance, shot start) were not tested.
