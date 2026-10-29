---
title: Powder fit from a chronograph ladder
description: Weighted least-squares fit of the burn coefficient and, on request, the start pressure, a chamber volume correction factor, the specific energy and a factor on the temperature sensitivities of the M3 interior model to measured muzzle velocities and peak pressures of a charge ladder or of sessions at several barrel lengths and powder temperatures, with optional Gaussian priors and a Huber loss, the prediction band of the fitted load at a charge that was not fired, and the peak-pressure range that the fixed inputs add, with a prior from similar powders and a confidence label of the range.
---

# Powder fit from a chronograph ladder

The burn form and the pressure exponent are fitted to a measured pressure-time trace on the [curve fit page](interior-curve-fit.md).

`fitPowder` fits the burn coefficient of one [M3](interior-m3.md) load and, on request, its shot-start pressure, a factor on its chamber volume, its specific energy and a factor on its temperature sensitivities to a ladder: charges with their mean muzzle velocities and, optionally, measured peak pressures. Points of a ladder may be fired from another barrel length or at another powder temperature, which is what resolves the energy and the temperature factor ([below](#several-barrel-lengths-and-temperatures)); `fitPowderSessions` takes such ladders as sessions and holds the parameters they do not resolve. The fit works on log parameters with the Levenberg-Marquardt loop of the [least-squares page](least-squares.md). It reports the fitted values, their uncertainty, correlation and covariance, the residuals, $\chi^2$ split into the ladder's and the priors' share, the degrees of freedom and the condition number. Optional Gaussian priors on the log parameters turn the fit into a maximum a posteriori estimate, and an optional Huber loss limits the pull of one outlying string. The fitted values describe the ladder's rifle, powder lot, components and model version over the ladder's charge range, barrel lengths and temperatures. They are not powder data and not load data. `fitPowderPooled` fits the sessions of many rifles, powders and lots at once ([below](#pooled-fit-over-rifles-powders-and-lots)), with prediction intervals that hold a model error. `predictPowder` propagates the covariance to the muzzle velocity and the peak pressure at any charge, with an interval, and names each axis on which a prediction lies outside the data the fit was made from.

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

Each ladder point $k$ gives a velocity row and, with a measured pressure, a pressure row after it. A peak pressure carries its basis in `pressureBasis`, one of `transducer`, `piezo`, `crusher` and `energy` (the `pressureMethod` of the cartridge records), and the basis is required with every peak pressure. The pressures of one fit share one basis: a ladder, or the sessions of `fitPowderSessions`, that mixes bases is refused with `MixedPressureBasisError`, whose `rows` and the `pressureRows` of the result give the number of pressure rows per basis. Values are never converted between bases. The prediction of a velocity row is `muzzleVelocity`, that of a pressure row is `peakBreechPressure` of the run at charge $m_k$:

$$
\hat y_i(\theta) =
\begin{cases}
v_0\bigl(m_k, q(\theta)\bigr) & \text{velocity row} \\
p_\text{max}\bigl(m_k, q(\theta)\bigr) & \text{pressure row}
\end{cases}
\qquad \sigma_i = 1 \text{ without stated uncertainties}
$$

Code: `packages/core/src/interior/fit.ts`, `ladderRows`, `fitPowder` (`rows`, `evaluate`).

A point carries its own `barrelLength` and `propellantTemperature` where they differ from the load's, and its prediction is the run at that length and temperature. Velocity uncertainties are given on all points or on none. Pressures need their uncertainty and need velocity uncertainties. Repeated charges add rows but no runs.

### Strings and their weights

`stringLadder` turns chronograph strings into ladder points. A string $j$ of $n_j$ shots $v_{ji}$ gives the point at its charge with its mean $\bar v_j$ as the velocity. Its uncertainty is the pooled standard deviation of all shots about their string means over the root of the string's shot count, over the strings of at least 2 shots:

$$
s_p = \sqrt{\frac{\sum_j \sum_i (v_{ji} - \bar v_j)^2}{\sum_j (n_j - 1)}}, \qquad \sigma_j = \frac{s_p}{\sqrt{n_j}}
$$

Code: `packages/core/src/interior/fit-strings.ts`, `stringLadder`, `pooledVelocitySd`.

The sample standard deviation of one string of five shots is too uncertain to weight its row by: on synthetic 5-charge ladders the 2 sigma interval of the burn coefficient held the truth in about 80 % of the fits with each string's own standard deviation, and in 92 to 93 % with the pooled one. Without a string of 2 shots, or with a pooled value of 0, the points carry no uncertainty and the fit is unweighted. The other values of a point (pressure, barrel length, temperature) pass through.

### Parameters

The burn coefficient is the vivacity $B_a$ of a vivacity law or the coefficient $\beta$ of a geometric law (see [burn laws and form functions](interior-burn-forms.md)). All parameters are fitted as logarithms, the start pressure relative to a floor below which it has no effect:

$$
B = B_0\,e^{\theta_1}, \qquad
p_\text{st} = p_\text{floor} + (p_{\text{st},0} - p_\text{floor})\,e^{\theta_2}, \qquad
f_V = e^{\theta_3}, \qquad
Q = Q_0\,e^{\theta_4}, \qquad
f_T = e^{\theta_5}
$$

Code: `packages/core/src/interior/fit.ts`, `powderParameterMap` (`q`, `offset`).

The specific energy $Q$ (parameter `energy`, initial value the load's) replaces the energy of the propellant. The temperature factor $f_T$ (parameter `temperatureFactor`, initial value 1) multiplies both temperature sensitivities of the load, $\sigma_c$ and $\sigma_h$, of the [temperature factor on the burn rate](interior-m3.md#temperature-of-the-propellant), so their ratio stays the load's. It needs a load that carries a sensitivity other than 0. The fitted load carries the scaled sensitivities.

The volume factor $f_V$ (parameter `volumeFactor`, initial value 1) multiplies the chamber volume of the load, $V_c = f_V\,V_{c,0}$, where $V_{c,0}$ is the volume the load carries. That volume is a nominal one unless it is a measured [case capacity](case-capacity.md), so the factor is the way to let a ladder correct it. It leaves the bore area, the bore diameter and every other input as given, and the fitted load carries the corrected volume. With the factor not fitted the load's chamber is not touched and the fit is the one without the option.

$$
p_\text{floor} = \max\bigl(p_i,\ p_f + p_e(0)\bigr)
$$

Code: `packages/core/src/interior/fit.ts`, `startPressureFloor`.

$p_e(0)$ is the engraving pressure of a profile point at travel 0, else 0. The gas starts at $p_i$, and the projectile starts once the mean pressure reaches $p_\text{st}$ and overcomes the resistance at travel 0 ([shot start](interior-m3.md)). Below $p_\text{floor}$ the start pressure therefore changes nothing. A fitted start pressure must start above $p_\text{floor}$, and the map keeps every step above it. The default fits $B$ alone.

The burn law has no offset (a rate proportional to $\bar p - P_1$, used for low pressures): in a fit to velocities alone, $P_1$ would act as a start pressure for the burn and trade off with $p_\text{st}$, so the fitted start pressure plays its role ([burn law checks](../research/interior-burn-law-checks.md)).

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

### Prior and robust loss

A prior on a fitted parameter is a Gaussian on its log parameter with centre $\mu_j$ and standard deviation $s_j$. The centre is given as a value $q_j^\ast$ of the parameter, for example from the powder's record or its family, and mapped like the fit's own start value. It enters the fit as one pseudo-row after the ladder rows, with observed value $\mu_j$, predicted value $\theta_j$ and standard deviation $s_j$. The fit then minimizes the negative log posterior up to a constant, the maximum a posteriori estimate ([Gelman 2013](../bibliography.md#gelman-2013), chapter unverified):

$$
\mu_j = \ln\frac{q_j^\ast - o_j}{q_{j,0} - o_j}, \qquad
\chi^2 = \underbrace{\sum_i r_i^2}_{\chi^2_\text{data}} + \underbrace{\sum_{j \in P} \frac{(\theta_j - \mu_j)^2}{s_j^2}}_{\chi^2_\text{prior}}
$$

Code: `packages/core/src/interior/fit.ts`, `fitPowder` (`priorRows`, `priorChiSquare`, `dataChiSquare`).

The burn coefficient and the volume factor need $q_j^\ast \gt 0$ and the start pressure $q_j^\ast \gt p_\text{floor}$, with $s_j \gt 0$ in both. A volume factor prior is centred on 1, with a standard deviation that states how far the load's volume may be from the real one, for example the spread of the capacity of a fired case; its width is the caller's choice and no default is built in. A prior on a parameter that is not fitted is refused. The checks for unresolved and ill-conditioned parameters see the prior rows too. A ladder whose velocities barely separate the burn coefficient and the start pressure therefore fits with priors where it fails as `ill-conditioned` without them, and a prior keeps its parameter from counting as `unresolved`. The reported uncertainty is then the posterior one, and its size against $s_j$ shows how much the ladder added. The degrees of freedom still count the ladder rows only. A prior with a very large $s_j$ leaves the fit unchanged.

The Huber loss of the [least-squares page](least-squares.md) with threshold $k$ (option `huberThreshold`, in sigmas of the rows) applies to the ladder rows only, not to the prior rows. $\chi^2$ in the result stays the plain sum, so a downweighted string still shows its full residual, and `loss` holds the minimized cost:

$$
\text{loss} = \sum_{i \in \text{ladder}} L_k(r_i) + \chi^2_\text{prior}
$$

Code: `packages/core/src/interior/fit.ts`, `fitPowder` (`huber`, `loss`), `packages/core/src/huber.ts`, `huberLoss`.

The result carries `stop` and `weightsSettled` of the [solver](least-squares.md#levenberg-marquardt-step): which rule ended the loop and whether the set of ladder rows beyond the threshold was unchanged over the last accepted step. Without `huberThreshold` the second is true.

Code: `packages/core/src/interior/fit.ts`, `fitPowder` (`stop`, `weightsSettled`).

Priors and the Huber loss need uncertainties on every velocity, since $s_j$ and $k$ are in absolute and in sigma units. Without `huberThreshold` the loss is quadratic ([Huber 1964](../bibliography.md#huber-1964)).

### Uncertainty

With $C_\theta$ the covariance of the log parameters at the solution (scaled by $\chi^2/\nu$ when no uncertainties are given; with priors it is the posterior covariance, from the ladder rows and the prior rows, and with a Huber loss the weights $W$ of the [least-squares page](least-squares.md) are taken at the solution), the standard uncertainty of a fitted value is

$$
\sigma_{q_j} = (q_j - o_j)\sqrt{C_{\theta,jj}}, \qquad o_j = \begin{cases} p_\text{floor} & \text{start pressure} \\ 0 & \text{burn coefficient, volume factor} \end{cases}
$$

Code: `packages/core/src/interior/fit.ts`, `fitPowder` (`standardUncertainty`), `powderParameterMap` (`offset`).

Without stated uncertainties and with as many rows as parameters there is no uncertainty and no correlation. The values are linearized, assume independent observations with the stated uncertainties and contain no model error.

### Prediction at a charge

`predictPowder` runs `interior` at the fitted parameters for a charge $m$ and takes the gradient of the muzzle velocity and of the peak breech pressure in the log parameters, by central differences of $\pm 10^{-3}$. The first-order propagation of the parameter covariance ([JCGM 100:2008](../bibliography.md#jcgm-100-2008), the law of propagation of uncertainty) gives the standard uncertainty, and the interval is symmetric about the model value:

$$
u(\hat y) = \sqrt{g^\top C_\theta\, g}, \qquad
g_j = \frac{\partial \hat y(m, \theta)}{\partial \theta_j}, \qquad
\hat y \pm k\, u(\hat y)
$$

Code: `packages/core/src/interior/fit.ts`, `predictPowder` (`gradient`, `band`).

The coverage factor $k$ is the two-sided quantile of the normal distribution at the coverage $1 - \alpha$ (default 90 %, $k = 1.645$) when the ladder carried velocity uncertainties. Without them $C_\theta$ is scaled by the residual variance, and $k$ is the Student quantile with $\nu$ degrees of freedom:

$$
k = \begin{cases}
z_{1 - \alpha/2} & \text{velocity uncertainties given} \\
t_{1 - \alpha/2,\,\nu} & \text{otherwise}
\end{cases}
$$

Code: `packages/core/src/interior/fit.ts`, `predictPowder` (`quantile`), `packages/core/src/groups/chi-square.ts`, `chiSquareQuantile`, `packages/core/src/groups/student-t.ts`, `studentTwoSidedQuantile`.

#### Domain

A fit keeps the data it was made from as its `domain`: one closed range per axis, each widened by a relative margin $\delta$ (default `powderDomainMargin`, 0, set per fit with `domainMargin`: on synthetic ladders with model error the interval loses coverage from the first per cent outside the range, so no margin keeps it and the flag sits at the range edge, [research log](../research/interior-powder-fit-extrapolation-margin.md)). The upper end of bore diameter and barrel length is widened by $\delta_+ = \max(\delta, 0.025)$, a tolerance for values rounded in the input; on the other axes $\delta_+ = \delta$:

$$
[\,x_\min (1 - \delta),\; x_\max (1 + \delta_+)\,]
$$

Code: `packages/core/src/interior/fit.ts`, `fitDomain`, `outsideDomain`.

| Axis | Spans | Checked in a prediction against |
|---|---|---|
| `charge` | the ladder charges | the charge |
| `velocity` | the measured muzzle velocities | the predicted muzzle velocity |
| `pressure` | the measured peak pressures; absent without any | the predicted peak breech pressure |
| `boreDiameter` | the load's bore diameter, a single value | `boreDiameter` of the options, default the load's |
| `barrelLength` | the barrel lengths of the ladder points, default the load's | `barrelLength` of the options, default the load's |

`predictPowder` sets `extrapolation` to an object that names each axis outside its range with the side, `below` or `above`, and leaves it out when every axis is inside. A value exactly at a widened end is inside. The axes are independent: a charge above the ladder usually brings a predicted velocity and pressure above the measured ones, and then all three are named. A `boreDiameter` option changes the bore diameter of the run and scales the bore area with its square. The propellant temperature is not an axis of the domain. Nothing else changes outside the domain. How the band behaves outside the range follows from the covariance: with both parameters fitted it widens quickly beyond the ladder, because the data no longer separate the two effects. With the burn coefficient alone the band follows the sensitivity of the model to that one parameter and can narrow where the sensitivity falls, the velocity band above the ladder for example. The band holds parameter uncertainty only. It contains no model error: a wrong form function, energy or heat loss shifts the true value away from the band, and the farther from the ladder, the more so. A charge at which the model has no valid run, or the perturbed parameters have none, throws a `PowderFitError` with reason `invalid`. A fit without a covariance (as many rows as parameters and no uncertainties) cannot predict.

### Pressure range from the fixed inputs

The prediction band holds the covariance of the fitted parameters only. A fitted burn coefficient absorbs the errors of every fixed input (see [Identifiability](#identifiability)), so a velocity-only ladder pins the coefficient while the peak pressure stays loosely known. `powderPressureRange` adds that part. For each input $j$ that the fit holds fixed, with standard uncertainty $u_j$, it moves the input of the fitted load to $x_j + u_j$ and to $x_j - u_j$, fits the same ladder again with the same parameters, priors and loss (starting from the fitted values), and runs the refitted load at the point. The effect of the input on the peak pressure $\hat p$ is half the difference of the two refits:

$$
c_j = \frac{\hat p(x_j + u_j) - \hat p(x_j - u_j)}{2}
$$

Code: `packages/core/src/interior/fit-confidence.ts`, `powderPressureRange` (`side`, `effects`).

Because the refit sees the same ladder, an input that the ladder constrains moves the peak pressure little. Measured pressure rows therefore narrow the range through the fit itself: with a pressure row, the refit has to keep the row, and the burn coefficient cannot absorb the shift. A shift common to every point that the burn coefficient absorbs exactly, such as one temperature offset on a ladder at one temperature, has an effect of about 0.

The effects combine with the fit's own standard uncertainty $u_\text{fit}$ (the pressure standard uncertainty of `predictPowder` at the point) by the law of propagation of uncertainty ([JCGM 100:2008](../bibliography.md#jcgm-100-2008), independent inputs), and the range is the coverage factor $k$ of the prediction times the combined uncertainty:

$$
u_c = \sqrt{u_\text{fit}^2 + \sum_j c_j^2}, \qquad
\hat p \pm k\,u_c, \qquad
h = \frac{k\,u_c}{\hat p}, \qquad
u_\text{corr} = u_\text{fit} + \sum_j |c_j|
$$

Code: `packages/core/src/interior/fit-confidence.ts`, `powderPressureRange` (`standardUncertainty`, `correlatedLimit`, `relativeHalfWidth`).

$h$ is the relative half-width of the range at a point, and the label uses its largest value over the points. $u_\text{corr}$ is the limit for inputs that are fully correlated in the direction that adds their effects, and it is reported next to $u_c$: the independence of the inputs is an assumption, and real errors of capacity, energy and burn rate are partly correlated. Nothing in the range models such correlation. The coverage factor is not corrected for the effective degrees of freedom of the combination.

The inputs and their default standard uncertainties, used where the caller states none, are in one table (`powderInputDefaults`). They are assumptions for a start, to be tuned against real sessions, not measurements:

| Input | Measured or entered | Estimated or assumed |
| --- | --- | --- |
| Case capacity (chamber volume) | 0.5 % | 3 % |
| Propellant energy | | 3 % |
| Start pressure | | 25 % |
| Bore friction | | 30 % |
| Propellant temperature | 3 K | 10 K |

The caller states per input whether it is measured or estimated and may give its own standard uncertainty (a fraction of the value, or K for the temperature; 0 leaves the input out). Ignition pressure, the ratio of specific heats, the covolume and the bullet mass are shifted only when the caller states an uncertainty. The burn form, the pressure exponent, the heat loss, the pressure gradient and the bore area are not shifted, so the range does not hold them. An input that is itself a fitted parameter (start pressure, case capacity with a volume factor, energy) is skipped, since the covariance holds it, and so is an input the load does not carry (a bore friction of 0, a load without temperature sensitivity). An input whose refit fails is skipped and named. The range needs a single fit with a covariance, not `fitPowderSessions`, and its points are the ladder's charges (with their barrel lengths and temperatures) or points the caller names.

### Prior from similar powders

A prior on the burn coefficient comes from `similarPowdersPrior`: the powders of the same burn law that lie nearest the target in the natural logarithm of the burn coefficient and of the specific energy (Euclidean distance in the two logarithms, the five nearest). The prior of [the section above](#prior-and-robust-loss) is centred on the geometric mean of their burn coefficients, with the sample standard deviation of their logarithms as $s$:

$$
\mu = \frac1n\sum_i \ln B_i, \qquad
s = \max\Bigl(0.05,\ \sqrt{\tfrac{1}{n-1}\sum_i (\ln B_i - \mu)^2}\Bigr), \qquad
q^\ast = e^{\mu}
$$

Code: `packages/core/src/interior/fit-confidence.ts`, `similarPowdersPrior`, `similarPowderRules`.

With fewer than 3 neighbours the prior is weak: it is centred on the target's own value with $s = 1$, and `weak` is set. The floor of 0.05 keeps neighbours with nearly equal coefficients from fixing the fit. The caller passes plain values of the powders and takes the prior from the result into `priors.burnRate`. Core reads no records. A prior from one known powder is a `PowderPrior` the caller builds from that powder's value and the spread it states. The fit states its basis: `refined` when a prior on the burn coefficient was given, else `from-scratch` (Bard 1974 and Gelman 2013 for the estimate with a prior, see Sources). A prior pulls a short ladder toward its centre by its weight $1/s^2$ against the ladder rows.

### Confidence label

`powderConfidence` sets a label from the relative half-width $h$ of the range and lists the reasons that apply. The label describes the width of the simulation's pressure range, not a load:

| Label | $h$ |
| --- | --- |
| `tight` | up to 10 % |
| `moderate` | up to 25 % |
| `loose` | above 25 % |

Code: `packages/core/src/interior/fit-confidence.ts`, `powderConfidence`, `powderConfidenceRules`.

The reasons do not change the label. They say what the range rests on or does not hold, in a fixed order:

| Reason | When |
| --- | --- |
| `no-pressure` | the ladder has no pressure row |
| `capacity-estimated` | the case capacity enters the range with its estimated uncertainty |
| `narrow-ladder` | the largest ladder charge is less than 1.1 times the smallest |
| `residual-trend` | with velocity uncertainties, at least 5 velocity rows, the residuals ordered by charge change sign at most once, and $\chi^2_\text{data}$ per row is above 1 |
| `start-pressure-correlated` | the start pressure is fitted and its correlation with the burn coefficient is above 0.9 in magnitude |
| `weak-prior` | the prior from `similarPowdersPrior` is weak |
| `outside-similar-powders` | the fitted burn coefficient lies more than 2 standard deviations of the prior from its centre |
| `extrapolated` | a point of the range lies outside the fit's domain on the charge or barrel length axis |
| `input-refit-failed` | the refit for an input failed, so the input is not in the range |

The result also carries the fit's basis. The thresholds are assumptions, to be tuned against real sessions. A `tight` label says that the inputs the range holds move the pressure little. It does not cover the model error of the inputs it leaves out, and a trend in the residuals, a prior far from the data or an extrapolation weaken it as the reasons say.

### Identifiability

On a velocity-only ladder a higher burn coefficient and a higher start pressure both raise the early pressure and the muzzle velocity. The ratio of the two effects changes little over the ladder. Their Jacobian columns are nearly parallel and the correlation of the two parameters is near $-1$. The condition check does not reject such a fit, but the start-pressure uncertainty is large. Measured peak pressures and wider ladders separate the two. A fitted burn coefficient absorbs the errors of every fixed input that moves the velocity: energy, isentropic exponent, covolume, chamber volume, form function, exponent, bore resistance and heat loss.

The volume factor and the burn coefficient act alike on the velocity: a larger volume lowers the pressure as a slower powder does. A ladder over a wide charge span still separates them, because the volume changes the pressure with the charge differently than the burn rate does, and measured peak pressures separate them better. On a ladder too narrow to separate them, for example two charges a few milligrams apart, their Jacobian columns are nearly parallel and the fit fails (`ill-conditioned`, `unresolved` or `not-converged`). A prior on the factor, centred on 1, or measured peak pressures then resolve it, and the reported uncertainty of both is the posterior one. A factor fitted without a prior is a correction of the volume only as far as no other fixed input is wrong in the same direction: its value is the volume that makes the model match the ladder, not a measurement of the case.

### Several barrel lengths and temperatures

Sessions that differ in barrel length or in powder temperature share the powder parameters. Each distinct combination of charge, barrel length and temperature is one `interior` run, and every ladder row is compared with the run of its own combination. A barrel length is the travel to the muzzle, as the load's. A temperature is the propellant temperature of the session.

The muzzle velocity against barrel length depends on how much of the charge is burnt along the bore, so a cut-down series separates the energy from the burn coefficient: a shorter barrel ends the run earlier in the burn. The burn coefficient alone fixes the burn rate at the reference temperature of the load, and a series at other temperatures moves the burn rate by $\tau_T$, so it fixes $f_T$. A charge ladder at one length also moves the velocity with energy and burn coefficient, but nearly alike, and in the model the other fixed inputs (covolume, isentropic exponent, heat loss, form function) are absorbed by whichever of the two is fitted. The fit therefore treats the energy as resolved only by lengths that differ: it fails as `unresolved` when the longest barrel is less than 5 % longer than the shortest. The 5 % is a choice of the fit. The temperature factor needs no such rule: with one temperature its Jacobian column is parallel to the burn coefficient's (at the reference temperature it is 0), and the conditioning check fails the fit.

Code: `packages/core/src/interior/fit.ts`, `fitPowder` (`conditions`, `evaluate`), `checkParameters` (`minLengthSpan`).

`fitPowderSessions` takes the sessions (a barrel length, a temperature and a ladder each), joins their points and requests the parameters of `options.parameters`, which must hold the burn coefficient. When the fit fails as `unresolved`, it drops the unresolved requested parameter other than the burn coefficient. When it fails as `ill-conditioned`, it drops the one with the largest component in the direction of the smallest eigenvalue. When it fails as `underdetermined`, it drops the last. It then fits again, until a fit passes or no parameter other than the burn coefficient is left (the failure is then thrown). A prior on a dropped parameter is dropped too. The result lists the `resolved` parameters, the fitted ones in the order of the fit, and the `held` ones with the reason of the failure. A held parameter is not in `parameters`: it keeps the value of the input load, so the caller sets the prior centre of a parameter it wants held there as the load's value. A parameter that a prior resolves counts as resolved, with the posterior uncertainty, as in the single-ladder fit.

Code: `packages/core/src/interior/fit-sessions.ts`, `fitPowderSessions` (`giveUp`).

The tuning screen of the web app fits the strings a user recorded or typed. Each string carries its powder temperature: the one its session records, the one typed with it, or else the load's. Strings at two or more temperatures request the temperature factor with the burn coefficient from `fitPowderSessions`, as one session whose points carry their temperatures; a factor the strings do not resolve is held at 1, and the screen says that only the burn coefficient was fitted. Strings at one temperature fit the burn coefficient alone, and the screen says that the factor needs two or more temperatures. A load whose temperature sensitivity is 0 or absent, as a user powder may be, fits no factor, and the screen asks for one value: it is used below and above the reference, which is the load's propellant temperature, so the ratio of the two sensitivities is 1. Since the fit scales it, the value only starts the fit. The saved powder keeps the fitted load's sensitivities, scaled by the fitted factor, and each string's temperature in its fit points.

Code: `apps/web/src/lib/powder-fit.ts`, `temperatureFit`, `withSensitivity`; `apps/web/src/lib/powder-fit-answer.ts`, `answerPowderFit`; `apps/web/src/lib/powder-save.ts`, `fittedPowder`.

Two rules of the screen can fit fewer values than the request names. A value they leave out keeps the value of the input load, and the screen says which rule applied.

| Rule | When | Fitted |
| --- | --- | --- |
| Thin ladder | fewer than 3 distinct charges, or the largest charge less than 10 % above the smallest | the request without the start pressure and the volume factor |
| Held fit | the fitted start pressure or volume factor correlates with the burn coefficient beyond 0.9 in magnitude, the limit of the confidence rule `start-pressure-correlated` | the burn coefficient alone, fitted again |

On 2 charges every extra value moves with the burn coefficient, so the screen offers to try the other values anyway, which lifts both rules. Hand tuning gives each fitted value with a standard uncertainty a slider of 3 standard uncertainties either side of the fitted value, in steps of 0.05; the lower end stays at 5 % of the fitted value or above. The sliders move the shown values and the curve of the chart, whose runs take an output step of 2e-5 s, 10 times the default: the muzzle velocity moves by less than 1e-6 m/s and a run takes about a sixth of the time. The band and the pressure range stay those of the fit. Save as a powder stores the fitted values, never the hand-tuned ones.

Code: `apps/web/src/lib/powder-fit-answer.ts`, `thinRule`, `heldFit`; `packages/core/src/interior/fit-confidence.ts`, `powderConfidenceRules`; `apps/web/src/components/powder-tune.tsx`, `FitResult`, `SaveFit`.

The values describe the rifle's barrels, the lot and the temperatures of the sessions. A fitted energy absorbs every fixed input that moves the velocity with the barrel length (see Identifiability), and a fitted temperature factor absorbs the effect of the initial temperature on the gas energy, which the model does not have. Neither is a property of the powder to carry to another load, and the result is a simulation parameter, not load data.

### Pooled fit over rifles, powders and lots

`fitPowderPooled` fits many chronograph sessions at once. Each session names its powder, rifle and, optionally, lot, and carries its own load (the rifle, components and fixed inputs), barrel length, powder temperature and a ladder of mean velocities with their `velocitySigma`. The predicted mean velocity of a string of session $s$ at charge $m$ is

$$
\hat v_s(m) = r_{R(s)}\, v_\text{M3}\bigl(m;\ B_{P(s)}\, \ell_{L(s)},\ f_{T,P(s)}\bigr), \qquad
B_P = B_{P,0}\, e^{\theta_{B,P}}, \quad r_R = e^{\theta_R}, \quad \ell_L = e^{\theta_L}, \quad f_{T,P} = e^{\theta_{T,P}}
$$

Code: `packages/core/src/interior/fit-pooled.ts`, `fitPowderPooled` (`velocity`, `targetLoad`).

- $B_P$, the burn coefficient of powder $P$, is shared by all its sessions. The burn coefficient of the powder's first session is the start $B_{P,0}$ and replaces that of its other sessions. On request the temperature factor $f_{T,P}$ of the powder is fitted too, where its sessions span two or more temperatures and its load carries a sensitivity; otherwise it is listed in `held` and stays 1.
- $r_R$, the velocity factor of rifle $R$, holds what the rifle changes beyond its load: bore, throat, chronograph. It is fitted only where the sessions hold two or more rifles. With one rifle it is absorbed by the burn coefficients.
- $\ell_L$, the factor of lot $L$ on its powder's burn coefficient, is fitted for each named lot of a powder whose sessions hold two or more lots (a session without a lot counts as one, without a factor).

Rifle and lot factors are random effects: each has a Gaussian prior on its log, centred on 0, with the spread `rifleSigma` (default 0.01) or `lotSigma` (default 0.03). The defaults are assumptions, to be tuned on measured sessions. A per-powder prior (`priors`, by powder, on the burn coefficient or the temperature factor, as a `PowderPrior`) comes from a powder record, its thermochemistry or the [similar powders](#prior-from-similar-powders). All priors are pseudo-rows, as in the single fit, so the result is the maximum of the posterior, and its covariance is the posterior one (first-order Laplace approximation). There is no global parameter of the powder model: velocities alone resolve neither the exponent nor the form parameters. A request for `exponent` or `form` fails as `unresolved` before any run, and the pooled fit takes no pressures.

The rows, Jacobian and conditioning check are those of the single fit. Each ladder point is one row; a parameter moves only the rows of its sessions, so a Jacobian column runs `interior` only there, and a rifle step reuses the last run. The fit fails as `fitPowder` does: `ill-conditioned` above the condition limit (for example a temperature factor between two temperatures that differ by a hundredth of a kelvin), `not-converged`, `invalid`, and `unresolved` for a powder whose sessions hold a single charge, where its burn coefficient and the rifle factors cannot be told apart. The result reports the covariance and correlation of all parameters and the condition number. A pooled fit of one session fits the burn coefficient alone and gives the value and standard uncertainty of `fitPowder` on its ladder, within a relative $10^{-9}$ in the tests.

`predictPooled` gives the mean velocity of a target (a session without a ladder) at any charge with an interval. Its variance sums the parameter term of the [prediction at a charge](#prediction-at-a-charge), over the parameters that move the target, the model error and the uncertainty of the string to be predicted:

$$
u^2(\hat v) = g^\top C_\theta\, g + \bigl(\varepsilon\, \hat v\bigr)^2 + \sigma_s^2 \;\bigl[+\ (\tau_R\, \hat v)^2 + (\tau_L\, g_B)^2\bigr], \qquad
\hat v \pm z_{1 - \alpha/2}\, u(\hat v)
$$

Code: `packages/core/src/interior/fit-pooled.ts`, `predictPooled` (`gradient`, `variance`).

A rifle the fit has not seen adds the spread of its random effect, $\tau_R \hat v$, and a lot it has not seen for the powder adds $\tau_L g_B$, with $g_B$ the gradient in the powder's burn coefficient. $\sigma_s$ is the `velocitySigma` of the string (default 0, the true mean). `calibratePooled` estimates the relative model error $\varepsilon$ from strings the fit was not fitted to: the mean of the squared relative residual beyond the variance of the prediction without model error, at least 0. In the bracket, the first term applies to a string of a rifle the fit has not seen, the second to a lot it has not seen:

$$
\varepsilon^2 = \max\Bigl(0,\ \frac{1}{n} \sum_{i=1}^{n} \frac{(y_i - \hat v_i)^2 - g_i^\top C_\theta\, g_i - \sigma_i^2 \;\bigl[-\ (\tau_R\, \hat v_i)^2 - (\tau_L\, g_{B,i})^2\bigr]}{\hat v_i^2}\Bigr)
$$

Code: `packages/core/src/interior/fit-pooled.ts`, `calibratePooled` (`excess`).

The held-out strings are chosen by the caller before the fit is looked at; strings that also test the interval must be others again. On synthetic sessions (3 powders, 3 rifles, 2 lots, 4 charges each, a relative model error of 0.4 % on top of a 3 m/s string uncertainty), the nominal 90 % interval after calibration on 108 strings covers between 85 and 95 % of 270 other strings at charges between the fitted ones. The parameter covariance itself holds no model error, as in the single fit.

On held-out measured sessions the targets of median 1 % and P90 2 % velocity error are not met: [validation](validation.md#pooled-powder-fit) gives the aggregates of a local run.

### Failures

`fitPowder` throws a `PowderFitError` with one of these reasons:

- `underdetermined`: fewer rows than parameters, before any run.
- `invalid`: an `interior` run at the start values or in a Jacobian is invalid. The error names the charge and the run's reason.
- `unresolved`: a parameter does not measurably change any prediction, for example a start pressure carried to the floor, or `energy` where the barrel lengths do not differ by 5 %.
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
| $Q$, $Q_0$ | Specific energy of the propellant, fitted and initial | J/kg | J/kg |
| $f_T$ | Factor on both temperature sensitivities of the load, fitted; initial value 1 | 1 | 1 |
| $\sigma_c$, $\sigma_h$, $\tau_T$ | Burn-rate temperature sensitivities below and above the reference, the factor they give on the burn rate | no kind, no kind, 1 | 1/K, 1/K, 1 |
| $p_\text{floor}$ | Start pressure below which it has no effect | bar | Pa |
| $f_V$ | Factor on the chamber volume of the load, fitted; initial value 1 | 1 | 1 |
| $V_c$, $V_{c,0}$ | Chamber volume of the fitted load and of the input load | cm³ | m³ |
| $p_i$ | Ignition pressure | bar | Pa |
| $p_f$ | Bore friction pressure | bar | Pa |
| $p_e(0)$ | Engraving pressure at travel 0 | bar | Pa |
| $\theta_j$ | Log parameter | 1 | 1 |
| $q_j^\ast$, $\mu_j$, $s_j$ | Prior centre as a value, in log parameter, and its standard deviation | as the parameter, 1, 1 | as the parameter, 1, 1 |
| $L_k$, $k$ | Huber loss of a weighted residual, its threshold in sigmas | 1 | 1 |
| $\chi^2_\text{data}$, $\chi^2_\text{prior}$ | Shares of $\chi^2$ of the ladder rows and of the priors | 1 | 1 |
| $P$ | Parameters with a prior | no kind | no kind |
| $q_j$, $o_j$ | Fitted value and its offset | as the parameter | as the parameter |
| $r_i$ | Weighted residual | 1 | 1 |
| $\chi^2$ | Sum of squared weighted residuals | 1 | 1 |
| $n$, $n_p$, $\nu$ | Rows, parameters, degrees of freedom | 1 | 1 |
| $C_\theta$ | Covariance of the log parameters | 1 | 1 |
| $x_\min$, $x_\max$, $\delta$, $\delta_+$ | Smallest and largest value of an axis in the data, relative margin of the domain, relative margin of its upper end | as the axis, 1 | as the axis, 1 |
| $m$, $\hat y$ | Charge of a prediction, predicted muzzle velocity or peak breech pressure | g, m/s or bar | kg, m/s or Pa |
| $u(\hat y)$, $g_j$ | Standard uncertainty of a prediction, its gradient in the log parameters | as $\hat y$ | as $\hat y$ |
| $k$, $z$, $t$, $\alpha$ | Coverage factor, normal and Student quantile, one minus the coverage | 1 | 1 |
| $c_j$, $u_j$ | Effect of input $j$ on the peak pressure, its standard uncertainty | Pa, as the input | Pa, as the input |
| $u_\text{fit}$, $u_c$, $u_\text{corr}$ | Fit, combined and fully correlated standard uncertainty of the peak pressure | bar | Pa |
| $h$ | Relative half-width of the pressure range | 1 | 1 |
| $B_i$, $n$ | Burn coefficients of the similar powders, their number | as the parameter, 1 | as the parameter, 1 |
| $r_R$, $\ell_L$, $\tau_R$, $\tau_L$ | Velocity factor of a rifle, burn factor of a lot, the spreads of their logs | 1 | 1 |
| $\varepsilon$, $\sigma_s$ | Relative model error of the pooled fit, standard uncertainty of a predicted string mean | 1, m/s | 1, m/s |
| $J_\text{floor,i}$ | Noise floor of a Jacobian entry per unit log parameter | 1 | 1 |

## Assumptions

- The M3 load describes the rifle, components and conditions of the ladder. Only the fitted parameters change between candidates.
- Velocities are mean muzzle velocities. A chronograph reading at a distance from the muzzle is converted to the muzzle by the caller, for example with [truing](exterior-truing.md).
- A pressure row is compared with the peak breech pressure. The gauge position is not modelled. All pressure rows are on the one stated basis; the model does not correct for the basis, so the caller states the basis its pressures were measured on.
- Observations are independent, with the stated standard uncertainties.
- The inputs of the range are independent, each with the stated standard uncertainty. The default uncertainties are assumptions, not measurements.
- A prior describes the powder's parameter, not this ladder: it comes from a record or a family of powders. A prior far from the data drags the fit, and the result then shows a large $\chi^2_\text{prior}$.

## Limits

- The fit is local: from a start far from the solution the steps can end at the start-pressure floor with `unresolved`.
- The peak pressure has a kink in the parameters where the peak moves between a located interior peak and burnout. A Jacobian taken across it mixes both sides.
- A prediction outside the domain is an extrapolation. The result holds no charge recommendation and no limit. The domain is the span of the data plus a rounding tolerance on bore diameter and barrel length, not a statement that the model holds inside it.
- A prediction band covers parameter uncertainty and not model error, and it is linearized: far from the ladder, where the model is strongly nonlinear in the parameters, the interval is less reliable.
- The posterior uncertainty is the first-order Laplace approximation, no sampling. With a Huber loss it is approximate.
- The burn coefficient, start pressure, volume factor, energy and temperature factor are fitted. Exponent, form parameters and the ratio of the two temperature sensitivities stay as given. `fitPowderSessions` shares one rifle's load, one lot and one set of fixed inputs over its sessions; the [pooled fit](#pooled-fit-over-rifles-powders-and-lots) pools rifles, powders and lots with random effects whose spreads are given, not estimated.
- Each session is one barrel length and one temperature, and the barrel length is the one the sessions' bore and chamber share. A session fired from a barrel with another bore, chamber or twist is another load.
- The pressure range holds the inputs it shifts, linearized by the refit at one standard uncertainty each. It holds no model error of the burn form, exponent, heat loss or pressure gradient, and not the correlation of inputs.
- Each prediction costs one `interior` run per distinct charge, barrel length and temperature, and each Jacobian two predictions per parameter.
- A crusher pressure is a conventional value, not an absolute pressure: the compression of the copper cylinder depends on the rise time of the pressure and on the cylinder type. A pressure step drives an undamped elastic gauge to twice the deflection of the same static pressure ($x(t) = x_s (1 - \cos \omega t)$), so a fast rise reads differently from a slow one. No single factor converts crusher readings to transducer readings, which is why a fit refuses mixed bases and converts none ([research log](../research/interior-crusher-conventional-pressure.md)).
- A fitted energy is an effective value, not the thermochemical one. On the 30 powder records with both, the fitted specific energy over the thermochemical value (impetus over $k - 1$) has a median of 0.78, and 27 lie between 0.6 and 0.95 ([research log](../research/interior-plausibility-notes.md)).
- The fitted burn coefficient holds for the powder as fired. Ageing and moisture are not modelled in [M3](interior-m3.md#limits), so a fit on fresh powder does not hold for old or damp powder of the same lot, and the reverse.
- Research log: [fitted parameters of the load-table fit](../research/interior-load-table-fit-parameters.md), [assumed peak pressure for powders without printed pressures](../research/interior-load-table-pressure-term.md).

## Sources

- [Levenberg 1944](../bibliography.md#levenberg-1944) and [Marquardt 1963](../bibliography.md#marquardt-1963): the damped least-squares iteration.
- [Gelman 2013](../bibliography.md#gelman-2013): the maximum a posteriori estimate and the Laplace approximation of a posterior.
- [Huber 1964](../bibliography.md#huber-1964): the Huber loss.
- [Bard 1974](../bibliography.md#bard-1974) (chapter unverified): the estimate of a nonlinear least-squares problem with prior information on the parameters, as extra rows.
- [JCGM 100:2008](../bibliography.md#jcgm-100-2008), the law of propagation of uncertainty (section 5.1.2, unverified) for the prediction band and the combination of the fixed inputs' effects with the fit's uncertainty, and section 4.2.3 (section number unverified): the standard uncertainty of a mean of $N$ readings, a standard deviation over $\sqrt N$, which `stringLadder` takes with the pooled standard deviation as the velocity uncertainty of a string.
