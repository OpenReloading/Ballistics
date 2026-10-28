# @open-reloading/cli

`ballistics verify` and `ballistics compare`: held-out evaluation of the interior model on a file of load rows. A thin layer: the run of a row is `recordLoad` of `@open-reloading/core` plus the seating of `@open-reloading/drawing`; the package holds no model logic. The page `apps/docs/docs/cli.md` defines rows, split, metrics, output and the model version hash.

## Commands (this directory, or `-w @open-reloading/cli` from the root)

- Build: `npm run build` (needs the other packages built first). Run: `node packages/cli/dist/bin.js ...` from the root (the package is private, so npm links no `ballistics` command).
- Test: `npm test` (Vitest, coverage floors in `vitest.config.ts`). Type check: `npm run typecheck`.
- JSON schema of a result: `npm run schema` rewrites `schema/result.schema.json` from `src/result.ts`; a test fails when the file is stale.

## Loop for an agent

1. Save the baseline: `node packages/cli/dist/bin.js verify --rows <rows> --records <dir> > baseline.json` (validation split, JSON when piped). Its `modelVersion` names the model, records and rows.
2. Change the model (core), then `npm run build -w @open-reloading/core`.
3. `node packages/cli/dist/bin.js compare --rows <rows> --records <dir> --baseline baseline.json --candidate m3`. A candidate can also be a module path that exports `interior`, with no build step.
4. Decide on `change`: a negative `velocityMedian` and `velocityP90` is better; check `usedRows` (a model that refuses rows looks better) and the per-family changes (`--group-by` for others). Keep or revert.
5. Run the sealed test split once, for the final version: add `--split test --final`. Never iterate on it.

Exit code 1 is a refusal, 2 is bad input; the message is on stderr.

## Facts

- Real rows and records are passed by path (`--rows`, `--records`, or the environment variables of the docs page) and are never committed, quoted in a test or printed in a result. Test fixtures are synthetic: `test/data.ts` builds rows from the model itself with known errors, `test/fixtures/records` adds capacities and powders to the records of the data package.
- The `table` column and the other carried columns are never part of a result.
- Percentiles, the split and the interval are defined once (`src/stats.ts`, `src/split.ts`, `src/metrics.ts`); a changed definition changes every result and needs the docs page and the tests changed with it.
