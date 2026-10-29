# Measure and accept rule (fixed before any result)

Throwaway spike branch, not for merge. Nothing here is load data.

## Split

`splitOf` of `packages/cli/src/split.ts`: first byte of the SHA-256 of the lower-case cartridge id, test 0 to 50, validation 51 to 101, training 102 to 255. Every constant of every candidate is fitted on training rows only. Validation rows are only predicted. The test split is not run.

## Metrics

On the used rows of the validation split, through `ballistics verify` and `ballistics compare` where the candidate has the signature of core's `interior`, else through the same row builder (`recordLoad`) and the same error definitions:

- median and P90 of the absolute relative muzzle velocity error;
- median and P90 of the absolute relative peak pressure error, on the rows that print one;
- the same per powder family (families with fewer than 5 cartridges merged into "other", not reported) and on the leave-one-powder-out line;
- used rows, and rows not used by reason.

## Uncertainty of the present fit

`u`: the standard error of the baseline validation median velocity error, by a bootstrap over cartridges (resample the validation cartridges with replacement, all rows of a drawn cartridge, 2000 resamples, seed 391), stated in percentage points.

`d`: for each candidate, the same bootstrap applied to the paired difference (candidate median minus baseline median on the same resampled cartridges) gives the standard error `u_d` of the change.

## Accept rule

A candidate passes when all hold on the validation split, against the M3 baseline on the same used rows:

1. the median velocity error falls by at least 0.1 percentage points;
2. the fall is larger than 2 `u_d` (the change is outside two standard errors of the present fit's median on these cartridges);
3. the P90 velocity error does not rise;
4. used rows do not fall by more than 1 % of the baseline used rows (a candidate that refuses rows is not better);
5. for a fitted law: positive burn rate and vivacity monotone over the burnt fraction for every fitted powder, and fewer than 1 % of perturbed held-out loads (charge +2 %, barrel -10 %) move the velocity in the wrong direction (down with more charge, up with a shorter barrel).

Pressure error is reported and never decides pass or fail.

A failed gate is a valid result.
