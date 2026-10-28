---
title: Interior model against exact solution, scaling and sensitivities
description: Whether the interior model reproduces an exact solution with covolume and shot-start pressure, scales geometrically, follows the chamber-volume and barrel-length relation, and responds to its inputs as a gun-class load does.
---

# Interior model against exact solution, scaling and sensitivities

## Question

Interior model: does `interior` agree with the exact solution of the constant-surface case that includes a covolume other than 1/density and a shot-start pressure, stay invariant under geometric scaling without a heat model, keep the first-order relation between chamber volume and barrel length, and show velocity elasticities of the size of a gun-class load?

## Method

Four checks in `packages/core/test/interior-exact.test.ts`, with the accept rules set before the run:

1. The exact solution below, integrated with a fixed-step Runge-Kutta rule (4000 steps, changing by less than $10^{-12}$ at 8000), against peak mean pressure, burnout travel and muzzle velocity of `interior`, for covolume 0, 1.0 and 1.2 $\cdot 10^{-3}$ m³/kg and start pressure 25 and 40 MPa (ignition pressure 1 MPa). Accept: relative difference below $10^{-8}$.
2. A rifle load with a seven-perforation grain, engraving and friction resistance, twist and a start pressure, scaled by $s$ = 0.5, 2 and 5, heat model off. Accept: peak pressure and muzzle velocity within $10^{-6}$ relative to $s = 1$, barrel time within $10^{-6}$ of $s$ times the $s = 1$ value.
3. Central differences ($\pm$ 0.5 %) of the muzzle velocity against chamber volume and against barrel length for the fixture load and a second rifle load. Accept: the slope against volume within 5 % of the relation below.
4. Central differences ($\pm$ 0.5 %) of the muzzle velocity against shell mass, charge, chamber volume and shot travel of a load of 203 mm bore defined in the test (90 kg shell, 10 kg charge, seven-perforation grain, 238 MPa peak, 525 m/s). Accept: each within 0.1 of the typical value, which has no citable source here ("typical, source unverified"): $-0.4$, $+0.6$ to $0.7$, $-0.25$, $+0.2$. The pressure responses are reported, not asserted.

Each check can fail: the reference of check 1 with covolume 1/density differs by far more than $10^{-6}$ (a permanent test), and the heat model on moves the result of check 2 by more than $10^{-3}$ (a permanent test).

## Formulas

For a constant burning surface, a linear burn law $dz/dt = B\bar p$, a Noble-Abel gas, no bore resistance and the uniform-density gas column (effective mass $m_e = m_p + m_c/3$), the energy balance of the [M3 page](../models/interior-m3.md) gives, from shot start at the burnt fraction $z_0$ and with $u = z - z_0$, the velocity $v = A u/(m_e B)$. The burnt fraction at shot start follows from the start pressure $p_s$ in the closed chamber, the ignition formula with $p_s$ in place of $p_i$. The pressure is $\bar p = (k-1)N(u)/V$ with $N(u) = m_c Q (z_0 + u) - c u^2$ and $c = A^2/(2 m_e B^2)$, and the gas volume obeys a linear equation in $u$:

$$
\frac{dV}{du} = c_0 + \frac{2c}{k-1}\,\frac{u}{N}\,V, \qquad c_0 = m_c\left(\frac{1}{\rho_s} - \eta\right)
$$

