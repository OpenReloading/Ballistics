---
title: Truing
description: Fit of the muzzle velocity and of drag factors to measured heights, holds and velocities of one or several firing sessions.
---

# Truing

Truing adjusts inputs of the trajectory so that its predictions match measured values. Every evaluation is an ordinary `trajectory` call with candidate inputs, so truing runs on the [point-mass](exterior-point-mass.md) and the [modified point-mass](exterior-modified-point-mass.md) model with every trajectory option. The fit is the [least squares on log parameters](least-squares.md).

- `trueMuzzleVelocity` fits the muzzle velocity.
- `trueDrag` fits a drag correction, with or without the muzzle velocity.
- `trueDragSessions` fits one drag correction of one projectile, shared by several sessions flown with their own conditions.
- `compareTruingFits` fits the same observations with the muzzle velocity alone and with the drag factor together with the muzzle velocity, and reports how far the two fitted shots disagree.

## Equations

### Parameters

The muzzle velocity $v_0$, a constant drag factor $k$, or drag factors $f_j$ at Mach knots $M_1 \lt \dots \lt M_J$, each fitted as a log parameter from its start value (the shot's muzzle velocity, factors 1):

$$
v_0 = v_{0,\text{nom}}\, e^{\theta_v}, \qquad k = e^{\theta_k}, \qquad f_j = e^{\theta_{f_j}}
$$

Code: `packages/core/src/exterior/truing.ts`, `leastSquares` (`q`), `factorSpecs`.

With the muzzle velocity fitted, it comes first. In `trueDragSessions` each session whose `fitMuzzleVelocity` is set adds its own muzzle velocity, in session order, before the drag factors.

### Constant drag factor

The factor multiplies the drag coefficient. A ballistic coefficient in velocity bands is divided by it in every band, a custom drag curve is multiplied by it at every node:

$$
C_D(M) \to k\, C_D(M): \qquad C_{\text{BC},b} \to \frac{C_{\text{BC},b}}{k}, \qquad c_n \to k\, c_n
$$

Code: `packages/core/src/exterior/truing.ts`, `dragCorrection`.

$C_{\text{BC}}/k$ is the trued ballistic coefficient.

### Mach-dependent drag factor

The factor is linear in Mach between the knots and held at the end values outside them:

$$
f(M) = \begin{cases} f_1 & M \le M_1 \\ f_j + \left(f_{j+1} - f_j\right) \dfrac{M - M_j}{M_{j+1} - M_j} & M_j \lt M \lt M_{j+1} \\ f_J & M \ge M_J \end{cases}
$$

Code: `packages/core/src/exterior/truing.ts`, `dragCorrection` (`factor`). `packages/core/src/exterior/drag.ts`, `dragCoefficient`.

The bullet's own drag coefficient on the area $\pi d^2/4$ is the custom curve itself, or from a ballistic coefficient of one band:

$$
C_\text{own}(M) = \frac{C_G(M)\, m}{C_\text{BC}\, d^2}
$$

Code: `packages/core/src/exterior/truing.ts`, `dragCorrection` (`own`).

The trued drag is a custom curve with nodes at the knots and at the nodes of the base table or curve. A base node within $10^{-9}$ relative of a knot is replaced by the knot, since two nearly equal nodes would make the slopes of a monotone cubic rounding noise:

$$
C_{D,\text{trued}}(M_n) = f(M_n)\, C_\text{own}(M_n), \qquad M_n \in \{\text{base nodes}\} \cup \{M_1, \dots, M_J\}
$$

Code: `packages/core/src/exterior/truing.ts`, `dragCorrection` (`nodes`, `near`).

$C_G$ and the custom curve are read with the input's interpolation (linear or monotone cubic, [drag](exterior-drag.md)), and the trued curve carries the same option. Between two nodes the trued curve follows its own interpolation, so the fitted curve is exactly the reported curve.

### Observations and cost

An observation is one measured value at a slant range $s_i$: the height above the line of sight, the elevation hold, or the ground speed. Its prediction is the same field of the trajectory point at $s_i$. With $\sigma_i = 1$ for observations without a standard deviation:

$$
r_i = \frac{\hat y_i(\theta) - y_i}{\sigma_i}, \qquad \chi^2 = \sum_{s=1}^{S} \sum_{i \in s} r_i^2
$$

Code: `packages/core/src/exterior/truing.ts`, `leastSquares` (`sigma`, `predictRun`). `packages/core/src/least-squares.ts`, `logLeastSquares` (`residuals`).

Each session $s$ is predicted by a trajectory of its own shot (air, wind, look angle, site, zero) with the candidate drag. One session is the case of `trueMuzzleVelocity` and `trueDrag`. A muzzle velocity of one session moves only that session's predictions, so its Jacobian column is zero on the rows of the other sessions (`moves`).

### Noise floor

A Jacobian entry below this floor per unit log parameter is noise. A parameter whose column lies below it on every row is unresolved:

$$
\text{floor}_i = \frac{10^{-6}\, a_i}{\sigma_i}, \qquad a_i = \begin{cases} s_i & \text{height (m)} \\ 1 & \text{elevation hold (rad)} \\ \lvert y_i \rvert & \text{velocity (m/s)} \end{cases}
$$

Code: `packages/core/src/exterior/truing.ts`, `leastSquares` (`floor`).

### Uncertainty

First-order propagation from the log parameter to the parameter:

$$
\sigma_{q_j} = q_j\, \sigma_{\theta_j}
$$

Code: `packages/core/src/exterior/truing.ts`, `truingResult` (`parameters`).

$\sigma_{\theta_j}$ and the correlations come from [the covariance at the solution](least-squares.md). The result also reports $\chi^2$, the degrees of freedom $n - p$, the condition number, and for every observation the predicted value, the residual (predicted minus observed) and the predicted Mach number at its range.

### Divergence of the two fits

With $\hat y_i^{(v)}$ the prediction of the muzzle velocity fit and $\hat y_i^{(k)}$ that of the fit of $v_0$ and $k$ together, at the same $n$ observations:

$$
D = \sqrt{\frac{1}{n} \sum_{i=1}^{n} \left(\frac{\hat y_i^{(k)} - \hat y_i^{(v)}}{\sigma_i}\right)^2}
$$

Code: `packages/core/src/exterior/truing.ts`, `compareTruingFits` (`divergence`).

$\sigma_i = 1$ where the observations have none, which the fit allows for one kind only. The two-parameter fit contains the one-parameter fit as the case $k = 1$, so noiseless data that only a muzzle velocity error produced give $k = 1$ and $D = 0$ up to the solver tolerance. With measurement noise $k$ moves off 1 and $D$ is positive without a drag error. A drag error that the muzzle velocity has to absorb gives $D > 0$. $D$ compares predictions at the observed ranges and says nothing about the ranges between or beyond them.

### The zero during truing

With a zero range, every candidate is zeroed again at that range by `trajectory`, so the zero carries the candidate muzzle velocity and drag. A height observed at the zero range then carries no information and is reported as unresolved. With bore angles given directly, they are held for every candidate.

### Failure modes

A failed fit throws `TruingError`, an `InputError`, with one of these reasons and the last estimate:

- `underdetermined`: fewer observations than parameters, before any trajectory.
- `unresolved`: a parameter the observations do not move (a height at the zero range, a Mach knot no flight reaches).
- `ill-conditioned`: the condition number exceeds `maxCondition` (default $10^3$), with the parameter combination the data cannot separate.
- `unreachable`: the start shot does not reach an observation range, or a Jacobian evaluation fails.
- `not-converged`: `maxIterations` accepted or rejected steps without convergence. The default is 30 in core, which the web app's truing section calls directly. The REST routes pass 20 and accept at most 20, so a fit that core would finish after more than 20 steps reports `not-converged` through the API.
- `step-budget`: the integration steps of all trajectories of the fit, zero searches included, reach `maxTotalSteps`.

Malformed inputs throw a plain `InputError` before any trajectory (`checkObservations`, `dragCorrection`, `fitDrag`):

- a standard deviation on some observations only, or not above 0,
- observations of different kinds without standard deviations,
- a height or hold at range 0,
- fewer than two knots, knots not rising or not above 0,
- knots with a ballistic coefficient of several bands,
- an empty session.

The trajectories of a fit run at `relativeTolerance` $10^{-10}$, `absoluteTolerance` $10^{-9}$ and a zero tolerance of $10^{-9}$ m unless the options set others.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $v_0$ | Muzzle velocity | m/s | m/s |
| $v_{0,\text{nom}}$ | Muzzle velocity of the input shot | m/s | m/s |
| $k$ | Constant drag factor on $C_D$ | 1 | 1 |
| $f_j$, $M_j$ | Drag factor at Mach knot $j$, knot Mach number | 1 | 1 |
| $\theta$ | Log parameters | 1 | 1 |
| $M$ | Mach number | 1 | 1 |
| $C_D$, $C_\text{own}$ | Drag coefficient on $\pi d^2/4$ | 1 | 1 |
| $C_G$ | Drag coefficient of the standard drag model | 1 | 1 |
| $C_{\text{BC}}$ | Ballistic coefficient | lb/in2 | kg/m2 |
| $c_n$ | Node value of a custom drag curve | 1 | 1 |
| $m$ | Bullet mass | g | kg |
| $d$ | Bullet diameter | mm | m |
| $s_i$ | Slant range of observation $i$ | mm | m |
| $y_i$, $\hat y_i$ | Observed and predicted height, elevation hold or speed | mm, deg, m/s | m, rad, m/s |
| $\sigma_i$ | Standard deviation of observation $i$ | unit of the observation | unit of the observation |
| $r_i$, $\chi^2$ | Weighted residual, sum of squares | 1 | 1 |
| $\sigma_{q_j}$ | Standard uncertainty of a fitted parameter | unit of the parameter | unit of the parameter |
| $\hat y_i^{(v)}$, $\hat y_i^{(k)}$ | Prediction of the muzzle velocity fit, of the fit of $v_0$ and $k$ | mm, deg, m/s | m, rad, m/s |
| $D$ | Divergence of the two fits | 1 | 1 |

## Assumptions

- Observations are independent. With standard deviations they are the true ones. Without them, one variance is shared by every observation of every session and the covariance is scaled by $\chi^2/(n - p)$.
- Every input that is not fitted is correct: air, wind, look angle, sight height and zero conditions of each session.
- The drag correction is one constant factor, or a factor piecewise linear in Mach. Outside the knot span the factor is held at its end value. This is a choice, not an extrapolation from data.
- Speeds are observed relative to the ground, while drag acts on the airspeed. With wind, the wind must be part of the session's shot.
- One projectile for all sessions of `trueDragSessions`. Each session that does not fit its muzzle velocity holds the one in its shot.

## Limits

- The uncertainties are linearized and hold the sampling error of the observations only, not errors of the model, the range, the atmosphere or the inputs held fixed.
- Without standard deviations and with as many observations as parameters the fit is exact and has no uncertainty. An exact fit without standard deviations and more observations than parameters has $\chi^2 = 0$, so every uncertainty is 0 and the correlations are NaN.
- A ballistic coefficient of several bands takes only a constant factor. Its bands switch on airspeed, not Mach.
- A session whose muzzle velocity is fitted from one observation adds nothing to the drag factor, since its muzzle velocity absorbs the residual. It shows in the correlations and the uncertainties.
- One muzzle velocity shared by several sessions and different projectiles per session are not offered.
- A trued value far from its start value is returned as fitted. The start value is part of the result.

## Sources

- [Levenberg 1944](../bibliography.md#levenberg-1944) and [Marquardt 1963](../bibliography.md#marquardt-1963): the least-squares method, see [least squares on log parameters](least-squares.md).
- [Bard 1974](../bibliography.md#bard-1974) (chapter unverified): the covariance of the estimate from the Jacobian at the solution.
