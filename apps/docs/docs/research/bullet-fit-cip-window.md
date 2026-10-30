---
title: Bullet fit window against C.I.P. values
description: Whether the window from the middle of land and groove up to G1 gives the bullet diameters expected for ten cartridges, and where its bounds fall.
---

# Bullet fit window against C.I.P. values

## Question

Bullet fit: does the window from the middle of the land and groove diameters up to the projectile diameter $G_1$ select the expected bullet diameters for cartridges of the records, and do its bounds fall where the page puts them?

## Method

`bulletFits` runs over eleven bullet diameters (the nominal inch sizes .224 to .452, converted to mm) for ten cartridges with the $G_1$, $F$ and $Z$ of their C.I.P. records. The accept rule, set in the test: the list of fitting bullets equals the expected list for every cartridge. The expected lists are the bullets the test names for each cartridge; that these are the bullets loaded in practice is not checked against a published source (unverified). A second case checks the bounds of one window ($G_1$ 7.85, $F$ 7.62, $Z$ 7.82 mm) on both sides.

## Formulas

A bullet of diameter $d$ fits when $(F + Z)/2 \lt d \le G_1 + \delta$, with $\delta = 0.005$ mm, half the last printed digit of the two-decimal C.I.P. values ([C.I.P. TDCC](../bibliography.md#cip-tdcc) for the meaning of $G_1$, $F$ and $Z$; the window is this project's rule, see [bullet fit](../models/bullet-fit.md)).

## Numbers

- 223 Rem.: .224. 22 Savage: .224 and .228. 7 x 57: .284. 308 Win.: .308. 303 British: .310, .311 and .312. 7,62 x 39: .308 to .312. 8 x 57 I: .318. 8 x 57 IS: .318 and .323. 45 Colt: .452. All as expected.
- 7,5 x 55 Suisse: no bullet of the list fits, since its $G_1$ of 7.78 mm lies below the 7.823 mm of a .308.
- Bounds of the 308 Win. window: the lower bound is 7.72 mm; 7.72 mm does not fit, 7.855 mm fits, 7.856 mm does not.
- Not tested: cartridges whose C.I.P. sheet lacks $G_1$, $F$ or $Z$ (the page states they get no fitting bullets) and any comparison with a bullet maker's stated cartridge.

## Result

No change. The tests are adopted as regression tests; the 7,5 x 55 Suisse without a fitting .308 is documented by its test.

## Data basis

Public: the C.I.P. values of the cartridge records and nominal bullet diameters.

## Where in the app

- `packages/core/test/bullet-fit.test.ts`.
- `packages/core/src/bullet-fit.ts`, `packages/core/src/cartridge-specs.ts`.
- Model page: [bullet fit](../models/bullet-fit.md).

## Confidence

Medium: the window behaves as specified for every case, but the expected bullet lists are not checked against a published pairing of bullets and cartridges.
