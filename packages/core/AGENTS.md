# @open-reloading/core

Pure TypeScript ballistics solver, ESM. Must stay headless: no runtime dependencies, no I/O, no network, no database.

## Commands (this directory, or `-w @open-reloading/core` from the root)

- Build: `npm run build` (output `dist/`)
- Test: `npm test` (Vitest)
- Single test: `npx vitest run <file> -t "<name>"`
- Type check: `npm run typecheck`

## Facts

- Model pages: `apps/docs/docs/models/` describes each model of this package with its equations.
  - The `Code:` line under each equation names the file and function that compute it. After renaming or moving such a function, update the line.
  - `npm test -w @open-reloading/docs` (`apps/docs/scripts/bibliography.test.mts`) fails on a file or name that no longer exists and on a source file no page names.
  - A change to a model's code updates its model page in the same commit.
- `src/errors.ts`:
  - `InputError` (extends `RangeError`): thrown on purpose for inputs outside the model and for computations that do not finish within their limits. `TruingError`, `PowderFitError` and `ValueError` (`interior/load-file.ts`) extend it.
  - Any other error is a defect (the API answers 500).
  - `need(ok, message)` throws an `InputError` for a failed input check.
  - `nth(array, index)` returns the entry or throws a `RangeError`; the integrator and interior model keep a module-local unchecked `el` for state vectors (`noUncheckedIndexedAccess`), a call into another module does not inline in vitest and slowed the Monte Carlo tests several times.
  - `overlay(base, settings)` returns `base` with the entries of `settings` that are not `undefined`; `Settings<T>` is `T` with every entry optional and allowed to be `undefined`. Options that are merged over defaults take `Settings<...>` and merge with `overlay`, never a spread (a spread lets an `undefined` entry replace its default).
  - Internal: `src/index.ts` re-exports only `InputError`, `overlay` and `Settings` from this file.
- `src/drag-tables.ts`: the BRL drag tables (G1, G2, G5, G6, G7, G8, GI and the 9/16 in sphere as GS) as JBM publishes them. Generated: do not edit by hand. Tests pin each table's length and end points.
- `src/interior/model.ts`: `interior` and `closedVessel`, the M3 Noble-Abel interior model (`apps/docs/docs/models/interior-m3.md`).
  - SI in and out, temperatures in K. Integrates with `src/exterior/rk45.ts` in scaled time.
  - Gas leakage (`leakage`, `leakFlowFactor`) and the heat-loss defaults (`convectiveDefaults`): `apps/docs/docs/models/interior-leakage-heat.md`.
- `src/interior/form.ts`: burn laws and form functions (`apps/docs/docs/models/interior-burn-forms.md`), one entry per grain shape and per vivacity form with its form function and its shape-specific checks.
- `src/interior/fit.ts`: `fitPowder`, `PowderFitError` (`apps/docs/docs/models/interior-powder-fit.md`). Weighted least-squares fit of the M3 burn coefficient and, on request, the start pressure to a chronograph ladder (mean muzzle velocities, optional peak pressures), with optional Gaussian priors and a Huber loss. One `interior` run per distinct charge and evaluation.
  - `predictPowder`: muzzle velocity and peak pressure of a fit at any charge with standard uncertainty and interval from the log-parameter covariance (`PowderFit.covariance`); `extrapolation` outside `chargeRange`. Parameter uncertainty only.
