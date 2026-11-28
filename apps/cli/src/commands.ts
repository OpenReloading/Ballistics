import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareKeys, type SourceRecord, sourceRecord } from '@rangefoundry/schema'
import { readPublishedLoads } from '@rangefoundry/tools/catalog'
import { DataError, ExpectedError, NoInputError, Refusal, UsageError } from './errors.ts'
import { type InteriorModel, type Outcome, outcomes } from './evaluate.ts'
import { fitPowders, notFittedReasons, type PressureKey, priorLines, withFit } from './fit.ts'
import { foldCount, foldPool, foldSalt, foldSplits, foldsOf } from './folds.ts'
import {
  changeOf,
  evaluate,
  type Grouping,
  groupsOf,
  halfWidthOf,
  metricsOf,
  widthByBarrel,
} from './metrics.ts'
import { builtInName, fitFiles, loadModel, type Model } from './model.ts'
import { foldAggregate, pairedChange, type RowError, rowErrors } from './paired.ts'
import { fillInputs, rowsFromPublished } from './published-rows.ts'
import { loadRecords, type Records, withoutEstimates } from './records.ts'
import {
  type CompareResult,
  type Evaluation,
  type FitResult,
  fitResult,
  notice,
  schemaVersion,
  type VerifyResult,
  verifyResult,
} from './result.ts'
import { type Row, readRows } from './rows.ts'
import { type Split, splitOf, splitSalt } from './split.ts'
import { inputsOf, modelVersion, sha256 } from './version.ts'

/** What `verify` and `compare` read: the rows, the records, the split and the sealed-split switch. */
export interface Options {
  /** Path of a rows file or of a folder of them, `catalogue`, or a folder laid out as `records/loads/`. */
  rows: string
  /** Records roots, empty for the records of the data package. */
  records: string[]
  split: Split
  /** Allows the test split. */
  final: boolean
  /** Adds the groups of this key to the result. */
  groupBy?: Grouping | undefined
  /** Adds the line of the powder not in the fitted set. */
  leaveOnePowderOut?: boolean | undefined
  /** Gets a note about the inputs; the result stays on stdout. */
  warn?: ((text: string) => void) | undefined
  /** `fit-on-training` evaluates with the burn coefficients fitted to the training rows; default `records`. */
  params?: 'records' | 'fit-on-training' | undefined
  /** Path of a saved `fit` result of the same rows and records whose values the run evaluates without fitting, a screen. */
  fit?: string | undefined
  /** With `exponent` `family`: path of a saved `fit` result of the same rows, records, velocity sigma and build whose family choice the run takes instead of making it. */
  family?: string | undefined
  /** Of the fit, a fraction of the velocity; default 0.03. */
  velocitySigma?: number | undefined
  /** Fits with the printed pressures, this sigma a fraction of the pressure, and a factor per key of `pressureFactor`; none without it. */
  pressureSigma?: number | undefined
  /** With `pressureSigma`: the key a pressure factor is computed per and applied by; default `basis`. */
  pressureFactor?: PressureKey | undefined
  /** `family` fits each burn coefficient at the pressure exponent its powder family chooses; default the record's. */
  exponent?: 'family' | undefined
  /** `prior`: each powder's energy is its prior times one energy-level factor chosen on the training pressures; `family`: each powder's energy is fitted with its burn coefficient under a prior on its family's impetus that tightens as its usable rows and cartridges fall; default the record's. */
  energy?: 'prior' | 'family' | undefined
  /** `verify`: adds the error of each used row of the split. */
  perRow?: boolean | undefined
  /** Grouped cross-validation by cartridge over the training and validation splits ({@link foldsOf}): each fold scored by a fit on the other folds; `verify` takes no `params` or `fit` with it, and ignores `split`. */
  folds?: boolean | undefined
}

