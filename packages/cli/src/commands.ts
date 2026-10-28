import { readFileSync } from 'node:fs'
import { Refusal, UsageError } from './errors.ts'
import { outcomes } from './evaluate.ts'
import { changeOf, evaluate, type Grouping } from './metrics.ts'
import { builtInName, loadModel } from './model.ts'
import { loadRecords } from './records.ts'
import {
  type CompareResult,
  type Evaluation,
  schemaVersion,
  type VerifyResult,
  verifyResult,
} from './result.ts'
import { readRows } from './rows.ts'
import type { Split } from './split.ts'
import { byText } from './stats.ts'
import { inputsOf, modelVersion } from './version.ts'

/** What `verify` and `compare` read: the rows, the records, the split and the sealed-split switch. */
export interface Options {
  /** Path of a rows file or of a folder of them. */
  rows: string
  /** Records roots, empty for the records of the data package. */
  records: string[]
  split: Split
  /** Allows the test split. */
  final: boolean
  /** Adds the groups of this key to the result. */
  groupBy?: Grouping | undefined
  /** Gets a note about the inputs; the result stays on stdout. */
  warn?: ((text: string) => void) | undefined
}

type Inputs = VerifyResult['inputs']

/** Refuses a run of the sealed test split without `--final`. */
function checkSealed({ split, final }: Options) {
  if (split === 'test' && !final)
    throw new Refusal('the test split is sealed: run it once per model version with --final')
}

/** The data both commands evaluate models on. */
function prepare(options: Options) {
  const { rows, files } = readRows(options.rows)
  const records = loadRecords(options.records)
  if (records.issues > 0)
    options.warn?.(`${records.issues} problem(s) in the records; the valid records are used\n`)
  return { rows, records, inputs: inputsOf(rows, files, records) }
}

type Prepared = ReturnType<typeof prepare>

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
  return { model: model.name, modelVersion: modelVersion(model, data.inputs), ...evaluation }
}

/** `verify`: the held-out metrics of one model on one split. */
export async function verify(options: Options, spec = builtInName): Promise<VerifyResult> {
  checkSealed(options)
  const data = prepare(options)
  const evaluation = await evaluateModel(spec, options, data)
  return {
    schemaVersion,
    command: 'verify',
    split: options.split,
    final: options.final,
    inputs: data.inputs,
    ...evaluation,
  }
}

/** The `verify` result a baseline file holds; a `UsageError` for a file that is not one. */
function savedResult(path: string): VerifyResult {
  let json: unknown
  try {
    json = JSON.parse(readFileSync(path, 'utf8')) // NOSONAR: the path is the argument the user gave
  } catch {
    throw new UsageError('the baseline file cannot be read as JSON')
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
    command: _c,
    split,
    final: _f,
    inputs,
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
    command: 'compare',
    split: options.split,
    final: options.final,
    inputs: data.inputs satisfies Inputs,
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
