---
title: Rifle cant in the hit probability
description: Whether a cant standard deviation is worth an input of the hit-probability model, from the closed form of the impact shift and a seeded simulation of normally distributed cant.
---

# Rifle cant in the hit probability

## Question

Hit probability (`hit-probability.md`): how large is the horizontal spread from a varying rifle cant at 200 and 1000 yd, and does a shooter know a cant standard deviation well enough for an input?

## Method

Accept rule, decided before any run: the closed form agrees with the figures of the question to 1 percent, and a seeded simulation of normally distributed cant agrees with the model standard deviation to 3 percent. The input is built only if a shooter can fill it from something they know; no typical cant standard deviation is known, so the default is not to build it.

Synthetic case: a rifle zeroed with the sight raised to compensate for drop, rolled about the bore by an angle $c$; the drops are 7.93 in at 200 yd and 296 in at 1000 yd (figures of the question, unverified). The closed form is compared with the drop vector rotated about the origin (the same trigonometry: a check of the algebra, not an independent measurement). The simulation draws 400 000 cants per case from a fixed seed (mulberry32, Box-Muller) for cant standard deviations of 0.5, 1, 2, 3 and 5 degrees.

Run: `node packages/core/scripts/hit-probability-cant.mts`.

## Formulas

A drop $H$ below the line of sight, rolled by $c$, moves the impact right by $H\sin c$ and up by $H(1-\cos c)$. For a cant with zero mean and standard deviation $\sigma_c$ in radians the horizontal standard deviation is, for small angles, $H\sigma_c$ and the mean vertical shift $H\sigma_c^2/2$ (first-order expansion of sine and cosine, no source). Added in quadrature to the horizontal group part this is $\sqrt{\sigma_{g,x}^2 + (H\sigma_c)^2}$.

## Numbers

One degree of cant: 200 yd, 7.93 in drop: horizontal 0.1384 in, vertical 0.0012 in (figures of the question: 0.14 in and 0.001 in, rounded to two digits, 1.1 percent and a rounded 0.001). 1000 yd, 296 in drop: horizontal 5.166 in (figure of the question 5.2 in, 0.7 percent), vertical 0.045 in. The rotation of the drop vector gives the same values to the printed digits.

Seeded simulation against $H\sigma_c$, error in percent of the model, largest over the five cant standard deviations: 200 yd 0.33 percent (5 degrees), 1000 yd 0.34 percent (5 degrees); at 1 degree 0.08 and 0.04 percent. Model horizontal standard deviation:

| Cant SD, degrees | 200 yd, in | 1000 yd, in |
| --- | --- | --- |
| 0.5 | 0.069 | 2.58 |
| 1 | 0.138 | 5.17 |
| 2 | 0.277 | 10.33 |
| 3 | 0.415 | 15.50 |
| 5 | 0.692 | 25.83 |

For scale, a group of 0.15 mrad standard deviation is 1.08 in at 200 yd and 5.4 in at 1000 yd. One degree of cant is 1.6 percent of the horizontal variance at 200 yd and 48 percent at 1000 yd.

## Result

No change. Documented as a limit (Limits of the [model page](../models/hit-probability.md)), not built as an input. The closed form and the simulation agree (1.1 percent against the rounded 0.14 in is within the rounding of the figure, 0.7 percent against 5.2 in), but no typical cant standard deviation is known, so the field fails the gate.

## Data basis

Analytic. A closed form and a synthetic case; the drops are figures of the question, unverified.

## Where in the app

- `packages/core/src/groups/hit-probability.ts` (`pointDispersion`)
- [Hit probability](../models/hit-probability.md)

## Confidence

High for the geometry and the simulation; low for the claim that no cant standard deviation is knowable by a shooter, which is a judgement without data.
