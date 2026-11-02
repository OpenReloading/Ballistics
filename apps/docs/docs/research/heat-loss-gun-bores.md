---
title: Convective heat loss against published gun figures
description: Whether the default convective heat-loss model reproduces the heat lost to the bore that detailed boundary-layer calculations give for a 203 mm gun at four charges.
---

# Convective heat loss against published gun figures

## Question

Interior ballistics, convective heat loss: with its default settings, does `heat: { model: 'convective' }` lose about as much heat to the bore as detailed boundary-layer and wall-conduction calculations give for a 203 mm gun at four charges, and does it fall with the charge to shot ratio as they do?

## Method

The reference figures come from the question text and are unverified (the source report was not found): plausibility targets only. They are heat lost up to shot exit of 3.40, 4.22, 4.64 and 4.99 MJ at the charges 13.6, 20.3, 25.1 and 29.5 kg of a 203 mm gun (6.9, 5.7, 5.2 and 4.7 percent of the energy released), and a range of 4.6 to 8.1 percent over guns of 40 to 203 mm. The same figures put the loss at roughly the square root of the charge to shot ratio.

The proxies are synthetic loads: every number below is a simulation, not load data.

Inputs of the four 203 mm proxies, identical except for the charge:

| Input | Value |
| --- | --- |
| Bore diameter, bore area | 0.203 m, $\pi/4 \cdot 0.203^2$ m² |
| Travel | 43 calibres (8.729 m), no twist |
| Shot mass | 119.5 kg |
| Chamber volume | 0.06 m³ for every charge |
| Charge | 13.6, 20.3, 25.1 and 29.5 kg (charge to shot ratio 0.114, 0.170, 0.210, 0.247) |
| Propellant | specific energy $3.6\cdot10^{6}$ J/kg, $k = 1.24$, solid density 1600 kg/m³, covolume $10^{-3}$ m³/kg, propellant temperature 294.15 K |
| Burn law | geometric, exponent 1, single-perforation cord (`tube`): diameter 12 mm, perforation 3 mm, length 300 mm |
| Ignition pressure, start pressure | 1 MPa, 20 MPa |
| Heat | convective, flame temperature 2800 K, every other field at `convectiveDefaults` (wall 300 K, viscosity $6\cdot10^{-5}$ Pa s, Prandtl number 0.69), factor 1 |

The specific energy follows from the reference: its losses divided by its percentages give 3.6 MJ/kg at every charge. The burn coefficient is the one free input. It was set after a scan of three values on a physical criterion, not on the heat: the highest charge peaks near the usual order of a 203 mm gun (342 MPa breech pressure) and every charge burns out inside the barrel (burnout travel 1.2 to 5.0 m). That gives $1.4\cdot10^{-9}$ m s⁻¹ Pa⁻¹; the other two values are reported as a sensitivity.

Accept rule, decided before the run: informational pass when the ratio of modelled to reference heat in MJ is 0.8 to 1.25 at all four charges. If a ratio fell outside, the next step was a semi-infinite wall conduction estimate of the surface temperature rise under the computed flux. No default and no `factor` is changed from this entry.

A rifle-like proxy is the load of the `interior` tests (`m3Load`: chamber $3.4\cdot10^{-6}$ m³, bore 6.9 mm, bullet 9.5 g, charge 2.8 g, specific energy $3.9\cdot10^{6}$ J/kg, $k = 1.23$, constant-surface vivacity 0.56 s⁻¹, flame temperature 2900 K, otherwise the defaults) with its barrel length set to 43, 87 and 130 calibres.

Script: the vitest file `packages/core/test/interior-heat-leak-checks.test.ts` on the unmerged branch `research/heat-loss-and-leak-checks`, run from `packages/core` with `npx vitest run test/interior-heat-leak-checks.test.ts --silent=false`.

## Formulas

