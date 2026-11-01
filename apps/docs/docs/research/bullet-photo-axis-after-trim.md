---
title: The axis after a trimmed shadow in a bullet photograph
description: Whether fitting the axis again after a shadow past the base is trimmed, and naming a base end softer on one side, keeps every shadow towards the base from going unnamed.
---

# The axis after a trimmed shadow in a bullet photograph

## Question

Bullet from a photo: after a shadow past the base is trimmed ([a shadow past the base](./bullet-photo-shadow-past-base.md)), does fitting the axis again on the trimmed cut-out set it right, and does naming a base end softer on one side leave no render with a shadow towards the base silently long (#934)?

## Method

- **Data.** Product-style renders as in [a shadow past the base](./bullet-photo-shadow-past-base.md) (light background, side shading, noise 3, blur 1 px, no ruler, the scale from the diameter, the bullet turned 3 degrees) of the 7.82 x 30 mm rifle bullet and the 9.02 x 15.5 mm pistol bullet, both flat-based, at 15 and 30 px per mm, the shadow 0.3, 0.6 and 1.2 mm towards the base and 0.3 and 0.9 mm across, blur 0.6 mm, depth 0.2: 24 renders. Clean renders without a shadow: the two bullets plus a boat tail, a rebated boat tail and a conical and a rounded hollow base on the rifle bullet, at 10, 20, 40 and 60 px per mm, turned 0, 3, 30, 90 and 160 degrees, blur 0.6 and 1.5 px: 240 renders. Plus the catalogue evaluation (`apps/web/test/bullet-photo-catalogue.test.ts`, scenarios A to H).
- **Compared.** The tool of #935 against the change.
- **Metric.** Length error against the larger of 1 % and 3 stated uncertainties, a note naming a shadow, the axis angle against the rendered one; on the clean renders the outline and whether a shadow is named; every column of the catalogue evaluation.
- **Accept rule** (the issue's acceptance, decided before the run). On the 24 renders every length is within the larger of 1 % and 3 u of the truth, or a note names a shadow. The clean renders name no shadow. The catalogue evaluation keeps its numbers for A to H.

## Formulas

As in [a shadow past the base](./bullet-photo-shadow-past-base.md): $i_l$, $i_r$ are the first samples where each side reaches half its shank line. After a trim the cut-out is cleared where $s < 0$ along the trimmed axis, and the axis is settled again on what is left (the middle of both edges on a least-squares line, as for the first fit) and the profile rebuilt. Where $\lvert i_l - i_r\rvert \ge 3$ but the late side does not cross $0.9\,\ell$ within $0.2\,\lvert i_l - i_r\rvert$ samples, nothing is trimmed and the shadow is named on the early side as not removed.

## Numbers

| Render | #935 | This change |
| --- | --- | --- |
| Pistol, 30 px/mm, shadow 1.2 mm towards the base, 0.9 mm across | 25.5 px long, axis 3.47 degrees off, no shadow named | the same outline, shadow named |
| Pistol, 30 px/mm, 1.2 mm, 0.3 mm across (trimmed) | -2.7 px, axis 1.71 degrees off | +2.3 px, axis 0.58 degrees off |
| Rifle, 30 px/mm, 0.6 mm, 0.3 mm across (trimmed) | +1.4 px, axis 0.20 degrees off | +1.0 px, axis 0.02 degrees off |
| Rifle, 30 px/mm, 0.6 mm, 0.9 mm across (trimmed) | -0.1 px, axis 0.03 degrees off | -0.4 px, axis 0.16 degrees off |

On all 24 renders the length is within 1 % or 3 u, or a shadow is named, before and after; before, one render (the first row) met the rule only because the scale from its widened diameter shortened its 25 px of overhang. The 240 clean renders give the same outlines before and after and name no shadow. The catalogue evaluation keeps every column of A to H but one: in F (every photograph with a drop shadow) the photographs with a warning go from 31 to 32 of 32; the new note is on a bullet that read 0.32 mm (3 %) long without one.

## Result

Improved: adopted. A trimmed outline is fitted again (the axis of the trimmed renders moves closer to the rendered one on two of three, by 0.13 degrees the other way on the third), and a base end softer on one side gets the shadow note. Neither changes the length of an untrimmed render: a shadow towards the base still widens the shank and lengthens the cut-out, named, not corrected. The accept rule asked for unchanged catalogue numbers; the one change, a warning on a 32nd of 32 photographs in F, is accepted as a deviation from it: every F photograph has a drop shadow, that one read 3 % long without a note, and no value of A to H moved.

## Data basis

Analytic: synthetic photographs rendered from bullet drawings (`renderPhoto`).

## Where in the app

- `apps/web/src/lib/bullet-photo-outline.ts` (`withoutOverhang`, `refitTrimmed`, `fitOutline`).
- `apps/web/test/bullet-photo-quality.test.ts` (the pistol renders and the refit).
- `apps/web/test/bullet-photo-catalogue.test.ts` (the evaluation).
- Model page: [bullet from a photo](../models/bullet-photo.md).

## Confidence

Medium: one shadow model and 24 renders with a shadow; real shadows and the corners of real photographs are untested.
