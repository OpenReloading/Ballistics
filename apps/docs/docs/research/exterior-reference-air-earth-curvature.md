---
title: Reference air density and Earth curvature
description: The density ratio between the two BC reference atmospheres, the older sound speed, and the size of the gravity direction error of a flat Earth.
---

# Reference air density and Earth curvature

## Question

Exterior ballistics: how far apart are the two reference atmospheres a BC can name, and does the flat-Earth gravity of the point-mass model matter at 1000 m?

## Method

Density: ICAO sea-level density from the constants of `icao` against 0.075126 lb/ft³ converted with the exact pound and foot. Sound speed: 1120.27 ft/s against the dry ICAO value. Curvature: a throwaway copy of the compiled solver whose gravity points from the bullet to the Earth's centre, $R$ = 6357 km, constant magnitude, against the unchanged solver. G7 BC 0.3 lb/in², 11.3 g, 7.82 mm, 850 m/s, sight height 50 mm, zero at 100 m, ICAO sea level, no Coriolis. Accept rule decided in advance: add curvature numbers to the model only if the height at 1000 m moves by more than 0.1 mrad.

## Formulas

ICAO density $\rho = p / (R_d T)$ with 101325 Pa, 287.05287 J/(kg K) and 288.15 K ([ICAO 1993](../bibliography.md#icao-1993)). 1 lb/ft³ = 0.45359237 / 0.3048³ kg/m³. Gravity direction error $x/R$; drop of the surface below the tangent $x^2/(2R)$. Curved gravity: $\vec g = -g\,(x, R + y)/\sqrt{x^2 + (R + y)^2}$ in the launch frame.

## Numbers

- Density: 1.2250 against 1.2034 kg/m³, ratio 1.01795.
- Sound speed: 1120.27 ft/s = 341.46 m/s (unverified), 0.34 % above 340.294 m/s.
- $x/R$: 0.157 mrad at 1000 m. $x^2/(2R)$: 7.1 mm at 300 m, 78.7 mm at 1000 m, 263 mm at 1828.8 m.
- Height change from the curved gravity: 0.00 mm at 300 m, 0.02 mm (0.00002 mrad) at 1000 m, 0.84 mm (0.0005 mrad) at 1828.8 m. Time of flight longer by 1.7 µs at 1000 m and 22 µs at 1828.8 m.

## Result

No change. The density ratio is documented on the [drag](../models/exterior-drag.md) and [atmosphere](../models/exterior-atmosphere.md) pages and pinned by a test; the reference is still stored and not applied. The curvature effect is far below 0.1 mrad, so the [point-mass page](../models/exterior-point-mass.md#limits) states the run and no correction is added.

## Data basis

Analytic: defined constants and model runs.

## Where in the app

- `packages/core/src/exterior/atmosphere.ts`, `icao`.
- `packages/core/test/exterior-atmosphere.test.ts`, the test "has a sea-level density 1.018 times the older reference density of 0.075126 lb/ft3".
- `packages/core/src/exterior/trajectory.ts`, `pointMassRhs`.
- Model pages: [drag](../models/exterior-drag.md), [atmosphere](../models/exterior-atmosphere.md), [point mass](../models/exterior-point-mass.md).

## Confidence

High for the density ratio and the size of the gravity direction effect; the older sound speed is unverified.
