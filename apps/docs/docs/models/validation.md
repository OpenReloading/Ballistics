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

The two CLI commands below require the command line workspace (`packages/cli`), which is not in the repository yet. They do not run in a clean checkout until it lands.

```sh
npm run build
node packages/cli/dist/bin.js verify --rows <rows> --records <records> --split validation
node packages/cli/dist/bin.js verify --rows <rows> --records <records> --split test --final
```

`--json` gives the result as data; `--group-by powder` and `--group-by family` give the groups; `--leave-one-powder-out` gives the line of the powder not in the fitted set (`notInFittedSet`), which fills the last row of the results table. The second command is the sealed run and is refused without `--final`. A change to the model is judged with `compare --baseline <verify.json> --candidate <model>` on the same rows. The rows, columns, split, metrics and model version hash are defined on the command line page of the documentation; this page does not repeat them.

The repository holds no measured rows. The command line tests run on synthetic rows built from the model itself, so they test the arithmetic of the evaluation and not the model.

## Results

The baseline on the validation split has not been produced yet: no measured rows are available to the repository. Cells stay "pending" until a run of `verify --json` fills them. The table is updated by hand at each release.

| Group | Cartridges | Rows | Median velocity error | P90 velocity error | Interval coverage |
| --- | --- | --- | --- | --- | --- |
| All | pending | pending | pending | pending | pending |
| Per family | pending | pending | pending | pending | pending |
| Per powder (one line each) | pending | pending | pending | pending | pending |
| Not in the fitted set (leave-one-powder-out) | pending | pending | pending | pending | pending |

Pressure rows have their own table of the same columns, filled only for rows that carry a printed pressure.

## Decisions

Each row has a default that stays in force until the owner changes it. The cost of being wrong is the cost of correcting the default later.

| Question | Options | Recommendation | Reasoning | Cost of being wrong | Default |
| --- | --- | --- | --- | --- | --- |
| Which models may be called validated | All interior outputs; velocity of the powder fit only; none until 1.0 | The interior velocity prediction of the powder fit, for charges not fired, and only with the held-out numbers next to the word. Pressure is reported where rows carry it and never called validated. The exterior model is verified, a different word | The velocity of an untested charge of a fitted powder is what the rows measure. Pressure printed in a source is a sample under its own conventions. The exterior model has no measured trajectories in the data, only closed forms and independent integrations to compare with | Low: a model is added to the list when it has held-out numbers | As recommended |
| Thresholds | Median 1 % and P90 2 % as claims; as targets for adopting a change; no threshold | Median 1 % and P90 2 % are targets. A model change is adopted when the validation median falls by at least 0.1 percentage points and P90 does not rise. No threshold claim until `verify` has produced the baseline on the validation split | A claim fixed before the baseline exists is a guess; the adoption rule only needs a before and an after on the same rows | A wrong threshold blocks a good change or admits a bad one, and it is corrected by editing one number | Report the result as it is |
| Powders without rows | Report nothing; report the error of fitted powders; leave-one-powder-out | Leave-one-powder-out as its own line, labelled "powder not in the fitted set". Its P90 is the 90th percentile of the held-out errors of that powder, as defined under Metrics. The half width of the interval shown for an unseen powder is a separate value and is not called P90 | A powder with no rows has nothing to be held out from; leaving a powder out of the fit and predicting it is the only direct measurement of that case | Low: the line stays empty and the interval stays as it is | As recommended. `verify --leave-one-powder-out` gives the line ([command line](../cli.md#powder-not-in-the-fitted-set)): each powder's fitted fields are replaced by the median over the other powders of its family. The cells stay pending until a run on rows outside the repository |
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
