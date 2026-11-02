---
title: Bore resistance in proportion to pressure and start pressure by bearing length
description: Whether a resistance term proportional to the gas pressure, or a start pressure in proportion to the bearing length, lowers the held-out velocity error of M3, and how much doubled engraving and friction move a 76 mm proxy.
---

# Bore resistance in proportion to pressure and start pressure by bearing length

## Question

Interior ballistics, bore resistance of M3: does a resistance pressure in proportion to the gas pressure (variant 1), or a start pressure in proportion to the bearing length (variant 2), lower the held-out muzzle velocity error against the present law, and how much do doubled engraving and friction resistance change peak pressure and velocity?

## Method

Rows: load rows that are not in the repository, evaluated with `ballistics verify` and `ballistics compare` ([CLI page](../cli.md)) on the split of `splitOf`: everything fitted or chosen on the training split, the validation split only predicted, the test split not run. Each row has a stand-in bullet record of the cartridge's $G_1$ and the printed mass, with a length from a log-linear model of length on mass and diameter over bullet records with a length. So the bearing length $L$ is that modelled length, all stand-ins have one construction, and every row runs at the 30 MPa start pressure that `powderModelValues` gives when a powder record states none. Barrel: the row's, else the median printed barrel of the cartridge, else 610 mm or 120 mm by case length.

- Variant 1: grid $c_p$ = 0, 0.025, 0.05, 0.075, 0.1, 0.125, 0.15, with friction stress, oversize coefficient, engraving fraction and the energy constants held at the record values. The $c_p$ with the lowest training median velocity error is chosen and only that one decides on validation.
- Variant 2: $p_\text{st} L / L_\text{ref}$ with $L_\text{ref}$ the mean bearing length of the used training rows (23.8 mm). Nothing fitted. The median per bearing-length tercile uses the limits of the training rows (18.5 and 29.1 mm) on both splits.
- Accept rule, fixed before any run: on validation the median velocity error falls by at least 0.1 percentage points, the P90 does not rise, the training median falls too, and no more rows are refused. Otherwise the simpler form stays. The mean signed peak-pressure error (model minus printed over printed) is reported and does not decide.
- $c_p = 0$ reproduced the baseline exactly (every change 0, the same used rows).

The doubling table runs a synthetic 76 mm proxy: bore 76.2 mm, travel 40 calibres, shot 6.2 kg, chamber 2.2 L, charge 1.6 kg and 75 % of it, a tubular grain of 6 by 1.5 by 150 mm, specific energy 3.6 MJ/kg, $k = 1.24$. The burn coefficient $10^{-9}$ m s⁻¹ Pa⁻¹ was set so that the full charge peaks near 300 MPa and burns out in the bore. The resistance values are guesses, not measurements: start pressure 25 MPa, an engraving ramp from 40 MPa to 0 over 25 mm, friction pressure 8 MPa. "Engraving doubled" doubles the ramp. Doubling the start pressure as well gives the same figures: the ramp at travel 0 plus the friction (48 MPa) already holds the shot longer. The code is in `spikes/360/` of the branch `spike/360-bore-friction` (never merged).

## Formulas

