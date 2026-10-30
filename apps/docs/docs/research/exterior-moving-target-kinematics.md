---
title: Moving target lead against the kinematics
description: Whether the lateral lead and its angle follow speed times time of flight times the sine of the heading, and what the model leaves out.
---

# Moving target lead against the kinematics

## Question

Exterior ballistics: does `movingTargetLead` give the lateral lead and lead angle of a target at constant speed and heading, for crossing, oblique and along-the-line headings?

## Method

The test calls `movingTargetLead` with a fixed time of flight and range and compares with the closed form evaluated in the test. Accept limit, set in the test: 12 decimal places for the lead and the angle, $10^{-12}$ m for a lead that must vanish. Cases: 2 m/s crossing to the right and to the left at 400 m with 0.6 s of flight, 2 m/s at a heading of 30 degrees, 5 m/s at headings 0 and 180 degrees at 300 m with 0.5 s. Negative speed, a range of 0 and a negative time of flight must be refused.

## Formulas

A target moving at $v_t$ with heading $\psi$ covers $L = v_t\, t \sin\psi$ across the line of sight during the time of flight $t$, seen at the angle $\theta = \arctan(L/R)$ from range $R$. This is the kinematics of constant velocity; no reference is cited.

## Numbers

- Crossing at 90 degrees: lead 1.2 m, angle $\arctan(1.2/400)$, about 3 mrad. Crossing to the left: -1.2 m.
- Heading 30 degrees: 0.6 m, half the crossing lead.
- Headings 0 and 180 degrees: lead and angle below $10^{-12}$.
- Each invalid input is refused with an input error.
- Not tested: the error from the target's motion along the line of sight, which changes the range at impact and so the time of flight. The model does not iterate for it (page, Limits); its size is not computed here.

## Result

No change. The tests are adopted as regression tests; the along-the-line error stays documented as a limit.

## Data basis

Analytic: the closed form of constant-velocity motion and synthetic inputs.

## Where in the app

- `packages/core/test/exterior-moving-target.test.ts`.
- `packages/core/src/exterior/moving-target.ts`.
- Model page: [moving target lead](../models/exterior-moving-target.md).

## Confidence

High: the lead is a closed form and the code reproduces it to rounding; the untested along-the-line error is a stated limit.
