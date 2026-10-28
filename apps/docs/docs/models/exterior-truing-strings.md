---
title: Truing from range strings
description: Plan and fit of muzzle velocity, drag factor, click value and an optional zero offset from impacts, dialled corrections and chronograph readings, with identifiability statuses and intervals.
---

# Truing from range strings

A range string is a set of measurements at known distances: the mean impact above the line of sight at the zero setting, or the clicks dialled to centre the group, plus optional chronograph readings.

- `fitTruingStrings` fits the muzzle velocity, a constant drag factor, the click value of the sight and, with the option `fitZeroOffset`, a zero offset to such a string, weighted by the stated uncertainty of every row. A parameter the data cannot separate is named weak or unresolved, returns no value and keeps its nominal value in the reported model. The identified parameters come with confidence intervals. A chi-square test checks the residuals.
- `planTruingStrings` gives the statuses and standard errors of a planned string before any shot, and the refusals of its structure.
- `comparePlanCandidates` does so for several candidate strings.

The workbench's Trajectory tab has the section Truing from range strings: the plan from distances, shots and the dispersion of one shot, the entry of measured rows, each with its number of shots and standard deviation, and the fit with its intervals and residual check. Its nominal shot is the tab's result.

Every prediction is an ordinary `trajectory` call. The iteration is the [least squares on log parameters](least-squares.md).

## Equations

### Parameters

Muzzle velocity, drag factor and click value as log parameters around their nominal values, and the zero offset $e$ in rad around 0:

$$
\theta_v = \ln\frac{v_0}{v_{0,\text{nom}}}, \qquad \theta_k = \ln k, \qquad \theta_c = \ln\frac{c}{c_\text{nom}}, \qquad e
$$

Code: `packages/core/src/exterior/range-strings.ts`, `applied`, `Model` (`predict`).

The drag factor multiplies the drag coefficient as in [truing](exterior-truing.md) (`dragCorrection`). The zero offset is the angle by which the impacts at the zero setting lie above the nominal zero.

### Predicted rows

With $h$, $\alpha$ and $v$ the height above the line of sight, the elevation hold and the ground speed of the trajectory at slant range $s_i$:

$$
\begin{aligned}
\hat y_i &= h(s_i;\, v_0, k) + e\, s_i && \text{impact} \\
\hat n_i &= \frac{\alpha(s_i;\, v_0, k) - e}{c} && \text{dial} \\
\hat v_i &= v(s_i;\, v_0, k) && \text{chronograph}
\end{aligned}
$$

Code: `packages/core/src/exterior/range-strings.ts`, `Model` (`predict`). `packages/core/src/exterior/trajectory.ts`, `TrajectoryPoint` (`height`, `elevationHold`, `velocity`).

An impact does not depend on $c$. Without a dial row the click value has no information.

### Uncertainty of a row

A row is the mean of $m_i$ shots with the standard deviation $\sigma_{1,i}$ of one shot, read in steps of width $w_i$. The rounding adds the variance of a uniform error:

$$
\sigma_i = \sqrt{\frac{\sigma_{1,i}^2}{m_i} + \frac{w_i^2}{12}}
$$

Code: `packages/core/src/exterior/range-strings.ts`, `rowSigma`, `defaultRounding`.

Default steps: 1 click for a dial, 0 for an impact and for the chronograph. The plan derives the spread of one shot from the standard deviation $\delta$ of one shot's vertical angle:

$$
\sigma_{1,i} = \delta\, s_i \ \text{(impact)}, \qquad \sigma_{1,i} = \frac{\delta}{c_\text{nom}} \ \text{(dial)}
$$

Code: `packages/core/src/exterior/range-strings.ts`, `plannedRows` (`spread`).

### Weighted Jacobian

$$
J_{ij} = \frac{1}{\sigma_i} \frac{\partial \hat y_i}{\partial \theta_j}
$$

Code: `packages/core/src/exterior/range-strings.ts`, `Model` (`jacobian`).

The columns of $\theta_v$ and $\theta_k$ are central differences with step $10^{-3}$. The columns of $\theta_c$ and $e$ are exact:

$$
\frac{\partial \hat n_i}{\partial \theta_c} = -\hat n_i, \qquad \frac{\partial \hat y_i}{\partial e} = s_i, \qquad \frac{\partial \hat n_i}{\partial e} = -\frac{1}{c}
$$

Code: `packages/core/src/exterior/range-strings.ts`, `Model` (`jacobian`, `perClick`).

