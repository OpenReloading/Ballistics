---
title: Fitted parameters of the load-table powder fit
description: Vivacity alone, vivacity and energy, or vivacity, energy and a burn-form parameter per powder, compared on held-out velocities of published load tables.
---

# Fitted parameters of the load-table powder fit

## Question

Interior ballistics, load-table powder fit: which parameters should be fitted per powder (vivacity only; vivacity and energy; vivacity, energy and the form parameter $a$) for the lowest held-out velocity error?

## Method

M3 with the vivacity law and the two-stage form. Three candidates:

- A: vivacity only.
- B: vivacity and energy, the energy with a log-normal prior (sigma 0.1 for single and double base, 0.15 for an unknown base, from the thermochemistry range where one exists, at least 0.02).
- C: B plus the form parameter $a$ with a prior, for powders with at least 20 training pressure rows.

Compared on the validation split (about 20 % of the cartridges, chosen by hash) on the 14252 rows all three cover. Accept rule: the lowest median absolute velocity error wins; within 0.1 percentage points the simpler candidate wins. Pressure errors are reported, not used.

## Formulas

The first stage of the two-stage form is $(1 + a z)^m$ ([burn forms](../models/interior-burn-forms.md)). Fitted parameters are taken in logs; a prior adds $\left(\ln \theta - \ln \theta_0\right)^2 / \sigma^2$ to the weighted sum of squared velocity residuals ([powder fit](../models/interior-powder-fit.md)).

## Numbers

| Candidate | velocity median % | velocity P90 % | pressure median % | pressure mean % | invalid runs |
| --- | ---: | ---: | ---: | ---: | ---: |
| A | 4.43 | 11.88 | 17.82 | -14.82 | 1002 |
| B | 3.33 | 9.20 | 14.97 | -6.60 | 1002 |
| C | 3.31 | 9.18 | 14.50 | -5.27 | 1002 |

Fits that failed and fell back to the next simpler candidate: C 50, B 10, A 1. C was selected for none of the 223 powders; every record keeps its starting form parameter (0.8 for ball powder, 0 otherwise). In the B fits the median absolute correlation of vivacity and energy is 0.973, and the posterior of the form parameter equals its prior: the rows add nothing to it.

## Result

Improved: B over A by 1.10 points of median velocity error, adopted. C not adopted: 0.02 points better than B, inside the 0.1-point margin, and the form parameter is not identified from velocities.

## Data basis

Measured. The measurements are not in the repository.

## Where in the app

- `packages/schema/src/powder.ts`, the `fitted` list of a powder record.
- `packages/core/src/interior/form.ts`, the two-stage form.
- Model pages: [burn forms](../models/interior-burn-forms.md), [powder fit](../models/interior-powder-fit.md).

## Confidence

Medium: one split of one catalogue of load tables; vivacity and energy stay strongly correlated in the adopted fit.
