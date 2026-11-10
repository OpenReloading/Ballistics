---

title: Target center on a tilted photo
description: Whether the center of the ellipse fitted to the black area is close enough to the target center under perspective, against the center from two concentric ring ellipses.
---

# Target center on a tilted photo

## Question

[Hole detection](../models/hole-detection.md), recognized target: is the center of the ellipse fitted to the black area close enough to the target center of a photo taken at a slant to score the holes?

## Method

The center from the conic pencil of two concentric ring ellipses was compared with the center of the ellipse fitted to the black area, on three photos of 25 m pistol targets not in the repository (rotated, 20 shots, dark holes). The holes were marked by hand and scored with a 9.65 mm gauge against the scores written on the targets.

## Formulas

Under perspective the image of a circle's center is not the center of its ellipse. The pencil of two concentric ellipses gives the vanishing line of the target plane and the image of the common center ([hole detection](../models/hole-detection.md), the plane step; `concentricPlane`).

## Numbers

The black-ellipse center lies 3.8, 16.1 and 6.6 mm from the center of the pencil. With the pencil center the scores equal the written ones on 2 of 3 targets (1 x 7, 4 x 8, 4 x 9, 1 x 10; and 1 x 7, 5 x 8, 7 x 9, 7 x 10). With the black-ellipse center they equal none: one shot off on two targets, and on the third 4 x 10 and 2 x 9 against the written 5 x 10 and 1 x 9 (one hole there was marked by hand on the edge of the 9 ring).

## Result

Improved: the conic-pencil center is the target center. The black-ellipse center is not adopted as the center; it is the fallback when only one ellipse is found, and the editor says that it is biased under tilt.

## Data basis

Measured. The measurements are not in the repository.

## Where in the app

- `apps/web/src/lib/target-face.ts`, `ringPlane`, `fitFace`.
- `apps/web/src/lib/ellipse.ts`, `concentricPlane`.
- Model page: [hole detection](../models/hole-detection.md).

## Confidence

Medium: three photos of one target type.
