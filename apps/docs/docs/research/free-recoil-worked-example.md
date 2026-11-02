---
title: Free recoil against a published worked example
description: Whether the free recoil model reproduces the velocity and energy of a worked example of the standards body, and why the printed energy differs in the last digits.
---

# Free recoil against a published worked example

## Question

Free recoil: does `freeRecoil` reproduce the recoil velocity and energy that a published worked example gives for a 7 lb firearm?

## Method

The example's inputs were converted to SI and entered: firearm 7 lb, projectile 589.9 gr, charge 33.4 gr, muzzle velocity 1275 ft/s, gas velocity factor 1.5, with 1 lb = 0.45359237 kg, 1 gr = 64.79891 mg, 1 ft = 0.3048 m and 1 ft lbf = 1.3558179483 J. The velocity was compared with the exact fraction 816000/49000 ft/s, the energy with 30.168 ft lbf, the velocity to 9 digits and the energy to 3 digits (the precision argument of `toBeCloseTo`).

## Formulas

The momentum balance of the [free recoil model](../models/free-recoil.md), $I = (m_p + f\, m_c)\, v_0$, $v_g = I / m_g$ and $E_g = \tfrac12 m_g v_g^2$, from [SAAMI 2018](../bibliography.md#saami-2018). In the units of the example the numerator of the velocity is the momentum $(589.9 + 1.5 \cdot 33.4) \cdot 1275$ in gr ft/s, which the test writes as 816000, and the denominator is the firearm mass of 7 lb in grains, 49000.

## Numbers

The printed values are transcribed from the test comment; the page of the standard that holds them is unverified.

| Quantity | Printed on the sheet | Model |
| --- | --- | --- |
| recoil velocity | 16.65 ft/s | 16.653 ft/s (816000/49000) |
| recoil energy | 30.22 ft lbf | 30.168 ft lbf |

The velocity agrees to the printed digits. The energy differs in the third digit: the sheet rounds the factor $7/64.34$ to 0.109 on the way, and the exact factor gives 30.168 ft lbf.

## Result

No change. The difference to the printed energy is the sheet's rounding, not the model. The tests pin the exact values, not the printed 30.22.

## Data basis

Public: a worked example of a published standard. The printed values are quoted from the test comment and unverified here.

## Where in the app

- `packages/core/src/recoil.ts`, `freeRecoil`.
- `packages/core/test/recoil.test.ts`, the test "reproduces the SAAMI worked example in SI".
- Model page: [free recoil](../models/free-recoil.md).

## Confidence

High for the arithmetic of the balance. The example tests the formula only, not the gas velocity factor of 1.5, which the standard gives per firearm type and the model page lists under limits.
