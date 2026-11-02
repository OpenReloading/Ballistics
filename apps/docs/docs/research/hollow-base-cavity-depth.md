---
title: Hollow-base cavity depth interval and override
description: How far the unknown depth of a hollow-base cavity moves the run, and the bracket and typed depth that carry it.
---

# Hollow-base cavity depth interval and override

## Question

Case capacity, hollow base: how much does the assumed depth of the cavity (a 45° cone or a hemisphere, as deep as its radius) move the peak pressure and the velocity, and should the run carry an interval for it and take a measured depth?

## Method

The cavity volume was varied around the default on stand-in loads with a free volume of 0.4 and 0.6 cm³ and a cavity radius of 3 mm: the cone replaced by the hemisphere (+0.028 cm³, the same as twice the depth), half the depth and three times the depth (issue #846). Decided in advance: keep the default and flag it approximate, add an interval from the cavity diameter that the pressure range reaches, and a typed depth that wins over the default. No maker publishes a depth or a volume of the cavity, and the repository holds no hollow-base record, so no bracket could be checked against data.

## Formulas

Cone cavity $V = \pi r_c^2 h / 3$, rounded cavity (half ellipsoid) $V = 2 \pi r_c^2 h / 3$, both textbook solids of revolution. Bracket $0.5\, r_c \le h \le 3\, r_c$. The volume tolerance of the pressure range becomes $0.01 + \max(V_b - V_{b,\mathrm{low}}, V_{b,\mathrm{high}} - V_b) / V_c$, at most 0.2. See [case capacity, cavity depth](../models/case-capacity.md#cavity-depth).

## Numbers

Cavity radius 3 mm: cone 0.028 cm³, hemisphere 0.057 cm³, bracket 0.014 to 0.085 cm³. Effect on the stand-in loads (free volume 0.4 / 0.6 cm³):

| Cavity change | Peak | Velocity |
|---|---|---|
| cone to hemisphere (+0.028 cm³), or twice the depth | -5.9 % / -3.6 % | -1.1 % / -0.7 % |
| half the depth | +3.4 % / +2.0 % | +0.6 % / +0.4 % |
| three times the depth (+0.056 cm³) | -10.9 % / -6.9 % | -2.1 % / -1.4 % |

With the bracket a 9 mm hollow-base wadcutter (opening 6 mm, 0.6 cm³ behind the bullet) gets a volume tolerance of 10.4 % instead of 1 % (`apps/web/test/cavity-range.test.ts`).

## Result

Improved. Adopted: the default stays and is flagged approximate, the depth bracket widens the volume tolerance of the pressure range, and a typed or recorded cavity depth (`base.cavityDepth`, Cavity depth in the Bullet card) wins, is drawn as given and named in the outline's notes. A fill volume converts to a depth by the shape. The bracket of half to three times the depth is an assumption without a source.

## Data basis

Analytic. Closed forms of the cavity shapes and stand-in loads; no measured cavity depth is in the repository.

## Where in the app

- `packages/drawing/src/bullet/outline.ts`, `cavityGeometry`, `cavityDepthBracket`, `cavityVolumeBracket`.
- `packages/drawing/src/seating/seating.ts`, `seat` (`cavityRange`).
- `packages/schema/src/bullet.ts`, `base.cavityDepth`.
- `apps/web/src/lib/cavity-range.ts`, `apps/web/src/lib/interior-request.ts`.
- Model page: [case capacity](../models/case-capacity.md#cavity-depth).

## Confidence

Low: the bracket has no source and no hollow-base record or depth measurement was available to check it.
