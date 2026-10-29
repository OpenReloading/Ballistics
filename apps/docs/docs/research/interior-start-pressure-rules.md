---
title: Shot-start pressure by bullet construction and firearm class
description: Whether a fitted start pressure per bullet construction and per rifle or handgun lowers the held-out velocity error against one fixed 30 MPa.
---

# Shot-start pressure by bullet construction and firearm class

## Question

Interior ballistics, shot start: does a fitted start pressure, by bullet construction and firearm class, lower the held-out velocity error of the load-table fit compared with one fixed 30 MPa?

## Method

Rules fitted on the training split with every powder refitted (vivacity and energy, two rounds), scored on the 14238 validation rows that every rule runs:

| Rule | Start pressure |
| --- | --- |
| fixed | 30 MPa |
| one value | one fitted value |
| construction | one per construction (lead, plated, jacketed, monolithic, from the printed bullet type) |
| construction and class | one per construction and class (rifle, handgun) |
| with floor | construction and class, and in a handgun at least a fitted fraction of the C.I.P. maximum pressure |

Accept rule per class: the simplest rule within 0.1 points of the lowest median absolute velocity error, among the rules whose P90 is not above that of the fixed value. Intervals: 95 % cartridge bootstrap with the powder parameters held (lower bounds of the true spread).

## Formulas

The projectile is held until the mean pressure reaches the start pressure $p_\text{st}$ and the pressure force exceeds the resistance at travel 0 ([M3, shot start](../models/interior-m3.md#shot-start)):

$$
g_\text{start} = \min\left(\bar p - p_\text{st},\; A \bar p - F_r(0)\right) \ge 0
$$

## Numbers

| Rule | rifle median % | rifle P90 % | handgun median % | handgun P90 % | all median % |
| --- | ---: | ---: | ---: | ---: | ---: |
| fixed | 2.76 | 7.22 | 6.16 | 13.58 | 3.33 |
| one value | 2.76 | 7.22 | 6.15 | 13.60 | 3.33 |
| construction | 2.73 | 7.17 | 6.02 | 13.08 | 3.28 |
| construction and class | 2.75 | 7.18 | 5.70 | 12.99 | 3.27 |
| with floor | 2.74 | 7.16 | 5.68 | 13.01 | 3.27 |

Fitted values, MPa (95 % interval): one value 30.3 (25.6 to 34.5). By construction and class: jacketed handgun 30.8 (21.2 to 40.6), jacketed rifle 29.2 (27.5 to 31.3), lead handgun 24.3 (16.7 to 34.2), lead rifle 30.0 (24.5 to 40.3), monolithic handgun 50.0 (33.8 to 65.3), monolithic rifle 35.3 (33.0 to 37.9), plated handgun 30.9 (13.2 to 37.7). Floor 0.083 of the maximum pressure (0.00 to 0.18).

## Result

Improved for handguns: median 6.16 % to 5.70 %, P90 13.58 % to 12.99 %. Adopted in a reduced form: the fixed 30 MPa for rifles, one value per construction for handguns, and a barrel of 300 mm or longer counts as a rifle. Not adopted: one fitted value, per construction alone, the floor (handgun median 5.70 % to 5.68 %, P90 12.99 % to 13.01 %) and fitted rifle values (rifle medians differ by at most 0.03 points).

## Data basis

Measured. The measurements are not in the repository.

## Where in the app

- `packages/core/src/interior/start-pressure.ts`, `defaultStartPressure`, `handgunBarrelLengthLimit`.
- Model page: [M3 model](../models/interior-m3.md).

## Confidence

Medium: effective values of the fit, not measured shot-start pressures; the plated and lead handgun intervals are wide.
