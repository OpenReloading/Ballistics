---
title: Rings needed to apply a recognised target without a question
description: How many matched rings a target recognised on a photo needs before the app applies it without the user confirming it.
---

# Rings needed to apply a recognised target without a question

## Question

[Hole detection](../models/hole-detection.md), recognised target: how many rings matched to a target record does a recognition need before the app applies it automatically, without asking the user?

## Method

Ring lines from a Hessian ridge detector, grouped by normalised radius, one robust ellipse per group; each ring matched to the nearest ring of a target record within 3 % of its radius (true matches lay within 1.7 %). Seven photos not in the repository: three 25 m pistol targets and four others.

## Formulas

A ring of relative radius $\rho$ matches a ring $\rho_j$ of a record when $|\rho - \rho_j| \le 0.03\, \rho_j$ (`TOLERANCE` in `apps/web/src/lib/target-face.ts`); the match score ranks the records, and `SURE_SCORE` (2.5) is the score of a sure match.

## Numbers

The three pistol targets are found with 5 or 6 ellipses and applied. The four others are not found: an orange target and a red band have no black area, and a pistol target and a 100-yard target show a black area with at most two matching rings. An earlier version fitted the 100-yard target to the 10 m air pistol target with three matched rings: equal ring spacing is a coincidence often enough at three rings.

## Result

Improved: a target is applied without a question only when exactly one record fits (no other record within 0.5 of the top score with at least 3 matched rings), that record has at least 4 matched rings (`SURE_RINGS`) and a score of at least 2.5 (`SURE_SCORE`), and, without a known photo scale, no other record matches every ring it matches; otherwise it is proposed and the user confirms. Applying a target from three matched rings is not adopted. The rim test of the black area and the 3 % tolerance came from this case.

## Data basis

Measured. The measurements are not in the repository.

## Where in the app

- `apps/web/src/lib/target-face.ts`, `matchFaces`, `scoreMatch`.
- Model page: [hole detection](../models/hole-detection.md).

## Confidence

Low: seven photos.
