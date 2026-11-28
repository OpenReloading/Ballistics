# @rangefoundry/cli

The `ballistics` command runs the compute operations of the RangeFoundry API offline, and verifies, compares and fits the interior ballistics model on files of load rows. Its results are simulations, not load data.

## Install

The package is not on npm yet. From a clone of the repository, with Node 26 or later and pnpm:

```sh
pnpm install
pnpm run build
node apps/cli/dist/bin.js run interior --input apps/cli/examples/interior.json
```

## Use

```sh
ballistics operations
ballistics run interior --input examples/interior.json
ballistics verify --rows rows.csv
ballistics --help
```

- Records: the catalog bundle of `@rangefoundry/catalog` by default. `--records <dir>` (repeatable, or `BALLISTICS_RECORDS`, joined by `:`, on Windows `;`) adds the records of a folder to it; a first folder with every kind directory, as `packages/catalog/records` of a clone, replaces the bundle.
- Output: JSON when stdout is not a terminal or with `--json`, a table on a terminal.

## Exit codes

| Code | Meaning                                                       |
| ---- | ------------------------------------------------------------- |
| 0    | A result was written                                          |
| 1    | A run the command refuses by its rules                        |
| 64   | A command line that does not hold                             |
| 65   | Data that does not parse, validate or give what the run needs |
| 66   | A path that does not exist or cannot be read                  |
| 70   | An internal error                                             |

Reference: [Command line](https://openreloading.github.io/Ballistics/docs/cli/).

License: AGPL-3.0-only