/** What `fit` reads. */
type FitOptions = Pick<
  Options,
  | 'rows'
  | 'records'
  | 'warn'
  | 'velocitySigma'
  | 'pressureSigma'
  | 'pressureFactor'
  | 'exponent'
  | 'family'
  | 'energy'
  | 'folds'
>

type Inputs = VerifyResult['inputs']

/** Refuses a run of the sealed test split without `--final`, and `--final` on another split. */
function checkSealed({ split, final }: Options) {
  if (final && split !== 'test') throw new UsageError('--final is for --split test only')
  if (split === 'test' && !final)
    throw new Refusal('the test split is sealed: run it once per model version with --final')
}

/** The records folder of the catalog package, which `readRecords` reads without roots. */
const packageRecords = () =>
  fileURLToPath(new URL('../records', import.meta.resolve('@rangefoundry/catalog')))

/** Whether `path` is a folder of published load files: cartridge folders and no `.csv` file. */
function isPublishedFolder(path: string) {
  const stat = statSync(path, { throwIfNoEntry: false }) // NOSONAR: the path is the argument the user gave
  if (!stat?.isDirectory()) return false
  const entries = readdirSync(path, { withFileTypes: true }) // NOSONAR: as above
  return !entries.some((e) => /\.csv$/i.test(e.name)) && entries.some((e) => e.isDirectory())
}

/** The JSON of `path`; an unreadable or malformed file is undefined, which no schema accepts. */
function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) // NOSONAR: a file of a records root the user gave
  } catch {
    return undefined
  }
}

/** As the published load files resolve them; a source file that does not read or parse is left out, as the record check reports it. */
function sourcesOf(roots: readonly string[]) {
  const byId = new Map<string, SourceRecord>()
  for (const root of roots) {
    const dir = join(root, 'sources')
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) continue // NOSONAR: as above
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      // NOSONAR: as above
      const parsed = sourceRecord.safeParse(readJson(join(dir, name)))
      if (parsed.success && !byId.has(parsed.data.id)) byId.set(parsed.data.id, parsed.data)
    }
  }
  return {
    byId,
    cited: new Set<string>(),
    embedded: new Map<string, Set<string>>(),
    citations: new Map<string, (string | undefined)[]>(),
  }
}

/** Of the catalogue's published load files (`catalogue`), or of a folder laid out as `records/loads/` only, their source references resolved from the records' sources. */
function catalogueRows(options: FitOptions) {
  const folder = options.rows === 'catalogue' ? undefined : resolve(options.rows)
  if (folder !== undefined && basename(folder) !== 'loads')
    throw new UsageError('a --rows folder of published loads is named loads, as records/loads/')
  const records = loadRecords(options.records)
  const errors: string[] = []
  const roots = options.records.length > 0 ? options.records : [packageRecords()]
  const files = (
    folder === undefined
      ? records.published
      : readPublishedLoads([dirname(folder)], sourcesOf(roots), errors).map((l) => l.file)
  ).toSorted((a, b) => compareKeys(`${a.cartridge}/${a.id}`, `${b.cartridge}/${b.id}`))
  if (errors.length > 0)
    options.warn?.(
      `${errors.length} problem(s) in the published load files; those files are left out\n`,
    )
  const { rows, skipped } = rowsFromPublished(files, new Set(records.cartridges.keys()))
  if (rows.length === 0) throw new DataError('the published loads give no row')
  const published = { files: files.length, rows: rows.length, skipped }
  const bytes = files.map((f) => Buffer.from(JSON.stringify(f)))
  return { rows: fillInputs(rows, records), files: bytes, records, published }
}

/** The data the commands evaluate models on and fit to. */
function prepare(options: FitOptions) {
  const catalogue = options.rows === 'catalogue' || isPublishedFolder(options.rows)
  const read: { rows: Row[]; files: Uint8Array[]; records: Records; published?: Published } =
    catalogue
      ? catalogueRows(options)
      : { ...readRows(options.rows), records: loadRecords(options.records) }
  const { rows, files, records } = read
  if (records.issues > 0)
    options.warn?.(
      `${records.issues} problem(s) in the records; check them before relying on the result\n`,
    )
  return {
    rows,
    records,
    inputs: inputsOf(rows, files, records),
    ...(read.published && { published: read.published }),
  }
}

