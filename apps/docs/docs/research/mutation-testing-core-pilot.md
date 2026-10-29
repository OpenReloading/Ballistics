---
title: Mutation testing of thirteen core modules
description: Whether mutation testing finds weak tests in the core package that line coverage does not, its run time per module, the surviving mutant classes and the tests that kill them, in three rounds.
---

# Mutation testing of thirteen core modules

## Question

Test quality of `packages/core`: does mutation testing find weak tests that the line coverage floor (98 percent) does not, at a run time the repository can carry?

## Method

Decided before the runs.

- Tool: StrykerJS 10.1.1 with its Vitest runner, per-test coverage analysis, concurrency 4, every default mutator. Stryker was installed outside the workspace, so no dependency of the repository changed. It needs the TypeScript 5 API for its tsconfig step (the workspace uses TypeScript 7), and its sandbox copy breaks the relative `extends` of the package's tsconfig, so it ran in place (`inPlace`).
- Modules, by risk: `exterior/atmosphere.ts` (unit constants and the input limits of every exterior run), `interior/form.ts` (burn laws, grain geometry and their checks), `groups/hit-probability.ts` (the zone integral and the dispersion inputs).
- Metric: the mutation score, killed and timed-out mutants over all mutants, and the wall time per module. A surviving mutant matters when it changes a boundary, a sign, a unit factor or drops a guard.
- Accept rule: worth adopting when the surviving mutants that matter show missing tests that line coverage hides, and a scheduled run fits in a CI job of 30 minutes.
- Then: tests for the ten most important survivors at least, and a second run of the same mutants against only the module's own test file to count the kills.
- Second round, the same tool and settings, each module run against only its own test file from the start: `exterior/drag.ts` (table lookup, segment search and the hold rules every trajectory step reads), `exterior/stability.ts` (unit factors of the Miller formula, the stability band, the MOA constant), `interior/range.ts` (the side bookkeeping of the pressure range and its invalid ends), `groups/statistics.ts` (input guards, signs and the CEP bracket of the group statistics) and `recoil.ts` (input guards of the free recoil). No module of the schema or API layer is in this round.
- Third round, the same tool and settings, each module against its own test file. Unlike the first two rounds, the modules were chosen after a screening run: nine small modules not covered before, each against its own test file. The five with the most surviving mutants are in the round, each for what reads it: `groups/velocity-statistics.ts` (the standard deviation interval and shot count the velocity string tools show), `interior/velocity-ladder.ts` (the slope bands that mark the flat spots of a charge ladder), `interior/vivacity.ts` (the mean dynamic vivacity that compares burn laws), `interior/ladder.ts` (the charges of every charge ladder the app and the API compute) and `interior/bore-resistance.ts` (the bore area and resistance law the load-table fit, the load file and the workbench read). Left out after the screening: `exterior/modified.ts` (98.6 %, 1 survivor), `exterior/moving-target.ts` (81.6 %, 7), `interior/start-pressure.ts` (80.8 %, 5) and `cartridge-specs.ts` (52.6 %, 36, of them 35 not covered by its own test file, which a later round can take).

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

Second round, each module against its own test file. "Equivalent" counts the survivors left after the new tests that give the same result as the source; the score after is a new run over the same mutants.

| Module | Mutants | Score before | Surviving or not covered | Wall time, own test file | Killed by the new tests | Equivalent left | Score after |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `exterior/drag.ts` | 181 | 85.1 % | 27 (4 not covered) | 21 s | 20 | 7 | 96.1 % |
| `exterior/stability.ts` | 97 | 80.4 % | 19 | 4 s | 18 | 1 | 99.0 % |
| `interior/range.ts` | 137 (9 runtime errors) | 92.2 % | 10 (2 not covered) | 9 s | 7 | 3 | 97.7 % |
| `groups/statistics.ts` | 373 (24 runtime errors) | 86.3 % | 48 (1 not covered) | 51 min | 35 | 13 | 96.3 % |
| `recoil.ts` | 44 | 77.3 % | 10 | 3 s | 10 | 0 | 100 % |

