---
title: Spin drift and jump fits against the modified point mass
description: How far the empirical spin drift and aerodynamic jump fits of the point-mass run lie from the modified point mass for one 168 gr bullet, and why they are kept.
---

# Spin drift and jump fits against the modified point mass

## Question

Exterior model: do the empirical spin drift and aerodynamic jump fits of the point-mass trajectory (`spinDrift`, `aerodynamicJump`) agree with the modified point mass with its own coefficients, and does a refit pay?

## Method

One bullet, 168 gr and 0.308 in, 3.98 calibres long, 2600 ft/s, sea-level standard air, G7 ballistic coefficient 0.218 lb/in2, twist 10, 12 and 14 in. The point-mass run (fit) and the modified-point-mass run use the same drag. The modified point mass takes inertias from radii of gyration of 0.10 (axial) and 1.0 (transverse) times $m d^2$, a lift slope of 2.1 and an overturning-moment slope of 1.81 at Mach 2.4 rising linearly to 4.0 at Mach 0.8. These coefficients are chosen to match the figures below, they are not measured. Metric: the ratio of fit to modified point mass for the spin drift at 600 and 1000 yd and for the jump per 10 mph crosswind at 100 yd. Accept rule set in advance: the two differ by less than 15 percent if the fit is fine; a refit needs a second bullet with the same bias. The test is `packages/core/test/exterior-fit-vs-modified.test.ts`, with the ratios asserted within 3 percent.

## Formulas

The fits are $D_s = 1.25\,(S_g + 1.2)\,t^{1.83}$ in and a jump linear in $S_g$ and the length in calibres, both in the [stability page](../models/exterior-stability.md). The modified point mass takes the drift from the yaw of repose and the jump from linear theory, in the [modified point mass page](../models/exterior-modified-point-mass.md). Both depend on the product of the lift slope and the ratio of the transverse inertia to the axial inertia, so one bullet fixes only that product and the Mach dependence of the moment slope.

## Numbers

Spin drift, fit over modified point mass:

| twist (in) | 600 yd | 1000 yd |
| --- | --- | --- |
| 10 | 1.38 (3.76 over 2.73 in) | 1.30 (14.5 over 11.1 in) |
| 12 | 1.32 (2.99 over 2.27 in) | 1.25 (11.6 over 9.3 in) |
| 14 | 1.30 (2.53 over 1.95 in) | 1.23 (9.8 over 7.9 in) |

Jump per 10 mph crosswind at 100 yd, 12 in twist: fit 0.41 in, linear formula 0.36 in, ratio 1.13. A rigid-body integration of 9.3, 11.1 and 8.0 in at 1000 yd is unverified (no citable source).

## Result

No change. The fits run 23 to 38 percent above the modified point mass for this bullet, beyond the 15 percent accept rule, and are documented as a limit in the stability page. They are not refitted: the repository holds no second bullet with drift data or coefficients, and the inertia of the one bullet is estimated.

## Data basis

Analytic: a synthetic bullet with coefficients chosen for the comparison. No measured drift data.

## Where in the app

- `packages/core/src/exterior/stability.ts`, `spinDrift`, `aerodynamicJump`.
- `packages/core/src/exterior/modified.ts`, `linearJump`.
- `packages/core/test/exterior-fit-vs-modified.test.ts`.
- Model pages: [stability, spin drift and jump](../models/exterior-stability.md), [modified point mass](../models/exterior-modified-point-mass.md).

## Confidence

Low: one bullet, coefficients chosen to reproduce the stated figures, the external reference unverified.
