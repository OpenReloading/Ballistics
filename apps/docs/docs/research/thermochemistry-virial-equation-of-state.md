---
title: Virial against Noble-Abel equation of state
description: Second and third Lennard-Jones virial coefficients of the five main propellant gases and the pressure of a virial gas against the Noble-Abel gas of the interior model at covolume fractions 0.1 to 0.3.
---

# Virial against Noble-Abel equation of state

Every number on this page is a simulation, not load data.

## Question

Interior model [M3](../models/interior-m3.md): how far does the Noble-Abel pressure lie from a virial gas truncated after the third coefficient for the main propellant gases, and is it above the 3 % that would justify a model change?

## Method

Reproduce: `node spikes/372/thermochemistry.mts` at commit `4f0382ff8860ef75b5d61219ef33f978ff284222` on the branch `spike/372-thermochemistry` (under one second).

Second and third virial coefficients of the 12-6 potential for CO, CO2, H2, H2O and N2 with the force constants of [Svehla 1962](../bibliography.md#svehla-1962), Table I, by numerical integration (step 0.004 sigma to 8 sigma; checked on hard spheres, where B* = 1 and C* = 5/8). Mixture of the reference products (mole fractions H2O 0.284, CO 0.282, CO2 0.212, N2 0.146, H2 0.076 as the rest): B with Lorentz-Berthelot unlike pairs, C with the geometric mean of the three pair values. The Noble-Abel covolume is the model's form, the mole-fraction sum of the pure-gas B. Grid: covolume fraction 0.1 to 0.3, 2000 to 4000 K. Metric: virial over Noble-Abel pressure minus one at equal density. Rule: a model change only above 3 %.

## Formulas

Second virial coefficient: minus two pi times the integral of the Mayer function times r squared. Third: minus eight pi squared over three times the triple integral of the three Mayer functions over the pair distances of a triangle ([Hirschfelder 1954](../bibliography.md#hirschfelder-1954)). Noble-Abel expands to a virial series whose third coefficient is the square of the second; the comparison is that ratio against the computed C / B squared.

## Numbers

Pure gases, B (cm3/mol) and C / B squared:

| T (K) | CO | CO2 | H2 | H2O | N2 |
| --- | --- | --- | --- | --- | --- |
| 2000 | 33.4, 0.865 | 36.0, 1.313 | 15.0, 0.770 | -7.5, 3.667 | 36.5, 0.803 |
| 3000 | 33.3, 0.774 | 39.6, 0.999 | 14.5, 0.716 | 1.5, 79.0 | 35.7, 0.737 |
| 4000 | 32.6, 0.732 | 40.6, 0.884 | 14.0, 0.689 | 5.6, 5.510 | 34.7, 0.705 |

Water lies near its Boyle temperature, so its ratio is not meaningful there.

Mixture, virial over Noble-Abel pressure minus one, percent:

| T (K) | b (cm3/mol) | 0.1 | 0.15 | 0.2 | 0.25 | 0.3 |
| --- | --- | --- | --- | --- | --- | --- |
| 2000 | 21.4 | 0.79 | 1.30 | 1.74 | 1.98 | 1.89 |
| 2500 | 23.4 | 0.35 | 0.47 | 0.42 | 0.12 | -0.53 |
| 3000 | 24.5 | 0.12 | 0.05 | -0.23 | -0.80 | -1.73 |
| 3500 | 25.2 | -0.01 | -0.20 | -0.62 | -1.35 | -2.45 |
| 4000 | 25.5 | -0.10 | -0.37 | -0.88 | -1.71 | -2.92 |

Largest difference -2.92 % (4000 K, covolume fraction 0.3).

## Result

no change; documented as a limit. The difference stays below 3 % over the grid, so the Noble-Abel gas stays. Its size, up to about 3 % in pressure at a covolume fraction of 0.3, is the size of the equation-of-state simplification. Peak pressure of a full M3 run with a virial gas was not computed; up to a covolume fraction of 0.2 the difference is below 1.8 %.

## Data basis

analytic: a closed-form potential with published force constants.

## Where in the app

`packages/schema/src/powder.ts` (`powderThermochemistry`), [M3](../models/interior-m3.md).

## Confidence

medium: the third coefficient of mixtures uses an approximate combining rule, and the series is truncated after C.