A runtime error (a mutant that breaks the module on import) is left out of the score. The statistics run is slow because 216 of its mutants (58 %) are static, so each runs the whole group test file with its seeded simulations, on a host shared with other jobs.

Surviving classes before the new tests, second round:

- Input guards never checked one by one, again: the five positive inputs of `millerStability`, every guard of `freeRecoil`, the confidence level, aim and coverage checks of the group statistics and the guards of `pooledGroupStatistics`, which could be dropped as a whole. The tests asserted only that some error is thrown.
- Inclusive limits: zero muzzle velocity and gas factor, a drag segment exactly as narrow or as steep as the hold limit, the band edge of `isStable`.
- A wrong index or side: `dragSegment` below the first node, at a node and at the last node, `segmentCoefficient` on the segments outside the table, the side label of the lower case of the pressure range and the side taken from the one end that could be computed.
- A wrong sign or unit factor: the Magnus term of the dynamic stability factor, MOA as pi times 10800, the width, height and aim offset of a group whose minimum is not 0, the node spacing of the monotone cubic slope, and the CEP bracket `1.2 * sqrt(l1)` that turned into a division survives below a variance of 1.44 m2.

The equivalent survivors of the second round: the default interpolation literal (any other string reads as linear), the internal node guard and the search bound of the drag table, and its end comparisons where both branches give the node value; `sg >= 1` in `isStable` (at Sg = 1 the second condition fails); in the range, a search for the opposite side (same spread), the branch for two invalid ends (the sign is 0 there too) and a move by zero; in the statistics, products with a deviation whose sum is zero, the axis angle branch that only a negative zero reaches, the limits of exactly 1e-9 for the aim centre and the shared distance, which no input reaches exactly, a zero major variance (the bisection then returns 0 too), and the strict test and stop rule of the CEP bisection (both end within its last step).

Third round, each module against its own test file, columns as in the second round. The wall times before and after are the same within a second or two.

| Module | Mutants | Score before | Surviving or not covered | Wall time, own test file | Killed by the new tests | Equivalent left | Score after |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `groups/velocity-statistics.ts` | 95 | 81.1 % | 18 | 14 s | 16 | 2 | 97.9 % |
| `interior/velocity-ladder.ts` | 87 | 66.7 % | 29 (2 not covered) | 3 s | 28 | 1 | 98.9 % |
| `interior/vivacity.ts` | 58 | 77.6 % | 13 | 3 s | 6 | 7 | 87.9 % |
| `interior/ladder.ts` | 58 | 82.8 % | 10 | 3 s | 10 | 0 | 100 % |
| `interior/bore-resistance.ts` | 84 | 54.8 % | 38 (34 not covered) | 3 s | 38 | 0 | 100 % |

Surviving classes before the new tests, third round:

- Input guards never checked one by one, again: the confidence level and width of `velocityStatistics` and `shotsNeeded`, every step check of `ladderFlatSpots`, the start charge, step and odd count of `chargeLadder`, and the range of `meanDynamicVivacity`. The tests asserted only that some error is thrown, and a later check threw instead; an infinite start charge, standard deviation or charge passed when an `&&` became `||`.
- Inclusive limits: a range of the mean vivacity from 0 or to 1, a standard deviation of 0, an oversize of exactly 5 %, a band of width 0 that counts as flat.
- A guard never reached: a width of 0.01 or more that 100 000 shots do not reach, whose search loop then never ends without its bound; an even ladder up or down, which a mutant refusing every ladder of an even count passed.
- A wrong unit factor or sign: the charge step of the ladder slope as a sum, and each count term of the Welch degrees of freedom, since no test checked a slope or a band against a value; the bore resistance with one term switched off, where the tests read only the missing term.
- Not covered by the own test file: `boreArea` and `recordResistance`, which only the load file and record load tests reached.

