---
title: Mutation testing of core, web, API, CLI, importer, schema, data, drawing and tools modules
description: Whether mutation testing finds weak tests in the core package, the web libraries, the API, the CLI, the importers, the schema, the data checks, the drawing geometry and the tools that line coverage does not, its run time per module, the surviving mutant classes and the tests that kill them, in eight rounds.
---

# Mutation testing of core, web, API, CLI, importer, schema, data, drawing and tools modules

## Question

Test quality of the logic modules (`packages/core` first, then the web libraries, the API, the CLI, the importers, the schema, the data checks, the drawing geometry and the tools): does mutation testing find weak tests that the line coverage floor does not, at a run time the repository can carry?

## Method

Decided before the runs.

- Tool: StrykerJS 10.1.1 with its Vitest runner, per-test coverage analysis, concurrency 4, every default mutator. Stryker was installed outside the workspace, so no dependency of the repository changed. It needs the TypeScript 5 API for its tsconfig step (the workspace uses TypeScript 7), and its sandbox copy breaks the relative `extends` of the package's tsconfig, so it ran in place (`inPlace`).
- Modules, by risk: `exterior/atmosphere.ts` (unit constants and the input limits of every exterior run), `interior/form.ts` (burn laws, grain geometry and their checks), `groups/hit-probability.ts` (the zone integral and the dispersion inputs).
- Metric: the mutation score, killed and timed-out mutants over all mutants, and the wall time per module. A surviving mutant matters when it changes a boundary, a sign, a unit factor or drops a guard.
- Accept rule: worth adopting when the surviving mutants that matter show missing tests that line coverage hides, and a scheduled run fits in a CI job of 30 minutes.
- Then: tests for the ten most important survivors at least, and a second run of the same mutants against only the module's own test file to count the kills.
- Second round, the same tool and settings, each module run against only its own test file from the start: `exterior/drag.ts` (table lookup, segment search and the hold rules every trajectory step reads), `exterior/stability.ts` (unit factors of the Miller formula, the stability band, the MOA constant), `interior/range.ts` (the side bookkeeping of the pressure range and its invalid ends), `groups/statistics.ts` (input guards, signs and the CEP bracket of the group statistics) and `recoil.ts` (input guards of the free recoil). No module of the schema or API layer is in this round.
- Third round, the same tool and settings, each module against its own test file. Unlike the first two rounds, the modules were chosen after a screening run: nine small modules not covered before, each against its own test file. The five with the most surviving mutants are in the round, each for what reads it: `groups/velocity-statistics.ts` (the standard deviation interval and shot count the velocity string tools show), `interior/velocity-ladder.ts` (the slope bands that mark the flat spots of a charge ladder), `interior/vivacity.ts` (the mean dynamic vivacity that compares burn laws), `interior/ladder.ts` (the charges of every charge ladder the app and the API compute) and `interior/bore-resistance.ts` (the bore area and resistance law the load-table fit, the load file and the workbench read). Left out after the screening: `exterior/modified.ts` (98.6 %, 1 survivor), `exterior/moving-target.ts` (81.6 %, 7), `interior/start-pressure.ts` (80.8 %, 5) and `cartridge-specs.ts` (52.6 %, 36, of them 35 not covered by its own test file, which a later round can take).
- Fourth round, the same tool and settings, five modules of `apps/web/src/lib` chosen by risk, one per kind of logic, each against its own test file: `units.ts` (unit conversion: every factor, preset and stored unit choice of the app, and the twist text), `chrono.ts` (file parsing: the size limits and the workbook and text paths of a chronograph import, and the session CSV it writes), `target-geometry.ts` (target geometry: the matrices, the homography and the calibration that turn photo pixels into target mm for every shot group), `ring-scoring.ts` (scoring: the touch rule of a hole on round, oval, square and stadium rings, the tenths, the ring fit of marks) and `field-spec.ts` (record validation: a field's text to SI and its bounds, required, positive and whole number checks, which every designer and calculator field reads). Generated files and pure wiring were not candidates. The tests of `ring-scoring.ts` are split over three files (`ring-scoring.test.ts`, `ring-scoring-shapes.test.ts`, `ring-scoring-national.test.ts`), so all three count as its own; `field-spec.ts` had no test file of its own, its tests sat in `units.test.ts`, so that file is its baseline and the new tests went into `field-spec.test.ts`. The web tests ran on the host (Node 26) against the workspace's Vitest, with Stryker's temporary directory inside the workspace (one on another file system breaks the restore of an in-place run).

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

Fourth round, five web library modules, each against its own test file, columns as in the second round. The wall time is the run after the new tests.

| Module | Mutants | Score before | Surviving or not covered | Wall time, own test file | Killed by the new tests | Equivalent left | Score after |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `units.ts` | 243 | 79.4 % | 50 (18 not covered) | 10 s | 39 | 11 | 95.5 % |
| `chrono.ts` | 191 (3 runtime errors) | 69.7 % | 57 (15 not covered) | 26 s | 55 | 2 | 98.9 % |
| `target-geometry.ts` | 438 (152 runtime errors) | 57.3 % | 122 (58 not covered) | 16 s | 96 | 26 | 90.9 % |
| `ring-scoring.ts` | 423 | 86.5 % | 57 (2 not covered) | 27 s | 19 | 38 | 91.0 % |
| `field-spec.ts` | 141 | 36.9 % | 89 (64 not covered) | 8 s | 84 | 5 | 96.5 % |

The runtime errors of `target-geometry.ts` are mutants that break the matrices the test file builds when it loads (a photo of a known homography), so the file fails before any test runs; they are left out of the score as in the earlier rounds. The chronograph run is longer after the new tests because two of them read 32 MiB of bytes.

Surviving classes before the new tests, fourth round:

- Input guards never checked one by one, again: a stored unit choice of `null`, a preset given as an array, overrides of `null`, of an unknown quantity or of a unit id that is no string (each threw or kept a wrong unit when its check was dropped); a matrix of 8 entries, a singular matrix and a singular linear system; three points on one line other than the first three of a homography; marks on a ring without points, exactly four marks, and an inner ring marked outside an outer one; a hole size of 0 with no event. The tests asserted only that some error is thrown, or did not reach the guard.
- Inclusive limits: a chronograph file of exactly 32 MiB, a field value at its minimum and at its maximum, 0 for a value that must be greater than 0, two values within the relative 1e-9 of a unit round-trip.
- A wrong index or axis: the angle step of a ring drawn on the sheet (any multiple of the step still lies on the circle), the centre of a circle whose first point is not level with it, the cold bore shot and the flyer of the example session, and a string whose shots are all excluded.
- A wrong sign or unit factor: the water volume and water mass of a case capacity with the density product and quotient swapped, the millisecond and percent factors, the sign of a product in the last row of `mul3`, the terms of `det3`, the entries of `apply3` (only a unit vector component was read), the turn of a point off both axes, and the upper end of the bisection bracket of the oval distance, which only a point beyond the ellipse's major semi-axis reaches.
- Not covered by the own test file: most of `field-spec.ts` (its tests read three of its functions), the matrix helpers, `turnPoint` and `turnedBox` of `target-geometry.ts`, the file size checks and the workbook path of `chrono.ts`, and the drawing unit, the time and percent texts and the water capacity of `units.ts`.

The equivalent survivors of the fourth round: in the units, the catch of an unreadable stored choice and the first type test of it (any other value also returns nothing), the four mutants of the lead pattern of a typed twist (its optional group always matches), the three of the zero and non-finite branch of the rounded field text (the same text either way) and the temperature difference unit of the US preset, which the temperature unit overwrites; in the chronograph session, the two of an undefined velocity, which a parsed shot never has; in the target geometry, the 13 of the point normalisation of the homography (an exact four-point solution does not depend on it), the pivot choice, the singular bound and the array allocation of the linear solver, the skip bound and the strict test of the collinear check, the five small terms and the strict test of the relative bound of a circle through three points, and three of the length guard of a reference, whose quotient check throws the same message; in the ring scores, the six strict tests within the 1e-12 m touch tolerance, the 13 of the stop rules, iteration bound and lower end of the oval distance's bisection, the inner ten's stadium and innermost ring tests (no hole reaches the inner ten outside the innermost ring), the eight of the mark normalisation and the sign of the free unknown of the ring fit, its seven degeneracy guards that a later check meets with the same message, and the empty hole check that the zero test repeats; in the field checks, the comparison with a missing value, the exact 1e-9 boundary, the value read after an empty text has returned, and the two bound tests whose comparison with a missing bound is false either way.

The 31 mutants that still survive after the new tests are boundary changes where both branches give the same value at the boundary (the stage joins of the vivacity forms, the lens and sliver limits), the bisection bounds and stop rule of the seven-perforation burnout, the truncation and the end weights of the Simpson rule (below 1e-13 against the closed form), two optional chainings on lookups that always find an entry, and one message text.

Round 5 took five more modules by risk with the same tool and settings, installed outside the workspace and run on the host, each against its own test file except `cli/metrics.ts`, whose score is over `test/verify.test.ts` and `test/compare.test.ts` (its own test file alone gives 67.2 %):

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

Round 6 took five modules of the schema validators and the API layer after a screening run of 15 small modules not covered before, each against its own test file, with the same tool and settings, installed outside the workspace and run on the host. Stryker's `testFiles` option makes every mutant run with a test filter, so a static mutant (one evaluated when the module loads, such as a constant table) is switched on only after the module has loaded and survives: the screening run of `interior/start-pressure.ts` showed 14 survivors that way against 5 without it. This round therefore restricts the run to the own test file through a Vitest configuration outside the workspace that includes only that file.

Screening, score and surviving or not covered mutants: `api/compute/resolve.ts` 0.0 % (73, its test file tests a schema conversion only), `api/routes/charge-target.ts` 47.6 % (11), `schema/target-sheet.ts` 49.2 % (93), `schema/overrides.ts` 57.0 % (49), `interior/workbench-keys.ts` 60.0 % (6 of 15), `schema/case-capacity.ts` 67.6 % (23), `interior/monte-carlo.ts` 73.7 % (20), `schema/competition-order.ts` 76.6 % (29), `interior/start-pressure.ts` 80.8 % (5), `exterior/moving-target.ts` 81.6 % (7), `interior/fit-sessions.ts` 84.5 % (16), `interior/record-load.ts` 86.2 % (9), `interior/fit-strings.ts` 89.5 % (4), `interior/load-file.ts` 89.8 % (21) and `interior/shotshell.ts` 97.8 % (1). The five with the lowest score were taken, each for what reads it, except `interior/workbench-keys.ts`, whose 15 mutants are key lists with little logic:

- `api/compute/resolve.ts`: the record lookups of every compute route and the bullet record to projectile step, with the lb/in2 factor of the ballistic coefficient bands and the guards for a missing or repeated band.
- `api/routes/charge-target.ts`: the charge solver route, its error handler for a full pool, its body limit and its OpenAPI entry.
- `schema/target-sheet.ts`: the cross-field rules of a target sheet (one rectangle, references need a photo, unique group and note ids, a ladder step needs a load) and the units its JSON Schema states.
- `schema/overrides.ts`: the merge of a user variant over a catalogue record and the override and draft schemas the designers save.
- `schema/case-capacity.ts`: the catalogue rules of a water capacity record and its accepted values.

| Module | Mutants | Score before | Surviving or not covered | Wall time, before and after | Killed by the new tests | Equivalent left | Description texts left | Score after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `api/compute/resolve.ts` | 73 | 0.0 % | 73 (73 not covered) | 6 s, 9 s | 72 | 1 | 0 | 98.6 % |
| `api/routes/charge-target.ts` | 21 | 47.6 % | 11 | 33 s, 34 s | 9 | 2 | 0 | 90.5 % |
| `schema/target-sheet.ts` | 190 (7 runtime errors) | 49.2 % | 93 | 11 s, 10 s | 20 | 1 | 72 | 60.1 % |
| `schema/overrides.ts` | 120 (6 runtime errors) | 57.0 % | 49 (7 not covered) | 7 s, 8 s | 44 | 5 | 0 | 95.6 % |
| `schema/case-capacity.ts` | 71 | 67.6 % | 23 | 7 s, 6 s | 13 | 0 | 10 | 85.9 % |

The kills were a dropped guard (a bullet record without a BC of the drag model, two BCs of one start speed, a cartridge value override with neither value nor raw text, a catalogue capacity without a case manufacturer, a sheet without a load whose groups have no ladder step), a wrong unit factor (the lb/in2 to kg/m2 factor of each band, the SI mass, diameter and length of a bullet record), a wrong index or default (a band without a start speed from 0, the length taken from the record only when none is stated, the 404 text naming kind and id), a merge that kept an undefined override or the removal of a value the base lacks, the error handler and `retry-after` of a full compute pool, the 256 KiB body limit, the input hash, API version and data hash of an answer, the summary, statuses, example and answer schema of the OpenAPI entry, every issue code, path and message of the sheet and capacity rules, the enum values of the polarity, origin and case condition, a note that must not be empty, the path descriptions of override fields and the units px, m and rad of the sheet's JSON Schema. The 9 equivalent mutants: in the projectile, a placeholder BC list for a record without BCs (it holds no BC of the model either); in the route, the truing details of an error answer (the charge solver throws no truing error) and a 200 answer sent by `reply` instead of returned; in the sheet, a placeholder note list for a sheet without notes (one note cannot repeat an id); in the overrides, a `null` treated as an object (`null` removes the field first), and four mutants of the description of a field that has its own (no field of the bullet, cartridge or powder overrides has one before the rebuild, and every item schema has all or none). Stryker reported the route without its answer stamp hook as surviving after 3 of the 15 tests of the file; the same mutant switched on by hand fails the new stamp test, so it counts as killed and the score after of the route is computed with it. The 82 description texts left are the `describe` strings of the schema fields, which the JSON Schema baseline of the contract tests compares (`packages/schema/test/contracts.test.ts`), not the own test file.

Round 7 took five modules of the web libraries, the data checks, the drawing geometry and the tools after a screening run of 16 small modules not covered before, each against its own test files through a Vitest configuration outside the workspace, with the same tool and settings, installed outside the workspace and run on the host. The screening ran with coverage analysis over all tests; the scores before in the table are a second run with per-test coverage, as in the other rounds, and match the screening.

Screening, score and surviving or not covered mutants: `web/hole-proposals.ts` 50.9 % (57), `web/user-store.ts` 51.6 % (78, over its three test files), `tools/audit.ts` 60.0 % (28), `data/references.ts` 63.1 % (58), `web/caliber.ts` 69.2 % (36), `tools/pack-check.ts` 69.8 % (54), `drawing/core/geometry.ts` 71.8 % (94), `drawing/cartridge/regions.ts` 72.6 % (26), `web/case-rows.ts` 73.9 % (12), `web/ticks.ts` 74.1 % (15), `web/lot-rows.ts` 75.6 % (19), `data/load-tables.ts` 82.3 % (17), `data/names.ts` 82.5 % (22), `data/renames.ts` 87.8 % (5), `web/mass-range.ts` 93.0 % (4) and `web/query.ts` 94.5 % (8). `web/dates.ts` has no score: its test file failed the tool's first run. The five taken, each for what reads it:

- `apps/web/src/lib/hole-proposals.ts`: the expected hole size of the target editor (typed, learned median, bullet, marker), the maybe tier of a proposal, the local photo scale under a perspective calibration and the proposals kept clear of placed shots.
- `apps/web/src/lib/user-store.ts`: the browser store of user records and photos: invalid entries stored only where the id is free, the photo ids of invalid sheets, a change read and written in one transaction, the relink of a chain of refits on delete and the persistent storage request.
- `packages/data/src/references.ts`: the reference checks of the record data (cartridge, components, primer, capacity, case, session, load and manufacturer of every record kind), with renamed ids.
- `tools/src/pack-check.ts`: the tarball check of the published libraries: entry points, the `files` field, test files, source maps and undeclared imports.
- `packages/drawing/src/core/geometry.ts`: the overlap tests the label placement of the drawings reads: segment and box, two boxes, two segments, two polygons with a pad, and the distance to a box.

Left out: `tools/audit.ts`, whose survivors are mostly its script block, which runs `npm audit` through a path that a test cannot replace; `web/caliber.ts`, whose survivors are mostly the literals of its caliber table; the others for their higher scores.

| Module | Mutants | Score before | Surviving or not covered | Wall time, before and after | Killed by the new tests | Equivalent left | Script block left | Score after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `web/hole-proposals.ts` | 116 | 50.9 % | 57 (43 not covered) | 9 s, 11 s | 57 | 0 | 0 | 100 % |
| `web/user-store.ts` | 161 | 51.6 % | 78 (62 not covered) | 10 s, 15 s | 73 | 5 | 0 | 96.9 % |
| `data/references.ts` | 157 | 63.1 % | 58 (36 not covered) | 7 s, 10 s | 57 | 1 | 0 | 99.4 % |
| `tools/pack-check.ts` | 179 | 69.8 % | 54 (21 not covered) | 56 s, 73 s | 20 | 10 | 24 | 81.0 % |
| `drawing/core/geometry.ts` | 333 | 71.8 % | 94 (1 not covered) | 10 s, 11 s | 63 | 31 | 0 | 90.7 % |

The scores after are new runs over the same mutants. The pack check runs `npm pack --dry-run` for each test, which sets its time. Its script block (the list of published packages and the loop that packs each of them) is reached only by packing every published package, which CI does as its own step, so its 24 mutants are left and not counted as equivalent.

Surviving classes before the new tests, round 7:

- Not covered by the own test file: the hole size rules, the maybe tier and the nominal size test of the hole proposals; the photo ids of invalid sheets, the store of invalid entries, the change in one transaction, the photo store and the persistent storage request of the user store; the cartridge and session reference checks and every manufacturer check but the capacity's.
- A dropped guard: a stored powder whose `fit.previous` is no text, whose data has no fit, or whose id is no text, and a record of another kind naming a deleted powder (each was relinked or broke the delete when its check was dropped); deleted records that name each other or themselves, whose loop never ended or named a deleted record without its stop rule; a bundle without renames; a load without a capacity or a primer; an export condition set to `null`; a package without `main` or `types`.
- A changed boundary: a proposal exactly half a hole from a shot, a confidence of exactly 0.5, polygons and boxes exactly the pad apart or touching in the reverse order, segments meeting end to end at either end of either one, a segment that ends on a box edge.
- A wrong index or sign: the even median of the learned hole size, a proposal near the second shot of a group, the closing edge of a polygon, the corner of a box at minus half its width and height, and the translation and turn of a box off the origin and off the axes, which no test had (every box sat at the origin facing +x).
- A wrong pattern: a trailing slash in `files`, a source root of a source map, a name that only ends or starts with a licence word, `.cjs` and `.d.mts` files, a non-code file with import text, a root `test/` folder and an `.mjs` test file.
- A wrong unit factor: the pad along a box's height (only its width was tested), the local photo scale taken off the middle of the region or 1 mm backwards, which only a perspective calibration shows.

The 47 equivalent survivors of round 7: in the user store, a fallback for a `getAll` that always returns an array, an optional chaining on stored values that are never `null` and one on powder data the `previous` read already found, the re-put of an unchanged name, and a text id test whose other branch gives the same result; in the references, a maker given as a plain id, which the schema rejects before this check; in the pack check, the fallback of a regular expression group that always matches, the three mutants of a pack that lists no package (npm always lists one), the fallback of a missing `files` field (no file matches either pattern), the test for a non-object export value (`Object.values` of it is empty), the filter of negation patterns (`matchesGlob` never matches one) and the exact name and glob test of an entry (a name without `*` matches itself); in the geometry, the twelve of the quick reach test and its reach in front of the exact segment and box test, the ten of the bounding box test in front of the exact segment crossing, the six of the near-zero and sign tests of a parallel clip edge, a parallel segment and a polygon edge of zero length, and the three of the loop bound behind its own guard.

Round 8 took five modules after a screening run of 13 small modules not covered before: the web libraries added or changed since round 7, importer parsers and tools checks, each against its own test files through a Vitest configuration outside the workspace, with the same tool and settings, installed outside the workspace and run on the host. The screening ran with per-test coverage, so its scores are the scores before.

Screening, score and surviving or not covered mutants: `importers/units.ts` 22.0 % (78), `web/records-csv.ts` 50.0 % (51), `tools/licences.ts` 57.6 % (145), `tools/pages-serve.ts` 63.7 % (33), `importers/shotview.ts` 79.6 % (44), `web/load-use.ts` 81.6 % (7), `web/firearm.ts` 82.8 % (76), `web/load-gaps.ts` 83.1 % (10), `web/match-rounds.ts` 89.8 % (10), `importers/openreloading-json.ts` 91.2 % (22), `web/caliber-class-of.ts` 93.8 % (1), `web/build-line.ts` 95.0 % (1) and `tools/dev-exit.ts` 97.0 % (1). The five with the lowest scores are in the round, each with logic of its own:

- `packages/importers/src/units.ts`: the velocity unit spellings of every chronograph import, the exact factors to m/s, the unit the caller names against the unit of the file, and the positive velocity check. Its own test file read only one function; `parseVelocity` is also reached through the generic importer tests, which this run does not include.
- `apps/web/src/lib/records-csv.ts`: the CSV files of the saved loads and the firearm list, with the names of the records a load names, taken from this browser or asked from the API once each.
- `tools/src/licences.ts`: the licence policy of the shipped packages: the production closure of the lock file, the platform filter, the SPDX expression reader, the policy file, the NOTICE block and the job summary.
- `tools/src/pages-serve.ts`: the local static host of the Pages site: the base path, the root guard, a directory and its index file, the content types and a 404 page that fails.
- `packages/importers/src/shotview.ts`: the ShotView CSV and workbook parser: the header row, the name line, quoted line breaks, the footer date and the footer statistics.

Left out: `web/firearm.ts`, whose survivors are mostly the literals of its label tables; the others for their higher scores or fewer survivors.

| Module | Mutants | Score before | Surviving or not covered | Wall time, before and after | Killed by the new tests | Equivalent left | Script block left | Score after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `importers/units.ts` | 100 | 22.0 % | 78 (59 not covered) | 2 s, 4 s | 78 | 0 | 0 | 100 % |
| `web/records-csv.ts` | 109 (7 runtime errors) | 50.0 % | 51 (42 not covered) | 4 s, 13 s | 48 | 3 | 0 | 97.1 % |
| `tools/licences.ts` | 344 (2 runtime errors) | 57.6 % | 145 (86 not covered) | 7 s, 10 s | 99 | 6 | 37 | 86.5 % |
| `tools/pages-serve.ts` | 91 | 63.7 % | 33 (6 not covered) | 24 s, 26 s | 20 | 5 | 8 | 85.7 % |
| `importers/shotview.ts` | 216 | 79.6 % | 44 (4 not covered) | 11 s, 16 s | 29 | 14 | 0 | 93.1 % |

The scores after are new runs over the same mutants. The script blocks are the parts that run only as a command: the licence check that reads the repository's lock file, policy and NOTICE, and the host's port, base path and root from the environment; CI runs the licence check as its own step. Four survivors are neither equivalent nor a script block: in the licences, a workspace entry with an `os` field, which the platform filter would read once the `node_modules/` test of a lock key is dropped, and two description texts of the packages left out of the list; in the ShotView workbook, the text of a date row with its label only.

Surviving classes before the new tests, round 8:

- Not covered by the own test file: `parseVelocityUnit` and `parseVelocity` of the units, the saving of both CSV files and the record names of the saved loads, the job summary and the default roots of the licence check.
- A dropped guard: a dependency that is not installed, a link without a target and a dependency cycle (the loop ended early or never ended), a policy whose list is no list of text or names no npm package, a velocity of exactly 0, a header row without `#`, a directory without `index.html`, a path that only starts with the base path, and a non-load record whose cartridge was asked from the API.
- A wrong unit factor or unit: the m/s factors of ft/s, km/h and mph, the rounding to 1e-6, a value in m/s rounded where it is kept as written, and the content type of each file extension.
- A wrong index or position: the day read from a time before it (`10:45`), a year read from a longer number, a dependency taken from the root where a nearer copy sits up a nested tree, a name line that holds numbers read as a shot, a blank line between the dash row and the date row, and a last shot row whose quoted note is never closed.
- A wrong pattern or text: an operator at the end of an SPDX expression, a comment line read as an excepted package, a reason comment without a space after the hash, the German labels of the footer statistics, the separator of two bore flags and the count of undeclared licences in the summary.
- A 404 page that fails after its head is sent: the host then wrote a second head, which throws.

The 28 equivalent survivors of round 8: in the CSV files, a reference test of a bullet or powder typed into the load (`parseRef` rejects it after) and two optional chainings on load uses that always exist; in the licences, the root of the folder search, which reaches the same key by a longer path, the guard and fallback of a lock entry that `resolve` already found, the order of two equal ids, which the unique list never has, and the end of an expression after an operator, which the length check rejects too; in the static host, the NUL byte check and the catch of `statSync`, each of which also covers the other, `throwIfNoEntry` (the catch gives the same result) and the fallback of a request without a URL, which Node never passes; in ShotView, the parity of the quote count (any sign or offset of two keeps it), the fallbacks of a cell that the header rule has already checked, the date rules where a missing day, month or year gives no ISO date either way, a time replaced by nothing instead of a space (words split at letters anyway), the first entry of the output and word lists, the footer search when the footer always starts with a dash row, and the label read of a date row.

## Result

improved. Tests were added (`test/exterior-atmosphere.test.ts`, `test/interior-form.test.ts`, `test/hit-probability.test.ts`): each limit accepted, each invalid field named, each ring probability against the closed form, and the closed-form check of the zone integral tightened from 8 to 13 digits. Mutation testing is recommended in a reduced form: a weekly, report-only run on these three modules, each against its own test file (about a minute in all), not on the full suite (more than 90 minutes for two modules) and not as a required check. More modules join one at a time after a measured run. The second round added tests to five more modules (`test/exterior-drag.test.ts`, `test/exterior-stability.test.ts`, `test/interior-range.test.ts`, `test/groups.test.ts`, `test/recoil.test.ts`); four of them run in seconds against their own test file and fit that weekly run, the group statistics (51 min) does not until its simulation tests move to a file of their own. No workflow was added. The third round added tests to five more modules (`test/velocity-statistics.test.ts`, `test/interior-velocity-ladder.test.ts`, `test/interior-vivacity.test.ts`, `test/interior-ladder.test.ts`, `test/interior-bore-resistance.test.ts`); each runs in 3 to 17 s against its own test file and fits the weekly run. The fourth round added tests to five web library modules (`apps/web/test/units.test.ts`, `chrono.test.ts`, `target-geometry.test.ts`, `ring-scoring.test.ts` with `ring-scoring-shapes.test.ts` and `ring-scoring-national.test.ts`, and the new `field-spec.test.ts`); each runs in 8 to 27 s against its own test files and fits the weekly run. Round 5 (`packages/core/src/cartridge-specs.ts`, `packages/api/src/compute/limits.ts`, `packages/cli/src/rows.ts`, `packages/cli/src/metrics.ts`, `packages/importers/src/pressure-history.ts`) raised the five modules to between 94.2 % and 100 %, each own-file run under 10 s except the metrics run over the verify and compare tests. Round 6 (`packages/api/src/compute/resolve.ts`, `packages/api/src/routes/charge-target.ts`, `packages/schema/src/target-sheet.ts`, `packages/schema/src/overrides.ts`, `packages/schema/src/case-capacity.ts`) killed every survivor that is neither equivalent nor a description text; each own-file run takes 6 to 34 s. A weekly run against the own test file should restrict the files through the Vitest configuration, not through `testFiles`, so its static mutants count. Round 7 (`apps/web/src/lib/hole-proposals.ts`, `apps/web/src/lib/user-store.ts`, `packages/data/src/references.ts`, `tools/src/pack-check.ts`, `packages/drawing/src/core/geometry.ts`) raised the five modules to between 81.0 % and 100 %; every survivor left is equivalent except the 24 of the pack check's script block. Four of the own-file runs take 11 to 15 s; the pack check takes 73 s, as each of its tests packs a package. Round 8 (`packages/importers/src/units.ts`, `apps/web/src/lib/records-csv.ts`, `tools/src/licences.ts`, `tools/src/pages-serve.ts`, `packages/importers/src/shotview.ts`) raised the five modules to between 85.7 % and 100 %; every survivor left is equivalent, a script block or one of four named in the round; each own-file run takes 4 to 26 s.

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
- `apps/web/src/lib/units.ts`, `apps/web/test/units.test.ts`
- `apps/web/src/lib/chrono.ts`, `apps/web/test/chrono.test.ts`
- `apps/web/src/lib/target-geometry.ts`, `apps/web/test/target-geometry.test.ts`
- `apps/web/src/lib/ring-scoring.ts`, `apps/web/test/ring-scoring.test.ts`, `apps/web/test/ring-scoring-shapes.test.ts`, `apps/web/test/ring-scoring-national.test.ts`
- `apps/web/src/lib/field-spec.ts`, `apps/web/test/field-spec.test.ts`
- `packages/core/src/cartridge-specs.ts`, `packages/core/test/cartridge-specs.test.ts`
- `packages/api/src/compute/limits.ts`, `packages/api/test/limits.test.ts`
- `packages/cli/src/rows.ts`, `packages/cli/test/rows.test.ts`
- `packages/cli/src/metrics.ts`, `packages/cli/test/metrics.test.ts`
- `packages/importers/src/pressure-history.ts`, `packages/importers/test/pressure-history.test.ts`
- `packages/api/src/compute/resolve.ts`, `packages/api/test/resolve.test.ts`
- `packages/api/src/routes/charge-target.ts`, `packages/api/test/charge-target.test.ts`
- `packages/schema/src/target-sheet.ts`, `packages/schema/test/target-sheet.test.ts`
- `packages/schema/src/overrides.ts`, `packages/schema/test/overrides.test.ts`
- `packages/schema/src/case-capacity.ts`, `packages/schema/test/case-capacity.test.ts`, `packages/schema/test/case-capacity-unit.test.ts`
- `apps/web/src/lib/hole-proposals.ts`, `apps/web/test/hole-proposals.test.ts`
- `apps/web/src/lib/user-store.ts`, `apps/web/test/user-store.test.ts`, `apps/web/test/user-store-refit.test.ts`, `apps/web/test/user-store-write.test.ts`
- `packages/data/src/references.ts`, `packages/data/test/references.test.ts`
- `tools/src/pack-check.ts`, `tools/test/pack-check.test.ts`
- `packages/drawing/src/core/geometry.ts`, `packages/drawing/test/geometry.test.ts`
- `packages/importers/src/units.ts`, `packages/importers/test/units.test.ts`
- `apps/web/src/lib/records-csv.ts`, `apps/web/test/records-csv.test.ts`
- `tools/src/licences.ts`, `tools/test/licences.test.ts`
- `tools/src/pages-serve.ts`, `tools/test/pages-serve.test.ts`
- `packages/importers/src/shotview.ts`, `packages/importers/test/shotview.test.ts`, `packages/importers/test/shotview-xlsx.test.ts`
- `packages/core/vitest.config.ts` (the line coverage floors the mutation score is compared with)

## Confidence

medium. The scores before and the kill counts are exact StrykerJS 10.1.1 outputs on these three files; the scores after are estimates computed from them, not a new full-suite run; the full-suite times were taken on a shared machine and vary with its load, and other modules are not measured. The second-round scores after are new runs over the same mutants, not estimates; its times are on the shared host too. The third-round scores after are new runs over the same mutants too; its module choice followed a screening run and is not a risk ranking of all of core. The fourth-round scores after are new runs over the same mutants; its modules are one per kind of logic, not a ranking of all of `apps/web/src/lib`, and its equivalent counts are a reading of each survivor, not a proof. The round 6 scores after are new runs over the same mutants; its equivalent and description counts are a reading of each survivor, and the screening covers 15 modules, not all of core, schema and the API. The round 7 scores after are new runs over the same mutants; its equivalent counts are a reading of each survivor, and its screening covers 16 modules, not all of the web libraries, data, drawing and tools. The round 8 scores after are new runs over the same mutants; its equivalent counts are a reading of each survivor, and its screening covers 13 modules, not all of the web libraries, importers and tools.
