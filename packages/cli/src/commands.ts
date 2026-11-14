import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareKeys, type SourceRecord, sourceRecord } from '@rangefoundry/schema'
import { readPublishedLoads } from '@rangefoundry/tools/catalog'
import { Refusal, UsageError } from './errors.ts'
import { type InteriorModel, outcomes } from './evaluate.ts'
import { fitPowders, notFittedReasons, type PressureKey, withFit } from './fit.ts'
import { changeOf, evaluate, type Grouping, metricsOf } from './metrics.ts'
import { builtInName, fitFiles, loadModel, type Model } from './model.ts'
import { pairedChange, type RowError, rowErrors } from './paired.ts'
import { fillInputs, rowsFromPublished } from './published-rows.ts'
import { loadRecords, type Records } from './records.ts'
import {
  type CompareResult,
  type Evaluation,
  type FitResult,
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
  /** Of the fit, a fraction of the velocity; default 0.03. */
  velocitySigma?: number | undefined
  /** Fits with the printed pressures, this sigma a fraction of the pressure, and a factor per key of `pressureFactor`; none without it. */
  pressureSigma?: number | undefined
  /** With `pressureSigma`: the key a pressure factor is computed per and applied by; default `basis`. */
  pressureFactor?: PressureKey | undefined
  /** `family` fits each burn coefficient at the pressure exponent its powder family chooses; default the record's. */
  exponent?: 'family' | undefined
  /** `prior`: each powder's energy is its prior times one energy-level factor chosen on the training pressures; default the record's. */
  energy?: 'prior' | undefined
  /** `verify`: adds the error of each used row of the split. */
  perRow?: boolean | undefined
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
  | 'energy'
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
  if (rows.length === 0) throw new UsageError('the published loads give no row')
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

/** The fit of a run under `model`, the records with its values laid over, its version line and its summary for an evaluation. */
function fitOf(options: FitOptions, data: Prepared, model: Model) {
  // load tables print no spread; ANSI/SAAMI Z299.4-2025 expects tested ammunition within 90 fps of the table, about 3 %
  const velocitySigma = options.velocitySigma ?? 0.03
  const { exponent, pressureSigma, pressureFactor, energy } = options
  if (pressureFactor !== undefined && pressureSigma === undefined)
    throw new UsageError('--pressure-factor needs --pressure-sigma')
  // one factor on all printed pressures and one per key both set the pressure level with no rule for which comes first
  if (energy !== undefined && pressureSigma !== undefined)
    throw new UsageError('--energy prior and --pressure-sigma do not combine')
  const fit = fitPowders(data.rows, data.records, model.interior, velocitySigma, {
    exponent,
    pressureSigma,
    pressureFactor,
    energy,
  })
  const reasons = Object.values(fit.notFitted)
  const notFitted = Object.fromEntries(
    notFittedReasons.flatMap((reason) => {
      const n = reasons.filter((r) => r === reason).length
      return n > 0 ? [[reason, n]] : []
    }),
  )
  // the priors come from records the rows may not name, which the records lines of the version leave out
  const energyLine = fit.priorLines
    ? ` energy prior ${sha256(fit.priorLines.toSorted(compareKeys).join('\n'))}`
    : ''
  return {
    powders: fit.powders,
    notFitted: fit.notFitted,
    exponent: fit.exponent,
    energy: fit.energy,
    velocitySigma,
    records: withFit(data.records, fit),
    params: `params fit-on-training velocity-sigma ${velocitySigma}${exponent === undefined ? '' : ' exponent family'}${fit.pressure ? ` pressure-sigma ${fit.pressure.sigma} pressure-factor ${fit.pressure.by}` : ''}${energyLine}`,
    summary: {
      velocitySigma,
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
    },
  }
}

type Fitted = ReturnType<typeof fitOf>

/** The version of `model` on the data, with the fit's files and its params line in a fit run. */
const versionOf = (model: Model, data: Prepared, fitted: Fitted | undefined) =>
  modelVersion(
    fitted ? { ...model, files: [...model.files, ...fitFiles()] } : model,
    data.inputs,
    fitted?.params,
  )

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

/** What the model selected by `spec` gives on the split, with the burn coefficients fitted under it in a `fit-on-training` run; refuses a split with no evaluable row. */
async function evaluateModel(spec: string, options: Options, data: Prepared): Promise<Evaluated> {
  const model = await loadModel(spec)
  const fitted = options.params === 'fit-on-training' ? fitOf(options, data, model) : undefined
  const records = fitted?.records ?? data.records
  const wanted: Split[] = options.split === 'training' ? ['training'] : [options.split, 'training']
  const all = outcomes(data.rows, records, model.interior, wanted)
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
    modelVersion: versionOf(model, data, fitted),
    ...evaluation,
    ...(unseen && {
      notInFittedSet: {
        ...metricsOf(unseen.items, evaluation.interval.halfWidth),
        powders: unseen.powders,
      },
    }),
    ...(fitted && { fit: fitted.summary }),
    rows: rowErrors(inSplit),
  }
}

