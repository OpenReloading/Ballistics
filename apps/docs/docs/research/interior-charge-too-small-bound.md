---
title: Bound for a charge too small for the interior model
description: Why the model flags a peak mean pressure below 2.2 times the hold pressure, which alternatives were not taken, and the loads it was derived on.
---

# Bound for a charge too small for the interior model

## Question

Interior ballistics: below which peak pressure does the [M3 model](../models/interior-m3.md) depend too much on the hold pressure, the larger of the start pressure and the ignition pressure, for a result to be trusted as a model result?

## Method

The elasticities of the peak mean pressure and of the muzzle velocity to the hold pressure $p_h$ were taken by central differences at 5 % of $p_h$ over a charge ladder of five made-up loads: rifle, rifle with bore resistance, magnum with the two-stage form, pistol, and lead-bullet pistol. The rule was set on the elasticity, and the loads show where it falls. A test then checks the stated ratio: for the standard test load with a start pressure of $3 \cdot 10^{7}$ Pa, the charge at which the peak mean pressure equals 2.2 times the start pressure must have an elasticity between 0.45 and 0.55, taken between start pressures of $2.85 \cdot 10^{7}$ and $3.15 \cdot 10^{7}$ Pa. The unit test of the flag checks both sides of the ratio: a start pressure of $2 \cdot 10^{7}$ Pa with ignition $10^{6}$ Pa flags a peak of $4.39 \cdot 10^{7}$ Pa, and a start pressure of 0 with ignition $5 \cdot 10^{6}$ Pa flags a peak of $1.09 \cdot 10^{7}$ Pa.

## Formulas

The hold pressure and the two elasticities, as on the model page:

$$
p_h = \max(p_\text{st},\ p_i), \qquad E_p = \frac{\partial \ln \bar p_\text{max}}{\partial \ln p_h}, \qquad E_v = \frac{\partial \ln v_e}{\partial \ln p_h}
$$

The rule: a load is too small when

$$
\bar p_\text{max} \lt 2.2\, p_h
$$

## Numbers

From the model page, "Charge too small":

- Without bore resistance, $E_p$ is close to one function of $r = \bar p_\text{max}/p_h$: 0.68 to 0.70 at $r = 1.5$, 0.5 at $r$ = 2.18 to 2.39, 1/3 at $r$ = 3.7 to 4.3.
- With $p_\text{st} = 0$, $E_p$ is 0.5 at $r$ = 2.1 to 2.3.
- With bore resistance, $E_p$ stays below 0.45 above $r = 1.1$.
- At $E_p = 0.5$ the peak mean pressure lies between 0.17 and 0.33 of the cartridge maximum pressure.

With the start-pressure tolerance of 20 % of the pressure range, the start pressure alone moves the peak by about 10 % at $E_p = 0.5$.

## Result

No change. Adopted as the ratio 2.2, the rounded low end of $r$ at the bound over the loads, a choice of the model and not taken from a source. Not adopted: a rule on a fraction of the cartridge maximum pressure, because the same elasticity corresponds to 0.17 to 0.33 of it across the loads. Documented as a limit: with bore resistance the rule flags more loads than the bound needs.

## Data basis

Analytic: made-up loads and the model's own elasticities, no measured data.

## Where in the app

- `packages/core/src/interior/model.ts`, `chargeTooSmall`, `chargeTooSmallRatio`.
- `packages/api/src/compute/limits.ts`, `chargeWarning`.
- `packages/core/test/interior-model.test.ts`, the tests "holds below 2.2 times the larger of the start and the ignition pressure" and "sits where half of a change of the start pressure reaches the peak mean pressure".
- Model page: [M3 interior model](../models/interior-m3.md).

## Confidence

Medium: the five loads are made up, and the bound of 0.5 is a judgement about how much of a hold-pressure error is acceptable. Real loads may sit differently on the curve.