The heat model is the one of the [leakage and heat loss page](../models/interior-leakage-heat.md): heat flux to the bore from a turbulent pipe-flow correlation of Dittus-Boelter form, with the mean gas speed $v/2$, a bore-diameter cylinder of the chamber volume and a wall held at $T_w$ (after [Corner 1950](../bibliography.md#corner-1950), pp. 410 to 425).

$$
\dot q = c_h\, h\, \pi d \left(x + \frac{V_c}{A}\right) (T - T_w), \qquad E_h = \int \dot q\, dt
$$

The share of the energy released is $E_h / (m_c Q)$ with the charge $m_c$ and its specific energy $Q$. The scaling exponent is the slope of $\ln E_h$ over $\ln (m_c / m_p)$ for the four charges, with the shot mass $m_p$.

## Numbers

Proxy of the verdict (coefficient $1.4\cdot10^{-9}$):

| Charge, kg | Peak breech pressure, MPa | Muzzle velocity, m/s | Model heat, MJ | Reference, MJ | Ratio | Model share, % | Reference share, % |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 13.6 | 68 | 458 | 2.78 | 3.40 | 0.82 | 5.68 | 6.9 |
| 20.3 | 139 | 598 | 3.72 | 4.22 | 0.88 | 5.09 | 5.7 |
| 25.1 | 224 | 689 | 4.24 | 4.64 | 0.91 | 4.70 | 5.2 |
| 29.5 | 342 | 769 | 4.63 | 4.99 | 0.93 | 4.36 | 4.7 |

Heat grows with the charge to shot ratio to the power 0.66, the reference to the power 0.50, so the model's share falls less: 5.68 to 4.36 percent against 6.9 to 4.7 percent.

Sensitivity to the burn coefficient of the cord (same loads):

| Coefficient, m s⁻¹ Pa⁻¹ | Peak breech pressure, MPa | Ratios at 13.6, 20.3, 25.1, 29.5 kg | Exponent |
| --- | --- | --- | --- |
| $1.0\cdot10^{-9}$ | 45 to 174 | 0.61, 0.77, 0.90, 0.95 | 1.08 |
| $1.4\cdot10^{-9}$ | 68 to 342 | 0.82, 0.88, 0.91, 0.93 | 0.66 |
| $2.0\cdot10^{-9}$ | 116 to 553 | 0.83, 0.86, 0.88, 0.89 | 0.59 |

At $10^{-9}$ the two lowest charges do not burn out in the barrel and the lowest two ratios fall below 0.8. At $2\cdot10^{-9}$ all ratios are inside the band, but the peak pressures are far above the order of a 203 mm gun.

Rifle-like proxy:

| Travel, calibres | Muzzle velocity, m/s | Heat, J | Share of the charge energy, % |
| --- | --- | --- | --- |
| 43 | 677 | 801 | 7.3 |
| 87 | 807 | 1595 | 14.6 |
| 130 | 861 | 2222 | 20.3 |

The heat per calibre of travel is 18.6, 18.3 and 17.1 J: the loss grows a little less than in proportion to the travel (the reference says about in proportion). No reference was found for these shares of one synthetic load.

## Result

No change. At the verdict proxy all four ratios are 0.82 to 0.93, inside the 0.8 to 1.25 rule, so the wall-temperature step was not run. The agreement depends on the synthetic powder: a slow cord ($10^{-9}$) breaks the lower limit at the two smaller charges. The model sits below the reference here (the run of another proxy quoted in the question sat 6 to 22 percent above it), so the run does not support the explanation that the constant 300 K wall overstates the driving temperature difference. The weaker fall of the share with the charge is confirmed (exponent 0.59 to 1.08 against 0.50). Documented as a limit.

The check covers gun-size bores only: no reference was found for rifle bores (Limits of the [leakage and heat loss page](../models/interior-leakage-heat.md)).

## Data basis

Analytic: synthetic proxy loads compared with unverified figures from the question text (no source found, none cited).

## Where in the app

- `packages/core/src/interior/model.ts`, `gasState` (`heatFlux`), `convectiveDefaults`.
- `packages/core/test/interior-model.test.ts`, the test "heat loss equals the quadrature of the convective flux over the curve".
- Model page: [leakage and heat loss](../models/interior-leakage-heat.md).

## Confidence

Low: the reference figures are unverified, the powder of the proxy is synthetic and moves the verdict at the smallest charges, and four charges of one gun fix the exponent only roughly.
