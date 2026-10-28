---
title: Least squares on log parameters
description: The Levenberg-Marquardt loop, the conditioning check, the covariance and the identifiability measures shared by truing and the powder fit.
---

# Least squares on log parameters

`logLeastSquares` fits parameters to observations by weighted least squares:

- Levenberg-Marquardt steps with central-difference Jacobians
- a conditioning check that refuses parameters the observations do not resolve or cannot separate
- the covariance and the correlations of the parameters at the solution

The callers write each positive parameter as the logarithm of its ratio to the start value, so every fitted value stays positive and a step is a relative change. `identifiability` computes the covariance and the collinearity measures of a weighted Jacobian without fitting. [Truing](exterior-truing.md), [truing from range strings](exterior-truing-strings.md) and the [powder fit](interior-powder-fit.md) supply the predictions and call these functions.

## Equations

### Parameters

A parameter $q_j$ is fitted as $\theta_j$, with $\theta = 0$ at the start:

$$
q_j = q_{j,0}\, e^{\theta_j}
$$

Code: `packages/core/src/exterior/truing.ts`, `leastSquares` (`q`). `packages/core/src/exterior/range-strings.ts`, `applied`.

The [powder fit](interior-powder-fit.md) maps the start pressure relative to a floor below which it has no effect. [Truing from range strings](exterior-truing-strings.md) fits the zero offset as $\theta$ itself, in rad.

### Residuals and cost

$$
r_i(\theta) = \frac{\hat y_i(\theta) - y_i}{\sigma_i}, \qquad \chi^2(\theta) = \sum_{i=1}^{n} r_i^2
$$

Code: `packages/core/src/least-squares.ts`, `logLeastSquares` (`residuals`, `chi2`).

$\sigma_i = 1$ for unweighted observations.

### Huber loss

A caller can ask for a Huber loss on its first $n_h$ observations. A weighted residual beyond the threshold $k$ then counts linearly, so one far outlier pulls the fit less than a square would. The other observations, such as priors, stay quadratic:

$$
L_k(r) = \begin{cases} r^2 & \lvert r \rvert \le k \\ 2k\lvert r \rvert - k^2 & \lvert r \rvert \gt k \end{cases}, \qquad \text{cost} = \sum_{i \le n_h} L_k(r_i) + \sum_{i \gt n_h} r_i^2
$$

Code: `packages/core/src/huber.ts`, `huberLoss`, `huberCost`.

Both pieces join at $\lvert r \rvert = k$ with the same value and slope, and $L_k = r^2$ without outliers. The step below minimizes this cost: the candidate must lower it to be accepted. `LogFitResult.chiSquare` stays the sum of $r_i^2$ and `loss` is the cost. The loss needs weighted observations, since $k$ is in units of $\sigma_i$.

### Jacobian

Central differences with step $h = 10^{-3}$ in each $\theta_j$:

$$
J_{ij} = \frac{\hat y_i(\theta + h\,e_j) - \hat y_i(\theta - h\,e_j)}{2 h\, \sigma_i}
$$

Code: `packages/core/src/least-squares.ts`, `logLeastSquares` (`jacobian`, `step`).

The observations can be stacked from several runs (sessions). A parameter that does not move a run has zero entries in that run's rows, and its predictions are not evaluated there (`moves`). A candidate whose prediction fails while forming the Jacobian ends the fit with reason `unreachable`.

### Levenberg-Marquardt step

$$
\left(J^\top W J + \lambda\, \operatorname{diag}\!\left(J^\top W J\right)\right)\delta = -J^\top W r, \qquad W_{ii} = \begin{cases} k / \lvert r_i \rvert & i \le n_h,\ \lvert r_i \rvert \gt k \\ 1 & \text{otherwise} \end{cases}
$$

Code: `packages/core/src/least-squares.ts`, `logLeastSquares` (`damped`, `delta`, `lambda0`), `packages/core/src/huber.ts`, `huberRoots`.

Without a Huber loss $W$ is the identity. With it, $W$ is the weight of iteratively reweighted least squares at the current residuals: it is the slope of the loss over $2r$, so the step uses the gradient of the cost.

