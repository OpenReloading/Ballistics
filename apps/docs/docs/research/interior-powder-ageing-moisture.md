---
title: Powder ageing and moisture
description: Why ageing and moisture of the powder are not inputs, and what that means for a fitted burn coefficient.
---

# Powder ageing and moisture

## Question

Interior ballistics, powder state: can the model account for residual water, solvent residue and consumed stabilizer of an aged powder?

## Method

Check which inputs of the burn law and the thermochemistry could carry the powder state. None measured; no comparison was run.

## Formulas

None: the burn law and the gas energy take the composition of the record as fixed ([M3](../models/interior-m3.md)).

## Numbers

Residual water in rolled powder about 1 % by mass, stabilizer typically 1.5 to 2 % at manufacture: both unverified, no open source checked. No model run.

## Result

No change. Documented as a limit: ageing and moisture are not modelled ([M3](../models/interior-m3.md#limits)), and a fitted burn coefficient does not hold for old or damp powder ([powder fit](../models/interior-powder-fit.md#limits)).

## Data basis

Analytic: a statement of the model's inputs; the composition figures are unverified.

## Where in the app

- `packages/core/src/interior/model.ts`, `interior`.
- `packages/core/src/interior/fit.ts`, `fitPowder`.
- Model pages: [M3 interior model](../models/interior-m3.md), [powder fit](../models/interior-powder-fit.md).

## Confidence

Low: the size of the effect on velocity and pressure is not known from anything in the repository.