All other entries of these two columns are 0.

### Status of a parameter

A parameter is `unresolved` with reason `no-information` when its column is 0, below $10^{-9}$ of the largest column norm, or below the noise floor on every row:

$$
\lvert J_{ij} \rvert \lt \frac{10^{-6}\, a_i}{\sigma_i} \ \text{for all } i, \qquad a_i = \begin{cases} s_i & \text{impact} \\ \max\left(\lvert n_i \rvert, 1\right) & \text{dial} \\ \bar v & \text{chronograph} \end{cases}
$$

Code: `packages/core/src/exterior/range-strings.ts`, `unresolved`, `measuredRows` (`scale`).

The plan has no measured values and takes 1 click for a dial and the nominal muzzle velocity for the chronograph.

For the other parameters, [`identifiability`](least-squares.md) gives the standard error $\sigma_{\theta_j}$ with all parameters free and the variance inflation factor $\mathrm{VIF}_j$. A parameter is `weak` when one of the reasons holds, else `identified`:

$$
\mathrm{VIF}_j \gt 10 \ \Rightarrow \ \text{collinear}, \qquad \sigma_{\theta_j} \gt 0.05 \ \text{or} \ \sigma_e \gt 10^{-4}\ \text{rad} \ \Rightarrow \ \text{imprecise}
$$

Code: `packages/core/src/exterior/range-strings.ts`, `parameterStatuses`, `analyse`, `rangeStringDefaults`.

The limits are the options `maxInflation`, `maxRelativeStandardUncertainty` and `maxZeroSigma`. When some parameter is collinear, the result names in `confounded` the parameters whose component in the eigenvector of the smallest eigenvalue exceeds 0.3 (`confoundedComponent`). A weak parameter reports $\sigma_{\theta_j}$ and $\mathrm{VIF}_j$ (infinite for a singular design) but no value and no interval.

### Refusals of a plan

A plan carries `refusals`, each with a fixed `id` and an `advice` text, when the structure of the string rules out separating $v_0$ from $k$:

| `id` | Condition | Advice |
| --- | --- | --- |
| `single-range` | Impact and dial entries all at one slant range, no chronograph | Add an entry at a second distance, or chronograph readings together with an impact entry. These may not separate every parameter (dial entries alone leave the click value in the fit, a zero offset needs more observations); the statuses show what is still open. |
| `velocity-only` | A chronograph and no impact or dial entry | Add an impact entry at a distance, or dial entries at two distances. The statuses show what is still open. |

Code: `packages/core/src/exterior/range-strings.ts`, `planRefusals`, `refusalAdvice`.

One drop moves $v_0$ and $k$ along the same direction. A chronograph at the muzzle (the default `instrumentDistance` of 0) depends on $v_0$ only, so the readings alone cannot identify $k$; at a distance one speed moves both. The refusal names the cause that the statuses show as `collinear` or `no-information`. The statuses are still reported. A chronograph at the muzzle with an impact entry at one range passes, since it fixes $v_0$ and the drop then fixes $k$. With dial entries only, $k$ and the click value stay confounded at one range, so the plan passes without refusal and the statuses show `collinear`. With `fitZeroOffset`, a chronograph and one impact entry leave $k$ and the zero offset confounded in the same way.

### Gaussian priors

A prior with standard deviation $s_j$ on $\theta_j$ (on $e$ in rad) is centred on the nominal value. It enters the iteration as one pseudo-row with observed value 0, predicted value $\theta_j$ and standard deviation $s_j$, so the iteration minimizes

$$
\chi^2_\text{prior} = \sum_i r_i^2 + \sum_{j \in P} \frac{\theta_j^2}{s_j^2}
$$

Code: `packages/core/src/exterior/range-strings.ts`, `solveStrings` (`priors`).

The interval of an identified parameter uses the standard error of the Laplace approximation, from the data rows and one row $1/s_j$ per prior of a resolved parameter:

$$
C_\text{post} = \left(J^\top J + S\right)^{-1}, \qquad S_{jj} = \frac{1}{s_j^2} \ (j \in P), \qquad S_{jl} = 0 \ \text{otherwise}
$$

Code: `packages/core/src/exterior/range-strings.ts`, `analyse` (`post`).

Statuses, variance inflation, condition number, correlations and the confounded set come from the data rows alone. A prior narrows an interval and never identifies a parameter. The result reports the ratio of the posterior to the prior standard error, a ratio near 1 meaning the prior decides the interval.

