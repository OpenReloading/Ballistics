---
title: Mutation testing of three core modules
description: Whether mutation testing finds weak tests in the core package that line coverage does not, its run time per module, the surviving mutant classes and the tests that kill them.
---

# Mutation testing of three core modules

## Question

Test quality of `packages/core`: does mutation testing find weak tests that the line coverage floor (98 percent) does not, at a run time the repository can carry?

## Method

Decided before the runs.

- Tool: StrykerJS 10.1.1 with its Vitest runner, per-test coverage analysis, concurrency 4, every default mutator. Stryker was installed outside the workspace, so no dependency of the repository changed. It needs the TypeScript 5 API for its tsconfig step (the workspace uses TypeScript 7), and its sandbox copy breaks the relative `extends` of the package's tsconfig, so it ran in place (`inPlace`).
- Modules, by risk: `exterior/atmosphere.ts` (unit constants and the input limits of every exterior run), `interior/form.ts` (burn laws, grain geometry and their checks), `groups/hit-probability.ts` (the zone integral and the dispersion inputs).
- Metric: the mutation score, killed and timed-out mutants over all mutants, and the wall time per module. A surviving mutant matters when it changes a boundary, a sign, a unit factor or drops a guard.
- Accept rule: worth adopting when the surviving mutants that matter show missing tests that line coverage hides, and a scheduled run fits in a CI job of 30 minutes.
- Then: tests for the ten most important survivors at least, and a second run of the same mutants against only the module's own test file to count the kills.

## Formulas

Mutation score $= (K + T) / N$ with $K$ killed, $T$ timed-out and $N$ all mutants of a file, a mutant without covering tests counted as surviving ([StrykerJS, Mutant states and metrics](https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/)).

## Numbers

| Module | Mutants | Score before | Surviving or not covered | Wall time, full suite | Killed by the new tests | Score after (est.) | Wall time, own test file |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `exterior/atmosphere.ts` | 115 | 83.5 % | 19 | 21 min | 17 | 98.3 % | 8 s |
| `interior/form.ts` | 462 | 84.0 % | 74 (8 not covered) | 74 min | 50 | 94.8 % | 33 s |
| `groups/hit-probability.ts` | 133 | 63.9 % | 48 | 4.3 min | 43 | 96.2 % | 21 s |

The full-suite times are per-test coverage over the whole core suite: the trajectory and interior-model tests cover atmosphere and form, so each of their mutants runs those slow tests. Atmosphere and form ran in the dev container on a shared 16-core host with other jobs, hit-probability on the host itself, so the three times are not on one footing. The "own test file" column runs the same mutants against only `test/exterior-atmosphere.test.ts`, `test/interior-form.test.ts` or `test/hit-probability.test.ts`. The score after is the score before plus the former survivors those runs kill, over the same mutants.

Surviving classes before the new tests:

- Input guards never checked one by one: every `checkAir` limit, `burnError` for the exponent, coefficient, vivacity, reference pressure, grain dimensions, tube and seven-perforation shapes and the two-stage form, and every `need` of `pointDispersion`, `ellipseProbability` and `hitProbability` could be removed or inverted. The existing tests asserted only that some error is thrown, and a later check (air density, a non-finite result) threw instead.
- Inclusive limits: `altitude >= minAltitude`, `humidity <= 1`, density at most 1000 kg/m3, a tube length of exactly one web, zero wind and range uncertainty could all become strict.
- A wrong index: `inside[k + 1]` turned into `inside[k - 1]` in `hitProbability` survived, because the test checked only that the ring probabilities sum to the hit probability and the score to their weighted sum, both still true when every inner ring gets 0.
- A unit factor: `humidity * saturationVapourPressure` turned into a division in the pressure check survived.

The 31 mutants that still survive after the new tests are boundary changes where both branches give the same value at the boundary (the stage joins of the vivacity forms, the lens and sliver limits), the bisection bounds and stop rule of the seven-perforation burnout, the truncation and the end weights of the Simpson rule (below 1e-13 against the closed form), two optional chainings on lookups that always find an entry, and one message text.

Round 5 took five more modules by risk, each run against its own test file with the same tool and settings, installed outside the workspace and run on the host:

- `core/cartridge-specs.ts`: the diameters and bore area that the bullet fit and the cartridge pages read; 35 of its mutants were covered by no test of its own file.
- `api/compute/limits.ts`: the comparison of a simulated pressure range with the CIP Pmax, its warnings and the decimals that keep a printed value on its side of a limit.
- `cli/rows.ts`: the parser of the user's load rows, a trust boundary whose messages must name file, line and column and never quote a value.
- `cli/metrics.ts`: the error metrics, interval coverage and changes that `verify` and `compare` report; it had no test file of its own, so the run before used `test/verify.test.ts` and `test/compare.test.ts`.
- `importers/pressure-history.ts`: unit factors and spellings of a pressure trace, the reading of numbers and the zero-phase low-pass.

| Module | Mutants | Score before | Surviving or not covered | Wall time | Killed by the new tests | Equivalent left | Score after |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `core/cartridge-specs.ts` | 76 | 52.6 % | 36 (35 not covered) | 2 s | 36 | 0 | 100 % |
| `api/compute/limits.ts` | 147 | 83.7 % | 24 (4 not covered) | 9 s | 24 | 0 | 100 % |
| `cli/rows.ts` | 291 | 90.0 % | 29 (4 not covered) | 9 s | 21 | 8 | 97.3 % |
| `cli/metrics.ts` | 127 | 85.8 % | 18 | 65 s | 18 | 0 | 100 % |
| `importers/pressure-history.ts` | 242 | 84.7 % | 37 (6 not covered) | 8 s | 23 | 14 | 94.2 % |

The scores after are new runs of the same mutants, not estimates. The new `test/metrics.test.ts` alone reaches 67.2 % in 5 s; the score after of `metrics.ts` is with the verify and compare tests. The kills were a dropped guard (the crusher method, a one-field record, an empty number column, a whitespace line), a changed boundary (a high end equal to the limit, a temperature of exactly -273.15, a printed velocity on the band edge, exactly ten problems), a wrong unit spelling (the micro signs, a bare or lower-case unit word, empty brackets before the unit), a wrong factor (the low-pass gain, checked against the closed form of a spike), a wrong index (the last word of a header cell, the base name of a rows file) and an output reversed or not trimmed. The 22 equivalent mutants are fallbacks for an index the code never misses, guards whose later check gives the same message, trims of cells the cell splitter already trims, a regular expression anchor whose loss `Number` still rejects, and a comparison with an undefined last time that is false either way.


## Result

improved. Tests were added (`test/exterior-atmosphere.test.ts`, `test/interior-form.test.ts`, `test/hit-probability.test.ts`): each limit accepted, each invalid field named, each ring probability against the closed form, and the closed-form check of the zone integral tightened from 8 to 13 digits. Mutation testing is recommended in a reduced form: a weekly, report-only run on these three modules, each against its own test file (about a minute in all), not on the full suite (more than 90 minutes for two modules) and not as a required check. More modules join one at a time after a measured run. No workflow was added. Round 5 raised the five modules above to between 94.2 % and 100 %, each own-file run under 10 s except the metrics run over the verify and compare tests.

## Data basis

analytic. The runs mutate the source and run the existing tests; no measured data is used.

## Where in the app

- `packages/core/src/exterior/atmosphere.ts`, `packages/core/test/exterior-atmosphere.test.ts`
- `packages/core/src/interior/form.ts`, `packages/core/test/interior-form.test.ts`
- `packages/core/src/groups/hit-probability.ts`, `packages/core/test/hit-probability.test.ts`
- `packages/core/src/cartridge-specs.ts`, `packages/core/test/cartridge-specs.test.ts`
- `packages/api/src/compute/limits.ts`, `packages/api/test/limits.test.ts`
- `packages/cli/src/rows.ts`, `packages/cli/test/rows.test.ts`
- `packages/cli/src/metrics.ts`, `packages/cli/test/metrics.test.ts`
- `packages/importers/src/pressure-history.ts`, `packages/importers/test/pressure-history.test.ts`
- `packages/core/vitest.config.ts` (the line coverage floors the mutation score is compared with)

## Confidence

medium. The scores before and the kill counts are exact StrykerJS 10.1.1 outputs on these three files; the scores after are estimates computed from them, not a new full-suite run; the full-suite times were taken on a shared machine and vary with its load, and other modules are not measured.
