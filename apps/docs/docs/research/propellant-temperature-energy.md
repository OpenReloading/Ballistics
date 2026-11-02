---
title: Temperature dependence of the propellant gas energy
description: How much of the effect of the propellant temperature on muzzle velocity and peak pressure the missing energy term carries, and whether fixing its coefficient lowers held-out residuals of a temperature ladder fit on synthetic data.
---

# Temperature dependence of the propellant gas energy

## Question

Interior model ([M3](../models/interior-m3.md), [powder fit](../models/interior-powder-fit.md)): how large is the omitted dependence of the specific energy on the propellant temperature next to the burn-rate factor, and does a fit with the energy coefficient fixed predict held-out temperatures better than the fit whose shared temperature factor is free?

## Method

Script: `node packages/core/scripts/propellant-temperature-energy.mts` from the repository root (about 9 minutes, fixed seeds; it evaluates the rule below). The option is `propellant.energyTemperature` (1/K, default 0) on the interior load.

Assumed figures, none with a source in the [bibliography](../bibliography.md), all unverified: energy coefficient 0.0003 1/K, burn-rate sensitivity 0.004 1/K on both sides of the reference 294.15 K, velocity noise 3 m/s per string mean, pressure noise 3 %.

Study 1. Six loads: the golden rifle load, the same with bore resistance and convective heat loss, a 203 mm gun load, two further charges of the rifle load and a pistol load (charge to bullet mass 0.05 to 0.35). Each is run at the reference and 5.6 K above it, with the burn term alone, the energy term alone and both. Energy share: the change from the energy term alone divided by the change from both.

Study 2. A truth load with a vivacity burn law and the energy term, three charges per temperature, ladders at 274.15, 294.15 and 314.15 K, 50 replicates with independent noise (seeds 1000 to 1049 for the ladder, 5000 to 5049 for the held-out strings). Fit (A): `fitPowder` with the burn rate and the temperature factor free, the load as it is today. Fit (B): the same with the energy coefficient fixed at 0.0003 1/K. Both start from a burn rate 12 % low and sensitivities 25 % low. Two held-out spans:

- interpolating: fit on 274.15 and 314.15 K, hold out 294.15 K;
- extrapolating: fit on all three, hold out 334.15 K (20 K above the hottest).

Four arms: truth with the term or without, each calibrated on velocities only or on velocities and peak pressures (3 % noise, one basis). Metric: pooled RMS of the residual of the predicted muzzle velocity (m/s) and peak breech pressure (percent) against independently noisy held-out strings, and against the noise-free truth.

Rule, set before the first run: the option is supported when, with the term in the truth, (B) has an RMS at least 15 % lower than (A) for velocity and for pressure at both spans in both calibration arms, and when, with no term in the truth, (B) has an RMS at most 5 % above (A) for velocity and for pressure at both spans in both arms. The first pair of arms is where the coefficient is right, the second pair measures the cost of a wrong coefficient.

## Formulas

The burn-rate factor is $\tau_T = \exp(\sigma\,(T_p - T_\text{ref}))$ and the energy factor is $\exp(\beta_Q\,(T_p - T_\text{ref}))$, both on the [M3 page](../models/interior-m3.md). To first order the relative change of the muzzle velocity for a small temperature step is the burn-rate elasticity times $\sigma\,\Delta T$ plus the energy elasticity times $\beta_Q\,\Delta T$, so the energy share is the second term over the sum. Both terms raise velocity with temperature, so a velocity ladder cannot tell them apart. A free factor on the burn sensitivities can stand in for the energy term inside the calibrated range and not outside it, because the two enter the pressure curve differently.

## Numbers

Study 1, change for +5.6 K (burn sensitivity 0.004 1/K, energy coefficient 0.0003 1/K), muzzle velocity / peak breech pressure in percent:

