---
title: Pressure exponent per powder family, leave one powder out
description: Whether a pressure exponent chosen per powder family still lowers the held-out velocity error when a powder's own rows are left out of its family's choice, which families are too small to choose one, and the fallback.
---

# Pressure exponent per powder family, leave one powder out

## Question

[M3 interior model](../models/interior-m3.md) with the [powder fit](../models/interior-powder-fit.md): an earlier study (issue #391, branch `spike/391-burn-law-constants`) found that a pressure exponent chosen per powder family, with the vivacity refitted per powder, lowers the held-out velocity error. That choice used every powder of the family, including the one predicted. Does the gain hold when a powder's exponent comes from its family without its own rows, and which families are too small to choose an exponent?

## Method

The [validation protocol](../models/validation.md): rows split by `splitOf` of the [command line](../cli.md#split), every constant fitted on training rows only, validation rows only predicted, the test split not run. Load rows that are not in the repository, converted to the command line columns as on the validation page.

For each powder and each exponent of the grid 0.7 to 1.3 (step 0.1), the vivacity factor was fitted on the powder's training rows, minimising the summed squared log error of the velocity. For a powder P of family F (base and grain form of the record), the exponent is the grid value with the least summed error over the other powders of F; P's vivacity factor is the one fitted at that exponent. A family is too small when the other powders number fewer than 3 or their training rows come from fewer than 5 cartridges; the fallback is the exponent chosen over all other powders pooled.

Accept rule, committed before any result and in the same form as the earlier study: on the validation split the median velocity error falls by at least 0.1 percentage points and by more than twice the bootstrap standard error of the paired change of the median (resampling the validation cartridges, 2,000 draws, fixed seed), the P90 does not rise, used rows fall by less than 1 %, the fitted vivacity stays positive and fewer than 1 % of perturbed held-out loads (charge +2 %, barrel -10 %) move the velocity the wrong way. Pressure is reported and never decides. The candidate was measured with `ballistics compare --candidate`; a per-row dump of the same rows gave the bootstrap and the direction check.

The fit and analysis scripts were written by a language-model agent and judged by the same rule; nothing from it is part of a prediction. Scripts and tables: `spikes/594/` on the unmerged branch `spike/594-exponent-leave-one-powder-out`, commit `c2d6d798d5ff7e34c5645228f695311d2cdd3b89` (rule in `RULE.md`, the first commit of the branch; tables in `RESULT.md`).

## Formulas

The vivacity law of the [burn forms page](../models/interior-burn-forms.md): $\dot z = B\, \varphi(z)\, (p / p_\text{ref})^n$. The candidate sets $n$ per family and refits $B$ per powder. For powder $P$ of family $F$ with per-powder objective $S_q(n) = \min_B \sum_i \ln^2(v_{\text{model},i} / v_{\text{printed},i})$, the exponent is $n_P = \arg\min_{n} \sum_{q \in F,\, q \neq P} S_q(n)$. The error of a row is $|v_\text{model} - v_\text{printed}| / v_\text{printed}$. The bootstrap resamples whole cartridges ([JCGM 100:2008](../bibliography.md#jcgm-100-2008) for the standard uncertainty).

## Numbers

Baseline, `ballistics verify` on the validation split: median velocity error 3.32 %, P90 8.87 %, 10,498 used rows from 11 cartridges, pressure median 14.95 %, P90 38.15 % on 4,060 rows.

| Candidate | Median velocity | P90 velocity | Median pressure | P90 pressure |
| --- | --- | --- | --- | --- |
| Baseline, exponent 1 | 3.32 % | 8.87 % | 14.95 % | 38.15 % |
| Family exponent, every powder in the choice | 2.85 % | 7.20 % | 13.09 % | 33.68 % |
| Family exponent, leave one powder out | 2.88 % | 7.24 % | 13.09 % | 33.88 % |
| Baseline, powder not in the fitted set | 15.68 % | 61.74 % | 82.89 % | 486.58 % |
| Powder not in the fitted set, family exponent | 13.36 % | 54.37 % | 78.44 % | 261.53 % |

Leave one powder out against the baseline: median -0.43 percentage points, twice the standard error of the change 0.33, P90 -1.63 percentage points, used rows unchanged, 0.11 % of 20,711 perturbed loads move the wrong way (baseline 0.13 %), every vivacity factor positive.

Per family, median and P90 velocity error (families with fewer than 5 validation cartridges or one source table, 514 rows, merged into "other" and not reported):

| Family | Rows | Baseline | Leave one powder out |
| --- | --- | --- | --- |
| Double base, ball | 3,328 | 3.88 %, 9.60 % | 3.15 %, 6.76 % |
| Double base, extruded | 1,178 | 2.82 %, 7.58 % | 2.47 %, 6.71 % |
| Single base, extruded | 3,727 | 3.04 %, 8.56 % | 2.83 %, 7.64 % |
| Base not stated, extruded | 285 | 2.55 %, 6.06 % | 2.15 %, 5.63 % |
| Base and form not stated | 1,466 | 2.98 %, 7.56 % | 2.68 %, 6.44 % |

Exponent choices: 17 of 223 powders get another exponent when their own rows are left out. The large families barely move (single base extruded: 8 of 67 powders from 0.9 to 0.8, the others none). Too small by the rule: double base flake (1 powder) and ball powders of unstated base (3 powders), 4 powders that take the pooled fallback of 0.8. Single base powders of unstated form (4 powders) pass the size rule, but their exponent ranges from 0.7 to 1.1 when one powder is left out.

## Result

Improved, not adopted yet. Choosing the exponent without the powder's own rows passes the rule (median 3.32 to 2.88 %, P90 8.87 to 7.24 %, pressure better too) and loses only 0.03 percentage points of median against the in-sample choice, so the gain is not an artefact of fitting the predicted powder. Families with fewer than 3 other powders or 5 training cartridges take the pooled exponent; a family of 4 powders already gives an unstable exponent, so the size rule of a build should be stricter or shrink small families toward the pooled value. A powder without rows remains poorly predicted (median 13.4 %) and its change is within the bootstrap noise.

## Data basis

Measured: load rows that are not in the repository, aggregates per powder family only; the sealed test split was not run.

## Where in the app

- `packages/schema/src/powder.ts`, `pressureExponent` of the powder record.
- `packages/core/src/interior/workbench-keys.ts`, `powderModelValues`, which passes the record exponent to the model.
- `packages/cli/src/unseen.ts`, `familyOf` and `unseenPowder`.
- `packages/cli/src/commands.ts`, `verify` and `compare`.
- Model pages: [M3](../models/interior-m3.md), [burn laws and form functions](../models/interior-burn-forms.md), [powder fit](../models/interior-powder-fit.md), [validation](../models/validation.md).

## Confidence

Medium: the result passes a margin set in advance, with a true leave-one-powder-out choice of the exponent, but the validation split has only 11 cartridges, the grid is coarse and the per-family changes carry no uncertainty.
