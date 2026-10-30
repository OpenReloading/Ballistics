---
title: Model validation
description: What "validated" means for a model of this project, the held-out protocol that earns it, the decisions behind the thresholds and the words the documentation may use for a result.
---

# Model validation

A model is called validated only when its prediction was compared with measured values it was not fitted to, by a fixed protocol, and the numbers of that comparison are printed next to the word. Results are simulations, never load data, and nothing on this page is a statement about a particular load.

## Protocol

Measured chronograph rows are never published and are not in the repository. Anything published from them is an aggregate (see the last row of [Decisions](#decisions)).

### Split

The first byte of the SHA-256 of the lower-case UTF-8 cartridge id assigns every row to a split. A row has the split of its cartridge, so one cartridge never appears on both sides of a comparison.

| Split | First byte | Use |
| --- | --- | --- |
| Test | 0 to 50 | Sealed: one final run per model version |
| Validation | 51 to 101 | Every change to model code |
| Training | 102 to 255 | Fitting, and the width of the interval |

The test split is run once per model version, at release, with the model version hash printed in the pull request or the release notes. A run on the test split never guides a model change; a change made after looking at it needs a new version and gives up that split's claim for the earlier one.

### Metrics

All errors are absolute relative errors. For the muzzle velocity the error of a row is $|v_\text{model} - v_\text{printed}| / v_\text{printed}$, and the same for the peak pressure of rows that carry one.

- Median and 90th percentile (P90) of the error, over the rows the model gave a result for.
- Rows the model did not run are counted by reason, next to the metrics. A model that refuses rows would otherwise look better.
- Interval coverage: the share of rows whose printed value lies inside the 90 % interval the model states for it.
- Each metric is reported for all rows of the split, per powder and per powder family.

### Command

```sh
npm run build
node packages/cli/dist/bin.js verify --rows <rows> --records <records> --split validation
node packages/cli/dist/bin.js verify --rows <rows> --records <records> --split test --final
```

`--json` gives the result as data; `--group-by powder` and `--group-by family` give the groups; `--leave-one-powder-out` gives the line of the powder not in the fitted set (`notInFittedSet`), which fills the last row of the results table. The second command is the sealed run and is refused without `--final`. A change to the model is judged with `compare --baseline <verify.json> --candidate <model>` on the same rows. The rows, columns, split, metrics and model version hash are defined on the command line page of the documentation; this page does not repeat them.

The repository holds no measured rows. The command line tests run on synthetic rows built from the model itself, so they test the arithmetic of the evaluation and not the model.

## Results

A local run of `verify --json` on load rows that are not in the repository, validation split, model version `67d67adfce3ebe7c390bd6630a9a508726dfd85f52ac8f00cd9958a458f187bd`, with the powder parameters of the records (`--params records`). Each cell is a local run. The table is updated by hand at each release.

| Group | Cartridges | Rows | Median velocity error | P90 velocity error | Interval coverage |
| --- | --- | --- | --- | --- | --- |
| All | 11 | 10,497 | 3.32 % | 8.87 % | 89.6 % |
| Family double base, ball | 11 | 3,326 | 3.89 % | 9.59 % | 88.0 % |
| Family double base, extruded | 11 | 1,179 | 2.82 % | 7.58 % | 92.5 % |
| Family single base, extruded | 11 | 3,727 | 3.04 % | 8.55 % | 90.3 % |
| Family base not stated, extruded | 9 | 285 | 2.56 % | 6.07 % | 97.5 % |
| Family base and form not stated | 11 | 1,466 | 2.98 % | 7.56 % | 92.2 % |
| Per powder (one line each) | not published | not published | not published | not published | not published |
| Not in the fitted set (leave-one-powder-out) | no data | no data | no data | no data | no data |

- Rows: 16,871 in the split, 10,497 used; not used: 5,583 without a case capacity, 639 refused by the model, 120 without powder parameters, 32 without a bullet shape.
- Families: 514 rows of families with fewer than 5 cartridges or a single source are merged into "other", which is not reported. Per powder lines are not published: a single powder's rows can make the line attributable.
- Inputs the rows do not carry: the bullet is a stand-in per cartridge and bullet mass, with the length from a fit of length over mass and diameter of the bullet records; a row without a barrel length takes the median printed barrel of its cartridge, else 610 mm (case longer than 33 mm) or 120 mm.
- A powder without rows gets no value, so the leave-one-powder-out line reports no data and the count of powders without a value. A family median estimate of such a powder measured a median velocity error of 15.7 %, a P90 of 61.7 % and 31.9 % coverage, too weak to show ([command line](../cli.md#powder-not-in-the-fitted-set)).
- The validation run took 47 s on a shared 16-core host.

Pressure, rows that carry a printed peak pressure in bar (piezo, transducer, C.I.P. or unstated method; CUP rows have no pressure):

| Group | Rows | Median pressure error | P90 pressure error |
| --- | --- | --- | --- |
| All | 4,060 | 15.0 % | 38.1 % |
| Not in the fitted set (leave-one-powder-out) | no data | no data | no data |

Not measured: the sealed test split (one run per model version, at release), and therefore the earlier baseline on the test split (median 3.4 %, P90 9.0 %) is not reproduced by the command line tool; by-session checks; a fit of each powder from rows.

### Pooled powder fit

A local run of the [pooled fit](interior-powder-fit.md#pooled-fit-over-rifles-powders-and-lots) on the same kind of load rows, outside the repository. The split was fixed before any result was seen, and the sealed test split was not read.

- Sessions: the rows of one table, cartridge, powder, bullet mass and type, barrel and overall length. Rifle: table, cartridge and barrel. Lot: table.
- Fit: 516 training-split sessions (952 rows) of 100 powders, 356 parameters. Each powder has a burn coefficient prior centred on its record value, log sigma 0.3. Without it, powders whose velocity barely moves with the burn coefficient left the fit `unresolved`.
- Calibration of the model error: 329 other training-split sessions (627 rows). Every row has a velocity sigma of 1 % (an assumption: the rows print no spread).
- Held out: 343 validation-split sessions (633 rows). Their cartridges are not in the fit, so every one is a rifle the fit has not seen.

| Group | Sessions | Rows | Median velocity error | P90 velocity error | 90 % interval coverage |
| --- | --- | --- | --- | --- | --- |
| Pooled fit, held out | 343 | 633 | 2.85 % | 7.84 % | 92.9 % |
| Record parameters, same rows | 343 | 633 | 3.02 % | 7.83 % | not stated |

The targets of median 1 % and P90 2 % are not met. The estimated relative model error is 5.3 %, and it dominates the intervals.


## Decisions

Each row has a default that stays in force until the owner changes it. The cost of being wrong is the cost of correcting the default later.

| Question | Options | Recommendation | Reasoning | Cost of being wrong | Default |
| --- | --- | --- | --- | --- | --- |
| Which models may be called validated | All interior outputs; velocity of the powder fit only; none until 1.0 | The interior velocity prediction of the powder fit, for charges not fired, and only with the held-out numbers next to the word. Pressure is reported where rows carry it and never called validated. The exterior model is verified, a different word | The velocity of an untested charge of a fitted powder is what the rows measure. Pressure printed in a source is a sample under its own conventions. The exterior model has no measured trajectories in the data, only closed forms and independent integrations to compare with | Low: a model is added to the list when it has held-out numbers | As recommended |
| Thresholds | Median 1 % and P90 2 % as claims; as targets for adopting a change; no threshold | Median 1 % and P90 2 % are targets. A model change is adopted when the validation median falls by at least 0.1 percentage points and P90 does not rise. No threshold claim until `verify` has produced the baseline on the validation split | A claim fixed before the baseline exists is a guess; the adoption rule only needs a before and an after on the same rows | A wrong threshold blocks a good change or admits a bad one, and it is corrected by editing one number | Report the result as it is |
| Powders without rows | Report nothing; report the error of fitted powders; leave-one-powder-out | Leave-one-powder-out as its own line, labelled "powder not in the fitted set". Its P90 is the 90th percentile of the held-out errors of that powder, as defined under Metrics. The half width of the interval shown for an unseen powder is a separate value and is not called P90 | A powder with no rows has nothing to be held out from; leaving a powder out of the fit and predicting it is the only direct measurement of that case | Low: the line stays empty and the interval stays as it is | A powder without rows gets no value. `verify --leave-one-powder-out` gives the line as "no data" with the count of powders without a value ([command line](../cli.md#powder-not-in-the-fitted-set)). The family median estimate measured a median velocity error of 15.7 %, a P90 of 61.7 % and 31.9 % coverage, too weak to show. The line of the results table is from a local run on rows outside the repository |
| Where the numbers live and when they are rerun | Generated on every build; hand-updated page; release notes only | The numbers table of this page, updated by hand at each release from `verify --json`. The validation split on every change to model code, the sealed test split once per model version at release | Rows are not in the repository, so a build cannot regenerate the table. The version hash ties a number to the code that produced it | Low | As recommended |
| What the app says | New on-screen claim; none | Nothing new inside the fitted domain. Outside it the existing interval or refusal text stands | The words of this page are for the documentation. A screen claim needs its own wording review | Low: a claim can be added later | No new on-screen claim |
| Publishing aggregates | Publish every group; merge small groups | Source composition is reviewed for every published group, per powder groups included. A powder family with fewer than 5 cartridges in the rows is merged into "other", which is not a guarantee that no source can be recovered | Rows of one source can make a group attributable whatever its size | A published group can be merged afterwards, a recovered source cannot be taken back | 5; the owner may set another |

## What the documentation may say

May say, with the numbers of a run and nothing else added:

> Held-out median error X percent, P90 Y percent on N rows of powder family F, model version H.

Where X, Y, N, F and H are the values of one `verify` result on one split. A result on the test split says so.

May not say:

- "Accurate", "reliable" or "validated" without the numbers beside the word.
- "Safe", in any form, with or without numbers.
- That a result is "within" a bound for a particular load, charge, rifle or lot.
- Anything about pressure as load data, or any charge to use. A pressure error is a number about the model and the printed values.
- A threshold as a result before `verify` has produced the number.

## Limits

- The error is against printed values, which carry their own conventions and scatter. A small error is agreement with the printed rows, not an accuracy of the physical quantity.
- The interval is built from training rows of the same model. It describes how far the model sat from printed values in the past and is not a prediction interval for the inputs of one load.
- Held-out cartridges stand for cartridges the fit has not seen, not for every rifle, lot or temperature.
- With few cartridges in a family the metrics of that family are noisy; the aggregate rule above hides them rather than correcting them.

## Sources

- [JCGM 100:2008](../bibliography.md#jcgm-100-2008): the law of propagation of uncertainty behind the fit's prediction interval, which the coverage tests.
- The [powder fit](interior-powder-fit.md) and [peak-pressure range](interior-pressure-range.md) pages describe the models whose outputs are compared.
- Research log: [burn law constants](../research/interior-burn-law-constants.md), [pressure exponent per powder family, leave one powder out](../research/interior-exponent-per-family-unseen-powder.md).
