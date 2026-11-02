---
title: Engraving ramp at the jump to the lands
description: Starting the workbench's engraving ramp at the seated bullet's jump (0 when touching or jammed) and its effect on peak pressure and muzzle velocity of the example load.
---

# Engraving ramp at the jump to the lands

## Question

M3 interior model, bore resistance: should a typed or record engraving ramp start at the jump of the seating instead of at travel 0, so seating closer to or into the lands changes the run?

## Method

The workbench's run gets the seated bullet's jump (seating figure, `packages/drawing/src/seating/seating.ts`, `jumpOf`) and moves every point of the engraving profile by it, with the first point at the jump, or at 0 for a jump of 0 or less. A seating ladder moves the ramp of each step to that step's jump. Without a ramp nothing changes and the result notes say so. No default ramp is added.

Comparison: the workbench example load (`apps/web/src/lib/example-data.ts`, `exampleInterior`) with two typed ramps, at jumps of -0.3, 0, 0.5, 1.0, 1.5 and 3.0 mm, and without a ramp. Metric: peak breech pressure and muzzle velocity of `interior` (`packages/core/src/interior/model.ts`). Accept rule: a jammed load and the same load with a jump give different results with a ramp, and identical results without one.

## Formulas

The engraving term of the bore resistance is unchanged ([M3 interior model](../models/interior-m3.md#bore-resistance)): $p_e(x)$ is interpolated linearly between the profile's points and is 0 before the first point. The move sets the profile's points to $x_i' = x_i - x_0 + \max(0, j)$, with $j$ the jump in m and $x_0$ the travel of the first point (0 for the workbench's ramps: the record law, the typed engraving values and a link's values all start there). Free travel before the first point is the model's existing treatment of a profile that starts later.

## Numbers

Example load: 2.4 g charge, 3.13 cm3 behind the bullet, 10.886 g bullet, 569 mm travel, start pressure 30 MPa. Ramp values are typed stand-ins, not taken from a record or a source.

| Jump | Ramp 60 MPa over 5 mm: peak, velocity | Ramp 30 MPa over 10 mm: peak, velocity |
| --- | --- | --- |
| -0.3 mm (jammed) | 420.1 MPa, 813.7 m/s | 338.4 MPa, 784.6 m/s |
| 0 mm (touching) | 420.1 MPa, 813.7 m/s | 338.4 MPa, 784.6 m/s |
| 0.5 mm | 325.1 MPa, 778.6 m/s | 296.2 MPa, 764.7 m/s |
| 1.0 mm | 303.5 MPa, 768.4 m/s | 286.9 MPa, 759.7 m/s |
| 1.5 mm | 292.8 MPa, 762.9 m/s | 281.6 MPa, 756.8 m/s |
| 3.0 mm | 278.5 MPa, 755.0 m/s | 273.4 MPa, 752.0 m/s |

Without a ramp: 259.3 MPa, 743.5 m/s at every jump. Before this change every row of a column had the jammed result.

## Result

Improved: adopted. The jammed and jumped runs differ with a ramp and are identical without one. The size of the change depends on the ramp, which no default supplies: with the 60 MPa stand-in the first 0.5 mm of jump lowers the peak by 23 %, with the 30 MPa one by 12 %. Not compared with a measurement: the numbers say nothing about a real load until a ramp is fitted from measured pressures.

## Data basis

Analytic: the workbench example load with typed stand-in ramps, no measurement.

## Where in the app

- `apps/web/src/lib/interior-request.ts` (`rampAtJump`, `interiorRequest`)
- `apps/web/src/components/workbench-outcome.ts` (`stepLoad`, `resultNotes`)
- `apps/web/src/lib/seating-ladder.ts`
- `apps/web/src/components/seating-preview.tsx` (`seatedReport`)
- `apps/web/test/interior-request.test.ts`
- [M3 interior model](../models/interior-m3.md#bore-resistance)

## Confidence

Medium: the mechanism follows the model's existing profile treatment and is tested, but the size of the effect rests on ramp values without a source.
