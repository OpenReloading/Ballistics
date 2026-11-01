---
title: An axis direction typed a few degrees off the bullet's
description: Whether the bullet photo tool can tell an axis direction the user typed from the bullet's own axis, and stop the turned base face from reading as a boat tail.
---

# An axis direction typed a few degrees off the bullet's

## Question

Bullet from a photo: when the user types the axis direction a few degrees off the bullet's own axis, can the tool say so and keep a flat base from reading as a boat tail (#917)?

## Method

- **Data.** Synthetic photographs (`renderPhoto`) of a 7.82 x 30 mm secant-ogive bullet lying 3 degrees off level, with a flat base and with a 5.5 mm boat tail, at 20 and 40 px per mm, measured with the axis direction typed 0, 0.5, 1, 2, 3, 5 and -3 degrees off the true one.
- **Compared.** The tool of #918 against the change, same renders.
- **Metric.** The base type and boat-tail length measured, and whether a note names the typed axis.
- **Accept rule** (the issue's acceptance, decided before the run). A flat base with the axis typed 3 degrees off gives no boat tail, or a note that the axis direction does not match the bullet. The catalogue evaluation (`apps/web/test/bullet-photo-catalogue.test.ts`, scenarios A to H, found axis) keeps every number.

## Formulas

With a typed axis only the offset is fitted, so the axis need not be the symmetry line. Each side's shank edge is fitted with a line $a + b z$; a turn $\delta$ of the axis off the bullet's makes the two slopes equal and opposite, $b_l \approx \tan\delta$, $b_r \approx -\tan\delta$, so $\delta \approx \tfrac{1}{2}\lvert\arctan b_l - \arctan b_r\rvert$. The base face, square to the bullet's axis, then crosses the columns square to the typed axis over $2a\tan\delta$ px, so one side's outline starts later than the other's: a taper on one side only, which the boat-tail check of #902 does not report once its base samples are found (they are now looked for in the outline's first half rather than before the shank starts, which on a flat base begins right after the corner).

## Numbers

| Render | Typed off | Before | After |
| --- | --- | --- | --- |
| Flat base, 40 px/mm | 0, 0.5, 1 degrees | flat | flat, no note |
| Flat base, 40 px/mm | 2 degrees | boat tail 0.27 mm | flat, note "about 2 degrees" |
| Flat base, 40 px/mm | 3 degrees | boat tail 0.41 mm | flat, note "about 3 degrees" |
| Flat base, 40 px/mm | 5 degrees | flat | flat, note "about 5 degrees" |
| Flat base, 20 px/mm | 5 degrees | boat tail 0.68 mm | flat, note "about 5 degrees" |
| Flat base, 20 px/mm | 2, 3, -3 degrees | flat | flat, note |
| Boat tail 5.5 mm, 40 px/mm | 3, -3 degrees | not run | boat tail 5.66 mm, note "about 2.7 degrees" |

The catalogue evaluation (found axis) is unchanged on every column of scenarios A to H.

A first version named any turn of 1 degree or more. The second reader showed that a short shank fitted over 10 samples has a slope uncertainty of about 1.3 degrees on the half difference, so the note would fire about half the time on an axis typed right: the threshold now also needs three standard uncertainties of the angle. Five seeds of a 9.02 x 15.5 mm pistol bullet at 8 px per mm with the axis typed right give no note.

## Result

Improved: adopted. A typed axis 1 degree and three standard uncertainties or more off the shank's symmetry line is named with its angle (or a shadow widening one side), and the turned base face gives no boat tail. The lengths along a typed axis turned off are still read along it (0.6 % long at 3 degrees and 40 px/mm): the note asks to clear or retype the direction.

## Data basis

Analytic: synthetic photographs rendered from a bullet drawing (`renderPhoto`).

## Where in the app

- `apps/web/src/lib/bullet-photo-outline.ts` (`typedAxisOff`, `sideTapers`).
- `apps/web/src/lib/bullet-photo-quality.ts` (the note).
- `apps/web/test/bullet-photo-quality.test.ts` (a flat base and a boat tail with the axis typed 3 degrees off).
- Model page: [bullet from a photo](../models/bullet-photo.md). Earlier entry: [a drop shadow](./bullet-photo-drop-shadow.md).

## Confidence

High for the renders: the turn shows as two opposite shank slopes in any photograph with a parallel shank; untested on real photographs.
