---
title: How the peak-pressure range combines input tolerances
description: One input at a time, all inputs at the pressure-raising and lowering ends, all vertices, root-sum-square and Monte Carlo, compared on synthetic M3 loads.
---

# How the peak-pressure range combines input tolerances

## Question

Interior ballistics, [pressure range](../models/interior-pressure-range.md): how should the app turn input tolerances into a peak-pressure range?

## Method

Adopted method: each input alone at both ends of its tolerance, then all inputs together at the pressure-raising ends and at the pressure-lowering ends (13 runs with the inputs of the test load). Compared with: one input at a time only; the root-sum-square of sensitivity times standard uncertainty; Monte Carlo propagation; all $2^n$ vertices (32 runs). Test load: an M3 rifle load with temperature coefficients 0.003 and 0.004 per K and a start pressure of 30 MPa. Vertex check on 9 synthetic loads with a complete range. Metrics: the high and low ends of each method's range in percent of the nominal peak, the difference of the combined ends from the extremes over all vertices, and the number of runs and their wall time. The run states no accept rule fixed in advance; the result below rests on these metrics.

## Formulas

The direction of input $q$ is the sign of the pressure change between its two ends, and the range spans the nominal run and both combined cases ([pressure range](../models/interior-pressure-range.md)):

$$
s_q = \operatorname{sign}\bigl(p_q^{+} - p_q^{-}\bigr), \qquad p_\text{low} = \min\bigl(p_\text{nom}, \min_c p_c\bigr), \qquad p_\text{high} = \max\bigl(p_\text{nom}, \max_c p_c\bigr)
$$

## Numbers

Nominal peak 3538.9 bar; combined range 3081.4 to 4077.7 bar (-12.9 % and +15.2 %).

| Input | high side % | low side % |
| --- | ---: | ---: |
| charge | +1.41 | -1.39 |
| volume | -1.77 | +1.85 |
| burn rate | +5.35 | -5.20 |
| temperature | +3.58 | -2.60 |
| start pressure | +2.39 | -2.47 |

The largest single-input change is 5.35 %, so the single-input cases alone show about a third of the combined +15.23 %. Summing the pressure-raising side of each input (+1.41, +1.85, +5.35, +3.58 and +2.39, unrounded) gives +14.59 %, 0.64 % of nominal below the combined case. On the 9 synthetic loads the combined ends equal the extremes over all 32 vertices exactly; the vertices cost 2.5 times as much (13 runs take 21.0 ms).

## Result

No change. Adopted as built; not adopted: one input at a time (understates the spread by more than half), all vertices (same extremes at 2.5 times the cost), root-sum-square and Monte Carlo (they need standard uncertainties and distributions that no measurement supports, and their result reads as a statistical interval), a fixed relative band (no measurement supports a value).

## Data basis

Analytic: synthetic loads. The vertex comparison is not a committed test.

## Where in the app

- `packages/core/src/interior/range.ts`, `toleranceRange`.
- `packages/core/test/interior-range.test.ts`.
- Model page: [pressure range](../models/interior-pressure-range.md).

## Confidence

Medium: the vertex equality holds on 9 loads where the pressure is monotone in each input, which the method assumes.
