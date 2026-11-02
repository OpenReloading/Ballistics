---
title: A drop shadow beside a bullet photograph
description: Whether comparing the two sides of the bullet photo outline takes a one-sided drop shadow out of the cut-out and stops it from reading as a boat tail, measured on the catalogue evaluation's renders.
---

# A drop shadow beside a bullet photograph

## Question

Bullet from a photo: can the outline tell a soft drop shadow on one side of the bullet from the bullet itself (#902), so that a scale from the diameter no longer shortens every length and the shadow's taper at the base no longer reads as a boat tail?

## Method

- **Data.** The [catalogue evaluation](./bullet-photo-catalogue-geometry.md) (`apps/web/test/bullet-photo-catalogue.test.ts`, run with `BULLET_PHOTO_EVAL=<out.json>`): 32 bullets (26 flat bases, 6 boat tails) drawn from bullet records and test shapes, each rendered in eight scenarios A to H and measured with the tool's worker steps. Scenario F is the product-style image of 500 px (the bullet 450 px long, no ruler, scale from the record's diameter) with a soft drop shadow offset 2 and 3 % of the length, blurred 2 %, depth 0.2.
- **Compared.** The tool on `main` (7c133fe8) against the change, same renders and seeds.
- **Metric.** Median and P90 of the absolute length error, false boat tails on flat bases, the count with a warning, and every other column of the evaluation for A to H.
- **Accept rule** (the issue's acceptance, fixed before the run). On F, every length within the larger of 1 % and 3 stated uncertainties of the truth, or a warning that names a shadow; no false boat tail on a flat base in F; scenarios A to E, G and H keep every number.

## Formulas

A body of revolution is symmetric about its axis, so the left and right edges' distances from the axis, $r_l(z)$ and $r_r(z)$, agree. A shadow offset towards the tip widens one side along the shank and leaves it short at the base. Each side's shank is fitted with a line $\ell(z)$; its taper $t = \ell(z_b) - r(z_b)$ at the base samples. A side that tapers more than the other by $\max(2.5\ \text{px},\ 0.02\, r_b)$ carries the shadow. Where the shadow leaves the base clear (both sides parallel over the base samples), the shank's half width is $a = r_b + t_s$ (base half width plus the sharp side's own taper), and the profile is the sharp side's, $r(z) = r_s(z) - \ell_s(z) + a$, about the axis it gives. Where the cut-out runs on past a flat tip in the shadow alone, the bullet ends with the sharp side. The scale from the diameter divides every length by the cut-out's diameter in pixels, so a widened shank shortens every length by the same share. The equations are the model page's (`withoutShadow`).

## Numbers

Before (main) and after, 32 photographs per scenario, median / P90 of the absolute error:

| Scenario F | Before | After |
| --- | --- | --- |
| Length % | 10 / 12 | 0.52 / 0.99 |
| Length mm | 2.6 / 4.3 | 0.13 / 0.26 |
| Nose length % | 21 / 29 | 0.40 / 4.4 |
| Boat tail mm (true tails) | 0.47 / 0.72 | 0.063 / 0.077 |
| False boat tails (flat bases) | 26 of 26 | 0 of 26 |
| Outline volume % | 5.4 / 8.8 | 0.44 / 0.66 |
| Seated volume % | 43 / 59 | 1.7 / 3.6 |
| Lengths within 3 u | 32 | 32 |
| With a warning | 24 | 31 |

Scenarios A to E, G and H: every column unchanged (no one-sided taper found). The lengths above 1 % in F after the change are three squat pistol bullets 340, 395 and 315 px across: 1.96 % (3 u = 9.0 %, shadow named), 3.02 % (3 u = 7.9 %, no warning: the axis of a bullet 1.14 calibres long turns about 11 degrees with the shadow, and no side is clear) and 1.57 % (3 u = 10 %, shadow named). The stated length uncertainty on F stays about 3 to 11 % of the length: the soft edge still raises every edge position's uncertainty.

## Result

Improved: adopted. The accept rule is met (Numbers). Shadows offset towards the base, far along the axis with little blur, or reaching the base are not taken out (#916, and a note where the base is not clear); an axis the user types is not checked (#917).

## Data basis

Analytic: synthetic photographs rendered from the drawings of bullet records and test shapes (`renderPhoto`), as in the catalogue evaluation.

## Where in the app

- `apps/web/src/lib/bullet-photo-outline.ts` (`sideTapers`, `withoutShadow`).
- `apps/web/src/lib/bullet-photo-measure.ts` (`boatTailOf`).
- `apps/web/src/lib/bullet-photo-quality.ts` (the notes naming the shadow).
- `apps/web/test/bullet-photo-catalogue.test.ts` (the evaluation).
- `apps/web/test/bullet-photo-quality.test.ts` (scenario F's shadow on three flat bases, a boat tail under a shadow that reaches the base).
- Model page: [bullet from a photo](../models/bullet-photo.md). Earlier entries: [synthetic photographs](./bullet-photo-synthetic-renders.md), [catalogue bullets](./bullet-photo-catalogue-geometry.md).

## Confidence

Medium: the renders share one shadow model (a blurred, offset silhouette darkening the paper) with the truth, and real shadows, lenses and backgrounds are untested.
