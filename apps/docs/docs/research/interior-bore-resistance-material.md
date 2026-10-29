---
title: Bullet material in the bore-resistance law
description: Whether solid copper and jacketed lead bullets should get their own friction stress or engraving profile, from three measures of how much more a solid copper bullet resists.
---

# Bullet material in the bore-resistance law

## Question

Interior ballistics, bore resistance: should solid copper and jacketed lead bullets get a different friction stress or engraving profile through a material input?

## Method

Three measures of how much more a solid copper bullet resists than a jacketed lead bullet in 5.56 mm and 7.62 mm were compared: the mean work over the barrel at firing speed, the peak push pressure of quasi-static push tests, and the fitted handgun start pressure of the [start-pressure entry](interior-start-pressure-rules.md). The first two are published measurements; their figures are unverified here. The friction law of the load-table fit was evaluated for the same bullets.

## Formulas

Friction pressure of the resistance law ([M3, bore resistance](../models/interior-m3.md#bore-resistance)):

$$
p_f = \tau_f\, \frac{\pi G_1 L}{A} \left(1 + c\, o\right)
$$

A stress per bearing area needs the bearing length $L$.

## Numbers

| Measure | Solid copper over jacketed lead |
| --- | --- |
| mean work at firing speed, two comparisons | 1.50 and 1.11 (10.5 and 3.4 times the combined uncertainty; the bullets differ in mass and length) |
| peak push pressure, 7.62 mm (read from a plot) | about 3 to 4 (14500 / 4100 psi) |
| fitted handgun start pressure | 1.6 (50.0 / 30.8 MPa; the intervals overlap between 33.8 and 40.6 MPa) |

No bearing length is given for any of the measured bullets, so a stress per bearing area cannot be derived. The friction law at 0.42 MPa gives 3 to 6 MPa for a 10 to 19 mm bearing on a 5.69 mm bullet; the mean push forces over the bore area are 3 to 11 times that. In a published simulation a change of the whole resistance profile by about 40 % moves the peak pressure by +11 % and -8 % and the velocity by +0.8 % and -0.5 %. The load-table fit does not resolve an effect of this size per load (its resistance variants differed by under 0.1 points of velocity error).

## Result

No change. Not adopted: the effect shows in simulated peak pressure and hardly in velocity, and no pressure trace by bullet material exists to test it. Documented as a limit: the material enters the model only through the start pressure by bullet construction (24 to 31 MPa for lead, plated and jacketed handgun bullets, 50 MPa for solid bullets below a 300 mm barrel).

## Data basis

Measured. The measurements are not in the repository.

## Where in the app

- `packages/core/src/interior/bore-resistance.ts`, `boreResistance`.
- `packages/core/src/interior/start-pressure.ts`, `defaultStartPressure`.
- Model page: [M3 model](../models/interior-m3.md).

## Confidence

Medium that solid copper resists more, low for the size: the published figures are unverified and differ by a factor of about 3.
