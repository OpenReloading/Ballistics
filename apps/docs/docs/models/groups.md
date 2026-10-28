---
title: Shot groups
description: Size and dispersion of shot groups on a target, confidence intervals by shot count, dispersion and prediction ellipses, and pooling of groups in angle.
---

# Shot groups

The group statistics describe the shots of one group on a target:

- the centre of impact
- sizes such as extreme spread and mean radius
- standard deviations per axis and the circular error probable (CEP), with chi-square confidence intervals by shot count
- the covariance with its principal axis
- ellipses that hold a stated share of the shots

The velocities of a chronograph string have their own statistics (mean, standard deviation, extreme spread, interval of the standard deviation, shots needed), see "Velocity strings".

Several groups of one load are pooled in angle, each about its own centre. Excluded shots enter only their count and the offset of their centre. A value whose minimum shot count is not met is undefined.

## Equations

### Centre and sums of squares

For the $n$ shots that are not excluded, at $(x_i, y_i)$ in the target plane ($x$ right, $y$ up):

$$
\bar x = \frac{1}{n} \sum_{i=1}^{n} x_i, \qquad \bar y = \frac{1}{n} \sum_{i=1}^{n} y_i
$$

Code: `packages/core/src/groups/statistics.ts`, `groupStatistics` (`centreOf`).

$$
S_{xx} = \sum_i (x_i - \bar x)^2, \qquad S_{yy} = \sum_i (y_i - \bar y)^2, \qquad S_{xy} = \sum_i (x_i - \bar x)(y_i - \bar y)
$$

Code: `packages/core/src/groups/statistics.ts`, `sums`.

The offset of the centre from the point of aim $(x_a, y_a)$ is $(\bar x - x_a, \bar y - y_a)$. Its compass point (N up, E right) is the nearest of eight sectors of 45 degrees, or the centre below $10^{-9}$ m:

$$
\beta = \operatorname{atan2}(\Delta x, \Delta y), \qquad q = \left(\operatorname{round}\frac{\beta}{\pi/4} + 8\right) \bmod 8
$$

Code: `packages/core/src/groups/statistics.ts`, `compassOf`.

### Sizes

Extreme spread, smallest pair distance and mean pair distance over all $n(n-1)/2$ pairs of shots, centre to centre:

$$
\mathrm{ES} = \max_{i \lt j} d_{ij}, \qquad d_{\min} = \min_{i \lt j} d_{ij}, \qquad \bar d = \frac{2}{n(n-1)} \sum_{i \lt j} d_{ij}, \qquad d_{ij} = \sqrt{(x_i - x_j)^2 + (y_i - y_j)^2}
$$

Code: `packages/core/src/groups/statistics.ts`, `pairDistances`.

Width and height are the ranges of the coordinates along the target axes:

$$
W = \max_i x_i - \min_i x_i, \qquad H = \max_i y_i - \min_i y_i
$$

Code: `packages/core/src/groups/statistics.ts`, `groupStatistics` (`width`, `height`).

Mean radius and the standard deviation of the radii:

$$
r_i = \sqrt{(x_i - \bar x)^2 + (y_i - \bar y)^2}, \qquad \bar r = \frac{1}{n} \sum_i r_i, \qquad s_r = \sqrt{\frac{\sum_i (r_i - \bar r)^2}{n - 1}}
$$

Code: `packages/core/src/groups/statistics.ts`, `groupStatistics` (`meanRadius`, `radiusStandardDeviation`).

### Standard deviations and circular error probable

$$
s_x = \sqrt{\frac{S_{xx}}{n-1}}, \qquad s_y = \sqrt{\frac{S_{yy}}{n-1}}, \qquad s_\mathrm{rad} = \sqrt{s_x^2 + s_y^2}
$$

Code: `packages/core/src/groups/statistics.ts`, `groupStatistics` (`standardDeviationX`, `standardDeviationY`, `radialStandardDeviation`).

The circular CEP assumes equal, uncorrelated axes with per-axis standard deviation $\hat\sigma$:

$$
\hat\sigma = \sqrt{\frac{s_x^2 + s_y^2}{2}}, \qquad \mathrm{CEP} = \sqrt{2 \ln 2}\, \hat\sigma
$$

Code: `packages/core/src/groups/statistics.ts`, `groupStatistics` (`cepFactor`).

### Covariance and principal axis

The sample covariance (divisor $n - 1$) has the principal variances

$$
C = \frac{1}{n-1} \begin{pmatrix} S_{xx} & S_{xy} \\ S_{xy} & S_{yy} \end{pmatrix}, \qquad \lambda_{1,2} = \frac{c_{xx} + c_{yy}}{2} \pm \sqrt{\left(\frac{c_{xx} - c_{yy}}{2}\right)^2 + c_{xy}^2}
$$