The present law is the one of the [M3 page](../models/interior-m3.md#bore-resistance): the resistance force $F_r(x) = A (p_f + p_e(x))$, with the friction pressure $p_f$ from the friction stress on the bullet side area and an engraving ramp $p_e$ over the bearing length.

Variant 1 adds a term in proportion to the space-mean gas pressure $\bar p$, wherever $F_r$ enters (the force on the bullet, the work against resistance, the base and breech pressure, the shot start):

$$
F_r(x, \bar p) = A \left(p_f + p_e(x) + c_p\, \bar p\right)
$$

The mean pressure, not the base pressure, because the base pressure itself depends on $F_r$.

Variant 2 scales the start pressure:

$$
p_\text{st}' = p_\text{st}\, \frac{L}{L_\text{ref}}
$$

## Numbers

Velocity and pressure errors are medians and P90s of the absolute relative error in percent, changes in percentage points (candidate minus baseline). Used rows: 14 457 training, 10 497 validation, 4 060 of them with a printed pressure.

Baseline: training median 3.14 %, P90 9.07 %, mean signed pressure error −0.9 %. Validation median 3.32 %, P90 8.87 %, mean signed pressure error −6.1 %.

Variant 1 on the training split:

| $c_p$ | Median, % | P90, % | Mean signed pressure error, % |
| --- | --- | --- | --- |
| 0 | 3.14 | 9.07 | −0.9 |
| 0.025 | 3.25 | 9.11 | +1.7 |
| 0.05 | 3.45 | 9.37 | +4.5 |
| 0.075 | 3.82 | 9.84 | +7.5 |
| 0.1 | 4.30 | 10.47 | +10.7 |
| 0.125 | 4.91 | 11.27 | +14.1 |
| 0.15 | 5.65 | 12.13 | +17.8 |

With the record constants held, the training median rises monotonically, by 2.50 percentage points over the grid (P90 by 3.06), so $c_p = 0$ is chosen and the validation change is 0. For information only (not part of the rule), $c_p$ = 0.025 on validation: median +0.16, P90 +0.08 percentage points, the same used rows.

Variant 2, change against the baseline:

| Split | Median | P90 | Pressure median | Mean signed pressure error | Used rows |
| --- | --- | --- | --- | --- | --- |
| Training | +0.13 | +0.58 | +0.93 | −0.9 % to −3.9 % | 14 457, unchanged |
| Validation | +0.04 | +0.67 | +1.22 | −6.1 % to −7.3 % | 10 497, unchanged |

Velocity median per bearing-length tercile, baseline to variant 2, in percent:

| Tercile | Training rows | Training | Validation rows | Validation |
| --- | --- | --- | --- | --- |
| Up to 18.5 mm | 4 885 | 4.36 to 4.90 | 2 645 | 5.10 to 5.59 |
| 18.5 to 29.1 mm | 4 787 | 3.11 to 3.04 | 4 275 | 3.15 to 3.09 |
| Above 29.1 mm | 4 785 | 2.40 to 2.48 | 3 577 | 2.73 to 2.80 |

Short bullets carry the largest error, and a lower start pressure for them makes it larger.

Doubling on the 76 mm proxy (simulations of guessed values):

| Charge | Case | Peak breech pressure | Muzzle velocity |
| --- | --- | --- | --- |
| 1.6 kg | present | 312 MPa | 761 m/s |
| 1.6 kg | engraving doubled | +30.5 % | +47 m/s |
| 1.6 kg | friction doubled | +8.2 % | −4 m/s |
| 1.6 kg | both doubled | +38.0 % | +36 m/s |
| 1.2 kg | present | 178 MPa | 584 m/s |
| 1.2 kg | engraving doubled | +39.0 % | +68 m/s |
| 1.2 kg | friction doubled | +10.1 % | −2 m/s |
| 1.2 kg | both doubled | +48.2 % | +56 m/s |
| Full charge | measured, doubled resistance, the term not stated (as quoted in the question, unverified) | about +10 % | about +6 m/s |
| Reduced charge | the same | | about +30 m/s |

A doubled engraving ramp (and both terms) raises the velocity, more at the reduced charge, as the quoted measurements do, but several times as much; doubled friction lowers it slightly. With a burn coefficient twice as large (full-charge peak 1179 MPa) the engraving changes shrink to +14.7 % and +10 m/s at full charge and +21.0 % and +11 m/s at the reduced charge, so the size depends strongly on the guessed proxy.

## Result

Worse. Neither variant passes the rule; the present law stays. Variant 1 was tried for $c_p$ from 0 to 0.15: every tried value above 0 raises the training error, so the rule chooses $c_p = 0$. Variant 2 raises the validation median by 0.04 and the P90 by 0.67 percentage points.

## Data basis

Measured: load rows that are not in the repository, aggregates only. The 76 mm table is analytic (a synthetic proxy with guessed resistance values).

## Where in the app

- `packages/core/src/interior/model.ts` (`gasState`, `resistance`)
- `packages/core/src/interior/bore-resistance.ts`
- `packages/core/src/interior/start-pressure.ts`
- `packages/core/src/interior/record-load.ts`
- `packages/cli/src/evaluate.ts`
- [M3 interior model](../models/interior-m3.md#bore-resistance)

## Confidence

Medium for variant 1, low for variant 2: $c_p$ was tested with the record constants held, not refitted jointly, and variant 2 tested only $L / L_\text{ref}$ with a modelled length, one construction and one start pressure, so a negative result for the bearing-length scaling is weak evidence.
