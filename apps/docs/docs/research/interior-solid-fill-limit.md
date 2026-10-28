---
title: Solid fill limit of the interior model
description: Why a charge whose solid volume exceeds 0.64 of the chamber is outside the interior model, and which alternatives were not taken.
---

# Solid fill limit of the interior model

## Question

Interior ballistics: at which fraction of the chamber volume filled by solid propellant is a load outside the [M3 model](../models/interior-m3.md), which burns free grains with a fixed form function?

## Method

The limit was set from the random close packing of equal spheres, the fill that free grains reach, and then checked in code against two consumers: the load ratio at the limit (`fillLoadRatioLimit`) and the charge ceiling of the charge solver. The checks use a solid density of 1600 kg/m³, a bulk density of 900 kg/m³ and the standard test chamber of $3.4 \cdot 10^{-6}$ m³. The accept limit is agreement to 12 digits.

## Formulas

The solid fill is the solid volume of the charge over the chamber volume, and the load ratio uses the bulk density instead. A charge at its bulk density fills the chamber to $\rho_\text{bulk}/\rho_s$:

$$
\varphi = \frac{m_c}{\rho_s V_c} = \Lambda\,\frac{\rho_\text{bulk}}{\rho_s}, \qquad \varphi_\text{max} = 0.64, \qquad \Lambda_\text{max} = \varphi_\text{max}\,\frac{\rho_s}{\rho_\text{bulk}}
$$

The density of the random close packing of equal spheres is 0.6366 ([Scott 1969](../bibliography.md#scott-1969)).

## Numbers

- 0.64 is the random close packing 0.6366 rounded up.
- At $\rho_s$ = 1.6 g/cm³ the fill at the bulk density is 0.61 for 0.98 g/cm³ and 0.55 for 0.88 g/cm³, so a charge at its bulk density lies inside the limit.
- At 0.9 g/cm³ bulk density the load ratio at the limit is $0.64 \cdot 1.6 / 0.9$.
- The `chamberVolume` rule of `interior` stops earlier for $\eta$ = 1 cm³/g and $\rho_s$ = 1.6 g/cm³: at $\varphi = 1/(\eta\,\rho_s) = 0.625$, below the limit.

## Result

No change. Adopted: the limit of 0.64 for grains of every shape, a choice of the model; a denser fill needs grains that deform or break, which changes their burning surface. The charge solver stops at the smaller of the two bounds, the solid fill limit and 0.999 of the chamber volume filled by the covolume of the charge, so for the case above it stops at 0.999 of 0.625, below the limit. Not offered: a limit that depends on the grain shape.

## Data basis

Public: the packing density of a published measurement of equal spheres. The grain shapes of powders are not spheres, and no measurement of their packing is in the repository.

## Where in the app

- `packages/core/src/interior/load-file.ts`, `solidFill`, `solidFillLimit`, `fillLoadRatioLimit`.
- `packages/core/src/interior/charge-solver.ts`, `chargeUpperBound`.
- `packages/core/test/interior-load-file.test.ts`, the tests of the `solidFill` block.
- `packages/core/test/interior-charge-solver.test.ts`, the test "caps the charge at the solid fill limit and below the chamber volume".
- Model page: [M3 interior model](../models/interior-m3.md).

## Confidence

Low: taking the sphere packing as the limit for flakes, cylinders and perforated grains is an assumption, and it was not compared with the fill of a real load.