Code: `packages/core/src/groups/statistics.ts`, `groupStatistics` (`covariance`), `eigenvalues`.

The major axis lies at the angle $\theta$ from $+x$, counterclockwise, reported in $(-\pi/2, \pi/2]$. It is undefined when $c_{xx} = c_{yy}$ and $c_{xy} = 0$:

$$
\theta = \tfrac{1}{2} \operatorname{atan2}(2 c_{xy},\, c_{xx} - c_{yy})
$$

Code: `packages/core/src/groups/statistics.ts`, `axisAngle`.

### Elliptical CEP

The elliptical CEP is the radius $R$ of the circle about the centre that holds half of a centred bivariate normal distribution with the sample covariance. Along the principal axes a shot is $(\sqrt{\lambda_1}\rho\cos\varphi, \sqrt{\lambda_2}\rho\sin\varphi)$ with $\varphi$ uniform and $\rho^2$ chi-square with 2 degrees of freedom, so the share outside the circle is

$$
P_\mathrm{out}(R) = \frac{2}{\pi} \int_0^{\pi/2} \exp\!\left(-\frac{R^2}{2(\lambda_1 \cos^2\varphi + \lambda_2 \sin^2\varphi)}\right) d\varphi = \frac{1}{2}
$$

Code: `packages/core/src/groups/statistics.ts`, `ellipticalCep` (`outside`), `packages/core/src/bisect.ts`, `bisect`.

The integral uses the trapezoid rule with 64 steps. $R$ comes from bisection on $[0, 1.2\sqrt{\lambda_1}]$.

### Dispersion and prediction ellipses

Both ellipses lie on the principal axes with semi-axes $k\sqrt{\lambda_1}$ and $k\sqrt{\lambda_2}$. The dispersion ellipse holds the share $p$ of a bivariate normal population with the sample covariance:

$$
k = \sqrt{-2 \ln(1 - p)}
$$

Code: `packages/core/src/groups/statistics.ts`, `dispersionEllipse`, `ellipseAt`.

The prediction ellipse holds one further shot from the same population with probability $p$ when mean and covariance are both estimated from the $n$ shots ($n \ge 3$):

$$
k^2 = \frac{2(n^2 - 1)}{n(n - 2)}\, F_{2,\,n-2}(p)
$$

Code: `packages/core/src/groups/statistics.ts`, `predictionEllipse`.

With 2 numerator degrees of freedom the regularized incomplete beta function in the F distribution function reduces to a power, so the quantile is closed form:

$$
F_{2,\,m}(p) = \frac{m}{2}\left((1 - p)^{-2/m} - 1\right)
$$

Code: `packages/core/src/groups/f-distribution.ts`, `fQuantileTwoNumeratorDegrees`.

### Confidence intervals by shot count

For a sum of squares $S$ with $\nu$ degrees of freedom, the two-sided interval at level $1 - \alpha$ for the standard deviation is

$$
\sqrt{\frac{S}{\chi^2_{1-\alpha/2,\,\nu}}} \le \sigma \le \sqrt{\frac{S}{\chi^2_{\alpha/2,\,\nu}}}
$$

Code: `packages/core/src/groups/statistics.ts`, `confidenceOf`.

with:

- one axis: $S = S_{xx}$ or $S_{yy}$, $\nu = n - 1$
- circular $\sigma$: $S = S_{xx} + S_{yy}$, $\nu = 2(n - 1)$
- radial standard deviation and CEP: the interval of $\sigma$ times $\sqrt{2}$ and $\sqrt{2 \ln 2}$

The chi-square distribution function is the regularized lower incomplete gamma function, summed as a power series with every term formed in logarithms ($a = \nu/2$, $z = x/2$):

$$
F_{\chi^2}(x; \nu) = P(a, z) = \sum_{k=0}^{\infty} \frac{e^{-z} z^{a+k}}{\Gamma(a + k + 1)}
$$

Code: `packages/core/src/groups/chi-square.ts`, `chiSquareCdf` (`lnGammaPlusOne`), `chiSquareQuantile`.

Above $z = a + 1$ the upper tail comes from the continued fraction of the upper incomplete gamma function:

$$
Q(a, z) = \frac{e^{-z} z^a}{\Gamma(a)} \cdot \cfrac{1}{z + 1 - a - \cfrac{1 \cdot (1 - a)}{z + 3 - a - \cfrac{2 \cdot (2 - a)}{z + 5 - a - \cdots}}}
$$

