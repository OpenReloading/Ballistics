---
title: Powder fit from a chronograph ladder
description: Weighted least-squares fit of the burn coefficient and, on request, the start pressure of the M3 interior model to measured muzzle velocities and peak pressures of a charge ladder.
---

# Powder fit from a chronograph ladder

`fitPowder` fits the burn coefficient of one [M3](interior-m3.md) load and, on request, its shot-start pressure to a ladder: charges with their mean muzzle velocities and, optionally, measured peak pressures. The fit works on log parameters with the Levenberg-Marquardt loop of the [least-squares page](least-squares.md). It reports the fitted values, their uncertainty and correlation, the residuals, $\chi^2$, the degrees of freedom and the condition number. The fitted values describe the ladder's rifle, powder lot, components and model version over the ladder's charge range. They are not powder data and not load data.

## Equations

### Ladder charges

`chargeLadder` builds the charges of a ladder of $N$ steps from a start charge $m_0$ and a step $\Delta m$, upward, downward or centred on $m_0$ (odd $N$, lowest first):

$$
m_i = m_0 \pm i\,\Delta m, \qquad
m_i = m_0 + \Bigl(i - \frac{N - 1}{2}\Bigr)\Delta m, \qquad i = 0, \dots, N - 1
$$

Code: `packages/core/src/interior/ladder.ts`, `chargeLadder`.

Each charge is a product, not a running sum. Every charge must be above 0.

### Observations

Each ladder point $k$ gives a velocity row and, with a measured pressure, a pressure row after it. The prediction of a velocity row is `muzzleVelocity`, that of a pressure row is `peakBreechPressure` of the run at charge $m_k$:

$$
\hat y_i(\theta) =
\begin{cases}
v_0\bigl(m_k, q(\theta)\bigr) & \text{velocity row} \\
p_\text{max}\bigl(m_k, q(\theta)\bigr) & \text{pressure row}
\end{cases}
\qquad \sigma_i = 1 \text{ without stated uncertainties}
$$

Code: `packages/core/src/interior/fit.ts`, `ladderRows`, `fitPowder` (`rows`, `evaluate`).

Velocity uncertainties are given on all points or on none. Pressures need their uncertainty and need velocity uncertainties. Repeated charges add rows but no runs.

### Parameters

The burn coefficient is the vivacity $B_a$ of a vivacity law or the coefficient $\beta$ of a geometric law (see [burn laws and form functions](interior-burn-forms.md)). Both parameters are fitted as logarithms, the start pressure relative to a floor below which it has no effect:

$$
B = B_0\,e^{\theta_1}, \qquad
p_\text{st} = p_\text{floor} + (p_{\text{st},0} - p_\text{floor})\,e^{\theta_2}
$$

Code: `packages/core/src/interior/fit.ts`, `powderParameterMap` (`q`, `offset`).

$$
p_\text{floor} = \max\bigl(p_i,\ p_f + p_e(0)\bigr)
$$

Code: `packages/core/src/interior/fit.ts`, `startPressureFloor`.

$p_e(0)$ is the engraving pressure of a profile point at travel 0, else 0. The gas starts at $p_i$, and the projectile starts once the mean pressure reaches $p_\text{st}$ and overcomes the resistance at travel 0 ([shot start](interior-m3.md)). Below $p_\text{floor}$ the start pressure therefore changes nothing. A fitted start pressure must start above $p_\text{floor}$, and the map keeps every step above it. The default fits $B$ alone.

### Cost

$$
r_i = \frac{\hat y_i(\theta) - y_i}{\sigma_i}, \qquad \chi^2 = \sum_i r_i^2, \qquad \nu = n - n_p
$$

Code: `packages/core/src/least-squares.ts`, `logLeastSquares` (`residuals`, `chi2`), `packages/core/src/interior/fit.ts`, `fitPowder` (`degreesOfFreedom`).

The loop starts at $\theta = 0$. By default it takes at most 30 steps, accepted and rejected, and fails when the condition number of the column-scaled Jacobian exceeds $10^3$. A Jacobian column is unresolved when its norm is 0 or below $10^{-9}$ of the largest column norm, or when every entry lies below the noise floor per unit log parameter:

$$
J_\text{floor,i} = 10^{-6}\,\frac{y_i}{\sigma_i}
$$

Code: `packages/core/src/interior/fit.ts`, `fitPowder` (the `floor` field of the `logLeastSquares` call).

A candidate with an invalid run at any charge is a rejected step.

### Uncertainty

With $C_\theta$ the covariance of the log parameters at the solution (scaled by $\chi^2/\nu$ when no uncertainties are given), the standard uncertainty of a fitted value is

$$
\sigma_{q_j} = (q_j - o_j)\sqrt{C_{\theta,jj}}, \qquad o_j = \begin{cases} p_\text{floor} & \text{start pressure} \\ 0 & \text{burn coefficient} \end{cases}
$$