/** What the published rows of a run were: files, rows and the charges left out by reason. */
type Published = NonNullable<VerifyResult['published']>

type Prepared = ReturnType<typeof prepare>

/** The params line of a fit run's version: its velocity sigma, whether it chose the exponent per family, its pressure sigma and key, and its energy priors or `family`. */
function paramsLine(
  velocitySigma: number,
  family: boolean,
  pressure: { sigma: number; by: string } | undefined,
  energy: readonly string[] | 'family' | undefined,
) {
  // the prior lines come from records the rows may not name, which the records lines of the version leave out; the family prior reads only powders the rows name
  const energyLine =
    energy === 'family'
      ? ' energy family'
      : energy
        ? ` energy prior ${sha256(energy.toSorted(compareKeys).join('\n'))}`
        : ''
  return `params fit-on-training velocity-sigma ${velocitySigma}${family ? ' exponent family' : ''}${pressure ? ` pressure-sigma ${pressure.sigma} pressure-factor ${pressure.by}` : ''}${energyLine}`
}

/** The summary of a fit for an evaluation. */
function summaryOf(
  fit: Pick<
    FitResult,
    'velocitySigma' | 'powders' | 'notFitted' | 'exponent' | 'pressure' | 'energy' | 'energyFamily'
  >,
): NonNullable<Evaluation['fit']> {
  const reasons = Object.values(fit.notFitted)
  const notFitted = Object.fromEntries(
    notFittedReasons.flatMap((reason) => {
      const n = reasons.filter((r) => r === reason).length
      return n > 0 ? [[reason, n]] : []
    }),
  )
  return {
    velocitySigma: fit.velocitySigma,
    powders: Object.keys(fit.powders).length,
    notFitted,
    ...(fit.exponent && {
      exponent: {
        pooled: fit.exponent.pooled,
        families: Object.fromEntries(
          Object.entries(fit.exponent.families).map(([name, f]) => [name, f.exponent]),
        ),
      },
    }),
    ...(fit.pressure && { pressure: fit.pressure }),
    ...(fit.energy && { energy: { factor: fit.energy.factor } }),
    ...(fit.energyFamily && { energyFamily: fit.energyFamily }),
  }
}

/** The version of `model` on the data, with the fit's files and the `params` line in a fit run. */
const versionOf = (model: Model, data: Prepared, params: string | undefined) =>
  modelVersion(
    params === undefined ? model : { ...model, files: [...model.files, ...fitFiles()] },
    data.inputs,
    params,
  )

/** A saved `fit` result of the rows and records of `data`; a `Refusal` for one of other inputs. */
function savedFit(path: string, option: 'fit' | 'family', data: Prepared) {
  const saved = savedResult(path, option)
  if (saved.inputs.rows !== data.inputs.rows || saved.inputs.records !== data.inputs.records)
    throw new Refusal(`the --${option} fit was run on other rows or records`)
  return saved
}

/** The family choice of the `--family` file, which a fit of `data` under `model` at `velocitySigma` would make itself; a `Refusal` for a file of another choice, sigma or build. */
function familyChoice(path: string, data: Prepared, model: Model, velocitySigma: number) {
  const saved = savedFit(path, 'family', data)
  if (!saved.exponent) throw new Refusal('the --family fit was run without --exponent family')
  if (saved.energy) throw new Refusal('the --family fit was run with --energy prior')
  if (saved.energyFamily) throw new Refusal('the --family fit was run with --energy family')
  if (saved.velocitySigma !== velocitySigma)
    throw new Refusal(
      `the --family fit has velocity sigma ${saved.velocitySigma}, this run ${velocitySigma}`,
    )
  // the version fingerprints the model and fit sources, so an equal one means this build makes the same choice
  const params = paramsLine(saved.velocitySigma, true, saved.pressure, undefined)
  if (versionOf(model, data, params) !== saved.modelVersion)
    throw new Refusal('the --family fit was made by another build of the model or the fit')
  return saved.exponent
}