- The damping starts at $\lambda = 10^{-3}$.
- A candidate $\theta + \delta$ that lowers the cost ($\chi^2$ without a Huber loss) is accepted, and $\lambda$ is divided by 10.
- A candidate with a higher $\chi^2$, or one the caller rejects (no predicted values), multiplies $\lambda$ by 10.

The loop stops on

$$
\frac{\chi^2_\text{old} - \chi^2_\text{new}}{\chi^2_\text{old}} \lt \epsilon \ \text{or}\ \chi^2_\text{new} = 0 \ \text{(accepted step)}, \qquad \max_j \lvert \delta_j \rvert \lt 10^{-8} \ \text{(step not applied)}
$$

Code: `packages/core/src/least-squares.ts`, `logLeastSquares` (`stalled`, `small`).

The result names the rule that ended the loop in `stop`: `stalled` for the first condition, `smallStep` for the second. Under a Huber loss the weights follow the residuals, so a row can cross the threshold on the last step. `weightsSettled` is true when the set of rows beyond the threshold was the same before and after the last accepted step, and always true without a Huber loss or without an accepted step. When it is false, the stop rule fired while the weights were still moving, and the fitted values may differ from those of a longer run.

Code: `packages/core/src/least-squares.ts`, `logLeastSquares` (`stop`, `weightsSettled`).

The tolerance $\epsilon$ is $10^{-12}$ unless the caller sets `tolerance`. The [curve fit](interior-curve-fit.md) sets $10^{-9}$: correlated form parameters leave a flat valley in which steps still gain a small share of $\chi^2$ long after the parameters have moved by far less than their uncertainty.

After `maxIterations` accepted or rejected steps it runs the conditioning check at the current iterate, then fails with reason `not-converged`.

### Linear systems

The damped systems and the covariance are inverted through the eigen decomposition $A = \sum_k \mu_k u_k u_k^\top$ of the symmetric matrix:

$$
A^{-1} = \sum_k \frac{u_k u_k^\top}{\mu_k}
$$

Code: `packages/core/src/least-squares.ts`, `inverse`.

The eigenvalues come from the cyclic Jacobi method. Each rotation zeroes the entry $a_{pq}$ with

$$
\vartheta = \frac{a_{qq} - a_{pp}}{2\, a_{pq}}, \qquad t = \frac{\operatorname{sgn}\vartheta}{\lvert\vartheta\rvert + \sqrt{\vartheta^2 + 1}}, \qquad c = \frac{1}{\sqrt{t^2 + 1}}, \qquad s = t\,c
$$

Code: `packages/core/src/least-squares.ts`, `eigen`.

Here the sign factor is $-1$ for $\vartheta < 0$ and $+1$ for $\vartheta \ge 0$, including $\vartheta = 0$.

Sweeps end when the sum of squares of the entries above the diagonal is at most $10^{-32}$ times that of the diagonal, after at most 100 sweeps.

### Conditioning check

Column norms, column-scaled Jacobian and condition number:

$$
D_{jj} = \lVert J_{:,j} \rVert, \qquad J_s = J D^{-1}, \qquad \kappa = \sqrt{\frac{\mu_\text{max}\!\left(J_s^\top J_s\right)}{\mu_\text{min}\!\left(J_s^\top J_s\right)}}
$$

Code: `packages/core/src/least-squares.ts`, `logLeastSquares`, `checkConditioning` (`norms`, `condition`).

A parameter is unresolved when $D_{jj} = 0$, when $D_{jj} \lt 10^{-9} \max_k D_{kk}$, or when every entry of its column lies below the noise floor of its row:

$$
\lvert J_{ij} \rvert \lt \text{floor}_i \quad \text{for all } i
$$

Code: `packages/core/src/least-squares.ts`, `logLeastSquares`, `checkConditioning` (`unresolved`).

The caller sets the floor of each row. The check runs at the start, at the solution and after `maxIterations`. The fit fails with:

- `unresolved`, naming the parameters
- `ill-conditioned` when $\kappa$ exceeds `maxCondition`, carrying $\kappa$ and the eigenvector of $\mu_\text{min}$ (the parameter combination the data cannot separate)

