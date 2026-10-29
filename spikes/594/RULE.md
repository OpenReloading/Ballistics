# Measure and accept rule (fixed before any result)

Throwaway spike branch, not for merge. Nothing here is load data. Same form as the rule of the earlier burn law study (branch `spike/391-burn-law-constants`, `spikes/391/RULE.md`).

## Question

Does a pressure exponent chosen per powder family, with the vivacity refitted per powder at that exponent, still lower the held-out error when the exponent of a powder is chosen without that powder's rows?

## Split

`splitOf` of `packages/cli/src/split.ts`: first byte of the SHA-256 of the lower-case cartridge id, test 0 to 50, validation 51 to 101, training 102 to 255. Every constant is fitted on training rows only. Validation rows are only predicted. The test split is not run, and its rows are not written to the converted rows file.

## Fit

- Grid of the pressure exponent: 0.7 to 1.3 in steps of 0.1.
- For each powder and each exponent of the grid, the vivacity factor of the powder is fitted on its own training rows (one-dimensional, on the log of the factor). Objective: the sum over the powder's rows of the squared log error of the velocity; a run the model refuses counts 1.
- Family: `familyOf` of `packages/cli/src/unseen.ts` (propellant base and grain form of the record).

## Candidates

1. **Baseline**: M3 with the record parameters (exponent 1).
2. **Family exponent, in sample** (a check of the pipeline, not decided): the exponent of a family is the grid value with the least summed objective over all powders of the family, each at its own best vivacity factor. It must reproduce the earlier study (median 2.85 %, P90 7.19 %); if it does not, the pipeline is wrong and nothing below is read.
3. **Family exponent, leave one powder out** (decided): for a powder P of family F, the exponent is the grid value with the least summed objective over the other powders of F, without any row of P. P's vivacity factor is then the one fitted on P's own training rows at that exponent.
4. **Unseen powder** (reported, not decided): P has no rows at all. Exponent as in 3; vivacity the median, over the other powders of F, of their record vivacity times their factor at that exponent; energy the median record energy of the other powders of F (as `unseenPowder` of the CLI does). Compared with the baseline's "not in the fitted set" line, where P's fitted fields are the family medians at exponent 1.

## Too small to fit

A family exponent is chosen for P only when the other powders of F with training rows number at least 3 and their training rows come from at least 5 distinct cartridges. Otherwise the fallback is the exponent chosen the same way over all other powders with training rows, pooled across families (without P). A powder without training rows runs at the baseline in candidate 3 and is counted.

## Metrics

On the used rows of the validation split, through `ballistics compare --candidate` for candidate 3 (and the same rows through a per-row dump for the bootstrap, the direction check and candidate 4; both must give the same medians):

- median and P90 of the absolute relative muzzle velocity error;
- median and P90 of the absolute relative peak pressure error, on the rows that print one;
- the same per powder family; a family is reported only with at least 5 validation cartridges and more than one source table, else it is merged into "other", not reported;
- used rows, and rows not used by reason;
- how many powders get another exponent under leave one powder out than in sample, and how many take the fallback.

## Uncertainty

`u_d`: the standard error of the paired change of the median velocity error (candidate median minus baseline median, each on its own used rows of the same resampled cartridges), by a bootstrap over the validation cartridges (resample cartridges with replacement, all rows of a drawn cartridge, 2000 resamples, seed 594).

## Accept rule

Candidate 3 passes when all hold on the validation split, against the baseline:

1. the median velocity error falls by at least 0.1 percentage points;
2. the fall is larger than 2 `u_d`;
3. the P90 velocity error does not rise;
4. used rows do not fall by more than 1 % of the baseline used rows;
5. the fitted vivacity factor is finite and positive for every powder (the form constants are not changed, so the burn rate stays positive and monotone as in the baseline), and fewer than 1 % of perturbed validation loads (charge +2 %, barrel -10 %) move the velocity the wrong way (down with more charge, up with a shorter barrel).

Pressure error is reported and never decides pass or fail. A failed gate is a valid result.