### Fit sequence

1. Screening at the nominal values: parameters without information are held. While the information of the rest is singular, its condition number exceeds `maxCondition` (default $10^3$), or there are more parameters than rows, the parameter with the largest variance inflation is held (on a tie the later one in the order $v_0$, $k$, $c$, $e$).
2. Levenberg-Marquardt on the kept parameters, the others at their nominal values (`solveStrings`).
3. Statuses at the solution. A kept parameter that is not identified leaves the kept set with the numbers that made it weak, and the rest is fitted again from the nominal values. The kept set only shrinks.
4. A failure of the iteration (`unresolved`, `ill-conditioned`, `unreachable`, `not-converged`) removes the parameters it names (for `ill-conditioned`: those with a component above 0.3 in the direction of the smallest eigenvalue, otherwise all kept) and the fit runs again. They are `unresolved` with reason `fit-failed` and listed in `failures`.

The reported model is the last fit: identified parameters at their fitted values, every other parameter at its nominal value. Its residuals, chi-square, degrees of freedom and trued shot belong to it. A parameter held at screening although its numbers pass the limits is `weak` with reason `collinear`. An invalid nominal shot or a range the nominal shot does not reach throws before any fit.

### Intervals

For an identified parameter, with $\sigma_\theta$ the posterior standard error when priors are given, else the one from the data:

$$
q \exp\left(\pm t\, u\, \sigma_\theta\right) \ \ (v_0, k, c), \qquad e \pm t\, u\, \sigma_e
$$

Code: `packages/core/src/exterior/range-strings.ts`, `intervalAround`, `unitSigma`, `stringsFitResult` (`quantile`, `intervalScale`).

By default $u = 1$ and $t = z = \sqrt{\chi^2_{1}(\text{level})}$, the normal quantile (1.960 at the default level 0.95). With `scaleByResidual` and $\nu \gt 0$ degrees of freedom the spreads are taken from the residuals:

$$
u = \max\left(\sqrt{\frac{\chi^2}{\nu}},\ 10^{-6}\right), \qquad t = t_\nu\left(\tfrac{1 + \text{level}}{2}\right)
$$

Code: `packages/core/src/exterior/range-strings.ts`, `stringsFitResult` (`intervalScale`, `quantile`), `minIntervalScale`.

$t_\nu$ is the quantile of Student's t distribution with $\nu$ degrees of freedom. The plan reports the interval the fit would give around the nominal value (around 0 for $e$) with $u = 1$ and $t = z$.

### Residual check

$$
\chi^2 = \sum_{i=1}^{n} \left(\frac{\hat y_i - y_i}{\sigma_i}\right)^2, \qquad \nu = n - \lvert K \rvert, \qquad \text{consistent} \iff \chi^2 \le \chi^2_{\nu}(0.99)
$$

Code: `packages/core/src/exterior/range-strings.ts`, `stringsFitResult` (`chiSquare`, `dof`, `consistent`).

$K$ is the set of fitted parameters, $n$ the number of data rows. Prior rows are not counted. The level 0.99 is the option `residualConfidenceLevel`. The p-value is the upper tail of the chi-square distribution ([groups](groups.md)). Without degrees of freedom there is no check.

The intervals are flagged as not to be relied on (`intervalsTrusted` false) when:

