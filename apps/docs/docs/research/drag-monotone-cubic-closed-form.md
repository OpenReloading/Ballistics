---
title: Monotone cubic drag interpolation against hand-computed values
description: Whether the monotone cubic reading of a drag table reproduces the exact values of the slope limit on small tables, and the line on two nodes.
---

# Monotone cubic drag interpolation against hand-computed values

## Question

Drag: does the monotone cubic interpolation of a drag table, `dragTableOf` with the cubic option, give the values that the slope rule of the [drag page](../models/exterior-drag.md) gives by hand?

## Method

Three small tables were evaluated by hand and compared with the code at selected Mach numbers. The accept limit, from the tests: a relative difference below $10^{-15}$ in every case.

| Table (Mach, coefficient) | Mach | Hand value |
| --- | --- | --- |
| (0, 0), (1, 1), (3, 2) | 0.5 | 25/48 |
| (0, 0), (1, 1), (3, 2) | 2 | 19/12 |
| (0, 0), (1, 1), (2, 6) | 0.5 | 3/8 |
| (0, 0), (1, 1), (2, 6) | 1.5 | 25/8 |
| (0.5, 0.3), (2.5, 0.7) | 0.6, 1, 1.7, 2.4 | $0.3 + 0.2\,(M - 0.5)$ |

A fourth case reads the first segment of the first table past its nodes, at Mach 1.5, and expects 21/16.

## Formulas

The slope at an interior node is the three-point parabola slope $p_j$ limited to twice the smaller adjacent secant, and the end nodes take the end secants ([monotone cubic interpolation](../models/exterior-drag.md); the limit follows [Fritsch 1980](../bibliography.md#fritsch-1980), pages unverified). For the first table the secants are 1 and 1/2, the parabola slope is 5/6, so the interior slope is $2 \min(1,\ 1/2,\ 5/12) = 5/6$. For the third table the secants are 1 and 5, the parabola slope is 3, so the interior slope is $2 \min(1,\ 5,\ 3/2) = 2$, set by the smaller secant, not by the parabola. With two nodes there is one secant and the cubic is the line.

## Numbers

All five groups agree within $10^{-15}$ relative. The steep table checks which term sets the slope: the smaller secant 1 bounds it, not the parabola slope 3, so the slope is 2 and the values are 3/8 and 25/8.

## Result

No change. The slope rule, the Hermite form and the extension past the nodes are implemented as written.

## Data basis

Analytic: values worked out by hand for three tables, no measured data.

## Where in the app

- `packages/core/src/exterior/drag.ts`, `nodeSlope`, `onSegment`, `segmentCoefficient`.
- `packages/core/test/exterior-drag.test.ts`, the tests "matches the closed form on three nodes and the line on two" and "extends the cubic of a segment past its nodes".
- Model page: [drag](../models/exterior-drag.md).

## Confidence

High: exact fractions, agreement at rounding level. Three nodes exercise one interior slope only; the standard tables, with many nodes, are not compared with an independent implementation.