- `src/least-squares.ts`:
  - `logLeastSquares`: the Levenberg-Marquardt loop on log parameters with the conditioning check and covariance, shared by truing and the powder fit.
  - `huber.ts`: the Huber loss and its reweighting for `logLeastSquares` (`huber` input; the powder fit's `huberThreshold`).
  - `identifiability`: covariance, variance inflation and condition number of a weighted Jacobian, used by the range string plan and fit.
- `src/load-notes.ts`: `loadNotes` (`apps/docs/docs/models/load-notes.md`). Notes on a saved load from its sessions in order: a lot changed or not recorded, seating length moved, mean velocity moved by more than the larger standard deviation, round count passed. Structured notes (rule, sessions, values), no wording and no units.
- `src/bisect.ts`: `bisect`, the bisection loop. Internal, not exported from `src/index.ts`.
  - Shared by the seven-perforation burnout (`interior/form.ts`), the ignition burnt fraction (`interior/model.ts`), `chiSquareQuantile`, `studentTwoSidedQuantile` and the CEP (`groups/`).
  - Each caller passes its own iteration count and stop rule (stop once the midpoint equals an end, or not). This keeps its results bit-identical.
- `src/interior/charge-solver.ts`: `solveCharge`, `chargeUpperBound`, `chargeTargetValue`. The charge at which one `interior` run reaches a target (peak pressure Pa, muzzle velocity, load ratio, barrel time, bullet lead time).
  - Search: a 32-point log scan of the charges the case allows (chamber volume rule of `interior`, solid fill up to `solidFillLimit` 0.64), then an Illinois root find to a relative tolerance of 1e-6 on the target.
  - The result carries the run at the returned charge.
  - Refusal (`ChargeRefusal`) with the reason and, except for `noValidRun`, the reachable range: no valid scanned run, a target outside the reachable values, a curve that crosses it more than once, a failed bracket, a tolerance not reached.
  - The API resolves the percent-of-limit pressure target to Pa.
- `src/interior/shotshell.ts`: `shotshellInterior`, `shotshellInteriorLoad` (`apps/docs/docs/models/interior-shotshell.md`). Experimental: a shotshell load (shot, wad, crimp opening pressure, smooth bore) mapped onto `interior`. Every result carries `experimental: true`.
- `src/interior/range.ts`:
  - `toleranceRange`, `interiorPressureRange` (`apps/docs/docs/models/interior-pressure-range.md`): the peak-pressure range over input tolerances. Each input alone at both ends, then all together at the two combined ends. Input tolerances only, no model error.
- `src/interior/monte-carlo.ts`: `sampledBand`, `interiorSampledBand` (`apps/docs/docs/models/interior-sampled-band.md`): fixed-seed normal draws of the same inputs, percentiles of peak pressure and muzzle velocity, no band when the injected clock passes the budget. No clock of its own.
- `src/exterior/`: SI in and out, angles in rad. Pages: M2 point mass `apps/docs/docs/models/exterior-point-mass.md`, truing `apps/docs/docs/models/exterior-truing.md`, M2b (modified point mass) `apps/docs/docs/models/exterior-modified-point-mass.md`, least squares `apps/docs/docs/models/least-squares.md`.
  - `atmosphere.ts`: ICAO troposphere, humid air.
  - `drag.ts`: `dragModels`, the one list of drag models, a literal in the key order of the generated `dragTables` (a test pins it). A new model is its table in a regenerated `drag-tables.ts` and its name in `dragModels`, read by the API drag schema and the web trajectory form. Also `dragTableOf`, table lookup (linear or monotone cubic, `apps/docs/docs/models/exterior-drag.md`), BC bands, custom Cd curves.
  - `rk45.ts`: Dormand-Prince 5(4) with dense output and events.
  - `stability.ts`: Miller, dynamic stability, spin drift, jump.
  - `trajectory.ts`: `trajectory`, `zeroAngles`. `model: 'modified-point-mass'` selects M2b.
  - `modified.ts`: M2b helpers (yaw of repose, inertia estimate, stability, linear jump).
  - `outline-drag.ts`: `estimateDragFromOutline` (`apps/docs/docs/models/exterior-outline-drag.md`), zero-yaw Cd(Mach) from the bullet outline with its warnings and standard deviation per node.
  - `truing.ts`: `trueMuzzleVelocity`, `trueDrag`, `trueDragSessions` (one drag correction over several sessions), `TruingError`.
  - `range-strings.ts` (`apps/docs/docs/models/exterior-truing-strings.md`): `planTruingStrings`, `comparePlanCandidates` over candidate strings, `fitTruingStrings`. Which of muzzle velocity, drag factor and click value (and with `fitZeroOffset` the zero offset) range strings identify, and the fit with intervals. Optional Gaussian priors narrow intervals and never change statuses.
- `src/groups/` (`apps/docs/docs/models/groups.md`): shot-group statistics with chi-square confidence intervals, pooling in angle. SI in and out (target-plane m, x right, y up). A value below its minimum shot count is `undefined`.
  - `statistics.ts`: `groupStatistics`, `pooledGroupStatistics`, `dispersionEllipse`, `predictionEllipse`, `subtendedAngle`.
  - `chi-square.ts`: `chiSquareCdf`, `chiSquareQuantile`, `chiSquareSurvival`.
  - `student-t.ts` (internal): `studentTwoSidedQuantile`.
  - `f-distribution.ts`: `fQuantileTwoNumeratorDegrees`.
