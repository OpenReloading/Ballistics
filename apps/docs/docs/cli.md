---
title: Command line
description: Held-out evaluation of the interior model on a file of load rows, and a comparison of two model versions.
---

# Command line: `verify` and `compare`

`packages/cli` (`@open-reloading/cli`, bin `ballistics`) measures how far the interior model is from printed load rows it was not fitted to, and says whether a changed model got better. It adds no model of its own: a row becomes an interior run through `recordLoad` of `@open-reloading/core` (the [M3 page](models/interior-m3.md#load-from-records)) and the seating of `@open-reloading/drawing`. Results are simulations compared with printed values, never load data.

```sh
npm run build
node packages/cli/dist/bin.js verify --rows rows.csv --records /path/to/records
node packages/cli/dist/bin.js compare --rows rows.csv --records /path/to/records --baseline verify.json --candidate ./my-model.mjs
```

Real rows and real records are passed by path and are never committed. The repository holds no rows; its tests build a small synthetic set from the model itself, with errors known by construction.

## Rows

One CSV file, or a folder of `.csv` files read in name order, with a header line. Columns:

| Column | Meaning | Required |
|---|---|---|
| `cartridge`, `bullet`, `powder` | Record ids | yes |
| `charge_g` | Charge, g | yes |
| `velocity_ms` | Printed muzzle velocity, m/s | yes |
| `pressure_bar` | Printed peak pressure, bar | no |
| `barrel_mm` | Barrel length, mm; a row without it is not used (`noBarrelLength`) | no |
| `temperature_c` | Propellant temperature, degC; default the temperature of the powder's fit | no |
| `coal_mm` | Cartridge overall length, mm; default the sheet's L6 | no |
| `pressure_basis`, `bearing_mm`, `muzzle_distance_m`, `session`, `rifle`, `lot` | What a later model may read: carried with the row, unused | no |
| `table` | A free label of the source table: carried, never part of a result | no |

A problem in the file is reported as file, line and column with a reason, never with the value, and the exit code is 2. Fields may be double-quoted.

The records are read with `readRecords` of `@open-reloading/data`: `--records <dir>` (repeatable, read as one set; `BALLISTICS_RECORDS` is a `:`-separated list), by default the records of the data package. The problems the reader reports (a record that fails its schema is left out, a duplicate id is kept) are counted in a note on stderr. The default rows path is `BALLISTICS_ROWS`. A cartridge's chamber volume is its water capacity (a capacity record, else a case record with a stated capacity, the first by id) less the volume of the seated bullet, as the [seating](models/case-capacity.md) computes it.

## Split

The first byte of the SHA-256 of the lower-case UTF-8 cartridge id decides: 0 to 50 test, 51 to 101 validation, 102 to 255 training (about 20 %, 20 % and 60 %). A row has the split of its cartridge. `--split` takes `validation` (default), `training` or `test`. The test split is sealed: `--split test` is refused without `--final`, to be run once per model version.

## Metrics

All errors are absolute relative errors, as fractions: for the velocity $|v_\text{model} - v_\text{printed}| / v_\text{printed}$, the same for the peak pressure of rows that print one. Median and 90th percentile (linear interpolation between the closest ranks) of the rows the model gave a result for, for all rows of the split, per powder id and per powder family (`<propellant base>/<grain form>` of the powder record, `unspecified` for a missing part). `--group-by powder|family|cartridge|bullet|construction` adds the groups of that key (`construction` is the structure of the bullet record, else `<core material>-core`).

The 90 % interval has the half width $h$, the 90th percentile of the velocity error of the used training rows of the same model; a row is inside when its velocity error is at most $h$. The coverage is the share of used rows inside. It comes from the training split and is not a prediction interval of the model's inputs.

Rows that are not used are counted by reason: `unknownCartridge`, `unknownBullet`, `unknownPowder`, `noPowderModel` (no interior parameters), `noCaseCapacity`, `noBulletLength`, `noBulletShape`, `noBarrelLength`, `missingCartridgeValue`, `modelRefused`.

The powder parameters are those of the records (`--params records`, the only mode). A fit of each powder on its training rows, leave-one-powder-out and by-session checks need a fit from rows and are not part of this version.

## Model version

Every result carries `modelVersion`, the SHA-256 over the sorted lines:

- `<label> <sha256>` of each built source file the evaluation reads: the files `@open-reloading/core` builds for `interior/model.js` and `interior/record-load.js`, the files `@open-reloading/drawing` builds for its seating and bullet entries, each with the files they import by a relative path (a candidate module adds itself and its relative imports, because it may call the model of core; imports of other packages are not followed);
- `<kind>/<id> <sha256>` of the stored JSON of every cartridge, bullet, powder, capacity and case record the rows name;
- `rows <sha256>` over the SHA-256 of each rows file.

`inputs.rows` and `inputs.records` in a result are the last two parts. The version changes with the model, the records or the rows, not with the split or the options.

## Commands

`verify --rows <path> [--model m3|<module>]` evaluates one model on the split. `m3` is the model of the installed core; a module path is a file that exports `interior(load, options?)` with the signature of core's `interior`.

`compare --baseline <m3|module|verify.json> --candidate <m3|module>` evaluates both on the same rows and split and gives each result and the change, candidate minus baseline, overall and per powder family (and per group of `--group-by`). A baseline `.json` is a saved `verify` result: it must be of the same split, rows and records, else the run is refused. A positive change of an error is worse; the change of the coverage is in fractions, the change of used rows in rows. The candidate may use fewer rows than the baseline: `usedRows` shows it.

## Output

JSON when stdout is not a terminal or with `--json`, a table with `--table` or on a terminal. The JSON carries `schemaVersion` (1) and is described by `packages/cli/schema/result.schema.json`, written from the zod definition in `src/result.ts` by `npm run schema -w @open-reloading/cli`; a test validates real output of both commands against it.

| Exit code | Meaning |
|---|---|
| 0 | A result was written |
| 1 | A refused run: the test split without `--final`, a baseline of another split or data, a split without a row the model could run |
| 2 | Bad input: the rows file, an option, the records, a model module |

The package `AGENTS.md` describes the loop for a language-model agent.
