---
title: Blob detector against an area-count hole detector
description: Why the hole detector on target photos uses a click-calibrated colour axis with a multi-scale blob detector, and which variants of automatic detection were dropped.
---

# Blob detector against an area-count hole detector

## Question

[Hole detection](../models/hole-detection.md): does a multi-scale blob detector on a click-calibrated colour axis find more holes than a morphological area-count detector, across the hole picked as the example and across photos, and which variants of automatic detection raise recall without more false proposals?

## Method

Both detectors ran on the same photos with each marked hole in turn as the example, a marked region, and 0.75 of the hand-marked hole size as the bullet size. Metric: shots found at the worst example and at the median example per photo.

Variants of automatic detection (8 seed runs, the 4 strongest blob peaks of each polarity) were tried on the photos not in the repository: (a) the union of the shots of all seed runs; (b) seeds restricted to the surface kind (black area or paper); (c) the size refinement that runs again at the refined hole size, without a recognised face.

## Formulas

Blobs are peaks of the scale-normalised Hessian response at scales tied to the expected hole diameter $D$, $\sigma = f D$ ([hole detection, blob response](../models/hole-detection.md#blob-response); after [Lindeberg 1998](../bibliography.md#lindeberg-1998)). The area-count detector divided the area of each connected dark part by the area of one expected hole.

## Numbers

Why the area-count detector swung: the editor took the expected hole size from the bullet diameter, but paper closes behind a bullet and a hole shows about 0.6 to 0.8 of it. A size off by 25 % or more removed most of its proposals.

Shots found, blob detector (area-count detector in brackets):

| Photos | worst example | median example |
| --- | --- | --- |
| ten-shot face | 10 (8) | 10 (9) |
| .22 scan | 5 (5) | 5 (5) |
| paper face, 8 holes | 7 (5) | 7 (7) |
| painted pistol face, 10 holes | 8 (9) | 10 (9) |
| three photos not in the repository, 40 shots | 35 (13) | 39 (26) |
| four openly licensed photos, 33 shots | 30 (27) | 32 (30) |

Automatic detection with the marked region: 32 of 33 and 35 of 40 shots (area-count: 14 and 21).

Variants: (a) raised the false proposals (to 22 and 43 on photos without a face) by more than the recall. (b) left one photo at 0 of 10 shots. (c) gained the 20-shot photo and lost one shot of five and one of eight on two others.

## Result

Improved: the blob detector replaced the area-count detector. The hole size is taken from the scale-space maximum at the picked hole, then from the strongest peaks of the region. Variants (a) and (b) are not adopted. Variant (c) is adopted in a reduced form: it runs only when a face is found, and the first run is kept when the run at the refined size gives the first size again.

## Data basis

Measured; the measurements are not in the repository.

## Where in the app

- `apps/web/src/lib/hole-detection.ts`.
- `apps/web/src/lib/blob-detector.ts`.
- Model page: [hole detection](../models/hole-detection.md).

## Confidence

Medium: the thresholds were set on these photos, so the counts are optimistic; the recall change of variant (a) was not recorded.