| load | charge / bullet | charge / chamber (kg/m³) | burn term: v / p (%) | energy term: v / p (%) | both: v / p (%) | energy share: v / p |
| --- | --- | --- | --- | --- | --- | --- |
| rifle, charge 2.8 g | 0.295 | 824 | 0.343 / 4.35 | 0.093 / 0.29 | 0.436 / 4.65 | 21.4 % / 6.2 % |
| rifle, resistance and heat loss | 0.295 | 824 | 0.341 / 4.12 | 0.094 / 0.27 | 0.435 / 4.40 | 21.6 % / 6.2 % |
| gun, 203 mm bore | 0.111 | 465 | 0.445 / 4.27 | 0.098 / 0.30 | 0.542 / 4.58 | 18.0 % / 6.5 % |
| rifle, light charge 1.8 g | 0.189 | 529 | 0.449 / 4.31 | 0.095 / 0.28 | 0.543 / 4.59 | 17.4 % / 6.0 % |
| rifle, heavy charge 3.3 g | 0.347 | 971 | 0.377 / 5.72 | 0.095 / 0.33 | 0.472 / 6.07 | 20.1 % / 5.4 % |
| pistol, 0.4 g | 0.050 | 333 | 0.413 / 2.08 | 0.094 / 0.21 | 0.507 / 2.30 | 18.5 % / 9.4 % |

The expected shares (about 20 to 25 % for velocity, about 7 % for pressure) hold in size: velocity at or a little below the lower end, pressure a little under.

Study 2, pooled RMS over 50 replicates and 3 held-out charges (A: shared temperature factor, B: energy coefficient fixed at 0.0003 1/K):

| arm | held-out span | model | velocity RMS (m/s) | pressure RMS (%) | velocity, noise-free truth | pressure, noise-free truth | failed fits |
| --- | --- | --- | --- | --- | --- | --- | --- |
| truth with term, velocity only | interpolating (294 K) | A | 3.34 | 3.48 | 1.70 | 0.83 | 0 |
| truth with term, velocity only | interpolating (294 K) | B | 3.21 | 3.42 | 1.42 | 0.68 | 0 |
| truth with term, velocity only | extrapolating (334 K) | A | 3.93 | 4.69 | 2.90 | 2.67 | 0 |
| truth with term, velocity only | extrapolating (334 K) | B | 3.26 | 4.08 | 1.85 | 1.71 | 0 |
| truth with term, velocity and pressure | interpolating (294 K) | A | 2.99 | 3.48 | 1.09 | 0.53 | 0 |
| truth with term, velocity and pressure | interpolating (294 K) | B | 2.95 | 3.45 | 0.94 | 0.45 | 0 |
| truth with term, velocity and pressure | extrapolating (334 K) | A | 4.06 | 4.44 | 3.10 | 2.27 | 0 |
| truth with term, velocity and pressure | extrapolating (334 K) | B | 3.13 | 4.03 | 1.68 | 1.56 | 0 |
| truth without term, velocity only | interpolating (294 K) | A | 3.21 | 3.42 | 1.41 | 0.68 | 0 |
| truth without term, velocity only | interpolating (294 K) | B | 3.28 | 3.41 | 1.54 | 0.73 | 0 |
| truth without term, velocity only | extrapolating (334 K) | A | 3.27 | 4.08 | 1.86 | 1.71 | 0 |
| truth without term, velocity only | extrapolating (334 K) | B | 3.88 | 4.41 | 2.77 | 2.60 | 0 |
| truth without term, velocity and pressure | interpolating (294 K) | A | 2.95 | 3.45 | 0.94 | 0.45 | 0 |
| truth without term, velocity and pressure | interpolating (294 K) | B | 2.97 | 3.44 | 0.97 | 0.47 | 0 |
| truth without term, velocity and pressure | extrapolating (334 K) | A | 3.14 | 4.02 | 1.69 | 1.56 | 0 |
| truth without term, velocity and pressure | extrapolating (334 K) | B | 4.19 | 4.15 | 3.23 | 2.06 | 0 |

Verdict by the rule (change of the RMS of B against A in percent, negative is lower):

