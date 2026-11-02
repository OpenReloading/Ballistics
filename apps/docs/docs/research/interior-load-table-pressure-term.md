---
title: Assumed peak pressure for powders fitted from velocities only
description: Whether an assumed peak pressure at the maximum loads removes the pressure overshoot of load-table fits of powders without printed pressures, and what it costs in velocity.
---

# Assumed peak pressure for powders fitted from velocities only

## Question

Interior ballistics, load-table powder fit: can an assumed peak pressure at the maximum loads of each cartridge remove the pressure overshoot of powders fitted from velocities alone, without a cost in velocity?

## Method

The overshoot was measured on 19457 maximum-load rows of the training and validation cartridges as the simulated peak breech pressure over the C.I.P. maximum pressure $p_\text{max}$ of the cartridge. Of 223 fitted powders, 85 have no printed pressure in their tables.

Each powder was refitted on the training rows (vivacity and energy, the energy with a log-normal prior) with one added term per training maximum-load row:

- (a) a pseudo-observation of the peak at $p_\text{max} - 50$ bar or at $0.9\, p_\text{max}$, relative sigma 10 %;
- (b) a one-sided cap that only penalises a peak above $p_\text{max}$, sigma 10 % or 3 %.

Sample: 21 powders without pressure rows (the 10 with the highest overshoot, 10 drawn with a fixed seed, 1 other), of which 14 converged in every variant and have validation maximum-load rows, plus 5 powders with 20 or more pressure rows as a control. Scored on the validation split: median absolute velocity error, mean velocity error, peak over $p_\text{max}$.

## Formulas

Residual of the pseudo-observation (a) and of the cap (b) for a maximum-load row with simulated peak $p$ and target $p_t$:

$$
r_a = \frac{\ln (p / p_t)}{\sigma}, \qquad r_b = \frac{\max\left(0,\ \ln (p / p_\text{max})\right)}{\sigma}
$$

Both join the velocity residuals of the weighted least-squares [powder fit](../models/interior-powder-fit.md).

## Numbers

Before any variant, powders without printed pressure reach a median peak of 122.2 % of $p_\text{max}$ (77.6 % of rows above 100 %); the 123 powders with 20 or more pressure rows reach 93.1 %. The printed maximum-load pressures themselves are at a median 96.8 % of $p_\text{max}$ (P10 82.3 %, P90 106.1 %), and 27.2 % of them are above it. Along the direction the velocity rows leave free (median correlation of ln vivacity and ln energy 0.970) a step of 0.1 changes the velocity by about 0.5 % and the peak pressure by about 12 %.

| Variant (14 powders, validation) | velocity median abs. error % | velocity mean error % | peak / $p_\text{max}$ median % | rows above 100 % | rows above 110 % | fitted / prior energy |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| without the term | 3.32 | -0.17 | 129.3 | 84.8 | 72.6 | 0.69 |
| (a) $p_\text{max} - 50$ bar | 4.35 | -1.31 | 97.7 | 40.1 | 19.2 | 0.77 |
| (a) $0.9\, p_\text{max}$ | 4.71 | -1.82 | 90.4 | 25.7 | 10.0 | 0.86 |
| (b) cap, sigma 10 % | 4.51 | -1.65 | 92.7 | 32.2 | 14.4 | 0.83 |
| (b) cap, sigma 3 % (11 powders) | 7.29 | -3.84 | 81.7 | 5.9 | 1.8 | 1.06 |

On the 5 control powders the variants change the velocity median by -0.05 to +0.28 points; the cap with sigma 3 % raises it from 3.31 % to 3.59 %.

## Result

Worse. Not adopted: the term costs 1.0 to 4.0 points of median velocity error and still leaves 25.7 % to 40.1 % of the rows above $p_\text{max}$ (5.9 % only at a velocity error of 7.29 %). It also fixes a pressure level the data do not set: printed maximum loads exceed $p_\text{max}$ in 27.2 % of rows, so $p_\text{max}$ is not a bound the published loads respect. Peak pressures of powders fitted without pressure rows are less certain than their velocities.

## Data basis

Measured. The measurements are not in the repository.

## Where in the app

- `packages/schema/src/powder.ts`, the fitted interior parameters of a powder record.
- `packages/core/src/interior/fit.ts`, priors and residuals of the powder fit.
- Model pages: [powder fit](../models/interior-powder-fit.md), [M3 model](../models/interior-m3.md).

## Confidence

Medium: the 14-powder sample over-represents high overshoot, so the variants compare with each other and not with the whole catalogue.
