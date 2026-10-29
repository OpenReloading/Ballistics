# Result: burn law constants, cheaper steps and machine learning

Throwaway spike branch, not for merge. Aggregates of load rows that are not in the repository; no row, source or per-powder line. The rule is `RULE.md` (the first commit). Results are simulations compared with printed values, never load data.

## Setup

- Code: `main` at 3a5c6a4a (the CLI and the published validation figures; there is no `integration/0.x-next` branch). Model version of the baseline run `8e17f2eace299766d9ba5212de610444398d027f56b7c18270c3ea5928a27fd3`.
- Split: `splitOf`. Every constant below is fitted on training rows only; validation rows are only predicted; the test split was not run and the rows of its cartridges were not written to the converted rows file.
- The record powder parameters of the baseline were fitted on the training split. The structure of the present model (bore resistance, start pressure rule) was chosen on the validation split earlier, so the baseline is not fully blind on validation; the candidates share that structure, so the comparison is paired.
- Rows: the same kind of rows as `validation.md`, converted to the CLI columns with a stand-in bullet per cartridge and bullet mass (length from a fit of length over mass and diameter of the bullet records) and the barrel rule of `validation.md`.
- Measure: `ballistics compare` for every candidate that has the signature of core's `interior` (`candidate.mts`); the same rows through `rows-dump.mts` (it calls the CLI's `predict`) for the per-row values the bootstrap, the direction check and the machine-learning candidates need. Both give the same medians.

## Baseline

`ballistics verify` on the validation split: median velocity error 3.32 %, P90 8.87 %, 10,493 used rows, interval coverage 89.6 %; pressure median 14.94 %, P90 38.15 % on 4,056 rows. `validation.md`: 3.32 %, 8.87 %, 10,497 rows, pressure 15.0 %, 38.1 % on 4,060 rows. The 4 rows are refused by the model in this run (643 against 639): the converted rows differ in the rounding of a few values. The issue's 3.4 % and 9.0 % on 12.8 thousand rows is an older tool on the test split, with outline capacities, so neither the split nor the row set is the same.

The validation split holds 11 cartridges. The bootstrap standard error of the baseline median over cartridges is `u` = 0.37 percentage points.

## Noise floor

- The same load in two source tables (cartridge, powder, bullet mass and charge): 3,054 pairs, 94.1 % print the identical velocity. Most repeated loads are reprints, not repeated measurements, so the scatter of a load measured twice cannot be taken from these rows. The 181 pairs that differ: median 1.93 %, P90 8.23 % (an upper bound: bullet type and barrel are spelled differently between tables, so some pairs are different loads).
- One powder across cartridges (212 powders with at least 3 cartridges, training and validation rows): the standard deviation of the per-cartridge mean log residual of M3 has a median of 3.79 % and a P90 of 7.89 %. That is the order of the present median error: the cartridge-to-cartridge part of the error is as large as the error.
- Within one cartridge and powder: median absolute deviation of the log residual 2.15 %, P90 6.74 % (24,408 rows).

## Informative rows against constants

Training rows, per powder: distinct loads (cartridge, bullet mass, charge, barrel). Constants per powder: present fit 2 (vivacity, energy); exponent per family 1 per powder plus 1 per family; rich form 4; a series of 3 exponential terms 6 plus energy. Families with fewer than 5 cartridges, fewer than 2 source tables or fewer than 3 powders are merged into "other" and not reported.

