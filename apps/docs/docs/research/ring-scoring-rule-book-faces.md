---
title: Ring scoring against the rule books
description: Whether the ring value, tenth-ring value and inner ten change exactly where the printed ring diameters, plug gauges and touch rules of the rule books put them, and whether the target fit recovers a known face.
---

# Ring scoring against the rule books

## Question

Ring scoring: does `scoreShot` change the ring value, the tenth-ring value and the inner ten exactly at the hole positions the rule books give, from their printed ring diameters, plug gauges and touch or hole-centre rules, and does `fitRings` recover the centre and scale of a face from marks on its rings?

## Method

For each face the test places a hole on the boundary the rule implies and $10^{-6}$ mm inside and outside it (the scoring tolerance is $10^{-9}$ mm) and checks the value on both sides. The faces and rules come from the target face records, which cite the rule books. Accept rule, set in the tests: the exact expected value on each side of every boundary.

- ISSF 10 m air rifle, 10 m air pistol, 25 m rapid fire, 50 m rifle, 300 m rifle: 10 ring, inner ten, outermost ring, gauge diameter in place of the bullet, tenth-ring values.
- National faces: DSB Scheibe Nr. 2 and Nr. 8, BDS Z19, BDMP Nr. 1 at 100, 50 and 25 m, DSU 200 m Präzision and the oval and stadium faces b2 to b5, VdRBw 10.3, and the events that score by the hole centre.
- Oval rings: the touching gap checked against a brute-force search over 200,001 points of the ellipse, and against holes placed a known distance out along the ellipse normal.
- Ring fit: a face 2 percent off its calibration, marks on two rings with 0.05 mm noise; exact marks with four points on two rings; refusals of degenerate marks.

## Formulas

A hole of diameter $D_h$ (the event's plug gauge where it fixes one) at distance $r$ from the centre scores ring $n$ when it touches that ring, $r \le D_n/2 + D_h/2$, with $D_n$ measured to the outside edge of the ring line, the higher value on touch ([ISSF 2022](../bibliography.md#issf-2022), rules 1.1.2, 1.4.1 to 1.4.10 and 5.2.1). Where a rule counts the hole centre, $D_h$ is 0 ([BDMP 2026](../bibliography.md#bdmp-2026), A.3.21.4.1; [DSU 2018](../bibliography.md#dsu-2018), Kapitel 4). The tenth-ring value counts tenths of the ring width inward from the touching edge, and the inner ten follows the event's rule ([ISSF 2025, Third Print](../bibliography.md#issf-2025-third), rules 6.3.3.1 and 6.3.4.1 to 6.3.4.6). The distance from a point to an oval ring is the closest-point distance to an ellipse ([Eberly 2013](../bibliography.md#eberly-2013)). The ring fit starts from an algebraic circle fit ([Kasa 1976](../bibliography.md#kasa-1976)).

## Numbers

- ISSF 10 m air rifle, 4.5 mm hole: 10 up to 2.5 mm from the centre (0.25 mm dot radius plus 2.25 mm), 9 beyond; inner ten up to 2.0 mm, where the hole covers the dot; 10.9 within 0.25 mm; 1 at 25 mm, 0 beyond.
- ISSF 10 m air pistol: inner ten up to 4.75 mm, 10 up to 8.0 mm.
- ISSF 300 m rifle with the 8 mm gauge: 10 up to 54 mm, inner ten up to 29 mm.
- ISSF 50 m rifle, 5.6 mm: 10.9 within 0.8 mm, 10.0 at 8.0 mm, 9.5 at 12.0 mm.
- ISSF 25 m rapid fire, 5.6 mm: 5 up to 252.8 mm, 0 beyond.
- DSB Nr. 8: inner ten up to 7.75 mm (5.5 mm plus 2.25 mm).
- Each national face listed under Method: its boundaries as printed.
- Oval rings: the touching gap agrees with the brute-force search within $10^{-3}$ mm and with the placed holes within $10^{-6}$ mm.
- Ring fit with 2 percent calibration error and 0.05 mm noise: centre within 0.05 mm, scale within 1 percent, rms misfit below 0.1 mm. Exact marks: centre and scale to 12 decimal places.
- Not tested: holes measured on real paper targets, where a torn or overlapping hole is read by a person.

## Result

No change. The tests are adopted as regression tests.

## Data basis

Public: the ring diameters, gauges and scoring rules of the cited rule books, through the target face records; the oval geometry and the ring fit on synthetic points.

## Where in the app

- `apps/web/test/ring-scoring.test.ts`, `apps/web/test/ring-scoring-national.test.ts`, `apps/web/test/ring-scoring-shapes.test.ts`.
- `apps/web/src/lib/ring-scoring.ts`.
- Model page: [ring scoring](../models/ring-scoring.md).

## Confidence

High: every boundary is checked on both sides against values printed in the rule books; scoring of real targets depends on where the hole is marked.
