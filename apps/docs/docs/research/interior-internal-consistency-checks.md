---
title: Interior model internal consistency checks
description: What the energy, isentrope, pressure-gradient and tolerance tests of the interior model show, and what they cannot show.
---

# Interior model internal consistency checks

## Question

Interior ballistics: does the [M3 model](../models/interior-m3.md) keep its own balances, and do its results depend on the integrator tolerances?

## Method

Four checks on synthetic loads, with the limit of each fixed in the test:

- Energy: with every part switched on (Lagrange gradient, rotation, bore resistance, convective heat loss, seven-perforated grain, shot start), the energy terms of the muzzle state add up to $m_c Q z$ within a relative $10^{-12}$, and the resistance work equals the area under the resistance force over the travel within $10^{-6}$.
- Isentrope: without heat loss, after burnout, $\bar p\, V_f^{\,k}$ is constant over more than 100 curve points within $10^{-12}$.
- Gradient: without resistance, the ratios of breech and of mean pressure to base pressure follow the Lagrange formulas within $10^{-12}$, and with resistance the base and breech pressures follow the equation of motion and the gradient within $10^{-9}$.
- Tolerances: halving the relative and absolute tolerances and the output step changes peak breech pressure, muzzle velocity and barrel time by less than $10^{-7}$.

## Formulas

After burnout the gas expands without heat input and the Noble-Abel state gives an adiabat. With the free volume $V_f = V_c + A x - \eta\, m_c$ (here $V_c = 3.4 \cdot 10^{-6}$ m³, $A = 3.75 \cdot 10^{-5}$ m², $\eta\, m_c = 10^{-3} \cdot 0.0028$ m³, $k = 1.23$):

$$
\bar p\, V_f^{\,k} = \text{constant}
$$

Without resistance, with the Lagrange coefficients $\delta = 1/3$ and $\varepsilon = 1/2$ and the projectile mass with rotation $m_p'$:

$$
\frac{p_\text{br}}{p_b} = 1 + \frac{m_c}{2 m_p'}, \qquad \frac{\bar p}{p_b} = 1 + \frac{m_c}{3 m_p'}
$$

The resistance work for the test load is $A\,(p_f x_e + \text{area under the engraving profile})$ with friction $4 \cdot 10^{6}$ Pa over 0.6 m and a profile that rises from 0 at 1 mm to $50 \cdot 10^{6}$ Pa at 3 mm and falls to $10 \cdot 10^{6}$ Pa at 8 mm. See the [M3 interior model](../models/interior-m3.md) for the gradient and the energy balance.

## Numbers

All checks pass within the limits above. The test notes that the first check holds by construction: the gas energy is defined by the same expression as the pressure, so the sum cannot differ. The same holds for the gradient ratios, which follow from the formulas the code evaluates.

## Result

No change. The checks guard against a coding slip in the balances and the gradient, and show that the integrator settings are not what limits the results at the stated precision. The model stays as it is.

## Data basis

Analytic: identities of the model compared with its own output, no measured data.

## Where in the app

- `packages/core/src/interior/model.ts`, `interior`.
- `packages/core/test/interior-model.test.ts`, the tests "energy terms add up to m_c Q z; resistance work equals its integral over travel", "p V_f^k is constant after burnout without heat loss (Noble-Abel isentrope)", "Lagrange pressure ratios without resistance", "base and breech pressure with bore resistance" and "halving the tolerances and the output step changes the results below 1e-7".
- Model page: [M3 interior model](../models/interior-m3.md).

## Confidence

High that the code matches the equations of the page. None of the checks compares the model with a measurement or an independent solution, so they say nothing on whether the equations are right for a real load.