| Family | Powders | Informative loads per powder (min / median / max) | Cartridges per powder (median) | Pressure rows per powder (median) | Peak pressure max/min (median) | Loading density max/min (median) | Burnt fraction range (median) | Share below present (vivacity, energy) = 2 | Share below exponent per family (+ vivacity refit) = 2 | Share below rich form (vivacity, energy, a, m) = 4 | Share below exponential series, 3 terms (+ energy) = 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| double/ball | 64 | 2 / 65 / 158 | 5 | 42 | 3.86 | 1.55 | 0.21 | 0% | 0% | 2% | 5% |
| double/extruded | 16 | 7 / 42 / 293 | 6 | 4 | 3.27 | 1.42 | 0.23 | 0% | 0% | 0% | 0% |
| single/extruded | 67 | 2 / 46 / 299 | 5 | 11 | 4.03 | 1.50 | 0.18 | 0% | 0% | 3% | 4% |
| single/flake | 8 | 6 / 27 / 81 | 4 | 25 | 3.82 | 3.03 | 0.00 | 0% | 0% | 0% | 25% |
| single/unspecified | 4 | 23 / 39 / 65 | 4 | 4 | 3.72 | 2.37 | 0.04 | 0% | 0% | 0% | 0% |
| unspecified/extruded | 10 | 2 / 14 / 218 | 4 | 0 | 1.68 | 1.20 | 0.00 | 0% | 0% | 10% | 40% |
| unspecified/unspecified | 38 | 1 / 32 / 293 | 5 | 0 | 2.69 | 1.34 | 0.04 | 3% | 3% | 5% | 13% |
all: 223 powders, loads 1 / 39 / 299; present (vivacity, energy) 0%, exponent per family (+ vivacity refit) 0%, rich form (vivacity, energy, a, m) 3%, exponential series, 3 terms (+ energy) 9%

Moving variables: no row prints a propellant temperature, so a temperature constant is not identified by these rows. The peak pressure of a powder's rows spans a factor of about 2 to 4 (median per family) and the loading density a factor of 1.2 to 3; the burnt fraction at the muzzle moves by about 0.2 for ball and extruded powders and barely for flake powders and those whose form is not stated (most of them burn out). A form constant that acts late in the burn is therefore weakly identified for most powders, whatever the row count. Pressure rows per powder are few outside the ball family.

## Candidates on the validation split

Velocity error, pressure error where rows print one; families as above. Leave-one-powder-out ("not in the fitted set") as in the CLI: each powder's fitted fields replaced by the median of its family.

