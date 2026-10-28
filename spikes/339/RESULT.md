## Spike #339: margin of the extrapolation flag of a powder fit

Result: no relative margin keeps the stated interval calibrated outside the fitted range once any model error is present. The recommended margin for the extrapolation flag is 0 on every axis (a rounding tolerance of 2.5 % for barrel length and bore diameter at most). What is missing is an uncertainty term that grows with the distance, and a fixed-input term for the velocity interval; sizes are below.

The wayfinder skill was not available in this session. Its steps were done by hand: facts checked against the code on `main` (3b836e8f), unknowns listed, experiment charted before the run.

### Facts checked on main

- `predictPowder` flags `extrapolation: 'below' | 'above'` only by the charge against `chargeRange` (`packages/core/src/interior/fit.ts:672-673`). `powderPressureRange` flags the same (`fit-confidence.ts:363`). No other axis is flagged.
- The interval of `predictPowder` holds the parameter covariance only (`fit.ts`, "no model error"). The pressure range of `powderPressureRange` adds the fixed inputs (case capacity, energy, start pressure, bore friction, temperature) by refitting. The velocity interval has no such counterpart.
- The web app and the API do not call either function yet (grep of `apps/web/src`, `packages/api/src`), so "the stated interval" is the `predictPowder` interval and, for the pressure, the `powderPressureRange` interval.

### Unknowns, and how each was handled

- What the truth differs by from the fitted model: three truth worlds plus one half-size world (below). The size of the structural departures is a choice and not measured.
- What a sensible scale step is per axis: the grid of relative distances below.
- Whether the interval is meant for the mean velocity or a single shot: it is for the mean (noise-free truth).

### Method

Script: `spikes/339/extrapolation.mts` (summaries `spikes/339/summarise.mts`, all tables `spikes/339/tables.md`, raw cells `spikes/339/out/`). Run: `node spikes/339/extrapolation.mts --reps 200 --worlds <world> --out spikes/339/out/<world>`, 200 replicates per world, fixed seeds. Node runs the sources of `packages/core` directly.

- Synthetic rifle-like load (the one of `packages/core/test/interior-fit.test.ts`, 0.6 m barrel, 6.9 mm bore), burn coefficient 0.45 1/s as truth. The fit starts at 0.38 and fits the burn coefficient only (default).
- Ladder "narrow": 5 charges, 2.2 to 2.6 g, velocity noise 4 m/s (1 sigma, given as `velocitySigma`, so the normal quantile, level 0.9). "narrow+p" adds pressure rows with 5 % uncertainty. "wide": 6 charges, 1.9 to 2.7 g. "two-barrels": the narrow charges at 0.5 and 0.6 m.
- Truth worlds, applied to the data and to the true values:
  - `exact`: the fitted model is the truth. Measures only noise and linearisation.
  - `inputs`: per replicate, case capacity, specific energy and start pressure are drawn with the standard uncertainties of `powderInputDefaults` (3 %, 3 %, 25 %, "estimated"). The fit uses the nominal values.
  - `structure-mild` and `structure`: physics the fitted model lacks: convective heat loss (flame 2800 K, factor 0.5 and 1), bore friction (2.5 and 5 MPa), another form function (a 0.75 / m 0.55, and a 0.7 / m 0.6). The sizes are a choice. In `structure` the fit reproduces the ladder to within 1 m/s, so the model error is invisible in the residuals.
- Axes. Relative distance is measured from the nearest end of the fitted range, in per cent of that end.
  - Charge: predictions at 1 to 25 % above and below the ladder, and inside it.
  - Barrel length: fitted at 0.6 m (and at 0.5 and 0.6 m); predicted at the middle charge at 2.5 to 100 % longer, 2.5 to 75 % shorter.
  - Bore diameter: fitted at 6.9 mm; predicted for a geometrically similar cartridge (length, area, chamber volume, charge and bullet mass scaled by the diameter ratio, 2.5 to 30 %). One scaling rule among many, because the model has no rule for reusing a powder in another cartridge.
  - Velocity and pressure: not inputs. Every charge prediction is binned by the distance of its predicted value outside the values of the ladder (measured velocities; measured pressures when given, else the model values at the ladder charges).
- Result per cell: share of true values inside the 90 % interval, and the factor on the standard uncertainty that would give 90 % (90th percentile of the absolute error over the standard uncertainty; the fit uses 1.645). 200 replicates give about 2 points of standard error near 90 %. The grid points of one replicate share the same noise, so neighbouring cells are not independent.
- Failures: no fit, ladder or range failed. 139 predictions of 10 cells were skipped because the true load is invalid at that point (chamber volume), all at +12.5 to +25 % charge in `inputs` (up to 10 of 200 replicates at +25 %).

### Results

Share of true values inside the 90 % interval, in %. Full tables for every cell and ladder: `spikes/339/tables.md`.

Charge axis, velocity interval, narrow ladder:

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