/** The velocity sigma of a fit with `options`. */
const velocitySigmaOf = (options: FitOptions) =>
  // load tables print no spread; ANSI/SAAMI Z299.4-2025 expects tested ammunition within 90 fps of the table, about 3 %
  options.velocitySigma ?? 0.03

/** Throws the `UsageError` of the fit options that do not combine. */
function checkFitOptions(options: FitOptions) {
  const { exponent, pressureSigma, pressureFactor, energy } = options
  if (pressureFactor !== undefined && pressureSigma === undefined)
    throw new UsageError('--pressure-factor needs --pressure-sigma')
  // one factor on all printed pressures and one per key both set the pressure level with no rule for which comes first
  if (energy === 'prior' && pressureSigma !== undefined)
    throw new UsageError('--energy prior and --pressure-sigma do not combine')
  if (options.family !== undefined && exponent === undefined)
    throw new UsageError('--family needs --exponent family')
  // with --energy prior the family choice is made at each energy-level factor and with --energy family at fitted energies, so a choice saved without it does not stand for it
  if (options.family !== undefined && energy !== undefined)
    throw new UsageError(`--family and --energy ${energy} do not combine`)
}

/** The fit of a run under `model`, the records with its values laid over, its version line and its summary for an evaluation. */
function fitOf(
  options: FitOptions,
  data: Prepared,
  model: Model,
  splits: readonly Split[] = ['training'],
) {
  checkFitOptions(options)
  const velocitySigma = velocitySigmaOf(options)
  const { exponent, pressureSigma, pressureFactor, energy } = options
  const family =
    options.family === undefined
      ? undefined
      : familyChoice(options.family, data, model, velocitySigma)
  // a fit on estimated capacities would move the values of every row of the powder, the rows with a measured capacity too
  const fit = fitPowders(data.rows, withoutEstimates(data.records), model.interior, velocitySigma, {
    exponent,
    family,
    pressureSigma,
    pressureFactor,
    energy,
    splits,
  })
  return {
    powders: fit.powders,
    notFitted: fit.notFitted,
    exponent: fit.exponent,
    energy: fit.energy,
    energyFamily: fit.energyFamily,
    velocitySigma,
    records: withFit(data.records, fit),
    params: paramsLine(
      velocitySigma,
      exponent !== undefined,
      fit.pressure,
      fit.energyFamily ? 'family' : fit.priorLines,
    ),
    summary: summaryOf({ ...fit, velocitySigma }),
  }
}

/** The outcomes of the rows of `split` of each powder with interior parameters, predicted as a powder not in the fitted set (without its parameters, so without a value), and the number of those powders. */
function leftOut({ rows, records }: Prepared, model: InteriorModel, split: Split) {
  const fitted = [...new Set(rows.map((r) => r.powder))].flatMap((id) => {
    const powder = records.powders.get(id)
    return powder?.interior ? [powder] : []
  })
  const inSplit = fitted.filter((p) =>
    rows.some((r) => r.powder === p.id && splitOf(r.cartridge) === split),
  )
  const items = inSplit.flatMap((powder) => {
    const { interior: _, ...plain } = powder
    const powders = new Map(records.powders).set(powder.id, plain)
    const own = rows.filter((r) => r.powder === powder.id)
    return outcomes(own, { ...records, powders }, model, [split])
  })
  return { items, powders: inSplit.length }
}

/** An evaluation with the error of each used row of the split, which `verify` adds with `--per-row` and `compare` pairs. */
type Evaluated = Evaluation & { rows?: RowError[] | undefined }