| Candidate | Group | Rows | Median velocity | P90 velocity | Median pressure | P90 pressure | Pressure rows |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M3 baseline | all | 10493 | 3.32 % | 8.87 % | 14.94 % | 38.15 % | 4056 |
| M3 baseline | double/ball | 3326 | 3.89 % | 9.60 % | | | |
| M3 baseline | double/extruded | 1178 | 2.82 % | 7.58 % | | | |
| M3 baseline | single/extruded | 3726 | 3.03 % | 8.56 % | | | |
| M3 baseline | unspecified/extruded | 285 | 2.56 % | 6.07 % | | | |
| M3 baseline | unspecified/unspecified | 1464 | 2.98 % | 7.56 % | | | |
| M3 baseline | not in the fitted set | 10492 | 15.68 % | 61.74 % | 82.88 % | 485.94 % | 4056 |
| Vivacity refit, exponent 1 (control) | all | 10493 | 3.09 % | 8.40 % | 15.06 % | 38.28 % | 4056 |
| Vivacity refit, exponent 1 (control) | double/ball | 3326 | 3.39 % | 8.95 % | | | |
| Vivacity refit, exponent 1 (control) | double/extruded | 1178 | 2.81 % | 7.30 % | | | |
| Vivacity refit, exponent 1 (control) | single/extruded | 3726 | 2.95 % | 8.42 % | | | |
| Vivacity refit, exponent 1 (control) | unspecified/extruded | 285 | 2.65 % | 6.23 % | | | |
| Vivacity refit, exponent 1 (control) | unspecified/unspecified | 1464 | 2.91 % | 7.15 % | | | |
| Vivacity refit, exponent 1 (control) | not in the fitted set | 10492 | 15.71 % | 61.74 % | 82.88 % | 485.94 % | 4056 |
| Residual correction (3 constants) | all | 10493 | 3.12 % | 8.58 % | 14.94 % | 38.15 % | 4056 |
| Residual correction (3 constants) | double/ball | 3326 | 3.60 % | 9.34 % | | | |
| Residual correction (3 constants) | double/extruded | 1178 | 2.90 % | 7.53 % | | | |
| Residual correction (3 constants) | single/extruded | 3726 | 2.85 % | 8.26 % | | | |
| Residual correction (3 constants) | unspecified/extruded | 285 | 2.34 % | 6.12 % | | | |
| Residual correction (3 constants) | unspecified/unspecified | 1464 | 2.73 % | 7.36 % | | | |
| Residual correction (3 constants) | not in the fitted set | 10492 | 16.33 % | 61.70 % | 82.88 % | 485.94 % | 4056 |
| Exponent per family + vivacity refit | all | 10493 | 2.85 % | 7.19 % | 13.09 % | 33.72 % | 4056 |
| Exponent per family + vivacity refit | double/ball | 3326 | 3.15 % | 6.75 % | | | |
| Exponent per family + vivacity refit | double/extruded | 1178 | 2.48 % | 6.70 % | | | |
| Exponent per family + vivacity refit | single/extruded | 3726 | 2.76 % | 7.72 % | | | |
| Exponent per family + vivacity refit | unspecified/extruded | 285 | 2.15 % | 5.63 % | | | |
| Exponent per family + vivacity refit | unspecified/unspecified | 1464 | 2.68 % | 6.44 % | | | |
| Exponent per family + vivacity refit | not in the fitted set | 10492 | 15.51 % | 61.74 % | 82.88 % | 485.94 % | 4056 |
| Rich form, 4 constants per powder | all | 10493 | 2.81 % | 7.11 % | 32.48 % | 123.75 % | 4056 |
| Rich form, 4 constants per powder | double/ball | 3326 | 3.09 % | 6.96 % | | | |
| Rich form, 4 constants per powder | double/extruded | 1178 | 2.81 % | 6.97 % | | | |
| Rich form, 4 constants per powder | single/extruded | 3726 | 2.60 % | 7.16 % | | | |
| Rich form, 4 constants per powder | unspecified/extruded | 285 | 2.46 % | 6.01 % | | | |
| Rich form, 4 constants per powder | unspecified/unspecified | 1464 | 2.50 % | 6.54 % | | | |
| Rich form, 4 constants per powder | not in the fitted set | 10492 | 15.55 % | 61.74 % | 83.08 % | 485.94 % | 4056 |
| ML corrector GBT | all | 10493 | 2.62 % | 6.79 % | n/a | n/a | n/a |
| ML corrector GBT | double/ball | 3326 | 2.99 % | 6.61 % | | | |
| ML corrector GBT | double/extruded | 1178 | 2.54 % | 6.40 % | | | |
| ML corrector GBT | single/extruded | 3726 | 2.47 % | 6.98 % | | | |
| ML corrector GBT | unspecified/extruded | 285 | 2.06 % | 5.27 % | | | |
| ML corrector GBT | unspecified/unspecified | 1464 | 2.15 % | 5.47 % | | | |
| ML corrector GBT | not in the fitted set | 10492 | 12.61 % | 56.03 % | | | |
| ML corrector MLP | all | 10493 | 2.56 % | 6.99 % | n/a | n/a | n/a |
| ML corrector MLP | double/ball | 3326 | 3.16 % | 7.44 % | | | |
| ML corrector MLP | double/extruded | 1178 | 2.37 % | 6.20 % | | | |
| ML corrector MLP | single/extruded | 3726 | 2.13 % | 6.35 % | | | |
| ML corrector MLP | unspecified/extruded | 285 | 2.65 % | 6.33 % | | | |
| ML corrector MLP | unspecified/unspecified | 1464 | 2.15 % | 5.56 % | | | |
| ML corrector MLP | not in the fitted set | 10492 | 11.95 % | 48.95 % | | | |
| ML corrector GP | all | 10493 | 3.19 % | 8.75 % | n/a | n/a | n/a |
| ML corrector GP | double/ball | 3326 | 3.76 % | 9.59 % | | | |
| ML corrector GP | double/extruded | 1178 | 2.90 % | 7.50 % | | | |
| ML corrector GP | single/extruded | 3726 | 2.87 % | 8.29 % | | | |
| ML corrector GP | unspecified/extruded | 285 | 2.50 % | 6.12 % | | | |
| ML corrector GP | unspecified/unspecified | 1464 | 2.81 % | 7.41 % | | | |
| ML corrector GP | not in the fitted set | 10492 | 16.13 % | 61.48 % | | | |
| ML stand-alone GBT | all | 10493 | 2.90 % | 7.73 % | n/a | n/a | n/a |
| ML stand-alone GBT | double/ball | 3326 | 3.51 % | 7.83 % | | | |
| ML stand-alone GBT | double/extruded | 1178 | 2.63 % | 7.40 % | | | |
| ML stand-alone GBT | single/extruded | 3726 | 2.57 % | 7.21 % | | | |
| ML stand-alone GBT | unspecified/extruded | 285 | 1.99 % | 6.32 % | | | |
| ML stand-alone GBT | unspecified/unspecified | 1464 | 2.57 % | 7.19 % | | | |
| ML stand-alone GBT | not in the fitted set | 10492 | 5.94 % | 20.39 % | | | |
| ML stand-alone MLP | all | 10493 | 2.99 % | 8.57 % | n/a | n/a | n/a |
| ML stand-alone MLP | double/ball | 3326 | 3.51 % | 8.61 % | | | |
| ML stand-alone MLP | double/extruded | 1178 | 2.43 % | 6.80 % | | | |
| ML stand-alone MLP | single/extruded | 3726 | 2.59 % | 7.66 % | | | |
| ML stand-alone MLP | unspecified/extruded | 285 | 4.09 % | 10.51 % | | | |
| ML stand-alone MLP | unspecified/unspecified | 1464 | 2.78 % | 8.42 % | | | |
| ML stand-alone MLP | not in the fitted set | 10492 | 9.29 % | 22.85 % | | | |