Code: `packages/core/src/interior/fit.ts`, `fitPowder` (`standardUncertainty`), `powderParameterMap` (`offset`).

Without stated uncertainties and with as many rows as parameters there is no uncertainty and no correlation. The values are linearized, assume independent observations with the stated uncertainties and contain no model error.

### Identifiability

On a velocity-only ladder a higher burn coefficient and a higher start pressure both raise the early pressure and the muzzle velocity. The ratio of the two effects changes little over the ladder. Their Jacobian columns are nearly parallel and the correlation of the two parameters is near $-1$. The condition check does not reject such a fit, but the start-pressure uncertainty is large. Measured peak pressures and wider ladders separate the two. A fitted burn coefficient absorbs the errors of every fixed input that moves the velocity: energy, isentropic exponent, covolume, chamber volume, form function, exponent, bore resistance and heat loss.

### Failures

`fitPowder` throws a `PowderFitError` with one of these reasons:

- `underdetermined`: fewer rows than parameters, before any run.
- `invalid`: an `interior` run at the start values or in a Jacobian is invalid. The error names the charge and the run's reason.
- `unresolved`: a parameter does not measurably change any prediction, for example a start pressure carried to the floor.
- `ill-conditioned`: the condition number is above the limit. The error carries the parameter combination of the smallest eigenvalue.
- `not-converged`: the step budget ran out with the conditioning check passed.

Malformed input (an empty ladder, a value that is not finite and above 0, uncertainties on some points only, an unknown or repeated parameter) throws a plain `InputError` before any run.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $m_0$, $\Delta m$, $m_i$, $m_k$ | Start charge, ladder step, ladder charges | g | kg |
| $N$ | Number of ladder steps | 1 | 1 |
| $y_i$, $\hat y_i$ | Observed and predicted value of row $i$: muzzle velocity or peak pressure | m/s or bar | m/s or Pa |
| $\sigma_i$ | Standard uncertainty of row $i$ | m/s or bar | m/s or Pa |
| $v_0$ | Mean muzzle velocity of a string | m/s | m/s |
| $p_\text{max}$ | Peak breech pressure | bar | Pa |
| $B$, $B_0$ | Burn coefficient, fitted and initial: vivacity of a vivacity law | 1/s | 1/s |
| $B$, $B_0$ | Burn coefficient, fitted and initial: coefficient of a geometric law | no kind | m s⁻¹ Pa⁻ⁿ |
| $p_\text{st}$, $p_{\text{st},0}$ | Start pressure, fitted and initial | bar | Pa |
| $p_\text{floor}$ | Start pressure below which it has no effect | bar | Pa |
| $p_i$ | Ignition pressure | bar | Pa |
| $p_f$ | Bore friction pressure | bar | Pa |
| $p_e(0)$ | Engraving pressure at travel 0 | bar | Pa |
| $\theta_j$ | Log parameter | 1 | 1 |
| $q_j$, $o_j$ | Fitted value and its offset | as the parameter | as the parameter |
| $r_i$ | Weighted residual | 1 | 1 |
| $\chi^2$ | Sum of squared weighted residuals | 1 | 1 |
| $n$, $n_p$, $\nu$ | Rows, parameters, degrees of freedom | 1 | 1 |
| $C_\theta$ | Covariance of the log parameters | 1 | 1 |
| $J_\text{floor,i}$ | Noise floor of a Jacobian entry per unit log parameter | 1 | 1 |

## Assumptions

- The M3 load describes the rifle, components and conditions of the ladder. Only the fitted parameters change between candidates.
- Velocities are mean muzzle velocities. A chronograph reading at a distance from the muzzle is converted to the muzzle by the caller, for example with [truing](exterior-truing.md).
- A pressure row is compared with the peak breech pressure. The gauge position is not modelled.
- Observations are independent, with the stated standard uncertainties.

## Limits

- The fit is local: from a start far from the solution the steps can end at the start-pressure floor with `unresolved`.
- The peak pressure has a kink in the parameters where the peak moves between a located interior peak and burnout. A Jacobian taken across it mixes both sides.
- Charges outside the ladder's range are extrapolations. The result holds no charge recommendation and no limit.
- Only the burn coefficient and the start pressure are fitted. Exponent, energy, form parameters and temperature coefficients stay as given. One ladder, one barrel and one temperature per fit.
- Each prediction costs one `interior` run per distinct charge, and each Jacobian two predictions per parameter.

## Sources

- [Levenberg 1944](../bibliography.md#levenberg-1944) and [Marquardt 1963](../bibliography.md#marquardt-1963): the damped least-squares iteration.
- [JCGM 100:2008](../bibliography.md#jcgm-100-2008), section 4.2.3 (section number unverified): the standard uncertainty of a mean of $N$ readings, the sample standard deviation over $\sqrt N$, which a caller uses as the velocity uncertainty of a string.
