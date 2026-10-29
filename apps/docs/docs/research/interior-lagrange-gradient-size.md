---
title: Size of the Lagrange gradient error
description: How far the uniform-density Lagrange coefficients lie from the self-similar column of an isentropic gas, by charge to projectile mass ratio.
---

# Size of the Lagrange gradient error

## Question

Interior ballistics, pressure gradient: how large is the error of the Lagrange coefficients $\delta = 1/3$, $\varepsilon = 1/2$ for the charge to projectile mass ratios of rifle loads?

## Method

Compare the breech and mean pressures over the base pressure of the uniform gas column with those of the self-similar column of an isentropic gas whose velocity also rises linearly from breech to base. Ratios $m_c/m_p'$ of 0.28, 0.51 and 1.03, ratio of specific heats $k$ of 1.24, 1.25 and 1.26. Metric: relative difference of each ratio. Accept rule fixed in advance: quote only the numbers the script reproduces.

## Formulas

Uniform column: breech over base $1 + m_c/(2 m_p')$, mean over base $1 + m_c/(3 m_p')$.

Self-similar isentropic column ([Corner 1950](../bibliography.md#corner-1950), pages unverified), with $\xi$ the position from breech (0) to base (1) and $n = 1/(k - 1)$: the gas density falls as $(1 - a^2 \xi^2)^n$ and the pressure as $(1 - a^2 \xi^2)^{n+1}$ from the breech. The momentum of the gas and of the projectile fix $a^2$ by

$$
\frac{m_c}{m_p'} = \frac{2 (n + 1)\, a^2 \int_0^1 (1 - a^2 \xi^2)^n\, d\xi}{(1 - a^2)^{n+1}}
$$

Breech over base is $(1 - a^2)^{-(n+1)}$, mean over base $\int_0^1 (1 - a^2 \xi^2)^{n+1} d\xi \,/\, (1 - a^2)^{n+1}$. The integrals by Simpson's rule (2000 intervals), $a^2$ by bisection.

## Numbers

| $m_c/m_p'$ | Breech over base, uniform | isentropic | Mean over base, uniform | isentropic | Uniform high by |
| --- | --- | --- | --- | --- | --- |
| 0.28 | 1.140 | 1.138 | 1.093 | 1.091 | 0.2 % |
| 0.51 | 1.255 | 1.248 | 1.170 | 1.162 | 0.6 to 0.7 % |
| 1.03 | 1.515 | 1.489 | 1.343 | 1.315 | 1.8 to 2.1 % |

The isentropic values change in the third decimal at most over $k$ from 1.24 to 1.26. The mean pressure coefficient of the isentropic column, (mean over base minus 1) over $m_c/m_p'$, falls from 0.324 at 0.28 to 0.306 at 1.03, against 1/3.

## Result

No change. Documented as a limit on the [M3 model page](../models/interior-m3.md#limits). The coefficients stay the default.

## Data basis

Analytic: two closed-form gas columns, no measured pressure.

## Where in the app

- `packages/core/src/interior/model.ts`, `lagrangeGradient`.
- Model page: [M3 interior model](../models/interior-m3.md).

## Confidence

Medium: both columns are idealized (all of the charge burnt, no friction), so the table bounds the shape error of the gradient, not its error against a measured breech pressure.