The leave-one-powder-out line of the per-powder candidates is the M3 line: the candidate module finds a powder by its record vivacity and energy, which the family median replaces, so an unseen powder runs with the present exponent and form. For the machine-learning candidates the powder's own training rows stay in the learner's fit, only its fitted fields are replaced; their line is therefore not a measurement of an unseen powder (see Not checked).

## Verdicts

Rule of `RULE.md`; `u_d` is the bootstrap standard error of the paired change of the median over the 11 validation cartridges. Direction: share of perturbed validation loads (charge +2 %, barrel -10 %, 20,705 pairs) whose velocity moves the wrong way.

| Candidate | Constants | Median change | P90 change | 2 u_d | Wrong direction | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Vivacity refit, exponent 1 (control) | 1 per powder | -0.23 pp | -0.47 pp | 0.28 pp | 0.13 % | fail (fall not above 2 u_d) |
| Residual correction on charge ratio and loading density | 3 in all | -0.20 pp | -0.30 pp | 0.26 pp | 0.13 % | fail (fall not above 2 u_d) |
| Pressure exponent per family + vivacity refit | 1 per powder, 1 per family | -0.47 pp | -1.68 pp | 0.34 pp | 0.11 % | pass |
| Rich form: vivacity, energy, form a and m per powder | 4 per powder | -0.51 pp | -1.76 pp | 0.50 pp | 0.19 % | pass (barely); pressure error doubles |
| ML corrector, gradient-boosted trees | 533 KiB model | -0.70 pp | -2.09 pp | 0.46 pp | 6.22 % | fail (direction) |
| ML corrector, small network (32, 32) | 52 KiB model | -0.76 pp | -1.88 pp | 0.36 pp | 5.60 % | fail (direction) |
| ML corrector, Gaussian process (2,000 training rows) | 31 MiB model | -0.13 pp | -0.13 pp | 0.20 pp | 0.13 % | fail (fall not above 2 u_d) |
| ML stand-alone, gradient-boosted trees | 527 KiB model | -0.42 pp | -1.15 pp | 0.52 pp | 11.67 % | fail (fall and direction) |
| ML stand-alone, small network | 51 KiB model | -0.33 pp | -0.31 pp | 0.34 pp | 11.47 % | fail (fall and direction) |

