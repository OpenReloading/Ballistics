---
title: Interior model against a published worked example
description: Whether the M3 interior model reproduces the printed values of a worked gun example from a handbook, a check on the closed form and the reading of its inputs.
---

# Interior model against a published worked example

## Question

Interior ballistics: does the [M3 model](../models/interior-m3.md) reproduce the intermediate and final values that a handbook prints for a worked example of a constant-surface gun, when the same inputs are entered?

## Method

The example's inputs were entered as printed on its first sheet: chamber volume $5.515 \cdot 10^{-5}$ m³, projectile 0.12 kg, charge 0.0505 kg, specific energy $3.517 \cdot 10^{6}$ J/kg, $k = 1.3$, solid density 1600 kg/m³, vivacity 0.262, Sébert factor 0.5, travel 1.7275 m, ignition pressure $10^{3}$ Pa. The bore area is the circle of a 20 mm bore plus 15 grooves of 2.5 mm by 0.425 mm. The printed values of sheets 1 to 3 were compared with the closed form (see the [constant-surface entry](interior-constant-surface-closed-form.md)) and with the numerical run. The accept limit, set in the test before the comparison: relative difference below $10^{-3}$, and below $2 \cdot 10^{-3}$ for the burnout travel.

## Formulas

Those of the [constant-surface entry](interior-constant-surface-closed-form.md): the scaled muzzle travel $\xi_e = A x_e / V^\ast$, the burnout state $\theta_B$, the factor $1/(1 - \theta_B)$ and the pressure and velocity of the closed form. The source is [the 1977 weapons handbook](../bibliography.md#rheinmetall-1977), section 2.1.5.5, p. 95 and sheets 1 to 3 (sheet 1 is printed on p. 98).

## Numbers

| Quantity | Printed value | Compared with | Accept limit (relative) |
| --- | --- | --- | --- |
| $\xi_e$ | 24.17 | closed form | $10^{-3}$ |
| $\theta_B$ | 0.2958 | closed form | $10^{-3}$ |
| $1/(1 - \theta_B)$ | 1.42 | closed form | $10^{-3}$ |
| peak pressure | 3442 bar | numerical run | $10^{-3}$ |
| muzzle velocity | 1061 m/s | numerical run | $10^{-3}$ |
| velocity at burnout | 850.4 m/s | numerical run | $10^{-3}$ |
| travel at burnout | 0.6689 m | numerical run | $2 \cdot 10^{-3}$ |

The printed values are the handbook's rounded ones, so the limit is the rounding of the print, not a measure of the model's accuracy.

## Result

No change. Every printed value lies within its limit, which confirms the reading of the inputs (including the bore area with grooves) and the formulas. Nothing was changed in the model.

## Data basis

Public: values printed in a handbook worked example. This page does not re-read the handbook; the values are those held by the test, unverified here.

## Where in the app

- `packages/core/src/interior/model.ts`, `interior`.
- `packages/core/test/interior-model.test.ts`, the test "reproduces the values of sheets 1 to 3".
- Model page: [M3 interior model](../models/interior-m3.md).

## Confidence

Medium: seven values agree, but they come from one example with a constant surface and no resistance, and they are rounded to three or four digits. A match does not show the handbook itself to be right.