Code: `packages/core/src/groups/chi-square.ts`, `chiSquareSurvival`.

evaluated by the modified Lentz method, and there $P = 1 - Q$: the series would need about $z$ terms. Below, $Q = 1 - P$. Quantiles come from bisection on $P$.

### Velocity strings

For the $n$ velocities $v_i$ of one string (m/s, excluded shots left out), the mean, the standard deviation with divisor $n - 1$ and the extreme spread are

$$
\bar v = \frac{1}{n} \sum_{i=1}^{n} v_i, \qquad s = \sqrt{\frac{\sum_i (v_i - \bar v)^2}{n - 1}}, \qquad \mathrm{ES} = \max_i v_i - \min_i v_i
$$

Code: `packages/core/src/groups/velocity-statistics.ts`, `velocityStatistics`.

The interval of the population standard deviation is the one-axis form of the interval above, $S = (n-1)s^2$ and $\nu = n - 1$, so as multiples of $s$:

$$
\sqrt{\frac{n-1}{\chi^2_{1-\alpha/2,\,n-1}}} \le \frac{\sigma}{s} \le \sqrt{\frac{n-1}{\chi^2_{\alpha/2,\,n-1}}}
$$

Code: `packages/core/src/groups/velocity-statistics.ts`, `velocityStatistics` (`intervalFactors`).

It needs 3 shots. The extreme spread has no interval.

The relative half-width of the interval is $w(n) = (u_n - l_n)/2$ with $l_n$ and $u_n$ the two factors above. `shotsNeeded` returns the smallest $n \ge 3$ with $w(n)$ at most the wanted value. $w$ falls with $n$, so the search doubles $n$ and then halves the bracket. At the 95 % level, 12, 26 and 53 shots give a half-width of 50 %, 30 % and 20 %; at 90 %, 9, 19 and 38.

Code: `packages/core/src/groups/velocity-statistics.ts`, `shotsNeeded`.

The session summary shows the 95 % interval and $n$ with each statistic. It compares two strings by their intervals: where they overlap, it states that the difference is smaller than the uncertainty. Two strings are ranked by the smaller SD only when the intervals are apart and each has at least 10 shots; with fewer shots, or without an interval, it states that there are too few shots to compare. At $n = 10$ and 95 % the interval runs from 0.69 to 1.83 times $s$, so two strings of 10 shots separate only when their standard deviations differ by a factor of about 2.7.

Code: `apps/web/src/lib/string-comparison.ts`, `compareSd`. `apps/web/src/components/string-comparison.tsx`, `StringComparison`.

### Expected extreme spread and flier screen

Code: `packages/core/src/groups/extreme-spread.ts`, `expectedExtremeSpread`; `packages/core/src/groups/flier-screen.ts`, `flierScreen`.

The mean extreme spread of a circular normal group of $n$ shots, $2 \le n \le 20$, and the 5th and 95th percentile of one group are tabulated in units of $\sigma$ from a seeded simulation, in [Expected extreme spread per shot count](../research/group-extreme-spread-per-shot-count.md). For two shots the mean is $\sqrt{\pi}\,\sigma$. The flier screen compares the shot farthest from the string mean with the mean and sample standard deviation of the other shots and flags it above a factor tabulated for 10 to 30 shots at a false-flag rate of 1 percent per clean normal string ([Flier screen](../research/string-flier-flag.md)). The flag is advisory and never excludes a shot.

### Bisection

`bisect` finds the point where a predicate that holds below the root turns false. It halves the bracket $[l, h]$ at the midpoint $x_m = (l + h)/2$: $l$ becomes $x_m$ where the predicate holds there, else $h$ becomes $x_m$. The result is the midpoint of the final bracket. A caller passes the iteration count and whether to stop early once $x_m$ equals an end of the bracket. The chi-square and Student's t quantiles and the elliptical CEP stop early, with 200, 200 and 100 halvings. The seven-perforation burnout of the [burn forms](interior-burn-forms.md) and the ignition burnt fraction of the [M3 model](interior-m3.md) run 200 halvings without the early stop.

The chi-square and Student's t quantiles first double the upper end of the bracket until the distribution function there reaches the target.

Code: `packages/core/src/bisect.ts`, `bisect`. `packages/core/src/groups/chi-square.ts`, `chiSquareQuantile`. `packages/core/src/groups/student-t.ts`, `studentTwoSidedQuantile`.

### Student's t quantile

The two-sided quantile of Student's t distribution with $\nu$ degrees of freedom solves $P(\lvert T \rvert \lt t) = 1 - \alpha$ by bisection, with $\theta = \arctan(t/\sqrt{\nu})$ and the closed forms for whole $\nu$:

$$
P(\lvert T \rvert \lt t) =
\begin{cases}
\sin\theta \displaystyle\sum_{k=0}^{\nu/2 - 1} \frac{(2k-1)!!}{(2k)!!} \cos^{2k}\theta & \nu \text{ even} \\[2ex]
\dfrac{2}{\pi}\left(\theta + \sin\theta \cos\theta \displaystyle\sum_{k=0}^{(\nu-3)/2} \frac{(2k)!!}{(2k+1)!!} \cos^{2k}\theta\right) & \nu \text{ odd}, \nu \gt 1 \\[2ex]
\dfrac{2\theta}{\pi} & \nu = 1
\end{cases}
$$

Code: `packages/core/src/groups/student-t.ts`, `studentTwoSidedQuantile` (`centralMass`).

The intervals of the [range string fit](exterior-truing-strings.md) use it.

### Vertical position and velocity

Over the $m \ge 3$ included shots that carry a velocity $v_i$:

$$
r = \frac{S_{vy}}{\sqrt{S_{vv} S_{yy}}}, \qquad b = \frac{S_{vy}}{S_{vv}}
$$

Code: `packages/core/src/groups/statistics.ts`, `velocityCorrelationOf`.

with the sums of squares and products about the means of these shots. With all these velocities or all heights equal there is no correlation.

### Angles and pooling

The angle a segment of length $L$ centred on the line of sight subtends at distance $D$:

$$
\alpha = 2 \arctan\frac{L}{2D}
$$

Code: `packages/core/src/groups/statistics.ts`, `subtendedAngle`.

Groups $j$ with $n_j \ge 2$ are pooled about their own centres, each in angle at its own distance $D_j$ as the small angle $L/D_j$, which differs from $\alpha$ by less than 0.01 % below 30 mrad:

$$
s_x^2 = \frac{\sum_j S_{xx,j} / D_j^2}{\sum_j (n_j - 1)}, \qquad s_y^2 = \frac{\sum_j S_{yy,j} / D_j^2}{\sum_j (n_j - 1)}, \qquad \hat\sigma^2 = \frac{s_x^2 + s_y^2}{2}
$$

Code: `packages/core/src/groups/statistics.ts`, `pooledGroupStatistics`, `pooledValues`.

The intervals use $\nu = \sum_j (n_j - 1)$ per axis and $2\sum_j (n_j - 1)$ for $\hat\sigma$. The mean extreme spread is the average of $\mathrm{ES}_j / D_j$. Lengths are the angular values times $D$.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $n$ | Shots not excluded | 1 | 1 |
| $x_i, y_i$ | Shot position in the target plane, $x$ right, $y$ up | mm | m |
| $\bar x, \bar y$ | Centre of impact | mm | m |
| $x_a, y_a$ | Point of aim | mm | m |
| $\Delta x, \Delta y$ | Centre minus point of aim | mm | m |
| $S_{xx}, S_{yy}, S_{xy}$ | Sums of squares and products about the centre | no kind | m² |
| $d_{ij}$ | Distance between shots $i$ and $j$ | mm | m |
| $\mathrm{ES}$, $W$, $H$ | Extreme spread, width, height | mm | m |
| $r_i$, $\bar r$, $s_r$ | Radius of shot $i$, mean radius, standard deviation of the radii | mm | m |
| $s_x, s_y, s_\mathrm{rad}$ | Standard deviations per axis and radial | mm | m |
| $\hat\sigma$, $\sigma$ | Estimated and population per-axis standard deviation of a circular normal spread | mm | m |
| $\mathrm{CEP}$, $R$ | Circular error probable, circular and elliptical | mm | m |
| $C$, $c_{xx}, c_{xy}, c_{yy}$ | Sample covariance | no kind | m² |
| $\lambda_1, \lambda_2$ | Principal variances, $\lambda_1 \ge \lambda_2 \ge 0$ | no kind | m² |
| $\theta$ | Direction of the major axis from $+x$ | deg | rad |
| $\beta$, $q$ | Bearing of the aim offset clockwise from up, sector index | deg, 1 | rad, 1 |
| $p$ | Coverage of an ellipse | 1 | 1 |
| $k$ | Ellipse scale on the principal standard deviations | 1 | 1 |
| $F_{2,m}(p)$ | Quantile of the F distribution with 2 and $m$ degrees of freedom | 1 | 1 |
| $1 - \alpha$ | Two-sided confidence level, default 0.95 | 1 | 1 |
| $\nu$ | Degrees of freedom | 1 | 1 |
| $v_i$, $\bar v$, $s$ | Velocity of shot $i$ of a string, mean, standard deviation | m/s | m/s |
| $l_n$, $u_n$, $w$ | Limits of the interval of $\sigma$ over $s$ for $n$ shots, relative half-width | 1 | 1 |
| $\chi^2_{q,\nu}$ | Quantile of the chi-square distribution at probability $q$ | 1 | 1 |
| $P$, $Q$ | Regularized lower and upper incomplete gamma functions | 1 | 1 |
| $t$, $\theta$ | Student's t quantile and its angle $\arctan(t/\sqrt{\nu})$ | 1, no kind | 1, rad |
| $v_i$ | Velocity of shot $i$ | m/s | m/s |
| $r$, $b$ | Correlation of height with velocity, slope of height on velocity | 1, no kind | 1, m per m/s |
| $L$, $D$ | Length in the target plane, distance from the muzzle to the target | mm | m |
| $\alpha$ | Angle subtended at the muzzle | deg | rad |