/** The values of the saved fit of `--fit` for an evaluation of `model`, which carries the fit's version and the version a fit of this build with the fit's options has; a `Refusal` for a fit of another model. */
function screenOf(path: string, data: Prepared, model: Model) {
  const saved = savedFit(path, 'fit', data)
  if (saved.model !== model.name)
    throw new Refusal(`the --fit fit is of the model ${saved.model}, this run ${model.name}`)
  const params = paramsLine(
    saved.velocitySigma,
    saved.exponent !== undefined,
    saved.pressure,
    saved.energyFamily ? 'family' : saved.energy && priorLines(data.rows, data.records),
  )
  return {
    records: withFit(data.records, saved),
    modelVersion: saved.modelVersion,
    screen: { version: versionOf(model, data, params) },
    summary: summaryOf(saved),
  }
}

/** What the model selected by `spec` gives on the split, with the burn coefficients fitted under it in a `fit-on-training` run, or those of the `--fit` file; refuses a split with no evaluable row. */
async function evaluateModel(spec: string, options: Options, data: Prepared): Promise<Evaluated> {
  const model = await loadModel(spec)
  const fitted =
    options.fit !== undefined
      ? screenOf(options.fit, data, model)
      : options.params === 'fit-on-training'
        ? fitOf(options, data, model)
        : undefined
  const records = fitted?.records ?? data.records
  const wanted: Split[] = options.split === 'training' ? ['training'] : [options.split, 'training']
  const run = outcomes(data.rows, records, model.interior, wanted)
  const estimated = run.filter((o) => o.estimatedCapacity && o.split === options.split)
  const all = estimatedNotUsed(run)
  const inSplit = all.filter((o) => o.split === options.split)
  const evaluation = evaluate(
    inSplit,
    all.filter((o) => o.split === 'training'),
    options.groupBy,
  )
  if (evaluation.overall.rows.used === 0)
    throw new Refusal(
      `no row of the ${options.split} split could be evaluated (${evaluation.overall.rows.inSplit} in the split)`,
    )
  const unseen =
    options.leaveOnePowderOut && leftOut({ ...data, records }, model.interior, options.split)
  return {
    model: model.name,
    modelVersion:
      fitted && 'modelVersion' in fitted
        ? fitted.modelVersion
        : versionOf(model, data, fitted?.params),
    ...evaluation,
    ...(unseen && {
      notInFittedSet: {
        ...metricsOf(unseen.items, widthByBarrel(evaluation.interval.byBarrel)),
        powders: unseen.powders,
      },
    }),
    ...(estimated.length > 0 && {
      estimatedCapacity: metricsOf(estimated, widthByBarrel(evaluation.interval.byBarrel)),
    }),
    ...(fitted && { fit: fitted.summary }),
    ...(fitted && 'screen' in fitted && { screen: fitted.screen }),
    rows: errorsOf(inSplit, estimated),
  }
}

/** `run` with each row of an estimated capacity not used, as `estimatedCapacity`. */
const estimatedNotUsed = (run: readonly Outcome[]) =>
  run.map(
    (o): Outcome =>
      o.estimatedCapacity ? { ...o, prediction: { reason: 'estimatedCapacity' } } : o,
  )

/** The row errors of `scored` and of `estimated`, marked as estimated, in row order. */
const errorsOf = (scored: readonly Outcome[], estimated: readonly Outcome[]) =>
  [
    ...rowErrors(scored),
    ...rowErrors(estimated).map((e) => ({ ...e, capacity: 'estimated' as const })),
  ].toSorted((a, b) => a.row - b.row)

/** `fit()`, with the number of the fold in the message of the expected error it throws, since the rows of one fold may lack what the whole training split has. */
function foldFit<T>(fold: number, fit: () => T): T {
  try {
    return fit()
  } catch (error) {
    if (error instanceof ExpectedError) error.message = `fold ${fold}: ${error.message}`
    throw error
  }
}

