---

title: Command line
description: One compute operation of the API offline, the list of operations with their schemas, held-out evaluation of the interior model on a file of load rows, a comparison of two model versions, and a fit of powder burn coefficients to those rows.
---

# Command line

`packages/cli` (`@open-reloading/cli`, bin `ballistics`) measures how far the interior model is from printed load rows it was not fitted to, and says whether a changed model got better. It adds no model of its own: a row becomes an interior run through `recordLoad` of `@open-reloading/ballistics` (the [M3 page](models/interior-m3.md#load-from-records)) and the seating of `@open-reloading/drawing`. Results are simulations compared with printed values, never load data.

```sh
pnpm run build
node packages/cli/dist/bin.js verify --rows rows.csv --records /path/to/records
node packages/cli/dist/bin.js compare --rows rows.csv --records /path/to/records --baseline verify.json --candidate ./my-model.mjs
node packages/cli/dist/bin.js verify --rows catalogue --split validation
node packages/cli/dist/bin.js fit --rows rows.csv --records /path/to/records
node packages/cli/dist/bin.js verify --rows rows.csv --records /path/to/records --params fit-on-training
```

`--help` (or `-h`), alone or after a command, prints the usage and exits 0. `run --help` and `operations --help` print the help of that command with an example that runs on a committed synthetic body.

## Operations: `run` and `operations`

`run <operation> --input <file|->` runs one compute operation of the REST API offline and writes its answer as JSON on stdout: the answer of `POST /v1/<operation>` to the body in the file (`-` reads it from standard input). The operations are the compute routes: `exterior/trajectory`, `exterior/truing`, `exterior/range-strings/plan`, `exterior/range-strings/fit`, `interior`, `interior/load-file` and `interior/charge-target`. The body, the answer and the errors are those of the route, from the same code: the REST API page of this site (`/rest/`) documents each body. The answer has no `inputHash`, `apiVersion` or `dataHash`, which the server adds; `interior/load-file` answers without curves, as the route without `?curves=true`.

```sh
node packages/cli/dist/bin.js run interior --input packages/cli/examples/interior.json
node packages/cli/dist/bin.js operations
```

Record ids in a body (`cartridge`, `bullet`, `powder`) resolve against the records of `--records <dir>` (repeatable, `BALLISTICS_RECORDS`), by default the records of the catalog package, as for `verify`. An unknown id is bad input: the error object carries `code` `recordNotFound` and `params` with the record's `kind` and `id`. A body the schema rejects is bad input with the issues in the error object (`issues`, each with `path` and `message`). An answer the route gives with 422 (an input the model refuses, a charge target out of reach, a load file without a value) is a refusal: the error object carries it as `answer`, a typed refusal of the model with its `code` and `params`. The message of a typed refusal or an unknown id is the code with its params after it (`recordNotFound (kind: cartridge, id: no-such)`): the command line does not word them.

`operations` writes one JSON document, `{"operations":[...]}`, with each operation's `name`, `summary`, `description`, `input` (the JSON Schema 2020-12 of the body) and `output` (that of the 200 answer). The schemas are written from the zod definitions the API's OpenAPI document is built from.

Neither command uses the network, starts a server or prompts on the terminal. Every interior answer carries `notice`: a simulation, not load data.

Real rows and real records are passed by path and are never committed. The repository holds no rows; its tests build a small synthetic set from the model itself, with errors known by construction.

## Rows

One CSV file, or a folder of `.csv` files read in name order, with a header line. Columns:

| Column                                  | Meaning                                                                                                                               | Required |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `cartridge`, `bullet`, `powder`         | Record ids                                                                                                                            | yes      |
| `charge_g`                              | Charge, g                                                                                                                             | yes      |
| `velocity_ms`                           | Printed muzzle velocity, m/s                                                                                                          | yes      |
| `pressure_bar`                          | Printed peak pressure, bar                                                                                                            | no       |
| `barrel_mm`                             | Barrel length, mm; a row without it is not used (`noBarrelLength`)                                                                    | no       |
| `temperature_c`                         | Propellant temperature, degC; default the temperature of the powder's fit                                                             | no       |
| `coal_mm`                               | Cartridge overall length, mm; default the sheet's L6                                                                                  | no       |
| `pressure_basis`                        | The basis the pressure was measured on (`transducer`, `case-contact`, ...); pressure errors are grouped by it, `unstated` without one | no       |
| `muzzle_distance_m`                     | Distance of the measuring point from the muzzle, m; the velocity is corrected to the muzzle ([below](#muzzle-distance))               | no       |
| `bearing_mm`, `session`, `rifle`, `lot` | `session`, `rifle` and `lot` group the rows into sessions of the [fit](#fit); `bearing_mm` is carried, unused                         | no       |
| `table`                                 | A free label of the source table: carried, never part of a result                                                                     | no       |

A problem in the file is reported as file, line and column with a reason, never with the value, and the exit code is 2. Fields may be double-quoted. A number is a plain decimal or exponent form (`0.5`, `2.5e1`); `0x1F` and `0b11` are not numbers.

### Published loads

`--rows catalogue` reads the [published load files](data/published-loads.md) of the records instead of a CSV file; `--rows <folder>` does the same for a folder laid out as `records/loads/` (named `loads`, with one folder per cartridge): only the files of that folder are read, their source references resolved from the source records of `--records`, and a file that fails is left out with a note on stderr. Each printed charge with a velocity `value` of a maker table is one row (`rowsFromPublished`, `src/published-rows.ts`):
- `charge`, `velocity` (as printed, at the printed point), `coal` and `barrel` (`barrel.length`) from their `value`; `pressure` only with a value in bar, so a crusher figure (CUP, LUP) gives a row with its velocity only; the pressure basis is the figure's `method`, `unstated` without one; the muzzle distance is `velocity.point.distance`, and a velocity without one is a muzzle value;
- `bullet` is the bullet record, else a stand-in record per cartridge and printed mass: the cartridge's G1 as diameter, the printed mass, and the length of a least-squares fit of ln length on ln mass and ln diameter over the bullet records with a length; it has no ballistic coefficient;
- a row without a barrel length takes the median printed barrel of its cartridge, else 610 mm for a case (L3) longer than 33 mm and 120 mm for a shorter one, as on the [validation page](models/validation.md).

A table of loads customers sent (`producedBy: customer`) is never read. Charges that give no row are counted by reason in `published.skipped`: `noVelocity`, `customerTable`, `noPowderRecord`, `noCartridge` (no cartridge record). `published` also carries the number of files and rows. `inputs.rows` is the SHA-256 over the SHA-256 of each file's JSON, in cartridge and file order.

The records are read with `readRecords` of the repository's catalog reader (`tools/src/catalog/records.ts`): `--records <dir>` (repeatable, read as one set; `BALLISTICS_RECORDS` is a `:`-separated list), by default the records of the catalog package. The problems the reader reports (a record that fails its schema is left out, a duplicate id is kept) are counted in a note on stderr. The default rows path is `BALLISTICS_ROWS`; `--rows -` reads one rows file from standard input. A cartridge's chamber volume is its water capacity (a capacity record, else a case record with a stated capacity, the first by id) less the volume of the seated bullet, as the [seating](models/case-capacity.md) computes it.

## Split

The first byte of the SHA-256 of the lower-case UTF-8 cartridge id decides: 0 to 50 test, 51 to 101 validation, 102 to 255 training (about 20 %, 20 % and 60 %). A row has the split of its cartridge. `--split` takes `validation` (default), `training` or `test`. The test split is sealed: `--split test` is refused without `--final`, to be run once per model version. `--final` with another split is bad input.

## Metrics

All errors are absolute relative errors, as fractions: for the velocity $|v_\text{model} - v_\text{printed}| / v_\text{printed}$, the same for the peak pressure of rows that print one. Median and 90th percentile (linear interpolation between the closest ranks) of the rows the model gave a result for, for all rows of the split, per powder id and per powder family (`<propellant base>/<grain form>` of the powder record, `unspecified` for a missing part). `--group-by powder|family|cartridge|bullet|construction` adds the groups of that key (`construction` is the structure of the bullet record, else `<core material>-core`).

The 90 % interval has the half width $h$, the 90th percentile of the velocity error of the used training rows of the same model; the interval of a row is the model velocity times $(1 \pm h)$, so a row is inside when $|v_\text{model} - v_\text{printed}| / v_\text{model} \le h$ (the distance is taken against the model's velocity, not the printed one, so it differs from the error above). The coverage is the share of used rows inside. It comes from the training split and is not a prediction interval of the model's inputs.

Rows that are not used are counted by reason: `unknownCartridge`, `unknownBullet`, `unknownPowder`, `noPowderModel` (no interior parameters), `noCaseCapacity`, `noBulletLength`, `noBulletShape`, `noBarrelLength`, `missingCartridgeValue`, `modelRefused`, `noBulletDrag` (a velocity printed at a distance whose bullet has no drag to fly back to the muzzle, see below).

### Pressure by basis

A pressure is compared only with pressures of its own basis: `pressureByBasis` of each group holds the median and P90 of the pressure error and the rows for each basis (`transducer`, `case-contact`, `piezo`, `unstated`, ...). No value is converted between bases. `pressure` stays the error over every row in bar, all bases together.

### Muzzle distance

A row with a muzzle distance above 0 (a velocity printed at `V5`, for example) is compared at the muzzle: its printed velocity is turned into the muzzle velocity whose flown speed at that distance equals it, with `muzzleVelocityFromDownrange` of ballistics ([model page](models/exterior-drag.md#speed-measured-downrange)), over the bullet record's G7 ballistic coefficients (else its G1 ones) in the ICAO standard atmosphere at sea level, before the error and the interval. A bullet without a coefficient, such as a stand-in, or with two of one model that share a band start, gives `noBulletDrag`. A row without a distance is a muzzle value and is not corrected.

The powder parameters are those of the records (`--params records`, the default), or the records with the burn coefficients fitted to the training rows (`--params fit-on-training`, [below](#fit)).

### Powder not in the fitted set

`verify --leave-one-powder-out` adds `notInFittedSet`, the line "powder not in the fitted set: no data". The fitted set is the powders the rows name (any split) whose record has interior parameters; their record values are the fit (with `--params fit-on-training`, only the powders fitted, with their fitted values). Each powder of that set with rows in the run's split is left out in turn and run without its interior parameters, as a powder without rows: it gets no value, so its rows count as `noPowderModel` (a row with an unknown cartridge or bullet as `unknownCartridge` or `unknownBullet`, which are checked first) and the line's velocity, pressure and coverage are null. The line carries the rows of all left-out powders and `powders`, their number, the count of powders without a value. Its rows of the split are only those of the run's split, so the test split stays sealed for the line too.

A powder without rows gets no value, not an estimate, as the app refuses a powder without interior parameters. A family median estimate (each field of `interior.fitted` replaced by the median over the other powders of its family) measured a median velocity error of 15.7 %, a P90 of 61.7 % and an interval coverage of 31.9 % on a local run, too weak to show. Its code (`src/unseen.ts`) stays with its tests; no command calls it.

## Fit

`fit --rows <path> [--model m3|<module>] [--velocity-sigma <fraction>] [--pressure-sigma <fraction>]` fits the burn coefficient (`interior.vivacity`) of each powder the rows name that has interior parameters, and writes the fitted values with their uncertainties. It fits nothing else: the energy, the pressure exponent and the form constants stay the record's.

- Rows: those of the training split only that the model can run with the record's values, velocities corrected to the muzzle ([above](#muzzle-distance)). Rows of the validation and test split are never read.
- Fit: `fitPowderPooled` of `@open-reloading/ballistics` running the model of `--model` (default `m3`) ([model page](models/interior-powder-fit.md#pooled-fit-over-rifles-powders-and-lots)), one powder at a time, so a powder that fails does not stop the others. A session is the rows of one load without its charge (cartridge, bullet, barrel, COAL, temperature, session, rifle, lot and table); its rifle is the row's `rifle`, else one test barrel per cartridge, barrel and table; its lot is the row's `lot`. Rifle and lot effects keep the library's default spreads.
- Value: the record's burn coefficient times `factor`, the fitted over the record value.
- Uncertainty: the fit's relative standard uncertainty, times the root of `chiSquarePerDegree` where that is above 1, times the fitted value. `chiSquarePerDegree` is the chi square of every row, the data and the one prior row of each rifle and lot effect, over all rows minus all parameters, null where that count is not above 0.
- `--velocity-sigma` is the standard deviation of a row's velocity, a fraction of it above 0 and below 1, default 0.03. Load tables print no spread; ANSI/SAAMI Z299.4-2025 (page 5) expects tested ammunition within 90 fps of the tabulated velocity, about 3 % at 3000 fps ([SAAMI Z299.4](https://saami.org/wp-content/uploads/2026/04/SAAMI-Z299.4-CFR-2025-Centerfire-Rifle-Approved-2-10-2025-2026-04-27.pdf)). That plus or minus 90 fps is a tolerance, not a standard deviation, so taking it as the sigma is a choice on the large side.

A powder that is not fitted is listed in `notFitted` with its reason: the reason of the fit (`unresolved`, the rows do not resolve the burn coefficient, for example training rows of one charge only; `invalid`, `not-converged`, `ill-conditioned`, `underdetermined`), or `noUsableRow`: every powder with interior parameters that any row names and that has no usable training row, so powder ids of the other splits can appear there; their rows are not read. A powder without interior parameters has no start value and is not listed.

`verify` and `compare` with `--params fit-on-training` run the fit and evaluate with the fitted burn coefficients. A powder not fitted gets no value: its rows count as `noPowderModel`. Each evaluation carries `fit` with the velocity sigma, the number of powders fitted, those not fitted by reason and, with `--pressure-sigma`, the `pressure` of the fit. `inputs` stay those of the records as read, so a saved `--params records` result is a valid baseline for a `fit-on-training` candidate. The two sides do not cover the same rows: a powder that is not fitted (also `noUsableRow`) has no value on the fit side only, so its rows count as `noPowderModel` there and the medians are taken over different rows; `change.usedRows` (overall and per group) shows by how many rows the sides differ. Each evaluation fits under its own model: in `compare` a live baseline and the candidate each get their own fit, a saved baseline is used as it is. The interval's half width comes from the training rows, which the fit has seen, so it is narrower than an interval from rows the fit has not seen, and the coverage of a `fit-on-training` run is not comparable with that of a `--params records` run.

### Pressure rows

`--pressure-sigma <fraction>` (on `fit`, and on `verify` or `compare` with `--params fit-on-training`) adds the printed pressures of the training rows to the fit; it has no default, and a value outside (0, 1) is bad input. A used training row that prints a pressure in bar, of a basis with a factor, gives its point a pressure. Its basis is the row's `pressureBasis`, `unstated` without one, as `pressureByBasis` groups it.

- Two steps: first every powder is fitted to its velocities only, as without the option. Each basis $b$ then gets a factor $c_b$, the exponential of the median of $\ln(p_\text{printed} / p_\text{model})$ over the basis's pressure rows of the powders fitted, with the model's peak pressure under that velocity fit: the model's peak times $c_b$ is what the basis reads. The model peak leaves out the fitted lot factors, as the evaluation does. The median, not the mean, so that a misprinted row or a powder that holds a minority of the basis's rows does not move the factor of the others. A basis without such a row gets no factor, and its training pressures are not read. Second, every powder is fitted again with its pressure rows, each the printed pressure over $c_b$ with a sigma of the option's fraction of that value; this second fit is the result.
- Why: the factor is what the basis has in common against the model fitted to velocities (the measuring method, the source, what the model lacks), so the pressure rows move a powder's burn coefficient only by its own deviation from the median of its basis. Fitted together with the pressures, the burn coefficients would take part of that common offset.
- Result: `pressure` holds the sigma and per basis its `factor` and `rows`; each powder carries `pressureRows`.
- Errors: in a `--params fit-on-training` run with the option, `pressure` and `pressureByBasis` compare the model's peak times the factor of the row's basis with the printed pressure; a basis without a factor (no pressure row of a powder fitted in the first step among the training rows) takes 1 in the evaluation. They show how well the factors fitted on the training rows carry to held-out rows of the same basis, not the error of the model's peak alone. A `compare` of a run with the option against a baseline without it shows what the factors do to the pressure errors, not a change of the model.
- Sigma: ANSI/SAAMI Z299.4-2025 bases its pressure data on a coefficient of variation of 4 % (page 8: a population standard deviation of 2,000 psi at 50,000 psi) and on samples of ten (page 9) ([SAAMI Z299.4](https://saami.org/wp-content/uploads/2026/04/SAAMI-Z299.4-CFR-2025-Centerfire-Rifle-Approved-2-10-2025-2026-04-27.pdf)); 4 % over the root of ten is 1.3 % for a mean of ten. The sigma of the fit must also hold what the model lacks, so it is larger than that. The choice is the user's, so there is no default.

The burn coefficient is the only value fitted per powder, so pressure rows pull it away from the value the velocities alone give. The option is for studies: the records keep velocity fits until a held-out comparison says otherwise.

## Model version

Every result carries `modelVersion`, the SHA-256 over the sorted lines:
- `<label> <sha256>` of each built source file the model's result depends on: the files `@open-reloading/units` builds for the unit conversion (`toSi`, `fromSi`, the conversion table and the water density that turns a capacity into a chamber volume), the files `@open-reloading/statistics` builds for the input checks (`need`, `InputError`) and the bisection the interior model solves with, the files `@open-reloading/ballistics` builds for `interior/model.js` and `interior/record-load.js`, the files `@open-reloading/schema` builds for its unit entry and the water capacity of a case or capacity record, the files `@open-reloading/drawing` builds for its seating and bullet entries, each with the files they import by a relative path (a candidate module adds itself and its relative imports, because it may call the installed interior model; imports of other packages are not followed), and the family median estimator (`unseen.js` of the CLI with its relative imports), which no run calls, kept so that published versions stay valid;
- `<kind>/<id> <sha256>` of the stored JSON of every cartridge, bullet, powder, capacity and case record the rows name;
- `rows <sha256>` over the SHA-256 of each rows file.

A `fit` run and a `--params fit-on-training` evaluation add the built files of the fit (`interior/fit-pooled.js` of ballistics, its solver `least-squares.js` of statistics and `fit.js` of the CLI, each with the files they import by a relative path) and the line `params fit-on-training velocity-sigma <value>`, followed by ` pressure-sigma <value>` with `--pressure-sigma`.

`inputs.rows` and `inputs.records` in a result are the last two parts. The version changes with the model, the records or the rows, not with the split; `--params fit-on-training` and its `--velocity-sigma` and `--pressure-sigma` do change it.

The code of the evaluation itself (rows, split, the metrics and the percentiles, the interval) is not in the hash: a change to it is a change of the evaluation, not of the model, and moves the metrics of an unchanged `modelVersion`. Compare a baseline and a candidate only with one build of the CLI.

## Commands

`verify` takes no `--baseline` or `--candidate`, `compare` takes no `--model`, `fit` takes only `--rows`, `--records`, `--model`, `--velocity-sigma`, `--pressure-sigma`, `--json` and `--table`: another option is bad input, as is `--velocity-sigma` or `--pressure-sigma` in a `verify` or `compare` without `--params fit-on-training`.

`verify --rows <path> [--model m3|<module>]` evaluates one model on the split. `m3` is the model of the installed `@open-reloading/ballistics`; a module path is a file that exports `interior(load, options?)` with the signature of its `interior`.

`compare --baseline <m3|module|verify.json> --candidate <m3|module>` evaluates both on the same rows and split and gives each result and the change, candidate minus baseline, overall and per powder family (and per group of `--group-by`). A baseline `.json` is a saved `verify` result: it must be of the same split, rows and records, else the run is refused. A positive change of an error is worse; the change of the coverage is in fractions, the change of used rows in rows. The candidate may use fewer rows than the baseline: `usedRows` shows it.

## Output

JSON when stdout is not a terminal or with `--json`, a table with `--table` or on a terminal. The JSON of `verify`, `compare` and `fit` carries `schemaVersion` (1) and `notice: "simulation, not load data"`, the label of the API's answers. It is described by `packages/cli/schema/result.schema.json`, written from the zod definition in `src/result.ts` by `pnpm --filter @open-reloading/cli run schema`; a test validates real output of these commands against it. The schema's `$id`, `https://openreloading.github.io/Ballistics/docs/result.schema.json`, is where the build of this site copies it.

`--version` prints `ballistics <version>` and exits 0.

| Exit code | Meaning                                                                                                                                                       | `kind`     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 0         | A result was written                                                                                                                                          |            |
| 1         | A refused run: the test split without `--final`, a baseline of another split or data, a split without a row the model could run, a 422 answer of an operation | `refused`  |
| 2         | Bad input: the rows file, an option, the records, a model module (also one that throws), an operation body or an unknown record id                            | `usage`    |
| 3         | An internal error of the CLI                                                                                                                                  | `internal` |

An error goes to stderr. With `--json`, or when stdout is not a terminal, it is one JSON object on one line, `{"error":{"kind":"usage","message":"..."}}`, for `run` with `issues` or `answer`; on a terminal it is a text line. It never carries a stack trace.
