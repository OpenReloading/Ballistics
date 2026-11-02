---
title: Interior model against the constant-surface closed form
description: Whether the M3 interior model reproduces the exact solution that exists for a constant burning surface without bore resistance, and how fast it approaches it as the ignition pressure falls.
---

# Interior model against the constant-surface closed form

## Question

Interior ballistics: does the numerical run of the [M3 model](../models/interior-m3.md) reproduce peak pressure, the travel of the peak, the burnout travel and the muzzle velocity of the one case with an exact solution, a constant burning surface?

## Method

A synthetic rifle case with a constant form function, pressure exponent 1, covolume equal to the inverse of the solid density, no bore resistance, no twist and a Sébert gradient (a single factor $s$ for both coefficients): chamber volume $3.4 \cdot 10^{-6}$ m³, bore area $3.75 \cdot 10^{-5}$ m², travel 0.6 m, projectile 0.0095 kg, charge 0.0028 kg, specific energy $3.9 \cdot 10^{6}$ J/kg, $k = 1.23$, solid density 1600 kg/m³, vivacity 0.56 at a reference pressure of 98066.5 Pa and $s = 0.5$.

Accept rules, set in the test:

- relative difference below $10^{-5}$ for peak pressure, travel of the peak, burnout travel and muzzle velocity, at an ignition pressure of 100 Pa;
- along the barrel, for every point with a burnt fraction $z \ge 0.1$, relative difference below $2 \cdot 10^{-6}/z$ in velocity, and in mean pressure up to burnout (the ignition gas shifts the numerical solution by a multiple of $z_0/z$);
- the largest deviation of peak pressure and muzzle velocity falls by a factor of more than 5 at each step of the ignition pressure through $10^{5}$, $10^{4}$, $10^{3}$ and $10^{2}$ Pa.

## Formulas

The closed form is described in the [1977 weapons handbook](../bibliography.md#rheinmetall-1977), pp. 88 to 94. In the symbols of the docs: $V_c$ chamber volume, $A$ bore area, $m_c$ charge, $Q$ specific energy, $B_a$ vivacity, $p_\text{ref}$ its reference pressure, $m_p$ projectile mass, $\rho_s$ solid density. Define the solid-free volume, the effective mass and the scaled travel:

$$
V^\ast = V_c - \frac{m_c}{\rho_s}, \qquad m^\ast = m_p + s\, m_c, \qquad \xi = \frac{A x}{V^\ast}
$$

A state variable $\theta$ replaces the travel, and burnout lies at $\theta_B$:

$$
\theta(\xi) = 1 - (1 + \xi)^{-(k-1)/2}, \qquad \theta_B = \frac{(p_\text{ref} A)^2}{2 B_a^2\, m^\ast m_c Q}
$$

Before burnout ($\theta \le \theta_B$) the velocity is proportional to $\theta$, and the mean pressure follows $\theta - \theta^2$ over $1 + \xi$:

$$
v = \frac{2 B_a m_c Q}{p_\text{ref} A}\,\theta, \qquad \bar p = \frac{2 (k-1)\, m^\ast (B_a m_c Q)^2}{V^\ast\, p_\text{ref}^2 A^2} \cdot \frac{\theta - \theta^2}{1 + \xi}
$$

The pressure peaks at $\theta_M = (k-1)/(2k)$. Past burnout the gas expands without further burning:

$$
v = \sqrt{\frac{2 m_c Q}{m^\ast}\left(1 - \frac{1}{(1 - \theta_B)(1 + \xi)^{k-1}}\right)}
$$

## Numbers

All accept rules under Method pass. The test asserts the limits, not the size of the differences. The case has $\theta_B$ above $0.23/2.46$, so the peak lies before burnout and burnout lies inside the barrel.

## Result

No change. The integrator, the ignition start and the event location agree with the exact solution to the limits above, and the deviation shrinks with the ignition pressure as the ignition-gas argument predicts.

## Data basis

Analytic: a closed form compared with the model on a synthetic case, no measured data.

## Where in the app

- `packages/core/src/interior/model.ts`, `interior`.
- `packages/core/test/interior-model.test.ts`, the tests "peak pressure, its travel, burnout travel and muzzle velocity", "velocity and pressure along the barrel, offset by the ignition gas near the start" and "deviation from the closed form falls with the ignition pressure".
- Model page: [M3 interior model](../models/interior-m3.md).

## Confidence

High for the integration and the energy balance on this case. The closed form needs a constant surface, exponent 1 and no resistance, so it does not test grain forms, pressure exponents other than 1, bore resistance, rotation or heat loss. A Sébert factor other than 0.5 is not compared.
