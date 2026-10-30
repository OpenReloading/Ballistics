---
title: Pressure and velocity bands from sampled input tolerances
description: The 5th, 50th and 95th percentile of the simulated peak pressure and muzzle velocity over draws of the input tolerances.
---

# Pressure and velocity bands from sampled input tolerances

`interiorSampledBand` draws the six inputs of the [peak-pressure range](interior-pressure-range.md) at random from their tolerances, runs the [M3 model](interior-m3.md) once per draw and reports the 5th, 50th and 95th percentile of the peak breech pressure and of the muzzle velocity. With several inputs varying the band is narrower than the corner-case range, which moves every input to its end at once, because few draws put every input near its end.

The method is the propagation of distributions by Monte Carlo sampling of [JCGM 101:2008](../bibliography.md#jcgm-101-2008): the input distributions are sampled, the model is evaluated for every draw, and the sorted outputs approximate the output distribution. The band covers input tolerances only and is not a confidence interval.

- The draws depend on the seed only (same seed, same band) and their number is fixed by the request.
- The run has a time budget. When the draws do not finish within it, no band is reported: the answer keeps the corner-case range and says the sampling went over budget. A band from part of the draws would depend on the speed of the machine.
- A draw that leaves the model is counted as failed and left out of the percentiles.

## Equations

### Drawing one input

An input $q$ with a relative tolerance $t_q$ takes a draw $q_k$, the propellant temperature $T$ with an absolute tolerance $t_T$ takes $T_k$, from the standard normal numbers $z_k$:

$$
q_k = q\,\Bigl(1 + \frac{z_k}{c}\,t_q\Bigr), \qquad T_k = T + \frac{z_k}{c}\,t_T, \qquad c = 1.645
$$

Code: `packages/core/src/interior/monte-carlo.ts`, `sampledBand` (`side`), `toleranceSigmas`; `packages/core/src/interior/range.ts`, `interiorApply`.

JCGM 101:2008 gives an input known only by its bounds a rectangular distribution. Here the tolerance is read as the central 90 % interval of a normal distribution instead, so that the 5th and 95th percentile of the output coincide with the corner cases of a single varied input.

The constant $c$ is the 95th percentile of the standard normal distribution. A tolerance is therefore the half width of the central 90 % interval of its input, so for a response that rises or falls steadily with one input the 5th and 95th percentile of the output are the values at the two ends of the tolerance, the values of the corner cases.

### Standard normal numbers

The numbers come from two uniform numbers $u_1, u_2$ in $[0, 1)$ of a seeded 32-bit generator (mulberry32) through the Box-Muller transform:

$$
z = \sqrt{-2 \ln(1 - u_1)}\,\cos(2 \pi u_2)
$$

Code: `packages/core/src/interior/monte-carlo.ts`, `sampledBand` (`normal`), `uniforms`.

Every draw takes one number per input, in the order of `pressureInputs`, also for an input whose tolerance is 0, so a tolerance set to 0 does not shift the draws of the others.

### Percentiles

For the sorted outputs $y_{(1)} \le \dots \le y_{(n)}$ of the $n$ valid draws, the percentile $p$ interpolates linearly between the two closest ranks:

$$
r = p\,(n - 1), \qquad i = \lfloor r \rfloor, \qquad
y_p = y_{(i+1)} + (r - i)\bigl(y_{(i+2)} - y_{(i+1)}\bigr)
$$

Code: `packages/core/src/interior/monte-carlo.ts`, `percentile`, `bandOf`.

With $p$ = 0.05, 0.5 and 0.95 these are the reported `p05`, `p50` and `p95`. The standard error of a percentile of $n$ draws shrinks with $\sqrt n$.

## Request and answer

`POST /interior` takes `sampling` with `samples` (10 to 2000), `seed` and `budgetMs`, each optional, for a single run. Defaults: 300 draws, seed 1, 3000 ms. A ladder request takes no sampling. With sampling the answer holds `sampled` with `status`:

| Status | Meaning |
| --- | --- |
| `sampled` | `pressure` and `velocity` hold `p05`, `p50` and `p95` (Pa, m/s). |
| `overBudget` | The draws did not finish within `budgetMs`: use `pressureRange`. |
| `invalid` | No draw stayed in the model. |

Code: `packages/api/src/compute/interior-schema.ts`, `samplingDefaults`; `packages/api/src/compute/tasks.ts`, `runners`.

The workbench asks for the band of the step it shows first, in a second request after the result. It shows the 5th to 95th percentile of the pressure and of the velocity in place of the corner-case range, and the line "Velocity {low} to {high} {unit}. 5th to 95th percentile, input tolerances only." After an over-budget run the line reads "Sampled bands over budget: corner-case range shown." and the pressure shows the corner-case range. The velocity has no corner-case range, so it shows no band then. The limit check compares the corner-case range with the limit in every case. Printed pages and downloaded files carry no such line.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $q$, $q_k$ | Input with a relative tolerance and its draw | as the input | as the input |
| $t_q$ | Relative tolerance of an input | 1 | 1 |
| $T$, $T_k$ | Propellant temperature and its draw | degC | K |
| $t_T$ | Absolute temperature tolerance | no kind | K |
| $z_k$ | Standard normal number of a draw | 1 | 1 |
| $c$ | 95th percentile of the standard normal distribution | 1 | 1 |
| $u_1$, $u_2$ | Uniform numbers of the generator | 1 | 1 |
| $y_{(i)}$ | Sorted outputs of the valid draws | bar, m/s | Pa, m/s |
| $y_p$ | Percentile $p$ of the outputs | bar, m/s | Pa, m/s |

## Assumptions

- Each input is normal around its nominal value, independent of the others, with the tolerance as the half width of its central 90 % interval. The tolerances themselves are the [assumed defaults](interior-pressure-range.md#default-tolerances) without a source.
- A draw far in the tail can leave the model, for example a negative start pressure of a wide tolerance. It counts as failed.

## Limits

- Model error is not part of the band: the band of an input that the model gets wrong is wrong as well.
- Inputs without a tolerance do not move. The seating depth changes the chamber volume and the bullet travel and has no tolerance of its own.
- The band is not a confidence interval and not a statement about a real load.
- A ladder request takes no sampling. The workbench shows the sampled band of the step shown first; another step of a ladder shows the corner-case range.

## Sources

- [JCGM 101:2008](../bibliography.md#jcgm-101-2008), propagation of distributions by a Monte Carlo method: the procedure of drawing the inputs, evaluating the model per draw and reading the percentiles of the sorted outputs, described here in own words (section numbers unverified). The Box-Muller transform of two uniform numbers is the usual construction of a normal number.
- Research log: [sampled band against the corner cases](../research/interior-sampled-band-corner-cases.md).
