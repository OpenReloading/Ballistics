---

title: A new sealed test split by a hash salt
description: Why the test split of the hash rule without a salt is spent, the salted rule that replaces it, how the rows move, and what a result under the new rule is and is not held out from.
---

# A new sealed test split by a hash salt

## Question

[Validation protocol](../models/validation.md) of the interior model: the test split is for one final run per model version, and no change may follow from it. The test split of the first rule (the first byte of the SHA-256 of the cartridge id) was run for eight versions of the load-table fit on 2026-10-13 and 2026-10-14, each result seen before the next version was built. Is it still a set no choice has seen, and what replaces it?

## Method

The first rule's test split is declared spent: a model version tuned after eight looks at one set is tuned to it, whatever the intent of each look. A new measurement set would be the clean answer; there is none, so the same rows are divided again.

- New rule: a fixed salt and a colon are hashed before the lower-case cartridge id. The thresholds and everything else stay: a row has the split of its cartridge, and the test split needs `--final`.
- The salt is `2026-11-12`, the date of the decision. It was fixed before any row was read under it; no other salt was tried, and the numbers below were computed afterwards.
- Every cartridge is assigned again, so training, validation and test all hold other rows than before. No figure of a run under the first rule is compared with one under the new rule. Every result of the command line carries the salt (`splitSalt`), and `compare` refuses a saved baseline of another salt or of none.

What a result under the new rule is not held out from:

- The powder records in use were fitted on the training rows of the first rule, which hold cartridges of the new validation and test splits. The friction constants ([engraving ramp](interior-engraving-ramp.md)) and the start-pressure rule ([start-pressure rules](interior-start-pressure-rules.md)) are model constants fitted on those first-rule training rows too, and no command line option refits them, so every run, `--params fit-on-training` included, has seen them. A `--params records` run on those splits is therefore not a held-out result. A `--params fit-on-training` run is one for what its fit sets (the burn coefficient, with `--exponent family` the exponent, with `--energy prior` the energy); a value the fit leaves at the record's, such as the energy without `--energy prior`, has seen the earlier training rows.
- Choices made earlier on the first rule's validation rows (the design of the fit options) have seen cartridges that are now in the test split.
- Every figure of the documentation outside this entry was measured under the rule without a salt unless it names the salt.

## Formulas

With $b$ the first byte of the SHA-256 digest ([FIPS 180-4](../bibliography.md#fips-180-4)) of the UTF-8 text `<salt>:<lower-case cartridge id>`: test for $b \le 50$, validation for $51 \le b \le 101$, training for $b \ge 102$. A uniform byte gives the shares 51/256, 51/256 and 154/256: 19.9 %, 19.9 % and 60.2 %.

## Numbers

The 553 cartridge ids of the catalog:

| Rule       | Test | Validation | Training |
| ---------- | ---- | ---------- | -------- |
| First rule | 128  | 104        | 321      |
| Salted     | 119  | 108        | 326      |

327 of the 553 ids change their split; 26 are in the test split under both rules.

Load rows that are not in the repository (257 cartridges with rows; a row counts when it prints a velocity and its powder has a record), cartridges and rows per split:

| Rule       | Test       | Validation | Training    |
| ---------- | ---------- | ---------- | ----------- |
| First rule | 57; 15,420 | 45; 15,920 | 155; 29,888 |
| Salted     | 62; 14,217 | 41; 10,621 | 154; 36,390 |

Of these, the cartridges with a capacity record, which a row needs for the model to run it: 11 test, 11 validation and 31 training under the first rule; 12, 17 and 24 under the salted rule.

## Result

No change of the model. Adopted: the salted rule is the only split of the command line, results carry the salt, and a baseline of another salt is refused. The validation split of the new rule has more cartridges the model can run (17 against 11), which narrows the standard error of a median resampled over cartridges, and fewer rows. The results table of the [validation page](../models/validation.md#results) was measured under the first rule and stays until a run under the new rule replaces it.

## Data basis

Public: the cartridge ids of the catalog and the hash rule. The row counts are of load rows that are not in the repository, as counts per split only.

## Where in the app

- `packages/cli/src/split.ts`, `splitOf` and `splitSalt`.
- `packages/cli/src/commands.ts`, `splitSalt` in every result and the refusal of a baseline of another salt.
- `packages/cli/src/result.ts`, the field in the result schema.
- Pages: [command line](../cli.md#split), [validation](../models/validation.md#split), [published loads](../data/published-loads.md#hold-out-split).

## Confidence

Medium: the salt was fixed blind and the tool refuses a comparison across the two rules, but the rows are the earlier rows divided again, so earlier choices have seen cartridges of the new test split. The friction constants and the start-pressure rule were fitted on first-rule training rows and are not refitted by any run, so even a `--params fit-on-training` run is held out only for the values its fit sets. It is a cleaner final check than the spent one, not an untouched one.