/** The grouped cross-validation of `--folds` by cartridge ({@link foldsOf}) over the training and validation rows of `data` under `model`: each fold scored by a fit with `options` on those rows of the other folds; a `Refusal` with fewer of their cartridges than folds. */
function crossValidate(options: FitOptions, data: Prepared, model: Model) {
  checkFitOptions(options)
  // a saved family choice was made on the rows of every fold
  if (options.family !== undefined) throw new UsageError('--folds and --family do not combine')
  const pool = data.rows.filter((r) => foldSplits.includes(splitOf(r.cartridge)))
  const foldOf = foldsOf(pool.map((r) => r.cartridge))
  if (foldOf.size < foldCount)
    throw new Refusal(
      `--folds needs ${foldCount} cartridges of the training and validation splits or more, the rows have ${foldOf.size}`,
    )
  const each = Array.from({ length: foldCount }, (_, fold) => {
    const held = (r: Row) => foldOf.get(r.cartridge) === fold
    const fitted = foldFit(fold, () =>
      fitOf(options, { ...data, rows: pool.filter((r) => !held(r)) }, model, foldSplits),
    )
    // as in a full fit, a powder without a fit row has no value, so its rows count as noPowderModel
    const unnamed = [...new Set(pool.filter(held).map((r) => r.powder))].filter(
      (id) =>
        data.records.powders.get(id)?.interior &&
        !Object.hasOwn(fitted.powders, id) &&
        !Object.hasOwn(fitted.notFitted, id),
    )
    const notFitted = {
      ...fitted.notFitted,
      ...Object.fromEntries(unnamed.map((id) => [id, 'noUsableRow' as const])),
    }
    const records = withFit(data.records, { powders: fitted.powders, notFitted })
    const run = outcomes(data.rows, records, model.interior, foldSplits)
    const all = estimatedNotUsed(run)
    const { byBarrel, trainingRows } = halfWidthOf(all.filter((o) => !held(o.row)))
    return {
      fold,
      cartridges: [...foldOf].flatMap(([id, f]) => (f === fold ? [id] : [])).toSorted(compareKeys),
      fit: summaryOf({ ...fitted, pressure: fitted.summary.pressure, notFitted }),
      interval: { basis: foldPool, byBarrel, trainingRows },
      scored: all.filter((o) => held(o.row)),
      estimated: run.filter((o) => o.estimatedCapacity && held(o.row)),
    }
  })
  const widths = new Map(
    each.flatMap((f) => {
      const width = widthByBarrel(f.interval.byBarrel)
      return f.scored.map((o) => [o.index, width(o)] as const)
    }),
  )
  return {
    scored: each.flatMap((f) => f.scored),
    estimated: each.flatMap((f) => f.estimated),
    halfWidth: (o: Outcome) => widths.get(o.index) ?? null,
    trainingRows: each.reduce((n, f) => n + f.interval.trainingRows, 0),
    folds: {
      ...({ unit: 'cartridge', count: foldCount, salt: foldSalt } as const),
      cartridges: foldOf.size,
      each: each.map(({ fold, cartridges, fit, interval, scored }) => ({
        fold,
        cartridges,
        fit,
        interval,
        overall: metricsOf(scored, widthByBarrel(interval.byBarrel)),
      })),
      aggregate: foldAggregate(each.map((f) => rowErrors(f.scored))),
    },
  }
}

/** The params line of a `--folds` run: that of a fit with its options, and the fold rule. */
function foldParams(options: FitOptions, data: Prepared) {
  const { exponent, pressureSigma, pressureFactor, energy } = options
  const pressure =
    pressureSigma === undefined
      ? undefined
      : { sigma: pressureSigma, by: pressureFactor ?? 'basis' }
  const priors = energy === 'prior' ? priorLines(data.rows, data.records) : energy
  const fit = paramsLine(velocitySigmaOf(options), exponent !== undefined, pressure, priors)
  return `${fit} folds cartridge ${foldCount} salt ${foldSalt}`
}