- the check fails, or
- an identified parameter was fitted while a weak or failed parameter with information was held at its nominal value (`conditionalOn`). A held parameter shifts the fitted ones by an amount the covariance does not contain, and the residual check does not see that shift.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $v_0$, $v_{0,\text{nom}}$ | Muzzle velocity, nominal muzzle velocity | m/s | m/s |
| $k$ | Drag factor on $C_D$ | 1 | 1 |
| $c$, $c_\text{nom}$ | Click value (angle of one click), nominal click value | deg | rad |
| $e$ | Zero offset | deg | rad |
| $\theta_v$, $\theta_k$, $\theta_c$ | Log parameters | 1 | 1 |
| $s_i$ | Slant range of row $i$, for the chronograph the distance from the muzzle | mm | m |
| $y_i$, $\hat y_i$ | Measured and predicted mean impact above the line of sight at the zero setting | mm | m |
| $n_i$, $\hat n_i$ | Measured and predicted clicks from the zero setting to centre the group, positive up | 1 | 1 |
| $\bar v$, $\hat v_i$ | Measured mean and predicted chronograph speed | m/s | m/s |
| $h$, $\alpha$, $v$ | Height above the line of sight, elevation hold, ground speed of the trajectory | mm, deg, m/s | m, rad, m/s |
| $m_i$ | Shots behind the mean of row $i$ | 1 | 1 |
| $\sigma_{1,i}$ | Standard deviation of one shot | unit of the row | unit of the row |
| $w_i$ | Step of the reading | unit of the row | unit of the row |
| $\sigma_i$ | Standard uncertainty of row $i$ | unit of the row | unit of the row |
| $\delta$ | Standard deviation of one shot's vertical angle (plan) | deg | rad |
| $J$ | Weighted Jacobian | no kind | 1 over the unit of the parameter |
| $\mathrm{VIF}_j$ | Variance inflation factor | 1 | 1 |
| $\sigma_\theta$, $\sigma_e$ | Standard error of a log parameter, of the zero offset | 1, deg | 1, rad |
| $s_j$ | Standard deviation of a prior | 1 (zero offset: deg) | 1 (zero offset: rad) |
| $C_\text{post}$ | Posterior covariance | no kind | 1 |
| $t$, $z$, $u$ | Quantile, normal quantile, interval scale | 1 | 1 |
| $\chi^2$, $\nu$ | Sum of squared standardized residuals, degrees of freedom | 1 | 1 |

## Assumptions

- Rows are independent with the stated standard uncertainties and about normal errors. Impact means at different distances share the aim point, and a common error of it is not modelled.
- One group of shots gives one row. An impact and a dial entry of the same group measure the same shots in two units and are rejected (`checkGroups`). The group of an entry is its name, or its distance when it has none.
- The drag is the nominal drag times one constant factor.
- The click value is constant over the dialled range. The dialled clicks are exact apart from the stated step.
- Everything not fitted is correct: air, wind, look angle, sight height, ballistic coefficient reference, and without `fitZeroOffset` the zero. Impacts are taken at the zero setting.
- The zero offset is one constant angle, added after the trajectory in the small-angle form.
- Priors are Gaussian in $\ln q$ and in $e$ and centred on the nominal values.

## Limits

- The standard errors are first order. Strings far from the nominal values of $v_0$ and $k$ make the plan's standard errors approximate. The limit 0.05 on $\sigma_\theta$ keeps an interval end within about 0.1 in $\theta$ of the estimate.
- Without `scaleByResidual` the intervals assume known spreads. Spreads estimated from few shots make them too narrow. They do not include errors of the model, the range, the atmosphere or the nominal values of what is not fitted.
- Without `fitZeroOffset`, an error of the zero aliases into muzzle velocity, drag factor and click value. Only the residual check can show it, and not at 0 degrees of freedom.
- With priors the data chi-square is taken at the posterior mode while the degrees of freedom ignore the priors, so the check fails more often than without priors.
- The limits 10, 0.05, $10^{-4}$ rad, the component 0.3, the noise floor $10^{-6}$, the residual level 0.99 and the smallest interval scale $10^{-6}$ are chosen values.
- Mach-dependent drag factors, several sessions with different air, impacts measured with a correction dialled, and wind or range estimation are not part of this fit.

## Sources

- [Levenberg 1944](../bibliography.md#levenberg-1944) and [Marquardt 1963](../bibliography.md#marquardt-1963): the iteration, see [least squares on log parameters](least-squares.md).
- [Bard 1974](../bibliography.md#bard-1974) (chapter unverified): the covariance of a nonlinear least-squares estimate as the inverse of the Jacobian information.
- [Marquardt 1970](../bibliography.md#marquardt-1970): variance inflation factors as the diagonal of the inverse correlation matrix. The limit 10 is not taken from this paper.
- [Belsley 1980](../bibliography.md#belsley-1980), chapter 3 (unverified): condition indices, with an index above 30 as the level of collinearity that degrades estimates. The variance inflation limit 10 flags more designs than an index of 30.
- [Bates 1988](../bibliography.md#bates-1988) (chapter unverified): the curvature that limits linear approximation intervals.
- [Widrow 2008](../bibliography.md#widrow-2008): the variance $w^2/12$ of a uniform rounding error.
- [Abramowitz 1964](../bibliography.md#abramowitz-1964), 26.7.3 and 26.7.4 (page unverified): Student's t distribution for whole degrees of freedom.
- [Bishop 2006](../bibliography.md#bishop-2006), section 4.4 (section number unverified): the Laplace approximation of a posterior with a Gaussian prior.