### Covariance at the solution

$$
C_\theta = s^2 \left(J^\top W J\right)^{-1}, \qquad s^2 = \begin{cases} 1 & \text{every observation has its own } \sigma_i \\ \chi^2 / (n - p) & \text{otherwise} \end{cases}
$$

Code: `packages/core/src/least-squares.ts`, `logLeastSquares` (`scale`, `covariance`).

$$
\sigma_{\theta_j} = \sqrt{C_{\theta,jj}}, \qquad \rho_{jk} = \frac{C_{\theta,jk}}{\sqrt{C_{\theta,jj}\, C_{\theta,kk}}}
$$

Code: `packages/core/src/least-squares.ts`, `logLeastSquares` (`standardUncertainty`, `correlation`).

With a Huber loss, $W$ is taken at the solution, so a residual beyond the threshold adds less information. This is the Laplace approximation of the posterior for a likelihood proportional to $e^{-L_k/2}$, with $W$ standing for the curvature of $L_k$. The Jacobian is formed again at the solution unless the last iteration already holds it. Without weights and with $n \le p$ there is no covariance. Because $\theta_j$ is a logarithm, $\sigma_{\theta_j}$ is the relative standard error of $q_j$, and the callers report $q_j\,\sigma_{\theta_j}$ (for the start pressure of the powder fit, its excess over the floor times $\sigma_{\theta_j}$).

### Identifiability of a weighted Jacobian

Information, its scale and its correlation form:

$$
F = J^\top J, \qquad D = \operatorname{diag}\!\left(\sqrt{F_{jj}}\right), \qquad R = D^{-1} F D^{-1}
$$

Code: `packages/core/src/least-squares.ts`, `identifiability`.

With the eigenvalues $\mu_k$ and eigenvectors $u_k$ of $R$, the inverse is formed with the eigenvalues floored at $10^{-12}\mu_\text{max}$:

$$
\left(R^{-1}\right)_{ab} = \sum_k \frac{u_{ak}\, u_{bk}}{\max\!\left(\mu_k,\ 10^{-12} \mu_\text{max}\right)}
$$

Code: `packages/core/src/least-squares.ts`, `identifiability` (`floor`, `lambda`, `inv`).

Standard error with the other parameters free and with them known, variance inflation, and condition number:

$$
\sigma_j = \frac{\sqrt{\left(R^{-1}\right)_{jj}}}{D_{jj}}, \qquad \sigma_j^\text{cond} = \frac{1}{D_{jj}}, \qquad \mathrm{VIF}_j = \left(R^{-1}\right)_{jj} = \left(\frac{\sigma_j}{\sigma_j^\text{cond}}\right)^2, \qquad \kappa = \sqrt{\frac{\mu_\text{max}}{\mu_\text{min}}}
$$

Code: `packages/core/src/least-squares.ts`, `identifiability` (`standardUncertainty`, `conditionalSigma`, `varianceInflation`, `conditionNumber`).

$$
\rho_{ab} = \frac{\left(R^{-1}\right)_{ab}}{\sqrt{\left(R^{-1}\right)_{aa} \left(R^{-1}\right)_{bb}}}
$$

Code: `packages/core/src/least-squares.ts`, `identifiability` (`correlation`).

