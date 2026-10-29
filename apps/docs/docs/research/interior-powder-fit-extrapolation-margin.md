---
title: Margin of the extrapolation flag of a powder fit
description: How the coverage of the powder fit interval falls with the distance outside the fitted charges, barrel lengths and bore, on synthetic ladders, and which margin each axis of the domain needs.
---

# Margin of the extrapolation flag of a powder fit

## Question

[Powder fit](../models/interior-powder-fit.md): how far outside the fitted ladder (charge, barrel length, bore diameter, velocity, pressure) does the stated 90 % interval of a prediction still hold the true value, and which relative margin around the fitted range should each axis of the extrapolation flag get?

## Method

Synthetic ladders from the [M3 model](../models/interior-m3.md), fitted with `fitPowder` and predicted with `predictPowder` and `powderPressureRange`, 200 replicates per world with fixed seeds. The code measured was that of the default branch before the domain of every axis was added, when only the charge was flagged.

- Load: the synthetic rifle-like load of the core powder fit tests (0.6 m barrel, 6.9 mm bore), burn coefficient 0.45 1/s as truth. The fit starts at 0.38 and fits the burn coefficient only (the default).
- Ladders: "narrow", 5 charges from 2.2 to 2.6 g, velocity noise 4 m/s (1 sigma, given as `velocitySigma`, so the normal quantile at level 0.9); "narrow+p", the same with pressure rows of 5 % uncertainty; "wide", 6 charges from 1.9 to 2.7 g; "two-barrels", the narrow charges at 0.5 and 0.6 m.
- Truth worlds, applied to the data and to the true values:
  - `exact`: the fitted model is the truth, so only noise and linearisation act.
  - `inputs`: per replicate, case capacity, specific energy and start pressure are drawn with the standard uncertainties of `powderInputDefaults` (3 %, 3 %, 25 %); the fit uses the nominal values.
  - `structure-mild` and `structure`: physics the fitted model lacks: convective heat loss (flame 2800 K, factor 0.5 and 1), bore friction (2.5 and 5 MPa), another form function (a 0.75 / m 0.55, and a 0.7 / m 0.6). The sizes are a choice. In `structure` the fit reproduces the ladder within 1 m/s, so the model error does not show in the residuals.
- Axes, with the relative distance from the nearest end of the fitted range in per cent of that end:
  - charge: 1 to 25 % above and below the ladder, and inside it;
  - barrel length: fitted at 0.6 m (and at 0.5 and 0.6 m), predicted at the middle charge 2.5 to 100 % longer and 2.5 to 75 % shorter;
  - bore diameter: fitted at 6.9 mm, predicted for a geometrically similar cartridge (length, area, chamber volume, charge and bullet mass scaled by the diameter ratio, 2.5 to 30 %), one scaling rule among many;
  - velocity and pressure are outputs: every charge prediction is binned by the distance of its predicted value outside the values of the ladder.
- Metric per cell: the share of true values inside the 90 % interval, and the factor on the standard uncertainty that would give 90 %.
- Accept rule for a margin, set before the run: the largest tested distance at which the coverage stays within 5 points of its in-range value or at least 85 %. The worlds `inputs` and `structure-mild` set the margin; `structure` is a sensitivity case.

Reproduce: `node spikes/339/extrapolation.mts --reps 200 --worlds <world> --out spikes/339/out/<world>`, summaries with `node spikes/339/summarise.mts`, from commit `7ba7ae843753079d8e7926fb0b30dc766603b712` (on the unmerged branch `spike/339-powder-fit-margin`, with every table in `spikes/339/tables.md` and the raw cells in `spikes/339/out/`). Node runs the sources of `packages/core` directly.

## Formulas

