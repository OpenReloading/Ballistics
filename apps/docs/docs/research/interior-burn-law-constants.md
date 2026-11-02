---
title: Burn law constants, cheaper steps and machine learning
description: Whether a pressure exponent per powder family, a residual correction, more burn form constants per powder or a machine-learning model predicts the muzzle velocity of held-out cartridges better than the present M3 fit, and whether the load rows identify that many constants.
---

# Burn law constants, cheaper steps and machine learning

## Question

[M3 interior model](../models/interior-m3.md) with the [powder fit](../models/interior-powder-fit.md): does a cheaper step on the present form, a burn law with more fitted constants per powder, or a machine-learning model predict muzzle velocity and peak pressure better than the present fit on cartridges not in the fit, and do the load rows identify that many constants?

## Method

The [validation protocol](../models/validation.md): rows split by `splitOf` of the [command line](../cli.md#split), every constant fitted on training rows only, validation rows only predicted, the test split not run. Load rows that are not in the repository, converted to the command line columns with a stand-in bullet per cartridge and bullet mass and the barrel rule of the validation page. Candidates with the signature of core's `interior` were measured with `ballistics compare --candidate`; the same rows through the command line's `predict` gave the per-row values for the bootstrap, the direction check and the machine-learning candidates.

Accept rule, committed before any result: on the validation split the median velocity error falls by at least 0.1 percentage points and by more than twice the bootstrap standard error of the paired change of the median (resampling the validation cartridges, 2,000 draws, fixed seed), the P90 does not rise, used rows fall by less than 1 %, and for a fitted law the burn rate is positive, the vivacity monotone over the first stage and fewer than 1 % of perturbed held-out loads (charge +2 %, barrel -10 %) move the velocity the wrong way. Pressure is reported and never decides.

Candidates:

- Control: the vivacity of each powder refitted at the present exponent 1.
- Pressure exponent per powder family, from a grid of 0.7 to 1.3, chosen on the training error, with the vivacity of each powder refitted at that exponent.
- A residual correction of the velocity, linear in the logarithms of charge-to-bullet mass ratio and loading density (3 constants in all).
- A richer form: vivacity, energy and the two-stage constants $a$ and $m$ per powder (4 constants per powder). A series of exponential terms was not fitted (see Result).
- Machine learning: a corrector of the M3 velocity residual and a stand-alone regressor, as gradient-boosted trees, a small network and a Gaussian process, with settings fixed before the run.

Noise floor: the same load (cartridge, powder, bullet mass, charge) printed in two source tables, and the spread of one powder's residual across cartridges. Informative rows: distinct loads per powder on the training split against the constants of each candidate, per powder family, families with fewer than 5 cartridges, 2 source tables or 3 powders merged into "other" and not reported.

The candidate forms, the fit code and the learners' settings were written by a language-model agent and judged by the same rule; nothing from it is part of a prediction. Scripts and tables: `spikes/391/` on the unmerged branch `spike/391-burn-law-constants`, commit `bf9a91e5b41694a1285e6e61e17086f57a11c3ff` (rule in `RULE.md`, the first commit of the branch; tables in `RESULT.md`).

## Formulas

The vivacity law of the [burn forms page](../models/interior-burn-forms.md): the burnt fraction $z$ rises as $\dot z = B\, \varphi(z)\, (p / p_\text{ref})^n$ with the two-stage form $\varphi(z) = (1 + a z)^m$ up to $z_1$. The candidates change $n$ per family, or $B$, the specific energy, $a$ and $m$ per powder. The residual correction multiplies the model velocity by $\exp(c_0 + c_1 \ln(m_c / m_b) + c_2 \ln(m_c / V_c))$ with charge $m_c$, bullet mass $m_b$ and chamber volume $V_c$. The error of a row is $|v_\text{model} - v_\text{printed}| / v_\text{printed}$, as on the validation page. The bootstrap standard error follows the resampling of whole cartridges, so rows of one cartridge stay together ([JCGM 100:2008](../bibliography.md#jcgm-100-2008) for the standard uncertainty).

## Numbers

Baseline, `ballistics verify` on the validation split: median velocity error 3.32 %, P90 8.87 %, 10,493 used rows (the validation page: 10,497; 4 rows more are refused with the converted rows), pressure median 14.94 %, P90 38.15 % on 4,056 rows; model version `8e17f2eace299766d9ba5212de610444398d027f56b7c18270c3ea5928a27fd3` (differs from the validation page's: the hash covers the rows file and the records); 11 cartridges, bootstrap standard error of the median 0.37 percentage points.

| Candidate | Median velocity | P90 velocity | Median pressure | P90 pressure | Wrong direction | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| M3, record parameters (baseline) | 3.32 % | 8.87 % | 14.94 % | 38.15 % | 0.13 % | baseline |
| Vivacity refit, exponent 1 (control) | 3.09 % | 8.40 % | 15.06 % | 38.28 % | 0.13 % | fail |
| Residual correction, 3 constants | 3.12 % | 8.58 % | 14.94 % | 38.15 % | 0.13 % | fail |
| Pressure exponent per family + vivacity refit | 2.85 % | 7.19 % | 13.09 % | 33.72 % | 0.11 % | pass |
| Richer form, 4 constants per powder | 2.81 % | 7.11 % | 32.48 % | 123.75 % | 0.19 % | pass, pressure worse |
| ML corrector, gradient-boosted trees | 2.62 % | 6.79 % | not modelled | not modelled | 6.22 % | fail |
| ML corrector, small network | 2.56 % | 6.99 % | not modelled | not modelled | 5.60 % | fail |
| ML corrector, Gaussian process | 3.19 % | 8.75 % | not modelled | not modelled | 0.13 % | fail |
| ML stand-alone, gradient-boosted trees | 2.90 % | 7.73 % | not modelled | not modelled | 11.67 % | fail |
| ML stand-alone, small network | 2.99 % | 8.57 % | not modelled | not modelled | 11.47 % | fail |

Twice the standard error of the paired change: 0.28 (control), 0.26 (residual), 0.34 (exponent), 0.50 (richer form), 0.46, 0.36, 0.20, 0.52 and 0.34 percentage points (learners in table order). The exponent chosen per family: 0.8 for the double base ball and extruded families and the extruded powders of unstated base, 0.9 for single base extruded and most others.

Per family, validation split, median and P90 velocity error:

| Family | Rows | Baseline | Exponent per family | Richer form |
| --- | --- | --- | --- | --- |
| Double base, ball | 3,326 | 3.89 %, 9.60 % | 3.15 %, 6.75 % | 3.09 %, 6.96 % |
| Double base, extruded | 1,178 | 2.82 %, 7.58 % | 2.48 %, 6.70 % | 2.81 %, 6.97 % |
| Single base, extruded | 3,726 | 3.03 %, 8.56 % | 2.76 %, 7.72 % | 2.60 %, 7.16 % |
| Base not stated, extruded | 285 | 2.56 %, 6.07 % | 2.15 %, 5.63 % | 2.46 %, 6.01 % |
| Base and form not stated | 1,464 | 2.98 %, 7.56 % | 2.68 %, 6.44 % | 2.50 %, 6.54 % |

Leave-one-powder-out (powder not in the fitted set): 15.7 %, 61.7 % for the baseline. The per-powder candidates fall back to the present exponent and form for an unfitted powder, so they stay within 0.2 percentage points of it (15.5 % and 15.6 %). The learners keep the powder's own training rows, so no line is stated for them.

Noise floor: of 3,054 pairs of the same load in two source tables, 94.1 % print the same velocity (reprints, not repeated measurements); the 181 pairs that differ have a median of 1.93 % and a P90 of 8.23 % (an upper bound, some are different loads). The standard deviation of one powder's mean residual across cartridges: median 3.79 %, P90 7.89 % (212 powders with at least 3 cartridges).

Informative loads per powder on the training split (minimum, median, maximum) and the share of powders with fewer loads than 4 and 7 constants:

| Family | Powders | Loads per powder | Below 4 | Below 7 |
| --- | --- | --- | --- | --- |
| Double base, ball | 64 | 2, 65, 158 | 2 % | 5 % |
| Double base, extruded | 16 | 7, 42, 293 | 0 % | 0 % |
| Single base, extruded | 67 | 2, 46, 299 | 3 % | 4 % |
| Single base, form not stated | 4 | 23, 39, 65 | 0 % | 0 % |
| Single base, flake | 8 | 6, 27, 81 | 0 % | 25 % |
| Base not stated, extruded | 10 | 2, 14, 218 | 10 % | 40 % |
| Base and form not stated | 38 | 1, 32, 293 | 5 % | 13 % |
| All | 223 | 1, 39, 299 | 3 % | 9 % |

No row prints a propellant temperature; the model peak pressure of one powder's rows spans a factor of 2 to 4, and the burnt fraction at the muzzle moves by about 0.2 for ball and extruded powders and barely for flake powders and those whose form is not stated.

## Result

Improved, not adopted. The pressure exponent per powder family with the vivacity refitted per powder passes the rule (median 3.32 to 2.85 %, P90 8.87 to 7.19 %, pressure better too) and is recommended as the next model change in its own issue; the stored powder shape already carries `pressureExponent`. The richer form passes on velocity by a hair but doubles the pressure error: velocity rows do not identify four constants per powder, so a series of exponential terms with more constants was not fitted. The residual correction and the refit alone fail the margin. The machine-learning models correct the most but move the velocity the wrong way on 5.6 to 11.7 % of perturbed loads and are not adopted. The spread of one powder across cartridges is as large as the present error, so the 1 % target needs data per rifle rather than more constants per powder.

## Data basis

Measured: load rows that are not in the repository, aggregates per powder family only; the sealed test split was not run.

## Where in the app

- `packages/core/src/interior/model.ts`, `interior`, and `packages/core/src/interior/form.ts`, the two-stage form.
- `packages/core/src/interior/record-load.ts`, `recordLoad`.
- `packages/schema/src/powder.ts`, `pressureExponent` of the powder record.
- `packages/cli/src/commands.ts`, `verify` and `compare`.
- Model pages: [M3](../models/interior-m3.md), [burn laws and form functions](../models/interior-burn-forms.md), [powder fit](../models/interior-powder-fit.md), [validation](../models/validation.md).

## Confidence

Medium: the exponent result passes a margin set in advance on paired held-out cartridges, but the validation split has only 11 cartridges and no leave-one-powder-out refit was run for any candidate.