The design is singular when $\mu_\text{min} \le 10^{-12}\mu_\text{max}$. Then $\kappa$ is infinite, and a parameter with $u_{j,\text{min}}^2 \gt 10^{-12}\mu_\text{max}$ in the eigenvector of $\mu_\text{min}$ gets an infinite $\sigma_j$ and $\mathrm{VIF}_j$ (`unbounded`). Parameters outside that direction keep finite values, and the correlations stay finite through the floor. `direction` returns the eigenvector of $\mu_\text{min}$.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $q_j$ | Fitted parameter | unit of the parameter | unit of the parameter |
| $q_{j,0}$ | Start value of the parameter | unit of the parameter | unit of the parameter |
| $\theta_j$ | Log parameter, $\ln(q_j/q_{j,0})$ | 1 | 1 |
| $y_i$, $\hat y_i$ | Observed and predicted value | unit of the observation | unit of the observation |
| $\sigma_i$ | Standard deviation of observation $i$ | unit of the observation | unit of the observation |
| $r_i$ | Weighted residual | 1 | 1 |
| $\chi^2$ | Sum of squared weighted residuals | 1 | 1 |
| $k$, $n_h$ | Huber threshold in sigmas, number of observations under the Huber loss | 1 | 1 |
| $L_k$ | Huber loss of a weighted residual | 1 | 1 |
| $W$ | Diagonal weights of the Huber loss, 1 without it | 1 | 1 |
| $n$, $p$ | Observations, parameters | 1 | 1 |
| $J$ | Weighted Jacobian, per unit $\theta$ | no kind | 1 over the unit of $\theta$ |
| $h$ | Difference step in $\theta$ | 1 | 1 |
| $\lambda$ | Damping of the step | 1 | 1 |
| $\epsilon$ | Relative decrease of the cost below which an accepted step ends the loop | 1 | 1 |
| $\delta$ | Step in $\theta$ | 1 | 1 |
| $\mu_k$, $u_k$ | Eigenvalue and eigenvector | 1 | 1 |
| $\kappa$ | Condition number of the column-scaled information | 1 | 1 |
| $C_\theta$ | Covariance of $\theta$ | no kind | 1 |
| $\sigma_{\theta_j}$ | Standard error of $\theta_j$, the relative standard error of $q_j$ | 1 | 1 |
| $\rho_{jk}$ | Correlation of two parameters | 1 | 1 |
| $F$, $R$ | Information and its unit-diagonal form | no kind | 1 |
| $\mathrm{VIF}_j$ | Variance inflation factor | 1 | 1 |

## Assumptions

- Observations are independent. With weights, $\sigma_i$ is the true standard deviation of observation $i$. Without weights, all observations share one variance, estimated from $\chi^2/(n - p)$.
- The model is close to linear in $\theta$ over the uncertainty of the estimate, so the inverse information describes the covariance.
- Under a Huber loss the observations beyond the threshold are outliers of the same model, not a second population. The covariance with $W$ is approximate.
- The prediction of a candidate is deterministic, so the values of the last accepted step are those at the solution and no prediction runs again.

## Limits

- The covariance is first order. It holds the sampling error of the observations only, not errors of the model or of inputs held fixed.
- The default `maxCondition` of the callers ($10^3$) and the noise floor are chosen values. A parameter refused as `unresolved` or `ill-conditioned` returns no value.
- Without weights and $n = p$ the fit solves the equations exactly and reports no uncertainty. An exact fit without weights and $n \gt p$ has $\chi^2 = 0$, so every $\sigma_{\theta_j}$ is 0 and the correlations are undefined (NaN). A covariance diagonal driven below 0 by rounding gives a NaN standard error.
- A parameter that reaches a region where it has no effect is reported as unresolved after `maxIterations`, not as slow convergence.
- Research log: [identifiability against the two-parameter closed form](../research/least-squares-identifiability-closed-form.md).

## Sources

- [Levenberg 1944](../bibliography.md#levenberg-1944) and [Marquardt 1963](../bibliography.md#marquardt-1963): the damped Gauss-Newton step, with the diagonal of $J^\top J$ as the damping scale from Marquardt 1963.
- [Golub 2013](../bibliography.md#golub-2013), chapter 8 (section number unverified): the cyclic Jacobi method for the symmetric eigenvalue problem.
- [Bard 1974](../bibliography.md#bard-1974) (chapter unverified): the covariance of a nonlinear least-squares estimate as the inverse of the Jacobian information.
- [Marquardt 1970](../bibliography.md#marquardt-1970): variance inflation factors as the diagonal of the inverse correlation matrix.
- [Belsley 1980](../bibliography.md#belsley-1980), chapter 3 (unverified): the condition number of the column-scaled design as a collinearity measure.
- [Huber 1964](../bibliography.md#huber-1964): the loss that is quadratic near zero and linear beyond a threshold.
- [Bates 1988](../bibliography.md#bates-1988) (chapter unverified): the limits of the linear approximation of a nonlinear least-squares estimate.