/** `verify`: the held-out metrics of one model on one split. */
export async function verify(options: Options, spec = builtInName): Promise<VerifyResult> {
  checkSealed(options)
  const data = prepare(options)
  const { rows, ...evaluation } = await evaluateModel(spec, options, data)
  return {
    schemaVersion,
    notice,
    command: 'verify',
    split: options.split,
    splitSalt,
    final: options.final,
    inputs: data.inputs,
    ...(data.published && { published: data.published }),
    ...evaluation,
    ...(options.perRow && { rows }),
  }
}

/** The `verify` result a baseline file holds; a `UsageError` for a file that is not one. */
function savedResult(path: string): VerifyResult {
  let text: string
  try {
    text = readFileSync(path, 'utf8') // NOSONAR: the path is the argument the user gave
  } catch (error) {
    throw new UsageError(
      `the --baseline file cannot be read: ${(error as NodeJS.ErrnoException).code}`,
    )
  }
  let json: unknown
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new UsageError('the --baseline file is not JSON')
  }
  // before the schema, which would call a result of the earlier rule "not a verify result"
  if ((json as { command?: unknown } | null)?.command === 'verify') {
    const salt = (json as { splitSalt?: unknown }).splitSalt
    if (salt !== splitSalt)
      throw new Refusal(
        `the baseline was split by another rule (salt ${typeof salt === 'string' ? salt : 'none'}, this run ${splitSalt}): its splits hold other rows`,
      )
  }
  const parsed = verifyResult.safeParse(json)
  if (!parsed.success) throw new UsageError('the baseline file is not a verify result')
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
    ...evaluation
  } = savedResult(spec)
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
      overall: changeOf(baseline.overall, candidate.overall),
      byFamily: Object.fromEntries(
        [...families]
          .toSorted(compareKeys)
          .map((f) => [f, changeOf(baseline.byFamily[f], candidate.byFamily[f])]),
      ),
      ...(sameGroups && {
        grouped: Object.fromEntries(
          [...groupNames]
            .toSorted(compareKeys)
            .map((g) => [g, changeOf(baseline.grouped?.groups[g], candidate.grouped?.groups[g])]),
        ),
      }),
    },
  }
}

/** `fit`: the burn coefficient of each powder fitted under one model to its training rows, with its uncertainty. */
export async function fit(options: FitOptions, spec = builtInName): Promise<FitResult> {
  const data = prepare(options)
  const model = await loadModel(spec)
  const fitted = fitOf(options, data, model)
  return {
    schemaVersion,
    notice,
    command: 'fit',
    inputs: data.inputs,
    ...(data.published && { published: data.published }),
    model: model.name,
    modelVersion: versionOf(model, data, fitted),
    split: 'training',
    splitSalt,
    velocitySigma: fitted.velocitySigma,
    ...(fitted.exponent && { exponent: fitted.exponent }),
    ...(fitted.summary.pressure && { pressure: fitted.summary.pressure }),
    powders: fitted.powders,
    notFitted: fitted.notFitted,
    ...(fitted.energy && { energy: fitted.energy }),
  }
}