Factor on the standard uncertainty needed for 90 % (1.645 is the nominal):

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

With fitted lengths of 0.5 and 0.6 m the structural worlds fall to 1 to 35 % already 2.5 % outside the fitted lengths (inside, between them: 89 %).

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

Pressure, narrow ladder (velocity only):

| interval | exact | inputs | structure-mild | structure |
|---|---:|---:|---:|---:|
| `predictPowder`, inside | 91 | 27 | 0 | 0 |
| `powderPressureRange`, inside | 100 | 92 | 1 | 0 |
| `powderPressureRange`, charge -25 % to +25 % | 100 | 90 to 93 | 0 to 100 | 0 to 100 |
| `predictPowder`, charge -25 % to +25 % | 91 to 92 | 7 to 30 | 0 | 0 |
| `powderPressureRange`, barrel -75 % to +100 % | 100 | 93 | 0 | 0 |

The `predictPowder` pressure interval is far from calibrated everywhere in `inputs` (27 % inside, 7 to 36 % outside on the three axes). The pressure range of the fixed inputs stays at 90 to 93 % at every distance on every axis in `inputs`. Under structural error neither interval covers, inside or outside: the pressure is biased low there (11 to 15 % in one replicate of `structure`), and the 0 to 100 % entries of the range across the charge are the bias crossing the interval, not a coverage that varies with the distance. Pressure rows (5 %) in the ladder do not change this.

### What the numbers say

- With the right model (`exact`) the intervals are calibrated at every tested distance on every axis (92 % at 90 % nominal, charge to +/-25 %, barrel to +100 %, bore to +/-30 %). The linearised covariance is not the problem.
- Any model error makes the coverage fall from the first per cent outside the range, with no plateau that a margin could mark. The loss is steepest on the charge axis (above more than below) and on bore diameter above the fitted bore.
- Inside the range the velocity interval already under-covers when the fixed inputs carry their assumed uncertainties (`inputs`: 79 %, 61 % for the wide ladder, whose ends are farther from the centre). The velocity interval has no fixed-input term; the pressure range has one and is calibrated for it.
- Peak pressure does not depend on barrel length, so the barrel axis adds no pressure error: the pressure result is the same at every barrel distance.
- Velocity and pressure are outputs. A predicted velocity outside the ladder's velocities is the charge, barrel or bore flag again, and the coverage against the value distance repeats the charge table. They need no margin of their own.

### Recommended margins for the extrapolation flag

Rule used: the largest tested distance at which the coverage stays within 5 points of its in-range value, or at least 85 %. The worlds `inputs` and `structure-mild` set the number; `structure` is reported as a sensitivity case.

| axis | margin | basis |
|---|---|---|
| charge | 0 % | `inputs`: 0 on both sides; `structure-mild`: +1 % above, 7.5 % below (asymmetric); `structure`: 0 above, 3 % below |
| velocity | none, follows charge, barrel and bore | an output of the same predictions |
| pressure | none | the interval fails by a bias that does not depend on the distance; the pressure range of the fixed inputs holds at every distance when the fixed inputs are the only error |
| barrel length | 0 %, at most 2.5 % above one fitted length | `inputs`: 10 % each side; `structure-mild`: 2.5 % above, 0 below; two fitted lengths: 2.5 to 5 % in `inputs`, 0 in the structural worlds |
| bore diameter | 0 %, at most 2.5 % above | `inputs`: 2.5 % above, 0 below; `structure-mild`: 2.5 % above, 0 below |

A margin does not restore coverage: the factor needed grows from the range edge on (table above), so widening the "inside" zone only moves where the flag turns on. The flag should stay at the range edge, and the interval outside should be widened.

### Proposed follow-ups (not opened)

1. A fixed-input term for the velocity interval, as `powderPressureRange` has for the pressure (the same refits give it). This is the main cause of the 79 % inside the ladder.
2. A model-error term that grows with the distance outside the range, sized from the factors above: in `structure-mild`, 1.7 inside, 2.1 at +1 %, 2.6 at +5 %, 3.1 at +10 %, 3.9 at +25 %. The size of the term depends on how large the real model error is, which this spike cannot measure. Real sessions are needed.
3. An `extrapolation` flag for barrel length and bore diameter (and propellant temperature, not tested) in `predictPowder`, with margin 0 and the rounding tolerance of 2.5 % above for barrel length and bore diameter.

### Not checked

- Real data: all worlds are synthetic, the structural ones by a size I chose. Margins from real sessions may differ.
- Propellant temperature axis, a ladder without `velocitySigma` (Student quantile), other ladder sizes, a burn law other than the two-stage vivacity form, other loads.
- Fits with more than the burn coefficient (start pressure, volume factor, energy, temperature factor), and `powderPressureRange` over sessions at several barrel lengths (it needs a single fit).
- A cartridge change other than a similar-geometry scale (bullet mass and chamber volume independent of the diameter).
- Interval levels other than 0.9.