The interval of a prediction is the model value $y$ plus or minus $k\,u$, with $u$ the standard uncertainty from the parameter covariance and $k = 1.645$ the normal quantile of a two-sided 90 % interval ([JCGM 100:2008](../bibliography.md#jcgm-100-2008)). With $e_i$ the error of replicate $i$ against the true value:

$$
\text{coverage} = \frac{1}{n} \sum_{i=1}^{n} \mathbf{1}\big(|e_i| \le k\,u_i\big), \qquad k_{90} = Q_{0.9}\!\left(\frac{|e_i|}{u_i}\right)
$$

$k_{90}$ is the factor that would cover 90 % of the replicates; a calibrated interval has $k_{90} \approx 1.645$. The relative distance of a value $x$ outside the fitted range $[x_\min, x_\max]$ is $x / x_\max - 1$ above and $x / x_\min - 1$ below. With 200 replicates the standard error of a coverage near 90 % is about 2 points. The grid points of one replicate share its noise, so neighbouring cells are not independent.

## Numbers

Coverage of the 90 % interval in %, narrow ladder.

Charge, velocity interval:

| distance | exact | inputs | structure-mild | structure |
|---|---:|---:|---:|---:|
| -25 % | 92 | 20 | 0 | 0 |
| -10 % | 92 | 39 | 77 | 17 |
| -5 % | 92 | 49 | 86 | 73 |
| -1 % | 92 | 60 | 91 | 89 |
| inside | 92 | 79 | 88 | 89 |
| +1 % | 92 | 56 | 84 | 78 |
| +3 % | 92 | 49 | 78 | 63 |
| +5 % | 92 | 43 | 72 | 48 |
| +10 % | 92 | 32 | 52 | 12 |
| +25 % | 92 | 15 | 28 | 1 |

Factor $k_{90}$ on the charge axis (nominal 1.645):

| distance | exact | inputs | structure-mild | structure |
|---|---:|---:|---:|---:|
| inside | 1.6 | 2.3 | 1.7 | 1.7 |
| +1 % | 1.6 | 3.3 | 2.1 | 2.3 |
| +5 % | 1.6 | 4.6 | 2.6 | 3.2 |
| +10 % | 1.6 | 6.6 | 3.1 | 4.3 |
| +25 % | 1.6 | 13.4 | 3.9 | 5.9 |
| -5 % | 1.6 | 5.0 | 1.8 | 2.5 |
| -10 % | 1.6 | 6.4 | 2.4 | 4.0 |

Barrel length, velocity interval, one fitted length of 0.6 m:

| distance | exact | inputs | structure-mild | structure |
|---|---:|---:|---:|---:|
| -20 % | 92 | 84 | 13 | 0 |
| -5 % | 92 | 90 | 73 | 46 |
| -2.5 % | 92 | 91 | 80 | 70 |
| inside | 92 | 91 | 89 | 88 |
| +2.5 % | 92 | 90 | 88 | 88 |
| +5 % | 92 | 89 | 84 | 73 |
| +10 % | 92 | 88 | 67 | 27 |
| +50 % | 92 | 66 | 0 | 0 |
| +100 % | 92 | 38 | 0 | 0 |

With fitted lengths of 0.5 and 0.6 m the structural worlds fall to 1 to 35 % already 2.5 % outside the fitted lengths (89 % between them).

Bore diameter, velocity interval:

| distance | exact | inputs | structure-mild | structure |
|---|---:|---:|---:|---:|
| -10 % | 92 | 59 | 80 | 80 |
| -2.5 % | 92 | 82 | 81 | 71 |
| inside | 92 | 91 | 89 | 88 |
| +2.5 % | 92 | 87 | 86 | 82 |
| +5 % | 92 | 68 | 68 | 36 |
| +10 % | 92 | 41 | 7 | 0 |
| +30 % | 92 | 9 | 0 | 0 |

Pressure, velocity-only ladder:

| interval | exact | inputs | structure-mild | structure |
|---|---:|---:|---:|---:|
| `predictPowder`, inside | 91 | 27 | 0 | 0 |
| `powderPressureRange`, inside | 100 | 92 | 1 | 0 |
| `powderPressureRange`, charge -25 % to +25 % | 100 | 90 to 93 | 0 to 100 | 0 to 100 |
| `predictPowder`, charge -25 % to +25 % | 91 to 92 | 7 to 30 | 0 | 0 |
| `powderPressureRange`, barrel -75 % to +100 % | 100 | 93 | 0 | 0 |

- With the right model (`exact`) the intervals hold at every tested distance on every axis (92 % at 90 % nominal, charge to ±25 %, barrel to +100 %, bore to ±30 %): the linearised covariance is not the problem.
- Any model error makes the coverage fall from the first per cent outside the range, with no plateau that a margin could mark. The loss is steepest on the charge axis (more above than below) and above the fitted bore.
- Inside the range the velocity interval already holds too little when the fixed inputs carry their assumed uncertainties (`inputs`: 79 %, 61 % for the wide ladder). The velocity interval has no fixed-input term; the pressure range has one and holds 90 to 93 % at every distance on every axis in `inputs`.
- Under structural error neither pressure interval covers, inside or outside: the pressure is biased low (11 to 15 % in one replicate of `structure`), and the 0 to 100 % across the charge is the bias crossing the interval, not a coverage that varies with the distance. Pressure rows of 5 % in the ladder do not change this.
- Peak pressure does not depend on barrel length, so the barrel axis adds no pressure error.
- 139 predictions in 10 cells were skipped because the true load is invalid there (chamber volume), all at +12.5 to +25 % charge in `inputs` (at most 10 of 200 replicates at +25 %). No fit, ladder or range failed.

Margins by the accept rule:

| axis | margin | basis |
|---|---|---|
| charge | 0 % | `inputs`: 0 on both sides; `structure-mild`: +1 % above, 7.5 % below; `structure`: 0 above, 3 % below |
| velocity | none, follows charge, barrel and bore | an output of the same predictions |
| pressure | none | the interval fails by a bias that does not depend on the distance |
| barrel length | 0 %, at most 2.5 % above one fitted length | `inputs`: 10 % each side; `structure-mild`: 2.5 % above, 0 below; two fitted lengths: 2.5 to 5 % in `inputs`, 0 in the structural worlds |
| bore diameter | 0 %, at most 2.5 % above | `inputs`: 2.5 % above, 0 below; `structure-mild`: 2.5 % above, 0 below |

## Result

No change. No margin keeps the interval at its stated level outside the fitted range once any model error is present, so the flag belongs at the range edge (margin 0, a rounding tolerance of 2.5 % above for barrel length and bore diameter at most) and the interval outside the range needs widening instead. Adopted after this entry: `powderDomainMargin` is 0 on every axis (it was 0.05), with a tolerance of 2.5 % above for barrel length and bore diameter. Proposed and not built: a fixed-input term for the velocity interval, as `powderPressureRange` has for the pressure; a model-error term that grows with the distance outside the range, sized from the factors above (in `structure-mild` 1.7 inside, 2.1 at +1 %, 2.6 at +5 %, 3.1 at +10 %, 3.9 at +25 %), whose size needs real sessions.

## Data basis

Analytic: synthetic ladders from the interior model with chosen noise, input uncertainties and structural departures, no measured data.

## Where in the app

- `packages/core/src/interior/fit.ts`, `predictPowder`, `fitDomain`, `outsideDomain`, `powderDomainMargin`.
- `packages/core/src/interior/fit-confidence.ts`, `powderPressureRange`.
- Model page: [powder fit](../models/interior-powder-fit.md#domain).

## Confidence

Medium: that a margin cannot restore the coverage holds in every world with a model error, but the sizes of the structural departures are a choice, and real sessions, the propellant temperature axis, fits of more than the burn coefficient, other ladder sizes and levels other than 0.9 were not tested.
