---
title: Primer and the ignition pressure
description: How much the muzzle velocity of the M3 model moves with the ignition pressure that stands in for the primer.
---

# Primer and the ignition pressure

## Question

Interior ballistics, ignition: how much does the muzzle velocity change when the ignition pressure, the only primer input of the model, goes from 5 to 200 bar?

## Method

Run `interior` on the load-file example of the API (`loadFileExample`, start pressure 100 bar), converted to SI with `toSi`, with the ignition pressure set to 5, 50, 99, 100, 101 and 200 bar and everything else as given. Metric: muzzle velocity. A primer composition field on records is added only if the change is large and a record could carry it.

## Formulas

The run starts from the burnt fraction that gives the ignition pressure in the closed chamber, and the projectile is held until the mean pressure reaches the start pressure ([M3, ignition and shot start](../models/interior-m3.md)). The larger of the two is the hold pressure.

## Numbers

- 5, 50, 99 and 100 bar: 824.774 m/s each.
- 101 bar: 824.906 m/s.
- 200 bar: 836.635 m/s, 1.44 % above the run at 5 bar.
- With the start pressure at 0, 5 bar gives 809.516 m/s and 200 bar 836.635 m/s.

## Result

No change. Documented as a limit on the [M3 model page](../models/interior-m3.md#limits): below the start pressure the ignition pressure has no effect on the velocity, above it the ignition pressure acts as the hold pressure. No primer composition field.

## Data basis

Analytic: model runs on the example load, no measured data.

## Where in the app

- `packages/core/src/interior/model.ts`, `interior`.
- `packages/api/src/compute/load-file-example.ts`, `loadFileExample`.
- Model page: [M3 interior model](../models/interior-m3.md).

## Confidence

High for the model's response, which the runs show directly; the model does not say how a real primer's energy maps to an ignition pressure.
