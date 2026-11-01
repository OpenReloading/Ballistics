import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPublishedLoads } from '@open-reloading/data'
import { type SourceRecord, sourceRecord } from '@open-reloading/schema'
import { Refusal, UsageError } from './errors.ts'
import { type InteriorModel, outcomes } from './evaluate.ts'
import { changeOf, evaluate, type Grouping, metricsOf } from './metrics.ts'
import { builtInName, loadModel } from './model.ts'
import { fillInputs, rowsFromPublished } from './published-rows.ts'
import { loadRecords, type Records } from './records.ts'
import {
  type CompareResult,
  type Evaluation,
  notice,
  schemaVersion,
  type VerifyResult,
  verifyResult,
} from './result.ts'
import { type Row, readRows } from './rows.ts'
import { type Split, splitOf } from './split.ts'
import { byText } from './stats.ts'
import { inputsOf, modelVersion } from './version.ts'

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
}

type Inputs = VerifyResult['inputs']

/** Refuses a run of the sealed test split without `--final`, and `--final` on another split. */
function checkSealed({ split, final }: Options) {
  if (final && split !== 'test') throw new UsageError('--final is for --split test only')
  if (split === 'test' && !final)
    throw new Refusal('the test split is sealed: run it once per model version with --final')
}

/** The records folder of the data package, which `readRecords` reads without roots. */
const packageRecords = () =>
  fileURLToPath(new URL('../records', import.meta.resolve('@open-reloading/data')))

/** Whether `path` is a folder of published load files: cartridge folders and no `.csv` file. */
function isPublishedFolder(path: string) {
  const stat = statSync(path, { throwIfNoEntry: false }) // NOSONAR: the path is the argument the user gave
  if (!stat?.isDirectory()) return false
  const entries = readdirSync(path, { withFileTypes: true }) // NOSONAR: as above
  return !entries.some((e) => /\.csv$/i.test(e.name)) && entries.some((e) => e.isDirectory())
}

/** The source records of every root, by id, as the published load files resolve them. */
function sourcesOf(roots: readonly string[]) {
  const byId = new Map<string, SourceRecord>()
  for (const root of roots) {
    const dir = join(root, 'sources')
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) continue // NOSONAR: as above
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      // NOSONAR: as above
      const parsed = sourceRecord.safeParse(JSON.parse(readFileSync(join(dir, name), 'utf8')))
      if (parsed.success && !byId.has(parsed.data.id)) byId.set(parsed.data.id, parsed.data)
    }
  }
  return { byId, cited: new Set<string>(), embedded: new Map<string, Set<string>>() }
}

/**
 * The rows of the catalogue's published load files (`catalogue`), or of the files of a folder laid
 * out as `records/loads/` only, their source references resolved from the records' sources.
 */
function catalogueRows(options: Options) {
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
  ).toSorted((a, b) => byText(`${a.cartridge}/${a.id}`, `${b.cartridge}/${b.id}`))
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

/** The data both commands evaluate models on. */
function prepare(options: Options) {
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

/** What the model selected by `spec` gives on the split; refuses a split with no evaluable row. */
async function evaluateModel(spec: string, options: Options, data: Prepared): Promise<Evaluation> {
  const model = await loadModel(spec)
  const wanted: Split[] = options.split === 'training' ? ['training'] : [options.split, 'training']
  const all = outcomes(data.rows, data.records, model.interior, wanted)
  const evaluation = evaluate(
    all.filter((o) => o.split === options.split),
    all.filter((o) => o.split === 'training'),
    options.groupBy,
  )
  if (evaluation.overall.rows.used === 0)
    throw new Refusal(
      `no row of the ${options.split} split could be evaluated (${evaluation.overall.rows.inSplit} in the split)`,
    )
  const unseen = options.leaveOnePowderOut && leftOut(data, model.interior, options.split)
  return {
    model: model.name,
    modelVersion: modelVersion(model, data.inputs),
    ...evaluation,
    ...(unseen && {
      notInFittedSet: {
        ...metricsOf(unseen.items, evaluation.interval.halfWidth),
        powders: unseen.powders,
      },
    }),
  }
}

/** `verify`: the held-out metrics of one model on one split. */
export async function verify(options: Options, spec = builtInName): Promise<VerifyResult> {
  checkSealed(options)
  const data = prepare(options)
  const evaluation = await evaluateModel(spec, options, data)
  return {
    schemaVersion,
    notice,
    command: 'verify',
    split: options.split,
    final: options.final,
    inputs: data.inputs,
    ...(data.published && { published: data.published }),
    ...evaluation,
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
  const parsed = verifyResult.safeParse(json)
  if (!parsed.success) throw new UsageError('the baseline file is not a verify result')
  return parsed.data
}

/** The baseline evaluation: a saved `verify` result of the same split and data, or a live model. */
async function baselineOf(spec: string, options: Options, data: Prepared): Promise<Evaluation> {
  if (!spec.endsWith('.json')) return await evaluateModel(spec, options, data)
  const {
    schemaVersion: _v,
    notice: _n,
    command: _c,
    split,
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
  const baseline = await baselineOf(baselineSpec, options, data)
  const candidate = await evaluateModel(candidateSpec, options, data)
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
    final: options.final,
    inputs: data.inputs satisfies Inputs,
    ...(data.published && { published: data.published }),
    baseline,
    candidate,
    change: {
      overall: changeOf(baseline.overall, candidate.overall),
      byFamily: Object.fromEntries(
        [...families]
          .toSorted(byText)
          .map((f) => [f, changeOf(baseline.byFamily[f], candidate.byFamily[f])]),
      ),
      ...(sameGroups && {
        grouped: Object.fromEntries(
          [...groupNames]
            .toSorted(byText)
            .map((g) => [g, changeOf(baseline.grouped?.groups[g], candidate.grouped?.groups[g])]),
        ),
      }),
    },
  }
}