The equivalent survivors of the third round: in the shot count search, a strict test of the width (no shot count gives the limit exactly) and the early return at the lower end (the bisection returns the same count); in the ladder, the pooled degrees of freedom with 2 added, which only a band of width 0 reads; in the mean vivacity, the seven mutants of the break filter, because a break outside the range adds a piece and its reverse, which cancel within the Simpson error.

The 31 mutants that still survive after the new tests are boundary changes where both branches give the same value at the boundary (the stage joins of the vivacity forms, the lens and sliver limits), the bisection bounds and stop rule of the seven-perforation burnout, the truncation and the end weights of the Simpson rule (below 1e-13 against the closed form), two optional chainings on lookups that always find an entry, and one message text.

## Result

improved. Tests were added (`test/exterior-atmosphere.test.ts`, `test/interior-form.test.ts`, `test/hit-probability.test.ts`): each limit accepted, each invalid field named, each ring probability against the closed form, and the closed-form check of the zone integral tightened from 8 to 13 digits. Mutation testing is recommended in a reduced form: a weekly, report-only run on these three modules, each against its own test file (about a minute in all), not on the full suite (more than 90 minutes for two modules) and not as a required check. More modules join one at a time after a measured run. The second round added tests to five more modules (`test/exterior-drag.test.ts`, `test/exterior-stability.test.ts`, `test/interior-range.test.ts`, `test/groups.test.ts`, `test/recoil.test.ts`); four of them run in seconds against their own test file and fit that weekly run, the group statistics (51 min) does not until its simulation tests move to a file of their own. No workflow was added. The third round added tests to five more modules (`test/velocity-statistics.test.ts`, `test/interior-velocity-ladder.test.ts`, `test/interior-vivacity.test.ts`, `test/interior-ladder.test.ts`, `test/interior-bore-resistance.test.ts`); each runs in 3 to 17 s against its own test file and fits the weekly run.

## Data basis

analytic. The runs mutate the source and run the existing tests; no measured data is used.

## Where in the app

- `packages/core/src/exterior/atmosphere.ts`, `packages/core/test/exterior-atmosphere.test.ts`
- `packages/core/src/interior/form.ts`, `packages/core/test/interior-form.test.ts`
- `packages/core/src/groups/hit-probability.ts`, `packages/core/test/hit-probability.test.ts`
- `packages/core/src/exterior/drag.ts`, `packages/core/test/exterior-drag.test.ts`
- `packages/core/src/exterior/stability.ts`, `packages/core/test/exterior-stability.test.ts`
- `packages/core/src/interior/range.ts`, `packages/core/test/interior-range.test.ts`
- `packages/core/src/groups/statistics.ts`, `packages/core/test/groups.test.ts`
- `packages/core/src/recoil.ts`, `packages/core/test/recoil.test.ts`
- `packages/core/src/groups/velocity-statistics.ts`, `packages/core/test/velocity-statistics.test.ts`
- `packages/core/src/interior/velocity-ladder.ts`, `packages/core/test/interior-velocity-ladder.test.ts`
- `packages/core/src/interior/vivacity.ts`, `packages/core/test/interior-vivacity.test.ts`
- `packages/core/src/interior/ladder.ts`, `packages/core/test/interior-ladder.test.ts`
- `packages/core/src/interior/bore-resistance.ts`, `packages/core/test/interior-bore-resistance.test.ts`
- `packages/core/vitest.config.ts` (the line coverage floors the mutation score is compared with)

## Confidence

medium. The scores before and the kill counts are exact StrykerJS 10.1.1 outputs on these three files; the scores after are estimates computed from them, not a new full-suite run; the full-suite times were taken on a shared machine and vary with its load, and other modules are not measured. The second-round scores after are new runs over the same mutants, not estimates; its times are on the shared host too. The third-round scores after are new runs over the same mutants too; its module choice followed a screening run and is not a risk ranking of all of core.