## Assumptions

- The shots of a group come from one bivariate normal population. The chi-square intervals of $\sigma$, the radial standard deviation and the CEP assume equal, uncorrelated axes (circular normal). The per-axis intervals assume normal dispersion along that axis.
- The velocities of a string are independent draws from one normal population. Drift over the string (barrel heat) and the rounding of the chronograph make them less so.
- Every variance divides by $n - 1$. The mean radius and the centre divide by $n$.
- Pooled groups share one population in angle: each group is reduced about its own centre and scaled by its own distance.
- The prediction ellipse covers a further shot with probability $p$ on average over groups, not for every group.

## Limits

- Minimum shot counts: the centre and the aim offset need 1 shot, every dispersion value and the dispersion ellipse 2, the prediction ellipse 3, the velocity correlation 3 shots with a velocity, not all of one velocity or one height.
- The interval of a velocity standard deviation holds its level only for normal velocities. In simulated strings of 10 to 30 shots from skewed, heavy-tailed or stray-shot populations, an interval stated at 95 % covered the true value 76 to 90 % of the time, and it is too narrow, not too wide. A percentile bootstrap covered less at these shot counts and is not used. The extreme spread of a string carries no interval.
- Mean radius, extreme spread, width, height, the pair distances and the elliptical CEP carry no interval. Their small-sample distributions exist only as tables, not reproduced here.
- The circular CEP overstates the CEP of an elongated group. The elliptical CEP holds for any axis ratio and equals the circular one for equal, uncorrelated axes.
- The dispersion ellipse describes the shots fired. For small $n$ it holds less than the share $p$ of further shots.
- The velocity correlation describes the data and names no cause. With few shots a large $\lvert r \rvert$ arises by chance.
- Pooled lengths are given only for groups at one distance (relative difference below $10^{-9}$).

## Sources

- [Grubbs 1991](../bibliography.md#grubbs-1991): centre of impact p. 3, sample variances pp. 4 to 6, eqs. (1) and (6), CEP p. 9, range of the coordinates p. 10, eq. (7), radial standard deviation pp. 15 to 17, eq. (9), mean radius pp. 18 and 19, extreme spread p. 19, mean extreme spread of several groups (note after the preface).
- [Carlson 2021](../bibliography.md#carlson-2021): CEP of a circular normal spread, sections 1.4.2.1 and 1.4.2.2, pp. 4 to 7, and the CEP of a bivariate normal as a disc integral found by iteration, section 1.4.2.3, p. 7.
- [Hoover 1984](../bibliography.md#hoover-1984): coverage of the covariance ellipse, section 2.5, p. 7.
- [NIST/SEMATECH](../bibliography.md#nist-sematech): 1.3.5.6 (measures of scale), 1.3.5.8 (chi-square interval for the variance), 1.3.6.6.5 (F distribution), 1.3.6.6.6 (chi-square distribution), 4.4.3.1 (least-squares slope), 6.5.4.1 and 6.5.4.2 (mean vector, covariance, correlation), 6.5.4.3.3 and 6.5.4.3.4 (limit for a further observation, the prediction ellipse), 6.5.5.1 (principal components).
- [DLMF](../bibliography.md#dlmf): 8.2.4 and 8.2.6 (incomplete gamma functions), 8.7.1 (series), 8.9.2 (continued fraction), 8.17.1 and 8.17.2 (incomplete beta function).
- [Lentz 1976](../bibliography.md#lentz-1976): the Lentz method for evaluating a continued fraction, which the code uses in its modified form with a floor on the terms.
- [Abramowitz 1964](../bibliography.md#abramowitz-1964): 26.7.3 and 26.7.4 (Student's t distribution for whole degrees of freedom), page numbers unverified.
