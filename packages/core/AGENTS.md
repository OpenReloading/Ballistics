# @open-reloading/core

Pure TypeScript ballistics solver, ESM. Must stay headless: no I/O, no network, no database. A runtime dependency follows the licence and benefit rule of the root `AGENTS.md` (Package rules).

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
  - `InputError` (extends `RangeError`): thrown on purpose for inputs outside the model and for computations that do not finish within their limits. `TruingError`, `PowderFitError`, `MixedPressureBasisError` (`interior/fit.ts`, pressure rows on more than one basis) and `ValueError` (`interior/load-file.ts`) extend it.
  - Any other error is a defect (the API answers 500).
  - `need(ok, message)` throws an `InputError` for a failed input check.
  - `nth(array, index)` returns the entry or throws a `RangeError`; the integrator and interior model keep a module-local unchecked `el` for state vectors (`noUncheckedIndexedAccess`), a call into another module does not inline in vitest and slowed the Monte Carlo tests several times.
  - `overlay(base, settings)` returns `base` with the entries of `settings` that are not `undefined`; `Settings<T>` is `T` with every entry optional and allowed to be `undefined`. Options that are merged over defaults take `Settings<...>` and merge with `overlay`, never a spread (a spread lets an `undefined` entry replace its default).
  - Internal: `src/index.ts` re-exports only `InputError`, `overlay` and `Settings` from this file.
- `src/drag-tables.ts`: the BRL drag tables (G1, G2, G5, G6, G7, G8, GI and the 9/16 in sphere as GS) as JBM publishes them. Generated: do not edit by hand. Tests pin each table's length and end points.
- `src/interior/model.ts`: `interior` and `closedVessel`, the M3 Noble-Abel interior model (`apps/docs/docs/models/interior-m3.md`).
  - SI in and out, temperatures in K. Integrates with `src/exterior/rk45.ts` in scaled time.
  - Gas leakage (`leakage`, `leakFlowFactor`) and the heat-loss defaults (`convectiveDefaults`): `apps/docs/docs/models/interior-leakage-heat.md`.
- `src/interior/record-load.ts`: `recordLoad`, the run of a load that names a cartridge, a powder and a bullet record, from structural record types (`apps/docs/docs/models/interior-m3.md`, "Load from records"). The caller gives the seated volume and travel (the seating geometry is in `@open-reloading/drawing`). Used by `packages/cli`.
- `src/interior/form.ts`: burn laws and form functions (`apps/docs/docs/models/interior-burn-forms.md`), one entry per grain shape and per vivacity form with its form function and its shape-specific checks.
- `src/interior/fit.ts`: `fitPowder`, `PowderFitError` (`apps/docs/docs/models/interior-powder-fit.md`). Weighted least-squares fit of the M3 burn coefficient and, on request, the start pressure and a factor on the chamber volume (`volumeFactor`, initial 1, optional prior around 1) to a chronograph ladder (mean muzzle velocities, optional peak pressures), with optional Gaussian priors and a Huber loss. Also the specific energy (`energy`, needs barrel lengths that differ by 5 %) and a factor on both temperature sensitivities (`temperatureFactor`, initial 1, needs a load with a sensitivity); a point carries its own `barrelLength` and `propellantTemperature`. One `interior` run per distinct charge, barrel length, temperature and evaluation.
  - `src/interior/fit-sessions.ts`: `fitPowderSessions` over `PowderSession`s (barrel length, temperature, ladder). A requested parameter other than the burn coefficient that the sessions leave unresolved is dropped and listed in `held`, the others in `resolved`.
  - `src/interior/fit-pooled.ts`: `fitPowderPooled` over `PooledSession`s (powder, rifle, optional lot, own load, velocity ladder). Burn coefficient (and on request temperature factor) per powder, velocity factor per rifle and burn factor per lot as random effects (zero-centred log priors, `pooledDefaults`), each only where two or more levels exist. `predictPooled`: interval from the covariance, the model error, the string's sigma and, for an unseen rifle or lot, its spread; `calibratePooled` estimates the relative model error from held-out strings. Velocities only; `exponent` and `form` refused as `unresolved`.
  - `src/interior/fit-strings.ts`: `stringLadder`, chronograph strings to ladder points, each mean with the pooled standard deviation of all shots about their string means over the root of its shot count as `velocitySigma` (`pooledVelocitySd`). Callers of `fitPowder` on strings use it.
  - `src/interior/fit-confidence.ts`: `powderPressureRange` (the peak-pressure range that the fixed inputs add to a fit, by refitting with each input shifted by its standard uncertainty; defaults in `powderInputDefaults`), `similarPowdersPrior` (a `PowderPrior` from the nearest powders; `PowderFit.basis` is `refined` with a burn coefficient prior) and `powderConfidence` (`tight`, `moderate`, `loose` by the relative half-width, plus reason codes).
  - `predictPowder`: muzzle velocity and peak pressure of a fit at any charge with standard uncertainty and interval from the log-parameter covariance (`PowderFit.covariance`); `PowderFit.domain` (ranges of charge, velocity, pressure, bore diameter and barrel length of the data, widened by `domainMargin`, default 0, the upper end of bore diameter and barrel length by at least 2.5 %) and `extrapolation`, the axes of a prediction outside it. Parameter uncertainty only.
