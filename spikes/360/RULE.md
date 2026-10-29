# Measure and accept rule (fixed before any result)

Throwaway spike branch, not for merge. Nothing here is load data.

## Rows and split

Load rows that are not in the repository, passed by path. Each row has a stand-in bullet record of its cartridge's G1 and the printed mass, with the length of a log-linear model of length on mass and diameter (over bullet records with a length), so the bearing length is that modelled length, and every stand-in has one construction. The barrel is the row's, else the median printed barrel of the cartridge, else 610 mm (case length above 33 mm) or 120 mm. With these records every row runs at the same start pressure (no powder record states one, so `powderModelValues` gives the 30 MPa rifle default).

Split: `splitOf` of `packages/cli/src/split.ts`. Fitting and every choice of a constant use training rows only; validation rows are only predicted; the test split is not run.

## Variants

- Baseline: the unchanged model, `ballistics verify --split validation` (and `--split training` for the training change).
- Variant 1: a bore resistance that adds `cp p` to the resistance pressure, `p` the space-mean gas pressure at that instant (not the base pressure, which itself depends on the resistance). It enters every place the resistance does: the force on the bullet, the work against resistance, the base and breech pressure and the shot start function. Grid `cp` = 0, 0.025, 0.05, 0.075, 0.1, 0.125, 0.15. Friction stress, oversize coefficient, engraving fraction and the energy constants stay at the record values. The `cp` of the grid with the lowest training median velocity error is chosen (the smaller `cp` on a tie); only that `cp` is run on validation. `cp` = 0 must reproduce the baseline (no change, the same used rows).
- Variant 2: start pressure `p_st L / L_ref`, `p_st` the present start pressure of the row, `L` the bearing length, `L_ref` the mean bearing length of the used training rows of the baseline (one value, as all rows have one construction and one start pressure). Nothing is fitted.

## Metrics

On the used rows of a split, through `verify` and `compare` (median and P90 of the absolute relative muzzle velocity error, pressure median and P90, used rows), and through `aggregate.mts` (the same `outcomes` of the CLI):

- mean signed relative peak-pressure error, model minus printed over printed, on the rows that print one;
- for variant 2: the median velocity error per bearing-length tercile, the tercile limits taken from the used training rows of the baseline and applied unchanged to validation;
- for variant 1: the training median and P90 at each grid point, and their range over the grid (identifiability).

## Accept rule

A variant passes when all hold on the validation split, against the baseline on the same rows and records:

1. the median velocity error falls by at least 0.1 percentage points;
2. the P90 velocity error does not rise;
3. the training median also falls (a gain only on validation, or only on training, is a fail);
4. used rows do not fall (a variant that refuses more rows is flagged and fails).

Pressure error is reported and does not decide pass or fail. A failed gate is a valid result; otherwise the simpler form stays.

## Sensitivity table

A 76 mm rifled proxy (no records; values are guesses, marked as such): engraving resistance doubled, friction doubled, both, at full charge and at 75 % charge, change of peak pressure and muzzle velocity, beside the measured changes the issue quotes.