/** What the model selected by `spec` gives on the training and validation rows under `--folds`, every fold together; refuses a run with no evaluable row. */
async function evaluateFolds(spec: string, options: Options, data: Prepared) {
  // each fold is fitted on its own rows, so neither the record values nor a saved fit apply
  if (options.params !== undefined || options.fit !== undefined)
    throw new UsageError('--folds fits each fold and takes no --params or --fit')
  if (options.leaveOnePowderOut)
    throw new UsageError('--folds and --leave-one-powder-out do not combine')
  const model = await loadModel(spec)
  const cv = crossValidate(options, data, model)
  const evaluation = groupsOf(cv.scored, cv.halfWidth, options.groupBy)
  if (evaluation.overall.rows.used === 0)
    throw new Refusal(
      `no row of the training and validation splits could be evaluated (${evaluation.overall.rows.inSplit} in the splits)`,
    )
  return {
    model: model.name,
    modelVersion: versionOf(model, data, foldParams(options, data)),
    interval: { basis: foldPool, trainingRows: cv.trainingRows },
    ...evaluation,
    ...(cv.estimated.length > 0 && { estimatedCapacity: metricsOf(cv.estimated, cv.halfWidth) }),
    folds: cv.folds,
    rows: errorsOf(cv.scored, cv.estimated),
  }
}

/** `verify`: the held-out metrics of one model on one split. */
export async function verify(options: Options, spec = builtInName): Promise<VerifyResult> {
  checkSealed(options)
  const data = prepare(options)
  const { rows, ...evaluation } = options.folds
    ? await evaluateFolds(spec, options, data)
    : await evaluateModel(spec, options, data)
  return {
    schemaVersion,
    notice,
    command: 'verify',
    split: options.folds ? foldPool : options.split,
    splitSalt,
    final: options.final,
    inputs: data.inputs,
    ...(data.published && { published: data.published }),
    ...evaluation,
    ...(options.perRow && { rows }),
  }
}

/** What each file option holds and how its messages name it. */
const savedKinds = {
  baseline: { command: 'verify', schema: verifyResult, noun: 'the baseline' },
  fit: { command: 'fit', schema: fitResult, noun: 'the fit' },
  family: { command: 'fit', schema: fitResult, noun: 'the family fit' },
} as const

/** The `verify` result a `--baseline` file holds, or the `fit` result of a `--fit` or `--family` file; a `NoInputError` for a file that cannot be read and a `DataError` for one that is not such a result. */
function savedResult(path: string, option: 'baseline'): VerifyResult
function savedResult(path: string, option: 'fit' | 'family'): FitResult
function savedResult(path: string, option: keyof typeof savedKinds): VerifyResult | FitResult {
  const { command, schema, noun } = savedKinds[option]
  let text: string
  try {
    text = readFileSync(path, 'utf8') // NOSONAR: the path is the argument the user gave
  } catch (error) {
    throw new NoInputError(
      `the --${option} file cannot be read: ${(error as NodeJS.ErrnoException).code}`,
    )
  }
  let json: unknown
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new DataError(`the --${option} file is not JSON`)
  }
  // before the schema, which would call a result of the earlier rule "not a verify result"
  if ((json as { command?: unknown } | null)?.command === command) {
    const salt = (json as { splitSalt?: unknown }).splitSalt
    if (salt !== splitSalt)
      throw new Refusal(
        `${noun} was split by another rule (salt ${typeof salt === 'string' ? salt : 'none'}, this run ${splitSalt}): its splits hold other rows`,
      )
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) throw new DataError(`${noun} file is not a ${command} result`)
  return parsed.data
}

