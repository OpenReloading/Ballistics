---
title: Burn form and exponent from a pressure-time curve
description: Weighted least-squares fit of the burn coefficient, the initial slope and transition point of a two-stage vivacity form and the pressure exponent of the M3 interior model to one measured pressure-time trace or to several traces of one powder at different charges, with the identifiability report of every parameter and the import of the user's own trace files.
---

# Burn form and exponent from a pressure-time curve

`fitPressureCurve` fits the burn coefficient, the form parameters $a$ and $z_1$ of a two-stage vivacity form and the pressure exponent $n$ of one [M3](interior-m3.md) load to a measured pressure-time trace. The trace's clock is not the model's, so the fit also finds the time shift between them. The fit works on log parameters with the Levenberg-Marquardt loop of the [least-squares page](least-squares.md). Each parameter is reported as `identified`, `weak` (fitted, but collinear with the others or imprecise) or `fixed` (held at its start value because the trace does not resolve it), with its uncertainty and variance inflation. The fitted values describe the powder lot, rifle and sensor of that one trace over the pressure range it covers. `fitPressureCurves` fits several traces of the same powder lot, rifle and sensor at different charges together, which resolves the exponent that one trace leaves held ([Several traces](#several-traces)). The results are simulation results, not powder data and not load data.

`parsePressureHistory` in `@open-reloading/importers` reads the user's own trace file into times in s, pressures in bar (`pressureBar`) and the sensor position. The fit takes pressures in Pa, so the caller passes `pressureBar` times $10^5$ as `pressure`.

## Equations

### Model and window

The burn law is the vivacity law of [burn laws and form functions](interior-burn-forms.md) with the two-stage form, $\varphi(z)$ of that page with parameters $a$, $m$, $q$ and $z_1$:

$$
\frac{dz}{dt} = B_a\, \tau_T\, \varphi(z; a, z_1) \left(\frac{\max(\bar p, 0)}{p_\text{ref}}\right)^{n}
$$

Code: `packages/core/src/interior/curve-fit.ts`, `fitPressureCurves` (`apply`), `packages/core/src/interior/model.ts`, `interiorRhs`.

The fit compares the trace with the pressure the model gives at the sensor position: the breech pressure, the space-mean pressure or the pressure at the projectile base. The fit window starts where the trace first reaches 25 % of its peak (at its first sample when it already starts above that) $p_\text{pk}$, found on a parabola through the crossing samples, and ends where it first falls to the fraction $f_\text{end}$ of the peak after the peak (default 0.5):

$$
t_s = \min\{t : p(t) \ge 0.25\, p_\text{pk}\}, \qquad
t_e = \min\{t > t_\text{pk} : p(t) \le f_\text{end}\, p_\text{pk}\}
$$

Code: `packages/core/src/interior/curve-fit.ts`, `traceWindow`, `riseTime`, `parabola`.

The rise is aligned above the shot-start pressure, which the M3 model does not reproduce (the pressure at which the projectile starts is of the order of 10 % of the peak, see [powder fit](interior-powder-fit.md)). The window must lie inside the barrel time of the model, else the fit throws an `InputError` that asks for a start closer to the trace or a larger $f_\text{end}$.

### Parameters

The burn coefficient is restated at the trace's peak, $p_\text{ref} = p_\text{pk}$. The model is the same, but the coefficient and the exponent are then far less collinear than at a reference pressure far from the pressures the trace covers:

$$
B_\text{pk} = B_a \left(\frac{p_\text{pk}}{p_\text{ref,0}}\right)^{n_0}
$$

Code: `packages/core/src/interior/curve-fit.ts`, `fitPressureCurves` (`restated`).

The fitted parameters are the logarithms of the ratios to the start values, $B_\text{pk}$, $a$, $z_1$ and $n$ ($a$ needs a start value above 0, $z_1$ below 1, $n$ above 0):

$$
q_j = q_{j,0}\, e^{\theta_j}, \qquad
t_\text{shift} = t_{\text{shift},0} + s\,\theta_\text{shift}, \qquad s = 10^{-4}\ \text{s}
$$

Code: `packages/core/src/interior/curve-fit.ts`, `fitPressureCurves` (`values`, `shiftScale`).

The time shift is always fitted and linear. Its start value puts the model's rise to 25 % of its own peak on the trace's rise. A shift fixed at that start value instead biases the other parameters by about the granularity of the trace's sampling, so it is fitted.

### Cost

The model pressure at the window's samples comes from one `interior` run, linearly interpolated at the shifted sample times:

$$
r_i = \frac{\hat p(t_i - t_\text{shift};\ \theta) - p_i}{\sigma}, \qquad \chi^2 = \sum_i r_i^2, \qquad \nu = n_s - n_p - 1
$$

Code: `packages/core/src/interior/curve-fit.ts`, `fitPressureCurves` (`evaluate`, `degreesOfFreedom`), `packages/core/src/least-squares.ts`, `logLeastSquares` (`residuals`, `chi2`).

The sample noise $\sigma$ is the trace's `sigma`. Without it the fit uses $\sigma = 1$ and scales the covariance by $\chi^2/\nu$, so the uncertainties assume the residuals are noise. A candidate whose run is invalid, or whose shifted window leaves the model's barrel time, is a rejected step. A Jacobian entry below $10^{-6}\,p_\text{pk}/\sigma$ per unit log parameter counts as noise. The loop stops at a relative gain of $\chi^2$ below $10^{-9}$ (the flat valley of correlated form parameters), a default of 100 iterations, and fails with the condition number of the column-scaled Jacobian above $10^3$.

### Identifiability

At the solution the weighted Jacobian is taken by central differences of $\pm 10^{-3}$ in each log parameter. `identifiability` of the [least-squares page](least-squares.md) gives its variance inflation factors, and `logLeastSquares` the relative standard uncertainty of each parameter, the standard error of its log parameter. $R$ is the correlation matrix of the column-scaled Jacobian:

$$
\text{VIF}_j = \bigl(R^{-1}\bigr)_{jj}, \qquad
u_\text{rel}(q_j) = \sqrt{C_{\theta,jj}}, \qquad u(q_j) = q_j\, u_\text{rel}(q_j)
$$

Code: `packages/core/src/interior/curve-fit.ts`, `fitPressureCurves` (`attempt`, `collinear`), `packages/core/src/least-squares.ts`, `identifiability` (`varianceInflation`).

A parameter is `weak` when its variance inflation exceeds `maxInflation` (default 10, reason `collinear`) or its relative standard uncertainty exceeds `maxRelativeStandardUncertainty` (default 0.25, reason `imprecise`). The time shift reports its variance inflation and uncertainty but is not held.

The standard uncertainty of every parameter holds the trace noise only: it is linearized at the solution and assumes the model is right. It holds no model error.

### Interval of the exponent

A fitted exponent carries an `interval` meant to cover the true exponent in 90 % of fits, symmetric in the log exponent with a coverage factor $k$ in place of the 1.645 of a normal distribution:

$$
n_\text{low} = n\, e^{-k\, u_\text{rel}(n)}, \qquad n_\text{high} = n\, e^{k\, u_\text{rel}(n)}, \qquad k = 2.2
$$

Code: `packages/core/src/interior/curve-fit.ts`, `fitPressureCurves` (`interval`), `coverage`.

$k$ comes from a synthetic study of `fitPressureCurves` at its default limits ([research log](../research/interior-curve-fit-exponent-interval.md)): 2, 3 and 5 breech traces at charges from 2.4 to 3.0 g, exponents 0.3, 0.5 and 0.8, noise 0.1, 0.5 and 2 % of the peak, the exponent starting 20 % high, 40 replicates per cell. $k$ is the 90th percentile of $\lvert \ln(\hat n / n) \rvert / u_\text{rel}$ over the fitted runs of half the replicates, 2.20 on 535 runs. On the other half it covered 91 % of the runs, 75 to 100 % per cell (18 of 27 cells at 90 % or more), against 85 % with 1.645. Two traces needed less (90th percentile 1.5), five more (2.3).

The interval holds the trace noise only, like the uncertainty it is built on. With heat loss and bore friction in the synthetic truth, which the fitted model lacks, the exponent came out 2 % low (median 0.98 of the truth, 0.96 to 1.01) with a relative uncertainty of about 0.6 %, and the interval covered 18 to 23 % of the runs while $\chi^2/\nu$ stayed at 1.09 to 1.14.

### Leave-one-trace-out check

With three or more traces and the exponent fitted, the fit refits the exponent $K$ times, each time without one trace, from the fitted load and with the parameters it fitted. A refit judges nothing: it keeps the exponent whatever its variance inflation and uncertainty, since a subset of a trace set has a narrower peak range. `leaveOneOut` lists the refitted exponents $n_{(k)}$ in input order. Their jackknife standard error on the log exponent ([Efron 1982](../bibliography.md#efron-1982)) is compared with the full width of the interval:

$$
s_J = \sqrt{\frac{K-1}{K} \sum_k \bigl(\ln n_{(k)} - \overline{\ln n_{(\cdot)}}\bigr)^2}, \qquad
s_J > 2\, k\, u_\text{rel}(n) \ \Rightarrow\ \text{reason } \texttt{inconsistent}
$$

Code: `packages/core/src/interior/curve-fit.ts`, `checkSpread`, `refits`, `jackknife`.

An `inconsistent` exponent is `weak` and stays fitted with its value and interval: the traces do not agree on it, and holding it at the caller's start value would not make them agree. When a refit fails or holds the exponent, there is no `leaveOneOut` and no check. With two traces there is none either.

In the study the check named 20 of 700 noise-only fits with three or five traces (2.9 %, at most 12.5 % in one cell). A comparison with the interval's half-width instead named 16 %. A trace from a powder that burns 5 % faster than the others is named (test). Heat loss and bore friction are not: the check named 2 and 3 of 40 fits with three and five traces, about the rate of noise-only fits, because the missing physics biases every trace the same way.

### Holding parameters fixed

A trace often fixes the burn coefficient and the shape of the rise but not the exponent: the pressure exponent and the form parameters move the same part of the curve. The fit therefore holds parameters at their start values and reports why:

- A `weak` exponent is held fixed with the reasons of the attempt that showed it, and the fit repeats without it. A fit of the exponent alone keeps it and reports it `weak`. The reason `inconsistent` of the [leave-one-trace-out check](#leave-one-trace-out-check) comes after the fit and does not hold it.
- An `unresolved` failure of the loop holds the parameters it names.
- An `ill-conditioned` failure holds the next of the exponent, the form slope and the transition point that is still fitted.
- The burn coefficient is never held. A fit that would leave nothing to fit, and any other failure, throws.

Code: `packages/core/src/interior/curve-fit.ts`, `fitPressureCurves` (the loop over `attempt`), `withheld`, `giveUp`.

A `fixed` parameter keeps the variance inflation of the attempt that showed it and has no standard uncertainty: with the exponent held at its start value, the other parameters absorb whatever the true exponent differs by. The start exponent is the caller's assumption, and a wrong one shows as model error in the residuals, not as an uncertainty. A weak parameter other than the exponent stays in the fit with its `reasons`, and its uncertainty then says how little the trace constrains it.

Raising `maxInflation` keeps the exponent in the fit where the default would hold it. Its uncertainty is then large and linearized, and the report shows its variance inflation.

### Several traces

`fitPressureCurves` takes one load and one charge per trace: trace $k$ is compared with the load at its own charge, everything else is shared. The burn coefficient, $a$, $z_1$ and $n$ are shared, every trace has its own fitted time shift, and the burn coefficient is restated at the geometric mean of the $K$ trace peaks:

$$
p_\text{ref} = \Bigl(\prod_k p_{\text{pk},k}\Bigr)^{1/K}, \qquad
\chi^2 = \sum_k \sum_{i \in W_k} \left(\frac{\hat p_k(t_{k,i} - t_{\text{shift},k};\ \theta) - p_{k,i}}{\sigma_k}\right)^2, \qquad
\nu = \sum_k n_{s,k} - n_p - K
$$

Code: `packages/core/src/interior/curve-fit.ts`, `fitPressureCurves` (`peak`, `evaluate`, `moves`).

Each trace has its own window, sensor and $\sigma_k$, found as for one trace. Either every trace gives `sigma` or none does. A time shift moves only its own trace's residuals, so its Jacobian columns are zero elsewhere. The parameters are held and reported as for one trace, with one `timeShift` entry per trace in input order. With one trace the result is that of `fitPressureCurve`.

A trace at a higher peak sees the burn rate change as $(p/p_\text{ref})^n$, while the form function and the time shift do not change with the charge, so the traces together separate the exponent from the shape of the rise. On synthetic traces two or more charges whose highest peak is 1.2 to 1.5 times the lowest gave the exponent a variance inflation of 17 to 83 against 125 to 365 for one trace ([research log](../research/interior-curve-fit-exponent.md)). The default `maxInflation` is therefore 100 when the traces come from at least two charges and the highest peak is at least 1.2 times the lowest, and 10 otherwise. The input checks are listed in `warnings`, each with the traces it names:

- `sameCharge`: traces at the same charge (within a relative $10^{-6}$). Repeat shots add no pressure range but keep the limit of the other charges.
- `narrowPeaks`: the highest peak is below 1.2 times the lowest. The exponent is then held under the limit of one trace.

Code: `packages/core/src/interior/curve-fit.ts`, `curveWarnings`, `minPeakRatio`.

### Failures

`fitPressureCurve` and `fitPressureCurves` throw a `PowderFitError` with reason `invalid` (a run at the start values or in a Jacobian is invalid), `unresolved` or `ill-conditioned` (when no parameter can be held to repair it) or `not-converged` (the iteration budget ran out). Malformed input throws an `InputError` before any run: a burn law that is not a vivacity law with a two-stage form, a trace that is not equally long, finite and strictly increasing in time, with fewer than two samples or without a positive peak, a trace that never falls to the fall fraction after its peak, a window with no more than the fitted parameters plus the time shift in samples, a start value outside the range above, an unknown or repeated parameter, and for `fitPressureCurves` no trace, a charge that is not positive, or `sigma` on only some traces.

### Trace import

`parsePressureHistory` reads delimited text with one sample per row, an optional header row, and the time and pressure columns (default the first and second). The units come from the header, as the text in `(...)` or `[...]` or the last word of the header cell (`time (ms)`, `pressure [MPa]`), or from the caller. A header cell without a unit names none. Exponent notation (`1.0E-05`) is read. A unit spelling is matched exactly, or in any case when it is all lower or all upper case, so `mPa` and `Mbar` are not read as `MPa` or `mbar`. A unit that is neither throws `pressure unit is missing: name the unit to import this file` (`time unit ...` likewise), and a recognised unit in the file that differs from the caller's throws. The sensor position (breech, mean or base) is always asked from the caller: the file cannot tell it. Pressures are returned in bar (`pressureBar`) and times in s. Times must increase, and the file needs at least 3 samples.

Code: `packages/importers/src/pressure-history.ts`, `parsePressureHistory`.

The optional low-pass is a one-pole filter run forwards and backwards, so it adds no delay. With the sample step $\Delta t_i$ and $\text{RC} = 1/(2\pi f_c)$:

$$
y_i = y_{i-1} + \frac{\Delta t_i}{\text{RC} + \Delta t_i}\,(x_i - y_{i-1})
$$

Code: `packages/importers/src/pressure-history.ts`, `pass`, `zeroPhase`.

The two passes have a combined response of $\lvert H \rvert^2$ with $\lvert H \rvert = 1/\sqrt{1 + (f/f_c)^2}$, so the $-3$ dB point lies at about $0.64 f_c$. The filter smooths the peak when the cutoff is not well above the content of the trace. No other filtering is done and sensor calibration is out of scope. The unit factor of psi is 6894.757293168 Pa ([NIST SP 811](../bibliography.md#nist-sp-811), Appendix B.9).

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $t_i$, $p_i$ | Time and measured pressure of sample $i$ | s, bar | s, Pa |
| $\hat p$ | Model pressure at the sensor position | bar | Pa |
| $\sigma$ | Standard uncertainty of one sample | bar | Pa |
| $p_\text{pk}$, $t_\text{pk}$ | Peak of the trace and its time | bar, s | Pa, s |
| $t_s$, $t_e$ | Start and end of the fit window on the trace's clock | s | s |
| $f_\text{end}$ | Fall fraction that ends the window | 1 | 1 |
| $B_a$, $B_\text{pk}$ | Burn coefficient (vivacity), as given and restated at $p_\text{pk}$ | 1/s | 1/s |
| $p_\text{ref}$, $p_\text{ref,0}$ | Reference pressure of the burn law, as fitted and as given | bar | Pa |
| $n$, $n_0$ | Pressure exponent, fitted and as given | 1 | 1 |
| $a$, $m$, $q$, $z_1$ | Parameters of the two-stage form | 1 | 1 |
| $z$, $\varphi$ | Burnt fraction, form function | 1 | 1 |
| $\tau_T$ | Temperature factor | 1 | 1 |
| $\theta_j$, $q_j$, $q_{j,0}$ | Log parameter, fitted value and start value | 1, as the parameter | 1, as the parameter |
| $t_\text{shift}$, $s$ | Time shift of the trace clock against the model clock, its scale | s | s |
| $r_i$, $\chi^2$, $\nu$ | Weighted residual, sum of squares, degrees of freedom | 1 | 1 |
| $n_s$, $n_p$ | Samples in the window, fitted parameters without the time shift | 1 | 1 |
| $K$, $k$, $W_k$ | Number of traces of a joint fit, trace index, samples in its window | 1 | 1 |
| $C_\theta$ | Covariance of the log parameters | 1 | 1 |
| $\text{VIF}_j$, $u_\text{rel}$ | Variance inflation factor, relative standard uncertainty | 1 | 1 |
| $k$, $n_\text{low}$, $n_\text{high}$ | Coverage factor, ends of the exponent's interval | 1 | 1 |
| $n_{(k)}$, $s_J$ | Exponent refitted without trace $k$, jackknife standard error of its log | 1 | 1 |
| $f_c$, $\text{RC}$, $\Delta t_i$ | Low-pass cutoff, its time constant, sample step | Hz, s, s | Hz, s, s |
| $x_i$, $y_i$ | Pressure before and after the low-pass | bar | bar |

## Assumptions

- The M3 load and its two-stage vivacity law describe the powder, rifle and conditions of the trace. Only the four parameters and the time shift change between candidates.
- The sensor position is the caller's: the trace is compared with the model's breech, space-mean or base pressure, and the difference between them is a modelling choice, not a measurement.
- Samples are independent with one standard uncertainty. A sensor offset, a gain error or a resonance is not modelled.
- The start values are close enough to the trace that the model reaches the end of the window inside the barrel.

## Limits

- The fit is local and the cost surface has a flat valley. A start far from the solution, or a held exponent that is wrong, ends in a stuck fit or a model error. The reported uncertainty and the exponent's interval are linearized at the solution and hold no model error.
- The shot-start pressure of the model and the trace differ, so the window starts at 25 % of the peak. The rise below that is not fitted.
- Under the default limits the exponent is usually reported `fixed`: with the time shift fitted, its variance inflation on a noisy trace is far above 10. A trace that resolves it needs low noise, a wide pressure range and a form that is already close. Two or more traces of the same powder at charges whose highest peak is at least about 1.2 times the lowest resolved it on synthetic traces (`fitPressureCurves`), a time shift fixed from a sensor delay did not ([research log](../research/interior-curve-fit-exponent.md)).
- The uncertainty and the interval of the exponent of a joint fit hold the trace noise only. Missing physics (heat loss, bore friction) biased it by 2 to 7 % on synthetic traces, with residuals and a leave-one-trace-out spread that did not show it. The coverage factor is from synthetic traces of one load and covered 75 to 100 % per cell; real traces (sensor resonance, shot start) were not tested.
- The initial slope $a$ is nearly degenerate with the other parameters on a slow powder. It then comes back `weak`, or the fit holds it.
- Only the two-stage vivacity form is supported. A geometric law, a constant form and the three-stage form are refused.
- The low-pass only smooths. Frequencies above the cutoff are not restored and the peak can be lowered.
- The fitted parameters describe the traces fitted. They are not powder data and hold no charge recommendation or limit.

## Sources

- Levenberg-Marquardt loop and its stop rule: see the [least-squares page](least-squares.md), [Levenberg 1944](../bibliography.md#levenberg-1944), [Marquardt 1963](../bibliography.md#marquardt-1963).
- Variance inflation and collinearity diagnosis: [Belsley 1980](../bibliography.md#belsley-1980), [Marquardt 1970](../bibliography.md#marquardt-1970).
- Nonlinear regression and linearized uncertainty: [Bates 1988](../bibliography.md#bates-1988).
- Propagation of uncertainty and coverage factors: [JCGM 100:2008](../bibliography.md#jcgm-100-2008).
- Jackknife standard error: [Efron 1982](../bibliography.md#efron-1982).
- Unit factor of psi: [NIST SP 811](../bibliography.md#nist-sp-811).