The travel follows from $V$ by the free-volume equation. After burnout the gas energy $N$ falls as $V^{-(k-1)}$, which gives the muzzle velocity. The solution is derived from the energy balance and the reduced variable of the constant-surface case ([Rheinmetall 1977](../bibliography.md#rheinmetall-1977), pp. 88 to 94, for the case with $\eta = 1/\rho_s$).

In that case the velocity depends on the travel only through $A x/V^*$ with $V^* = V_c - m_c/\rho_s$. To first order an added chamber volume $\Delta V$ then acts like a shorter barrel by $L\,\Delta V/V^*$:

$$
\frac{\partial v}{\partial V_c} = -\frac{L}{V^*}\,\frac{\partial v}{\partial L}
$$

Geometric scaling: with pressures, energies and densities kept, the dimensionless equations of the model do not change, so pressure and velocity against travel in calibres are the same and times scale with $s$. The heat-transfer coefficient depends on size, so the heat model breaks this.

## Numbers

Check 1, relative difference of `interior` from the exact solution (peak mean pressure, burnout travel, muzzle velocity):

| covolume (m³/kg) | start pressure (MPa) | peak | burnout travel | velocity |
| --- | --- | --- | --- | --- |
| 0 | 25 | $1.9 \cdot 10^{-14}$ | $3.4 \cdot 10^{-13}$ | $9.7 \cdot 10^{-14}$ |
| 0.0010 | 25 | $5.1 \cdot 10^{-14}$ | $5.5 \cdot 10^{-13}$ | $1.2 \cdot 10^{-13}$ |
| 0.0012 | 25 | $6.5 \cdot 10^{-14}$ | $6.0 \cdot 10^{-13}$ | $1.3 \cdot 10^{-13}$ |
| 0 | 40 | $1.0 \cdot 10^{-14}$ | $8.5 \cdot 10^{-14}$ | $2.2 \cdot 10^{-14}$ |
| 0.0010 | 40 | $2.4 \cdot 10^{-14}$ | $1.4 \cdot 10^{-13}$ | $2.6 \cdot 10^{-14}$ |
| 0.0012 | 40 | $3.2 \cdot 10^{-14}$ | $1.6 \cdot 10^{-13}$ | $3.1 \cdot 10^{-14}$ |

The mutation (covolume 1/density in the reference, covolume 0.0012 and 40 MPa in the model) gives a difference of 0.28 in peak pressure and 0.077 in velocity.

Check 2, difference from $s = 1$ (peak pressure 279 MPa, velocity 799 m/s): $0$ for peak pressure, velocity and barrel time at $s$ = 0.5 and 2, and $9.7 \cdot 10^{-9}$, $2.4 \cdot 10^{-9}$ and $2.1 \cdot 10^{-9}$ at $s = 5$. With the convective heat model (flame temperature 2800 K, factor 1) the change against $s = 1$ is:

| $s$ | peak pressure | muzzle velocity |
| --- | --- | --- |
| 0.5 | $-0.35$ % | $-0.64$ % |
| 2 | $+0.31$ % | $+0.56$ % |
| 5 | $+0.66$ % | $+1.20$ % |

A factor 0.5 on the heat flux halves these changes (0.17 to 0.34 % and 0.31 to 0.60 %). The flame temperature changes them little (2200 K: 0.64 % and 1.14 % at $s = 5$).

Check 3, slope of the velocity against chamber volume against the relation (volume 3.4 $\cdot 10^{-6}$ m³ fixture load: $-1.0681 \cdot 10^{8}$ against $-1.0765 \cdot 10^{8}$ m/s per m³, difference 0.78 %; second rifle load: $-9.027 \cdot 10^{7}$ against $-9.111 \cdot 10^{7}$, difference 0.92 %).

Check 4, elasticities (change in percent per percent):

| input | velocity | peak mean pressure |
| --- | --- | --- |
| shell mass | $-0.38$ | $+0.92$ |
| charge | $+0.68$ | $+2.40$ |
| chamber volume | $-0.27$ | $-1.41$ |
| shot travel | $+0.18$ | $0$ |

The four tests run in about 0.3 s together.

## Result

No change. `interior` reproduces the exact solution to about $10^{-13}$ for every covolume and start pressure tried, scales exactly, and satisfies the volume and length relation within 1 %. No defective term was found. The heat model is documented as the only size-dependent term in the Limits of the [M3 page](../models/interior-m3.md). The velocity elasticities agree with the typical figures within 0.1. The pressure responses to mass (0.92 against about 0.6), charge (2.4 against 1.6 to 1.8) and volume ($-1.41$ against about $-1.1$) differ from the typical figures and are not asserted.

## Data basis

Analytic: an exact solution, a scaling law and a derived relation compared with the model. The elasticity values are typical figures of unverified source, compared with a proxy load defined in the test.

## Where in the app

- `packages/core/src/interior/model.ts`, `interior`.
- `packages/core/test/interior-exact.test.ts`.
- Model page: [M3 interior model](../models/interior-m3.md).

## Confidence

High for the exact solution, the scaling and the volume relation (analytic, differences at rounding level or below 1 %); low for the elasticities, because the typical figures have no citable source and depend on the load.
