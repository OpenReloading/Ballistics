---
title: A shadow past the base of a bullet photograph
description: Whether the bullet photo tool can trim a drop shadow offset towards the base, and keep a shadow far along the axis, from reading as a boat tail.
---

# A shadow past the base of a bullet photograph

## Question

Bullet from a photo: a drop shadow offset towards the base, or far along the axis with little blur, still read as a boat tail after #902. Can the outline tell such a shadow and name it, with no boat tail on a flat base (#916)?

## Method

- **Data.** Product-style renders (`renderPhoto`: light background, side shading, noise 3, blur 1 px, no ruler, the scale from the diameter) of two flat-base bullets: a 7.82 x 30 mm tangent rifle bullet with the [catalogue evaluation's](./bullet-photo-catalogue-geometry.md) drop shadow offset towards the base instead of the tip (offset -2 and 3 % of the length, blur 2 %, depth 0.2) at 15 and 30 px per mm; and a 9.02 x 15.5 mm pistol bullet with a shadow 20 px along the axis (towards the tip and towards the base) and 6 px across, blur 4, at 15 px per mm. Plus the catalogue evaluation (`apps/web/test/bullet-photo-catalogue.test.ts`, scenarios A to H).
- **Compared.** The tool of #918 against the change (with #917, which it is built on).
- **Metric.** Base type, length error against 3 stated uncertainties, and a note naming the shadow; every column of the catalogue evaluation.
- **Accept rule** (the issue's acceptance, decided before the run). On the renders, no boat tail on the flat base, and the length within the larger of 1 % and 3 u of the truth or a note naming a shadow. The catalogue evaluation keeps its numbers for A to H.

## Formulas

A shadow offset towards the base by more than its blur carries the cut-out on past the base face. With each side's shank line $\ell(z)$ (as for the [drop shadow](./bullet-photo-drop-shadow.md)), let $i_l$, $i_r$ be the first samples where each side reaches $\tfrac{1}{2}\ell$. Past the base only the shadow is cut out, its far edge on one side, so one side reaches half its line $\lvert i_l - i_r\rvert \ge 3$ samples before the other. The late side then meets the bullet's base face and crosses it to $0.9\,\ell$ within $0.2\,\lvert i_l - i_r\rvert$ samples; the corner of an axis turned off the bullet ramps on about as far again ($2a\tan\delta$ px in all), which tells them apart. The samples before the crossing are left out and the axis' origin moves to it. The trim is computed for every axis the tool finds. Where the one-sided check of #902 could not take a shadow out, the trimmed outline is checked again and kept; where it did take one out and the trim would also change the outline, the one-sided result is kept untrimmed with its shadow named as not removed (the values may be off).

## Numbers

| Render | #918 | This change |
| --- | --- | --- |
| Rifle, shadow towards the base, 15 px/mm | flat, length -10.8 % (3 u 19 %), shadow named | the same |
| Rifle, shadow towards the base, 30 px/mm | boat tail 1.44 mm, length -7.8 % (3 u 11.8 %), shadow named | flat, length -9.6 % (3 u 11.6 %), shadow named |
| Pistol, shadow 20 px towards the tip | boat tail 0.59 mm, length +8.9 % (3 u 13.5 %), soft-edge note | flat (from #917's base samples), the same length and note |
| Pistol, shadow 20 px towards the base | flat, length +4.5 % (3 u 20.6 %), shadow named | the same |

The catalogue evaluation is unchanged on every column of A to H. A first version that trimmed before the one-sided check moved two wide bullets of F from 0.51 and 0.52 % to -0.82 and -0.89 %: their turned corners looked like an overhang. Trying the one-sided check first keeps their values; since an overhang is also seen there, their note now says the values may be off instead of that the shadow was taken out (the warning count of F is unchanged).

The second reader's sweep: no trim on 720 clean renders (flat, boat tail, rebated boat tail, pistol, conical and rounded hollow bases at 10 to 60 px per mm, five angles, three seeds, two blurs). On 24 renders with a shadow 0.3 to 1.2 mm towards the base at 15 and 30 px per mm the trim fired on 3; most others are named as not removed, while a pistol bullet at 30 px per mm with a shadow 0.6 mm towards the base and 0.9 mm across got no shadow named and read 19 px long. A one-sided correction that reported the shadow taken out with an overhang left (a boat tail at 30 px per mm, 20 px long) now says the values may be off. The axis is not fitted again after a trim (3.5 degrees off on the trimmed pistol bullet at 15 px per mm). These are #934.

## Result

Improved: adopted in a reduced form. No render gives a boat tail on its flat base, and each is within 3 u with the shadow named (the soft-edge note names a shadow for the one towards the tip). The lengths stay off by 4 to 11 %: a shadow towards the base leaves no clear base to measure the shank's half width from, so the shank stays widened, and a shadow far beyond a flat tip is not told from the tip. Both are named, not corrected.

## Data basis

Analytic: synthetic photographs rendered from bullet drawings (`renderPhoto`).

## Where in the app

- `apps/web/src/lib/bullet-photo-outline.ts` (`withoutOverhang`, `shankLines`, `fitOutline`).
- `apps/web/test/bullet-photo-quality.test.ts` (the four renders).
- `apps/web/test/bullet-photo-catalogue.test.ts` (the evaluation).
- Model page: [bullet from a photo](../models/bullet-photo.md). Earlier entries: [a drop shadow](./bullet-photo-drop-shadow.md), [catalogue bullets](./bullet-photo-catalogue-geometry.md).

## Confidence

Medium: one shadow model (a blurred, offset silhouette) and four renders; real shadows and the corners of real photographs are untested.
