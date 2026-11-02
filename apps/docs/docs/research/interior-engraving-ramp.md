---
title: Engraving ramp in the bore-resistance law
description: Whether an engraving pressure that falls over the bearing length lowers the held-out velocity error beyond bore friction scaled by bullet oversize.
---

# Engraving ramp in the bore-resistance law

## Question

Interior ballistics, bore resistance: does an engraving ramp lower the held-out velocity error of the load-table fit beyond a friction stress raised by bullet oversize?

## Method

The resistance law of the [M3 model](../models/interior-m3.md#bore-resistance) was fitted to the training split with grids for the friction stress $\tau_f$ (0 to 4 MPa), the oversize coefficient $c$ (0 to 12 per percent) and the engraving fraction $\phi_e$ (0 to 4), every powder refitted (vivacity and energy). Scored on 12680 validation rows. Accept rule: the simplest variant within 0.1 percentage points of the lowest median absolute velocity error.

Barrel-length check: the burn coefficient fitted at 720 mm of a published firing series of 7 barrel lengths, the other 6 lengths predicted, error of the velocity change from 720 mm (measured spread of the series 18.34 m/s).

## Formulas

Friction on the bullet side area, raised by the oversize $o$ of the bullet over the groove diameter in percent, plus an engraving pressure that falls linearly over the bearing length $L$ ([M3, bore resistance](../models/interior-m3.md#bore-resistance)):

$$
p_f = \tau_f\, \frac{\pi G_1 L}{A} \left(1 + c\, o\right), \qquad p_e(x) = \phi_e\, p_\text{st} \left(1 - \frac{x}{L}\right) \text{ for } 0 \le x \le L
$$

## Numbers

| Variant (validation) | velocity median % | velocity P90 % | mean error % |
| --- | ---: | ---: | ---: |
| no resistance law | 3.44 | 9.79 | -1.99 |
| friction with engraving fraction 0.89 | 3.29 | 9.38 | -1.96 |
| friction without engraving | 3.33 | 9.28 | -1.58 |

Barrel-length error (median / P90, m/s): no resistance law 12.14 / 21.78; engraving fraction 0.85: 9.30 / 17.11; 0.89: 9.23 / 17.01; no engraving: 10.44 / 18.92.

On the test split of two consecutive model versions, without calibration: with engraving 3.52 % / 9.31 % (median / P90), without 3.40 % / 8.99 %.

## Result

No change from the engraving term: adopted in a reduced form, friction stress 0.42 MPa and oversize coefficient 1.3 per percent with engraving fraction 0. The variant without engraving is within 0.1 points of the one with it, has fewer terms and is better on the test split; the barrel-length error rises from 9.23 to 10.44 m/s without it. The engraving ramp stays an input of a run (`engravingPressure`, `engravingLength` of the load file).

## Data basis

Measured. The measurements are not in the repository.

## Where in the app

- `packages/core/src/interior/bore-resistance.ts`, `boreResistance`, `recordResistance`.
- `packages/core/src/interior/load-file.ts`, `overrideResistance`.
- Model page: [M3 model](../models/interior-m3.md).

## Confidence

Medium: the velocity tables carry no pressure trace, so the resistance terms are effective values of the fit.
