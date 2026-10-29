---
title: Shotshell loads with one assumed powder
description: Whether the shotshell model with one assumed powder for every load reproduces published 12 gauge velocities and stays under published pressure limits, and why it is not a tracked benchmark.
---

# Shotshell loads with one assumed powder

## Question

Interior ballistics, [shotshell model](../models/interior-shotshell.md): does M3 with one assumed shotshell powder reproduce published 12 gauge velocities and stay under the published pressure limits, well enough to be a tracked benchmark?

## Method

Assumed 12 gauge load: bore 18.41 mm, barrel 762 mm, wad base 10 mm plus the powder space, wad 2.5 g, crimp opening pressure 2 MPa, ignition 1 MPa, bulk density 0.55 g/cm³, energy 3.9 MJ/kg, $k = 1.23$, vivacity law with the two-stage form, 293.15 K, no heat loss, friction or leak. Vivacity 1.625 s⁻¹, calibrated to 366 m/s at the design centre (37 g of shot, 1.65 g charge). Then 29 published lead-shot reference loads, each with the charge solved to its reference velocity, compared with the maximum average pressure of the published standard and the C.I.P. maximum pressure.

## Formulas

The shotshell load maps onto M3 with the circle of the bore diameter as bore area, wad plus shot as the projectile and the crimp opening pressure $p_c$ as the shot-start pressure ([shotshell model](../models/interior-shotshell.md)).

## Numbers

At the four corners of the design range: 352.4 to 377.1 m/s against the published 348 to 384 m/s. The highest peak is 765 bar, 0.965 of the maximum average pressure of the standard and 1.034 of the C.I.P. maximum pressure. Over the 29 reference loads: median peak 0.747 of the maximum average pressure, P90 1.137; above it in 6 and above the C.I.P. maximum in 8 of 29.

## Result

No change. Not adopted as a tracked benchmark; kept as a plausibility check. One powder stands for every load, so a peak above a limit says that the powder does not suit the load, and no figure is held out of the calibration.

## Data basis

Measured. The measurements are not in the repository.

## Where in the app

- `packages/core/src/interior/shotshell.ts`.
- Model page: [shotshell model](../models/interior-shotshell.md).

## Confidence

Medium: one assumed powder and one calibration point.