- `src/interior/curve-fit.ts`: `fitPressureCurve` (`apps/docs/docs/models/interior-curve-fit.md`). Fits the burn coefficient (restated at the trace's peak), the initial slope and transition point of a two-stage vivacity form, the pressure exponent and a time shift to one pressure-time trace (`PressureHistory`, sensor breech, mean or base). `fitPressureCurves` fits several traces of one powder at their own charges (`ChargedTrace`), shared parameters, one time shift per trace.
  - A parameter the trace does not resolve (exponent first when collinear, or unresolved, or ill-conditioned) is held at its start value and reported `status: 'fixed'` with its reasons. The burn coefficient is never held.
  - The identifiability report per parameter: variance inflation, relative standard uncertainty, reasons.
  - A fitted exponent carries a 90 % `interval` (coverage factor 2.2 from a synthetic study, trace noise only). With three or more traces the exponent is refitted without each trace (`leaveOneOut`), and a jackknife spread above the interval's width adds the reason `inconsistent`.
- `src/least-squares.ts`:
  - `logLeastSquares`: the Levenberg-Marquardt loop on log parameters with the conditioning check and covariance, shared by truing, the powder fit and the curve fit. `tolerance` (default 1e-12) is the relative gain of the cost below which an accepted step ends the loop.
  - `huber.ts`: the Huber loss and its reweighting for `logLeastSquares` (`huber` input; the powder fit's `huberThreshold`).
  - `identifiability`: covariance, variance inflation and condition number of a weighted Jacobian, used by the range string plan and fit.
- `src/load-notes.ts`: `loadNotes` (`apps/docs/docs/models/load-notes.md`). Notes on a saved load from its sessions in order: a lot changed or not recorded, seating length moved, mean velocity moved by more than the larger standard deviation, round count passed. Structured notes (rule, sessions, values), no wording and no units.
- `src/advisories.ts`: `advisoryRules`, the one registry of the rules that tell a user something about a run (`apps/docs/docs/models/interior-m3.md`, "Advisories"): id, severity (`error` blocks a run, `warn` and `info` never change a result), input keys, short name, message (facts about inputs only) and fix. The API warning enum and the workbench's warning names are derived from it. `interiorAdvisories` evaluates the input rules on a load and changes nothing. A new rule is an entry here, its test (fires, does not fire) and its line on the model page.
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
  - `placeMaximum`: a user-entered maximum below, inside or above the range (`modelDiscrepancy`, `inputPlausible`, `aboveRange`) and the dominant input, no new run.
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
