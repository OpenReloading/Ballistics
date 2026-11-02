---
title: Gas leakage against published mortar clearance figures
description: Whether the leak model reproduces the muzzle-velocity loss per 0.001 in of annular clearance that trials of smooth-bore mortars give, with discharge coefficient 0.83 and 1.
---

# Gas leakage against published mortar clearance figures

## Question

Interior ballistics, gas leakage: for a smooth-bore 81 mm mortar proxy with an annular clearance, does the leak model lose about the muzzle velocity per 0.001 in of clearance that mortar trials give, with the discharge coefficient 0.83 that those trials suggest, and does it differ from the default 1?

## Method

Reference figures, from the issue text: unverified targets for a plausibility comparison (the source report was not found). A muzzle-velocity loss of 1.5 to 1.7 ft/s (0.46 to 0.52 m/s) per 0.001 in (25 micrometres) of clearance on the diameter, reduced to 80 mm, in three independent trial series of 60 to 105 mm mortars, with no trend with the charge (five charges of the 60 mm mortar: 1.3 to 1.8 ft/s). The same data fit a loss of $c$ times the ratio of leak area to bore area with $c$ about 610 to 760 m/s, and the leak flowing at about 0.83 of the ideal orifice value.

Every number below is a simulation of synthetic proxy loads, not load data. Inputs of the 81 mm mortar proxy:

| Input | Value |
| --- | --- |
| Bore diameter, bore area | 0.081 m, $\pi/4 \cdot 0.081^2$ m² |
| Travel | 1.2 m, no twist |
| Bomb mass | 3.3 kg |
| Chamber volume | $1.5\cdot10^{-3}$ m³ |
| Propellant | specific energy $3.6\cdot10^{6}$ J/kg, $k = 1.24$, solid density 1600 kg/m³, covolume $10^{-3}$ m³/kg, propellant temperature 294.15 K |
| Burn law | geometric, exponent 1, `tube` grain: diameter 4 mm, perforation 1 mm, length 6 mm |
| Ignition pressure, start pressure | 1 MPa, 1 MPa (3 MPa dominated the 100 m/s load and was dropped before the final run) |
| Burn coefficient | $10^{-8}$ m s⁻¹ Pa⁻¹ (the proxy of the verdict, named first before any run), and $3\cdot10^{-9}$ as a sensitivity |
| Heat, back pressure | none, the ICAO sea-level pressure |

For each target muzzle velocity of 100, 150, 200 and 250 m/s the charge comes from `solveCharge` on the load without a leak. The load is then run again at that charge with a leak area constant over the whole travel: bore area times $2c/d$ with the clearance $c$ of 0.001 in (25.4 micrometres), at discharge 0.83 and at discharge 1. Half the clearance is run too, to check linearity. The loss is the difference of the muzzle velocities, in ft/s, multiplied by 81/80 to reduce it to 80 mm (the loss scales with $2c/d$, so the same absolute clearance on an 81 mm bore counts for less than on 80 mm).

Accept rule: pass when, with discharge 0.83, the loss lies within 30 percent of 1.6 ft/s (1.12 to 2.08 ft/s) for every load of 100 to 250 m/s, and discharge 1 lies outside that band for at least one load. The default discharge is kept whatever the result.

Script: the vitest file `packages/core/test/interior-heat-leak-checks.test.ts` on the unmerged branch `research/heat-loss-and-leak-checks`, run from `packages/core` with `npx vitest run test/interior-heat-leak-checks.test.ts --silent=false`.

## Formulas

The leak is the quasi-steady isentropic orifice flow of the [leakage and heat loss page](../models/interior-leakage-heat.md), with the flow factor $\Phi_k$ and the discharge coefficient $C_d$ on the area (after [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), pp. 42 to 43). The annulus of clearance $c$ on the diameter $d$ has the area ratio

$$
\frac{A_\ell}{A} = \frac{d^2 - (d - c)^2}{d^2} \approx \frac{2c}{d}
$$

and the loss is summarised by $\Delta v = c_\ell\, A_\ell / A$ with the coefficient $c_\ell$ in m/s, which for the reference is 610 to 760 m/s.

## Numbers

Proxy of the verdict (burn coefficient $10^{-8}$), loss per 0.001 in reduced to 80 mm:

| Muzzle velocity, m/s | Charge, kg | Peak breech pressure, MPa | Loss at 0.83, ft/s | Ratio to 1.6 ft/s | Loss at 1, ft/s | Ratio to 1.6 ft/s |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 0.022 | 4 | 1.58 | 0.99 | 1.91 | 1.19 |
| 150 | 0.040 | 8 | 1.33 | 0.83 | 1.60 | 1.00 |
| 200 | 0.065 | 18 | 1.24 | 0.78 | 1.50 | 0.94 |
| 250 | 0.096 | 35 | 1.24 | 0.77 | 1.49 | 0.93 |

Sensitivity, burn coefficient $3\cdot10^{-9}$:

| Muzzle velocity, m/s | Charge, kg | Peak breech pressure, MPa | Loss at 0.83, ft/s | Ratio to 1.6 ft/s | Loss at 1, ft/s | Ratio to 1.6 ft/s |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 0.067 | 3 | 1.68 | 1.05 | 2.02 | 1.26 |
| 150 | 0.112 | 7 | 1.75 | 1.09 | 2.11 | 1.32 |
| 200 | 0.156 | 13 | 1.78 | 1.12 | 2.15 | 1.34 |
| 250 | 0.199 | 21 | 1.80 | 1.13 | 2.17 | 1.36 |

- Linearity: half the clearance gives half the loss to within 0.1 percent in every row.
- The coefficient $c_\ell$ at discharge 0.83 is 480 m/s per ft/s of loss: 595 to 760 m/s for the verdict proxy and 806 to 864 m/s for the sensitivity, against 610 to 760 m/s for the reference.
- Dependence on the charge: with the verdict proxy the loss falls by 21 percent from the 100 to the 250 m/s load; with the sensitivity proxy it rises by 7 percent. The reference shows no trend.

## Result

No change. The first half of the rule is met: at discharge 0.83 every load is inside 1.12 to 2.08 ft/s for both proxies. The second half is not met for the proxy of the verdict: discharge 1 (1.49 to 1.91 ft/s) is inside the band at every load too, so the band does not separate the two discharges. Only the slower powder puts discharge 1 outside it (2.11 to 2.17 ft/s at 150 to 250 m/s). The expected "partly outside" of the question's own run (1.25 to 2.6 ft/s) did not occur, since the loads here give 1.24 to 1.80 ft/s at 0.83. The loss depends on the powder, through the pressure history at the leak, by about 25 percent, which is as much as the gap between the two discharges. Documented as a limit: the range found is 0.8 to 1.1 times the reference slope with discharge 0.83, and the default discharge of 1 is kept.

## Data basis

Analytic: synthetic proxy loads compared with unverified figures from the question text (source not found, none cited).

## Where in the app

- `packages/core/src/interior/model.ts`, `gasState` (`leakRates`), `leakFlowFactor`.
- `packages/core/test/interior-model.test.ts`, the test "choked blowdown of a fixed vessel follows the isentropic closed form".
- Model page: [leakage and heat loss](../models/interior-leakage-heat.md).

## Confidence

Low: the reference figures are unverified, the reference mortar loads are unknown so the band is wide, and the synthetic powder moves the result as much as the discharge coefficient does.
