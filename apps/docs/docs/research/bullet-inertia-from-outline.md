---
title: Bullet inertia from the outline
description: Moments of inertia of a bullet integrated from its outline against the solid-cylinder estimate, and a stability factor from the geometry alone against Miller's rule, on analytic data.
---

# Bullet inertia from the outline

## Question

Modified point mass and stability: is the inertia of a bullet integrated from its outline (nose, cylinder, boat tail, uniform density) closer to a reference than the [solid-cylinder estimate](../models/exterior-modified-point-mass.md), and is a stability factor from the geometry alone a usable lower estimate next to Miller's rule?

## Method

Decided before the run.

- Moments: the relative error of both moments of the cylinder estimate and of the outline integral against a reference. Build when the transverse error of the outline falls below half of the cylinder error on every bullet, the axial error is below 5 percent and the transverse error below 15 percent.
- Data: no bullet with a published measured axial and transverse moment and a dimensioned outline could be taken into the repository (see Data basis). The quadrature is therefore checked against an independent numerical integral of the drawing outline polygon of the demo 168 grain record, and the rule is evaluated on one stated reference only (168 grain, 7.62 mm class: axial 7.23e-8 kg m2, transverse 5.38e-7 kg m2: author-derived values with no source page, unverified). No measured-error claim is made.
- Stability from the geometry: the factor with the overturning-moment slope from the outline, over twelve rifle outlines (length 3.4 to 5.4 calibres, Rt/R 1, 0.7 and 0.4, boat tail 0.3 or 0.5 calibre) and two pistol outlines, with the twist that gives Miller's factor 1.5 at 2800 ft/s in standard air. Pass when every ratio to Miller's factor is from 0.6 to 1.0 and none exceeds it by more than 10 percent. Both factors scale with the mass, so the ratio does not depend on the density chosen for the outline.
- Effect: the spin drift of the modified point mass of the demo bullet (G7 coefficient 0.221, 790 m/s, twist 254 mm, zero at 100 m) with the inertias from the cylinder and from the outline, the moment slope estimated from Miller's rule in both.

## Formulas

For a body of revolution of uniform density $\rho$ with radius profile $r(z)$ from the base ($z = 0$) to the tip ($z = l$), with the volume $V_\mathrm{vol} = \pi \int r^2 \, dz$ and the centre of mass $z_\mathrm{cm} = \pi \int r^2 z \, dz / V_\mathrm{vol}$ (the integrals are the textbook definitions for a solid of revolution, derived by the author; [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), section 2.2, is the related reading, page not verified):

$$
I_x = \frac{\pi \rho}{2} \int r^4 \, dz, \qquad I_y = \rho \int \left( \frac{\pi r^4}{4} + \pi r^2 (z - z_\mathrm{cm})^2 \right) dz, \qquad \rho = \frac{m}{V_\mathrm{vol}}
$$

The profile is the one of [outline drag](../models/exterior-outline-drag.md): a linear boat tail, the cylinder, and a nose arc through the shank end and the meplat edge with the radius $R = R_t / (R_t/R)$ ($R_t$ the tangent ogive radius of that length and drop), a cone for $R_t/R = 0$.

The geometry-only slope of the overturning moment, as stated in the issue of this entry (no source with a page could be named, so treat the slope as author-derived and unverified), with the base area $A_B$:

$$
C_{M\alpha}' = \frac{8 \left[ V_\mathrm{vol} - z_\mathrm{cm} A_B \right]}{\pi d^3}, \qquad S_g = \frac{2 I_x^2 p^2}{\pi I_y \rho_\mathrm{air} v^2 d^3 C_{M\alpha}'}
$$