- Pressure exponent per family: the training error chose 0.8 for the double base ball and extruded families, 0.9 for single base extruded and most others (90 powders at 0.8, 123 at 0.9, 4 at 0.7, 6 at 1). The control shows that half of the median gain and most of the P90 gain come from the exponent, not from refitting the vivacity. The pressure error falls too (median 14.94 to 13.09 %, P90 38.15 to 33.72 %). The stored powder shape already has `pressureExponent`, so the change needs a refit, not a schema change.
- Rich form: passes the velocity rule with the smallest margin, but its pressure error rises from 14.9 to 32.5 % (median) and from 38 to 124 % (P90). Four constants per powder fitted on velocity rows alone move the pressure where no row holds it: the form constants are not identified by velocity rows (see the table of informative rows). A series of exponential terms with 6 or more constants per powder was not fitted: with the same rows it would be less identified still, and 9 % of the powders have fewer informative loads than 7 constants.
- Machine learning: the trees and the network correct the most, but 5.6 to 11.7 % of the perturbed loads move the velocity the wrong way (more charge, less velocity; shorter barrel, more velocity). The present model has 0.13 % (27 barrel cases). The Gaussian process did not fit (length scales at the lower bound) with the default kernel and was not tuned, by the rule. All learners are deterministic with a fixed seed; trees and the network are small enough to run offline in a browser as data, the Gaussian process at 31 MiB is not.
- Tooling: the candidate forms, the fit code and the learners' settings were written by a language-model agent in this study and judged by the same rule. Nothing from such a tool is part of a prediction.

## Recommendation

Fit the pressure exponent per powder family (with the vivacity refitted per powder at that exponent) as the next model change, in its own issue, with the leave-one-powder-out line and pressure checked there. Do not add per-powder form constants or a richer law until rows carry what identifies them (temperatures, pressure rows outside the ball family, loads that stop burning in the barrel). A machine-learning corrector is not adopted; a monotone-constrained variant would be the next thing to try, and only with a true leave-one-powder-out refit. The noise floor cannot be read from these rows (reprints), and the spread of one powder across cartridges (median 3.8 %) is as large as the present error, so the 1 % target needs data per rifle, not more constants per powder.

## Not checked

- The sealed test split (no run, by the owner's rule).
- A true leave-one-powder-out for the refitted laws and the learners (a refit without the powder's rows); the lines above are not that.
- A monotone-constrained learner; a tuned Gaussian process kernel.
- The exponential-series law (reasoned out above, not fitted).
- Sensitivity of the exponent choice to the grid (0.7 to 1.3 in steps of 0.1) and a prior on it.
- Pressure rows as a fit target: every fit used velocity rows only.
- With 11 validation cartridges the bootstrap is coarse; per-family changes are not tested against an uncertainty.

## Reproduce

Scripts in this folder, from the repository root after `npm run build`, with local rows and records given by path (never committed): `rows-dump.mts` (per-row dump), `fit.mts exponent|rich <i>/<n>` (per-powder refits, sharded), `analyse.py` (choices, metrics, bootstrap, learners; Python with NumPy and scikit-learn 1.9), `candidate.mts` through `ballistics compare --candidate spikes/391/candidate.mts` with `SPIKE391_PARAMS` naming the fitted constants.
