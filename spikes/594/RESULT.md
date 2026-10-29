# Result: pressure exponent per family, leave one powder out

Throwaway spike branch, not for merge. Aggregates of load rows that are not in the repository; no row, source or per-powder line. The rule is `RULE.md` (the first commit). Results are simulations compared with printed values, never load data.

## Setup

- Code: `main` at 7b36740b. Rows converted to the CLI columns as on `validation.md` (stand-in bullet per cartridge and bullet mass, barrel rule of that page), test split not written.
- Baseline, `ballistics verify` on the validation split: median velocity error 3.32 %, P90 8.87 %, 10,498 used rows (`validation.md`: 10,497; one row more is accepted with these converted rows), pressure 14.95 %, 38.15 % on 4,060 rows. Not used: 5,583 without a case capacity, 638 refused, 120 without powder parameters, 32 without a bullet shape. The validation rows with a result come from 11 cartridges.
- Fits: `fit.mts exponent` (the per-powder fit of the earlier study), 223 powders with training rows. Choices, parameter files and the per-row dump: `dump.mts`; aggregates, bootstrap and direction check: `analyse.py`. Candidate 3 through `ballistics compare --candidate spikes/594/candidate.mts` gives the same values as the dump (median 2.88 %, P90 7.24 %, 10,498 rows).
- Bootstrap: over the 11 validation cartridges that have used rows. The first analysis run resampled all 42 cartridges of the split, including those without a used row; it gave 2 `u_d` = 0.35 instead of 0.33 percentage points and the same verdict. The rule means the cartridges of the used rows, as in the earlier study.

## Candidates on the validation split

| Candidate | Rows | Median velocity | P90 velocity | Median pressure | P90 pressure |
| --- | --- | --- | --- | --- | --- |
| Baseline, exponent 1 | 10498 | 3.32 % | 8.87 % | 14.95 % | 38.15 % |
| Family exponent, in sample (pipeline check) | 10498 | 2.85 % | 7.20 % | 13.09 % | 33.68 % |
| Family exponent, leave one powder out | 10498 | 2.88 % | 7.24 % | 13.09 % | 33.88 % |
| Baseline, powder not in the fitted set | 10497 | 15.68 % | 61.74 % | 82.89 % | 486.58 % |
| Unseen powder at the leave-one-out exponent | 10498 | 13.36 % | 54.37 % | 78.44 % | 261.53 % |

The in-sample line reproduces the earlier study (2.85 %, 7.19 %), so the pipeline is the same.

Per family (5 or more validation cartridges and more than one source table; 514 used rows of the other families are merged into "other", not reported), median and P90 velocity error:

| Family | Rows | Baseline | In sample | Leave one powder out |
| --- | --- | --- | --- | --- |
| double/ball | 3328 | 3.88 %, 9.60 % | 3.15 %, 6.76 % | 3.15 %, 6.76 % |
| double/extruded | 1178 | 2.82 %, 7.58 % | 2.47 %, 6.71 % | 2.47 %, 6.71 % |
| single/extruded | 3727 | 3.04 %, 8.56 % | 2.76 %, 7.71 % | 2.83 %, 7.64 % |
| unspecified/extruded | 285 | 2.55 %, 6.06 % | 2.15 %, 5.63 % | 2.15 %, 5.63 % |
| unspecified/unspecified | 1466 | 2.98 %, 7.56 % | 2.68 %, 6.44 % | 2.68 %, 6.44 % |

Pressure per reported family, leave one powder out against baseline (median): 15.31 to 14.09 %, 13.68 to 11.34 %, 15.03 to 12.20 %, 9.57 to 4.95 %, 14.33 to 12.05 %.

## Exponent choices

- In sample: 0.8 for double/ball, double/extruded, unspecified/extruded; 0.9 for single/extruded, single/flake, single/unspecified, unspecified/unspecified, unspecified/flake; smaller families 0.7 to 1.
- Leave one powder out: 17 of 223 powders get another exponent than in sample. In the large families almost none move (double/ball, double/extruded, unspecified/unspecified, unspecified/extruded: none; single/extruded: 8 of 67, 0.9 to 0.8). In the small families the exponent jumps: single/unspecified (4 powders) gets 0.7, 0.9, 1 and 1.1 for its four powders; double/unspecified (6 powders) moves one powder from 1 to 0.7.
- Too small by the rule (fewer than 3 other powders or fewer than 5 training cartridges): double/flake (1 powder) and unspecified/ball (3 powders), 4 powders in all. They take the pooled fallback, 0.8 for each.
- The fitted vivacity factor is finite and positive for every powder.

## Verdict

| Check | Value | Rule | |
| --- | --- | --- | --- |
| Median change | -0.43 pp | at least 0.1 pp fall | pass |
| Against 2 `u_d` | 0.43 > 0.33 pp | larger than 2 `u_d` | pass |
| P90 change | -1.63 pp | not up | pass |
| Used rows | 10,498 against 10,498 | fall under 1 % | pass |
| Wrong direction (charge +2 %, barrel -10 %) | 22 of 20,711 (0.11 %; baseline 27, 0.13 %) | under 1 % | pass |
| Vivacity factor | positive, finite for all 223 | positive | pass |

**Pass.** Leaving a powder's rows out of its family's exponent costs 0.03 pp of median and 0.04 pp of P90 against the in-sample choice. The unseen-powder line falls by 2.32 pp (median) and 7.36 pp (P90), less than its 2 `u_d` of 3.02 pp, and stays far above the fitted powders: a powder without rows is still poorly predicted.

## Not checked

- The sealed test split (no run).
- A finer exponent grid, a prior on the exponent, pressure rows as a fit target.
- A stricter size rule for small families: single/unspecified passes the size rule with 3 other powders, but its exponent is unstable under leave one powder out; its rows are in "other", so the cost is not reported.
- Uncertainty of the per-family changes (11 cartridges are too few for it).

## Reproduce

From the repository root after `npm run build`, with local rows and records given by path (never committed): `fit.mts exponent <i>/<n> <out.json> <rows> <records>...` per shard, merged into one JSON; `dump.mts <fit.json> <out dir> <rows> <records>...`; `python3 -I analyse.py <out dir>` (NumPy); `SPIKE594_PARAMS=<out dir>/params-lopo.json node packages/cli/dist/bin.js compare --candidate spikes/594/candidate.mts ...`.
