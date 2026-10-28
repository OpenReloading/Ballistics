---
title: Closed vessel against closed forms
description: Whether the burn time and final pressure of the closed-vessel run match the exact results for a constant form, a pressure exponent, a temperature factor and the two and three-stage vivacity forms.
---

# Closed vessel against closed forms

## Question

Interior ballistics: does `closedVessel` (the projectile held, the charge burnt to burnout) reproduce the final pressure and the burn time that follow from integrating the burn law by hand?

## Method

A synthetic rifle chamber (volume $3.4 \cdot 10^{-6}$ m³, charge 0.0028 kg, specific energy $3.9 \cdot 10^{6}$ J/kg, $k = 1.23$, solid density 1600 kg/m³, ignition pressure $10^{6}$ Pa) was run with a vivacity of 0.56 at a reference pressure of 98066.5 Pa. The accept limits are those of the tests:

- final pressure, covolume 0, 1/1600 and $10^{-3}$ m³/kg: relative difference below $10^{-12}$;
- burn time of the constant form with exponent 1, covolume 0 and $10^{-3}$ m³/kg: below $10^{-8}$;
- burn time with pressure exponent 0.8: below $10^{-8}$;
- burn time against the propellant temperature, $+20$ K with a hot sensitivity of $2 \cdot 10^{-3}$ 1/K and $-20$ K with a cold sensitivity of $10^{-3}$ 1/K: below $10^{-9}$;
- two-stage form ($a = 1.2$, $m = 0.4$, $q = 0.3$, $z_1 = 0.45$): below $10^{-7}$, with tighter integrator tolerances because the form function has an infinite slope at $z = 1$;
- three-stage form, four parameter sets with $r$ = 0.3, 0.9, 0.99 and 0: below $10^{-8}$ ($10^{-10}$ for the last).

## Formulas

With no motion the energy balance gives the pressure from the burnt fraction $z$. The free volume is linear in $z$, so, with $a = (k-1)\, m_c Q$, $b = V_c - m_c/\rho_s$ and $c = m_c(1/\rho_s - \eta)$ ([M3 interior model](../models/interior-m3.md)):

$$
V_f = b + c z, \qquad \bar p = \frac{a z}{b + c z}
$$

The final pressure is $\bar p$ at $z = 1$. For the constant form ($\varphi = 1$) and exponent 1 the burn law of the [burn forms page](../models/interior-burn-forms.md) integrates to a burn time from the ignition fraction $z_0$:

$$
t_b = \frac{p_\text{ref}}{B_a\, a}\left(b \ln\frac{1}{z_0} + c\,(1 - z_0)\right)
$$

For exponent $n \ne 1$ with $\eta = 1/\rho_s$ (so $c = 0$) the integral is a power: $t_b = (b\, p_\text{ref}/a)^n (1 - z_0^{1-n}) / ((1-n) B_a)$. A temperature factor divides the time by $\tau_T$. The two and three-stage forms have no elementary burn time. The test integrates $1/(z \varphi(z))$ by Simpson's rule in $\ln z$ for the first stage and by a geometric series in $1 - z$ for the later ones.

## Numbers

All differences are below the limits listed under Method. The burn time at 314.15 K and at 274.15 K equals the time at 294.15 K divided by $\tau_T$, which is $e^{2 \cdot 10^{-3} \cdot 20}$ and $e^{-10^{-3} \cdot 20}$ there, to within $10^{-9}$.

## Result

No change. Both the final pressure and the burn times agree with the integrals, so the burn law, the temperature factor and the form functions are implemented as written. The default integrator tolerances leave about $5 \cdot 10^{-7}$ in the two-stage burn time, which the test removes by tightening them.

## Data basis

Analytic: closed forms and numerical quadratures compared with the model, no measured data.

## Where in the app

- `packages/core/src/interior/model.ts`, `closedVessel`.
- `packages/core/test/interior-model.test.ts`, the tests of the `closed vessel` block: "final pressure (k-1) m_c Q / (V_c - eta m_c)", "burn time against the closed form", "burn time with pressure exponent n = 0.8", "burn time scales as 1/tau_T with the propellant temperature", "burn time of the two-stage form function" and "burn time of the three-stage form".
- Model pages: [M3 interior model](../models/interior-m3.md), [burn laws and form functions](../models/interior-burn-forms.md).

## Confidence

High: the references are exact or a quadrature to a stated accuracy, and the limits are tight. The check covers a held projectile only; the coupling to the motion is covered by the [constant-surface closed form](interior-constant-surface-closed-form.md).