| arm | held-out span | velocity RMS, B against A (%) | pressure RMS, B against A (%) | criterion met |
| --- | --- | --- | --- | --- |
| truth with term, velocity only | interpolating (294 K) | -3.7 | -1.7 | no |
| truth with term, velocity only | extrapolating (334 K) | -17.1 | -12.9 | no |
| truth with term, velocity and pressure | interpolating (294 K) | -1.5 | -0.7 | no |
| truth with term, velocity and pressure | extrapolating (334 K) | -22.9 | -9.3 | no |
| truth without term, velocity only | interpolating (294 K) | 2.0 | -0.4 | yes |
| truth without term, velocity only | extrapolating (334 K) | 18.8 | 8.1 | no |
| truth without term, velocity and pressure | interpolating (294 K) | 0.6 | -0.3 | yes |
| truth without term, velocity and pressure | extrapolating (334 K) | 33.4 | 3.1 | no |

The rule is not met: with the term in the truth, B reaches 15 % lower only in velocity at the extrapolating span, never in pressure; with no term in the truth, B exceeds the 5 % allowed in velocity at the extrapolating span.

## Result

No change. The energy term is not adopted: the model keeps its default of 0 and the option stays out of the powder record and the load file. Inside the calibrated temperature range the fitted temperature factor absorbs the term, for velocity and for pressure (differences below the noise of 3 m/s and 3 %). Beyond it a correct coefficient lowers the velocity error by about a fifth and a wrong one raises it by a fifth to a third, so the term helps only with a coefficient known better than the spread between powders.

Text for the Limits of the [M3 page](../models/interior-m3.md) (added there in short): "The gas energy is independent of the initial temperature by default. For the loads tried it carries 17 to 22 % of the muzzle-velocity change and 5 to 9 % of the peak-pressure change for a temperature step (assumed coefficients, simulations); the fitted temperature factor absorbs it inside the calibrated temperature range."

The measured part is pending: the held-out test on chronograph ladders of one powder at three or more temperature levels, at least 20 K between the coldest and the hottest and between the hottest and the next level below it, two spans, the energy coefficient fixed, passes when the velocity RMS and the pressure RMS are each at least 15 % lower than those of the current fit on both spans. It runs on unpublished rows, on the machine that holds them:

```sh
npm ci && npm run build
node packages/cli/scripts/temperature-energy.mts --rows <rows.csv|folder> [--records <dir>]
```

The rows are those of the [command line](../cli.md#rows), with `temperature_c` on every row and `pressure_bar` with `pressure_basis` where a pressure was measured. Rows of one temperature level carry the same `temperature_c` (the level's mean, for example), because each distinct value is a level of its own. A crusher pressure is neither fitted nor scored. When the fit used pressures, a held-out pressure counts only on that basis; a fit on velocities alone is scored against held-out pressures of any other basis. A ladder is the rows of one powder, cartridge, bullet, barrel, COAL and rifle. The interpolating span fits the coldest and the hottest temperature (at least 20 K apart) and holds out those between; the extrapolating span holds out the hottest and fits the temperatures at least 20 K colder (two or more). Each span fits (A) with the burn rate and the temperature factor free and (B) the same with the energy coefficient at 0.0003 1/K, weighted with 3 m/s and 3 %; a powder record without a temperature sensitivity starts from the assumed 0.004 1/K about the temperature of its fit. The script prints JSON with aggregates only, no record id, row, charge or temperature. Post it whole: the counts of ladders and rows, `skipped` by reason, per span the ladders used, the failed fits, the held-out rows and the pooled RMS of A and B, their change, and `supported`, the rule above.

## Data basis

Analytic: synthetic loads and a synthetic truth with the fitted model's own structure and assumed coefficients. The measured part is not in the repository.

## Where in the app

- `packages/core/src/interior/model.ts`, `energyAtTemperature`.
- `packages/core/src/interior/fit.ts`, `fitPowder`.
- `packages/core/test/interior-energy-temperature.test.ts`.
- `packages/core/scripts/propellant-temperature-energy.mts`.
- `packages/cli/scripts/temperature-energy.mts`, the measured check.
- Model pages: [M3 interior model](../models/interior-m3.md), [powder fit](../models/interior-powder-fit.md).

## Confidence

Medium for the size in Study 1: it follows from the model for the stated coefficients, which are unverified. Low for the verdict of Study 2: the truth shares the structure of the fitted model, the coefficients and noise are assumed, and measured ladders may behave differently.
