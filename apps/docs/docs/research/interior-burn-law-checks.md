---
title: Burn law checks
description: Pressure exponent, closed-vessel vivacity against the dynamic vivacity, an offset burn law and coated grains, checked against the vivacity burn law of the M3 interior model.
---

# Burn law checks

## Question

Interior ballistics, burn law: should the exponent stay at 1, does the dynamic vivacity equal the quantity read from a closed-vessel curve, is an offset law worth adding at low pressure, and does a shell-and-core factor describe coated and ball powders better than the two-stage form?

## Method

Four checks, accept rules fixed before the work:

1. Exponent: on closed-vessel curves of one powder at four or more loading densities, the coefficient of variation of $\int \bar p^n\, dt$ for $n$ = 0.67, 0.8 and 1.0. A different $n$ is adopted only if its spread is clearly below that of $n = 1$.
2. Definition: a conversion from $L_d(z)$ to the closed-vessel quantity $L$ must equal $\dot p / (\bar p\, p_\text{max})$ computed from a central difference of the Noble-Abel closed-vessel pressure, to $10^{-6}$ relative, for the demo powder at $D$ = 0.1, 0.2 and 0.3 and $z$ from 0.05 to 0.95 (both sides of the form's break at 0.8). If the factor between the two stays within 15 percent, the definition is only stated.
3. Offset law: a low-charge velocity ladder fitted with the power law and with a rate proportional to $\bar p - P_1$; the offset law is kept only if $\chi^2$ falls by more than one added parameter is worth.
4. Coated grains: a shell-and-core factor is kept only if it lowers the rms velocity residual of coated powders against the two-stage form with no more free parameters.

## Formulas

With the projectile held, the Noble-Abel energy balance gives the mean pressure from the burnt fraction ([closed vessel against closed forms](interior-closed-vessel-closed-forms.md)). With the normalised charge density $D = m_c / (V_c \rho_s)$ it reads

$$
\bar p(z) = \frac{\Phi z}{1 + \chi z}, \qquad \Phi = \frac{(k - 1) Q \rho_s D}{1 - D}, \qquad \chi = \frac{(1 - \eta \rho_s) D}{1 - D}
$$

Differentiating in time and dividing by $\bar p$ and $p_\text{max} = \bar p(1)$ gives the quantity of a measured curve in terms of the dynamic vivacity $L_d = \dot z / \bar p$ of the [burn forms page](../models/interior-burn-forms.md):

$$
L = \frac{\dot p}{\bar p\, p_\text{max}} = L_d\, \frac{1 + \chi}{(1 + \chi z)^2}
$$

For a burn law $\dot z = B \varphi(z)\, \bar p^n$ with a fixed form function, the integral over the time in which the burnt fraction rises from $z_a$ to $z_b$ is $\int \bar p^n\, dt = \int_{z_a}^{z_b} dz / (B \varphi(z))$, which does not depend on the loading density. A closed vessel ignites at a burnt fraction $z_0 \gt 0$, set by the igniter pressure, which changes with the loading density through $\bar p(z)$. The comparison therefore takes a common range with $z_a$ above the $z_0$ of every curve, not the whole burn from ignition ([Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 106, for the dynamic vivacity; the integral follows from the burn law of the [burn forms page](../models/interior-burn-forms.md)).

## Numbers

1. Exponent: no closed-vessel curve is in the records (0 curves; the firing records hold muzzle velocities and peak pressures only). Not measured.
2. Definition: the conversion matches the numerical derivative to better than $10^{-6}$ relative at all three loading densities. The factor $(1 + \chi)/(1 + \chi z)^2$ for the demo powder ($\eta = 0.97 \cdot 10^{-3}$ m³/kg, $\rho_s = 1600$ kg/m³):

| $D$ | $\chi$ | $z = 0$ | $z = 0.1$ | $z = 0.9$ | $z = 1$ |
| --- | --- | --- | --- | --- | --- |
| 0.1 | −0.061 | 0.94 | 0.95 | 1.05 | 1.07 |
| 0.2 | −0.138 | 0.86 | 0.89 | 1.12 | 1.16 |
| 0.3 | −0.237 | 0.76 | 0.80 | 1.23 | 1.31 |
| 0.5 | −0.552 | 0.45 | 0.50 | 1.77 | 2.23 |

The factor stays within 15 percent only at $D \le 0.1$ over the whole burn, and up to about $D = 0.2$ over $z$ = 0.1 to 0.9, the range of $\bar L_d$. Cartridge loading densities are near 0.5.

3. Offset law: the velocity data holds no low-charge ladder of one powder in one rifle; load tables give a start and a maximum charge per load only. Not measured.
4. Coated grains: the powder records hold no coating, only the grain form (`ball` among them). Not measured.

## Result

No change. Item 2 is documented as a limit: the factor exceeds 15 percent, so the burn forms page states that every vivacity of the model is $L_d$ and gives the conversion to the closed-vessel quantity. A conversion helper with its test is kept on a spike branch and is not adopted until a closed-vessel vivacity is read from a source. Items 1, 3 and 4 are documented as limits by the issue's fallback: $n = 1$ is kept, the fitted start pressure plays the role of the offset, and the two-stage parameter $a$ remains the only proxy for a coating.

## Data basis

Analytic: the Noble-Abel closed-vessel pressure and the demo powder. Items 1, 3 and 4 count the records searched; no measured curve or ladder.

## Where in the app

- `packages/core/src/interior/vivacity.ts`, `dynamicVivacity`, `meanDynamicVivacity`.
- `packages/core/src/interior/form.ts`, the two-stage form.
- `packages/core/src/interior/fit.ts`, the start pressure of the powder fit.
- Model pages: [burn laws and form functions](../models/interior-burn-forms.md), [powder fit](../models/interior-powder-fit.md).

## Confidence

High for item 2: the conversion is exact algebra checked numerically. Low for items 1, 3 and 4: not measured; the fallbacks rest on missing data.
