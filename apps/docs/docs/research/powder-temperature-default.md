---
title: Default powder temperature sensitivity by grain form
description: A default burn-rate temperature sensitivity for powder records without their own, by grain form, with its interval, its sources and the derivation of the extruded value from a maker table.
---

# Default powder temperature sensitivity by grain form

## Question

Interior ballistics, propellant temperature: can a powder record without its own `temperatureSensitivity` take a default of its grain form, with an interval, so that the run is no longer blind to the propellant temperature?

## Method

Ball: the closed-vessel burn-rate sensitivities of [Boulkadid 2016](../bibliography.md#boulkadid-2016) for deterred ball powders with about 10 % nitroglycerin, as quoted in issue #842 (the paper's tables were not re-read). Extruded and flake: the velocities at 70 and 125 °F of the 17 powders outside the Extreme line in [Hodgdon 2012](../bibliography.md#hodgdon-2012) (three of them ball: Win 748, AA 2520, AA 2460), each converted to a hot sensitivity $\sigma_h$ by bisection on three stand-in rifle loads (seven-perforated grain, 10.9 g, charges 2.4, 2.8 and 3.2 g, each set to peak at 380 MPa at 294.15 K) so that +30.56 K moves the muzzle velocity as the powder did. Script: `node packages/core/scripts/powder-temperature-default.mts`. Decided in advance: the default is the mean of the 14 extruded powders on the middle load, the interval spans the loads' mean ± 1 SD, and the cold-side peak pressure is shown as an interval over $\sigma_c$ from 0 to 0.0030, never as a point.

## Formulas

$\tau_T = \exp(\sigma (T_p - T_\text{ref}))$ with $\sigma = \sigma_h$ above and $\sigma_c$ below $T_\text{ref}$ ([M3, temperature of the propellant](../models/interior-m3.md#temperature-of-the-propellant)). Velocity change of a powder in the maker table: $v_{125} / v_{70} - 1$ over $\Delta T = 55 \cdot 5/9 = 30.56$ K.

## Numbers

Ball (Boulkadid 2016 as quoted): burn-rate sensitivity spherical 0.305 ± 0.016 %/K and flattened 0.229 ± 0.028 %/K above 21 °C, 0.121 ± 0.006 and 0.115 ± 0.008 %/K below; peak pressure coefficient hot 0.429 ± 0.102 and 0.239 ± 0.110 %/K, cold 0.022 ± 0.043 and 0.037 ± 0.052 %/K. Default $\sigma_h$ 0.0027 (0.0023 to 0.0031), $\sigma_c$ 0.0012.

Hodgdon 2012, 17 powders: velocity change mean 0.0427 %/K, SD 0.0350, range -0.0164 to 0.1001 %/K. Through the model:

| Stand-in load | Muzzle velocity | $\sigma$ 0.0025 at +30.56 K: $\Delta v$ | Extruded (14): mean, SD of $\sigma_h$ | All 17: mean, SD |
|---|---|---|---|---|
| 2.4 g | 790 m/s | 2.13 % | 0.00153, 0.00141 | 0.00153, 0.00128 |
| 2.8 g | 829 m/s | 3.29 % | 0.00096, 0.00088 | 0.00096, 0.00080 |
| 3.2 g | 838 m/s | 5.11 % | 0.00061, 0.00056 | 0.00061, 0.00050 |

Default $\sigma_h$ for extruded and flake 0.0010 1/K, interval 0.0001 to 0.0029 (the issue's estimate on its own stand-in load was about 0.0020, 0.0003 to 0.0050). The issue's solver check of the cold side: with the measured cold $\sigma_c$ 0.00121 at -75 K the model gives -5.35 % velocity (measured -5.6 %) but -13.0 % peak against about -1.65 % measured, which is why the cold peak is an interval.

## Result

Improved. Adopted: a default by grain form (ball, extruded, flake; none for other), flagged approximate and named in the result notes, with the cold-side peak pressure as an interval over $\sigma_c$ 0 to 0.0030; the record's own coefficient always wins. Documented as a limit: the extruded value depends on the stand-in load by a factor of about 2.5, rests on maker data without shot counts or lots, and has no cold-side claim. The optional `temperatureStabilised` field for the Hodgdon Extreme powders was not added.

## Data basis

Public. Boulkadid 2016 (as quoted, unverified here) and the Hodgdon 2012 maker table through the model on stand-in loads.

## Where in the app

- `packages/core/src/interior/temperature-default.ts`, `defaultSensitivity`, `coldPeakInterval`.
- `packages/core/scripts/powder-temperature-default.mts`, the derivation.
- `apps/web/src/lib/interior-request.ts`, the default in the run.
- `apps/web/src/components/workbench-outcome.ts`, the notes.
- Model page: [M3, default by grain form](../models/interior-m3.md#default-by-grain-form).

## Confidence

Low: the extruded value moves with the stand-in load and the ball figures were not re-read from the paper.
