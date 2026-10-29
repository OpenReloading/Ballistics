---
title: Crusher pressures as conventional values
description: Why a crusher reading is not converted to a transducer pressure and why the powder fit refuses mixed pressure bases.
---

# Crusher pressures as conventional values

## Question

Powder fit, pressure rows: can a crusher reading be converted to an absolute pressure by one factor, so that a fit could mix bases?

## Method

Check whether the reading of a crusher cylinder depends only on the peak pressure. Analytic argument with an elastic gauge; no calibration data in the repository.

## Formulas

An undamped linear gauge of natural angular frequency $\omega$ under a pressure step that gives the static deflection $x_s$ deflects as $x(t) = x_s (1 - \cos \omega t)$, with the maximum $2 x_s$. A slow rise gives $x_s$. The reading thus depends on the rise time as well as the peak. A copper cylinder deforms plastically, so its dependence also changes with the cylinder type.

## Numbers

Step against static load of an elastic gauge: factor 2. Calibration figures of real cylinders: none stated, no open source checked.

## Result

No change. The fit keeps refusing mixed bases (`MixedPressureBasisError`) and converts none. Documented as a limit on the [powder fit page](../models/interior-powder-fit.md#limits).

## Data basis

Analytic: the step response of an elastic gauge.

## Where in the app

- `packages/core/src/interior/fit.ts`, `MixedPressureBasisError`.
- Model page: [powder fit](../models/interior-powder-fit.md).

## Confidence

Medium: the dependence on rise time is certain in kind; its size for a given cylinder is not known here.