with $p = 2 \pi v / T_w$ the muzzle spin ($v$ the muzzle velocity, $T_w$ the twist per turn), so that $S_g = 8 \pi I_x^2 / (\rho_\mathrm{air} I_y C_{M\alpha}' T_w^2 d^3)$ does not depend on the muzzle velocity. Miller's rule: [Miller 2005](../bibliography.md#miller-2005). The stability factor of linear theory: [McCoy 1999](../bibliography.md#mccoy-1999).

## Numbers

Quadrature, demo 168 grain outline (7.823 mm, 30.5 mm, nose 16 mm, Rt/R 0.55, meplat 1.6 mm, boat tail 3.8 mm to 6.62 mm), core integral (200 panels of five Gauss-Legendre nodes per profile piece) against Simpson's rule over the segments of the drawing polygon (4000 steps per segment):

| Quantity | Relative difference |
| --- | --- |
| Volume | 1.3e-4 |
| Centre of mass | 9.4e-5 |
| Axial moment | 5.0e-5 |
| Transverse moment | 1.1e-4 |

The remaining difference is the 24-step chord sampling of the polygon nose. A cone and a cylinder match their closed forms to 1e-6 in the unit test of the function.

Moments, demo bullet (cylinder estimate with its length against the outline integral):

| | Axial, kg m2 | Transverse, kg m2 |
| --- | --- | --- |
| Cylinder | 8.33e-8 | 8.86e-7 |
| Outline | 7.19e-8 | 5.94e-7 |
| Reference (author-derived, unverified) | 7.23e-8 | 5.38e-7 |
| Error, cylinder | 15.2 % | 64.6 % |
| Error, outline | 0.6 % | 10.4 % |
| Verdict | improved | improved |

The rule is met on this one reference (transverse 10.4 % against half of 64.6 %, axial below 5 %, transverse below 15 %); it is not a test over five bullets. The 5.38e-7 of the reference and the outline are not of the same bullet, so a 10 percent error here is a reference point and no accuracy claim.

Over the twelve rifle outlines the cylinder is 12.5 to 17.1 percent above the outline in the axial moment and 47.8 to 66.2 percent above it in the transverse moment (two pistol outlines: 8.3 and 11.0, and 19.8 and 26.4 percent).

Stability from the geometry over Miller's factor, rifle grid: 0.652 to 0.762 (every ratio inside 0.6 to 1.0, none above 1.0), by shape: Rt/R 1 gives 0.652 to 0.659, 0.7 gives 0.695 to 0.702, 0.4 gives 0.755 to 0.762. Pistol outlines: 0.685 and 0.742 (outside the range of Miller's rule, so shown for information).

Spin drift of the demo bullet with the inertias from the outline instead of the cylinder: 22.4 against 28.7 mm at 300 m, 127 against 164 mm at 600 m, 662 against 851 mm at 1000 m, about 22 percent less at every range (22.0, 22.6 and 22.2 percent from the rounded values). With the moment slope taken from Miller's rule the drift goes with $I_y / I_x$, so the change is the ratio of that quotient, 8.27 against 10.63.

## Result

improved on the analytic reference: the outline integral replaces the cylinder estimate as the default of a missing moment when it is adopted, and the cylinder stays until then. Not adopted by this entry: the function `outlineInertia` and its tests are on the unmerged branch `research/bullet-inertia-from-outline` and a follow-up issue takes them over. The geometry-only stability factor passes the rule on the tested grid of fourteen outlines as a proposed lower estimate. The stability model page is not updated by this entry (see Where in the app), the factor is not shown in the interface, and it stays so until the slope has a verified source and a validation against measured data.

## Data basis

analytic. The search for bullets with a published measured axial and transverse moment found candidate reports of the US Army ballistics laboratory for 7.62 mm and 5.56 mm ammunition, which this work could not retrieve (the archive refused the requests with HTTP 403), so no value was imported and no source was added to the bibliography. The checks are the closed forms of a cone and a cylinder, an independent integral of the drawing polygon, and one unverified reference value.

## Where in the app

- `packages/core/src/exterior/modified.ts` (`cylinderInertia`, unchanged).
- `packages/core/src/exterior/trajectory.ts` (`estimateInertias`, the place a follow-up uses the outline when the bullet record has one).
- `packages/core/src/exterior/outline-drag.ts` (`OutlineDragInput`, the outline the function takes).
- `packages/core/src/exterior/stability.ts` (`millerStability`).
- [Modified point mass](../models/exterior-modified-point-mass.md), "Moments of inertia estimate" and Limits: add the outline integral, the numbers above and keep the cylinder as the estimate without an outline.
- [Stability](../models/exterior-stability.md): add the geometry-only factor as a lower estimate with its ratio range 0.65 to 0.76 to Miller's rule on the grid above, and the note that it is not shown in the interface.

Designer wiring, not built: the bullet designer already holds the outline fields; with all of nose length, Rt/R, boat tail and base diameter given, pass them to the function and show the moments in the computed rows marked as an estimate from the outline; without them the cylinder stays and its row says so; no change to the record schema.

## Confidence

low: one reference value that is not from a measured source with the outline, and a geometry-only slope whose source is unverified. The closed-form and polygon checks of the quadrature are high.