/** The baseline evaluation: a saved `verify` result of the same split and data, or a live model. */
async function baselineOf(spec: string, options: Options, data: Prepared): Promise<Evaluated> {
  if (!spec.endsWith('.json')) return await evaluateModel(spec, options, data)
  const {
    schemaVersion: _v,
    notice: _n,
    command: _c,
    split,
    splitSalt: _s,
    final: _f,
    inputs,
    published: _p,
    folds,
    ...evaluation
  } = savedResult(spec, 'baseline')
  // its rows were scored by five fits, the candidate's by one
  if (folds) throw new Refusal('the baseline is a --folds result, which compare does not pair')
  if (split !== options.split)
    throw new Refusal(`the baseline is a ${split} result, this run is ${options.split}`)
  if (inputs.rows !== data.inputs.rows || inputs.records !== data.inputs.records)
    throw new Refusal('the baseline was run on other rows or records')
  return evaluation
}

/** `compare`: a baseline and a candidate on the same rows and split, with the change per metric. */
export async function compare(
  options: Options,
  baselineSpec: string,
  candidateSpec: string,
): Promise<CompareResult> {
  checkSealed(options)
  const data = prepare(options)
  const { rows: baselineRows, ...baseline } = await baselineOf(baselineSpec, options, data)
  const { rows: candidateRows, ...candidate } = await evaluateModel(candidateSpec, options, data)
  const by = candidate.grouped?.by
  const sameGroups = by !== undefined && baseline.grouped?.by === by
  const groupNames = new Set([
    ...Object.keys(baseline.grouped?.groups ?? {}),
    ...Object.keys(candidate.grouped?.groups ?? {}),
  ])
  const families = new Set([...Object.keys(baseline.byFamily), ...Object.keys(candidate.byFamily)])
  // a baseline saved with one half width for every row measured its coverage against another interval
  const oneWidth = baseline.interval.byBarrel === undefined
  const changeIn: typeof changeOf = (before, after) => {
    const change = changeOf(before, after)
    return oneWidth ? { ...change, intervalCoverage: null } : change
  }
  return {
    schemaVersion,
    notice,
    command: 'compare',
    split: options.split,
    splitSalt,
    final: options.final,
    inputs: data.inputs satisfies Inputs,
    ...(data.published && { published: data.published }),
    baseline,
    candidate,
    ...(baselineRows && candidateRows && { paired: pairedChange(baselineRows, candidateRows) }),
    change: {
      overall: changeIn(baseline.overall, candidate.overall),
      byFamily: Object.fromEntries(
        [...families]
          .toSorted(compareKeys)
          .map((f) => [f, changeIn(baseline.byFamily[f], candidate.byFamily[f])]),
      ),
      ...(sameGroups && {
        grouped: Object.fromEntries(
          [...groupNames]
            .toSorted(compareKeys)
            .map((g) => [g, changeIn(baseline.grouped?.groups[g], candidate.grouped?.groups[g])]),
        ),
      }),
      ...((baseline.estimatedCapacity || candidate.estimatedCapacity) && {
        estimatedCapacity: changeIn(baseline.estimatedCapacity, candidate.estimatedCapacity),
      }),
    },
  }
}

/** `fit`: the burn coefficient of each powder fitted under one model to its training rows, with its uncertainty. */
export async function fit(options: FitOptions, spec = builtInName): Promise<FitResult> {
  const data = prepare(options)
  const model = await loadModel(spec)
  // before the full fit, so that a run --folds refuses fails fast
  const folds = options.folds ? crossValidate(options, data, model).folds : undefined
  const fitted = fitOf(options, data, model)
  return {
    schemaVersion,
    notice,
    command: 'fit',
    inputs: data.inputs,
    ...(data.published && { published: data.published }),
    model: model.name,
    modelVersion: versionOf(model, data, fitted.params),
    split: 'training',
    splitSalt,
    velocitySigma: fitted.velocitySigma,
    ...(fitted.exponent && { exponent: fitted.exponent }),
    ...(fitted.summary.pressure && { pressure: fitted.summary.pressure }),
    powders: fitted.powders,
    notFitted: fitted.notFitted,
    ...(fitted.energy && { energy: fitted.energy }),
    ...(fitted.energyFamily && { energyFamily: fitted.energyFamily }),
    ...(folds && { folds }),
  }
}
