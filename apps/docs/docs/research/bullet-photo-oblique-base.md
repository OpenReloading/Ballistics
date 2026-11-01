---
title: A slanted base face against a shadow past the base in a bullet photograph
description: Whether a clean bullet with a base face cut at an angle, or an axis turned a little, gets a shadow named, and how a straight face is told from a shadow's end.
---

# A slanted base face against a shadow past the base in a bullet photograph

## Question

Bullet from a photo: since a base end softer on one side names a shadow ([the axis after a trimmed shadow](./bullet-photo-axis-after-trim.md)), does a clean bullet with a base face cut at an angle (a slanted sprue cut) or an axis fitted a little off get a shadow named, and can a straight face be told from a shadow's end (#963)?

## Method

- **Data.** Product-style renders as in [the axis after a trimmed shadow](./bullet-photo-axis-after-trim.md) (light background, side shading, noise 3, no ruler, the scale from the diameter, the bullet turned 3 degrees) of the 7.82 x 30 mm rifle bullet and the 9.02 x 15.5 mm pistol bullet, both flat-based. Without a shadow: the base face cut 0.5, 1, 2 and 5 degrees off the cross-section (`renderPhoto`, `obliqueBase`) at 15, 30, 40 and 60 px per mm, blur 1 and 2 px: 64 renders; and the fitted axis forced 0.3, 0.4 and 0.5 degrees off either way at 40 and 60 px per mm, blur 1 and 2 px, turned 0 and 3 degrees: 96 renders. With a shadow: 0.3, 0.6 and 1.2 mm towards the base, 0.3 and 0.9 mm across, blur 0.2, 0.3 and 0.6 mm, depth 0.2, at 15, 30 and 60 px per mm, blur 1 px: 108 renders. Plus the catalogue evaluation (`apps/web/test/bullet-photo-catalogue.test.ts`, scenarios A to H).
- **Compared.** The tool of #964 against the change.
- **Metric.** A note naming a shadow; the length error against the larger of 1 % and 3 stated uncertainties; every column of the catalogue evaluation.
- **Accept rule** (decided before the change). Every render with a shadow has its length within the larger of 1 % and 3 u, or a note names the shadow. Fewer clean renders name a shadow. The catalogue evaluation keeps every photograph within 3 u or named.

## Formulas

As in [a shadow past the base](./bullet-photo-shadow-past-base.md): the early side reaches half its shank line $\ell$ at sample $i_e$, the late side at $i_l \ge i_e + 3$, and where the late side does not cross $0.9\,\ell$ within $0.2\,(i_l - i_e)$ samples the base end is softer on that side. A straight face at an angle, of half width $a$ and turned by $\delta$, reaches the late side over $2a\tan\delta$ along the axis, linearly: the late side takes as many samples $n_1$ from $0.1\,\ell$ to $0.5\,\ell$ as $n_2$ from $0.5\,\ell$ to $0.9\,\ell$, while the early side's corner goes from $0.5\,\ell$ to $0.9\,\ell$ within $n_e$ samples of its blur. A shadow's end ramps on unevenly or leaves the early side soft. The shadow is not named where

$$n_e \le 1,\qquad \max(n_1, n_2) \ge 3,\qquad \lvert n_1 - n_2\rvert \le 1 + 0.1\max(n_1, n_2).$$

Below 3 samples the two ramps differ by the rounding of one sample and tell nothing.

## Numbers

| Renders | #964 | This change |
| --- | --- | --- |
| Base face cut 0.5 to 5 degrees, no shadow (64) | 40 name a shadow | 14 name a shadow |
| Axis forced 0.3 to 0.5 degrees off, no shadow (96) | none named | none named |
| With a shadow (108) | every one within 1 % or 3 u, or named | every one within 1 % or 3 u, or named; 14 within and not named |

Every render with a slanted face reads its length within 1 % or 3 u, before and after. The catalogue evaluation keeps every column of A to H but one: in F (every photograph with a drop shadow) the photographs with a warning go from 32 back to 31 of 32, as before #964. The note leaves the photograph #964 added it for, which reads 0.32 mm (3 %) long with a stated uncertainty of 0.28 mm, so within 3 u.

## Result

Improved: adopted. 26 of the 40 slanted faces that got a shadow named no longer do; the 14 left ramp over 2 samples or less (cut 0.5 to 2 degrees off, or at 15 px per mm with a 2 px blur), where a straight face and a shadow's end look alike. An axis fitted 0.3 to 0.5 degrees off named no shadow in any of its 96 renders with #964 already. The one catalogue photograph that loses its note keeps its length within 3 times its stated uncertainty; a straight base end and a shadow's end that both ramp on evenly cannot be told apart from the outline alone.

## Data basis

Analytic: synthetic photographs rendered from bullet drawings (`renderPhoto`).

## Where in the app

- `apps/web/src/lib/bullet-photo-outline.ts` (`withoutOverhang`, `straightFace`).
- `apps/web/src/lib/bullet-photo-sample.ts` (`obliqueBase`).
- `apps/web/test/bullet-photo-quality.test.ts` (the slanted base faces).
- `apps/web/test/bullet-photo-catalogue.test.ts` (the evaluation).
- Model page: [bullet from a photo](../models/bullet-photo.md).

## Confidence

Medium: one shadow model and one way of cutting the base; real slanted faces, rough sprue cuts and real shadows are untested.
