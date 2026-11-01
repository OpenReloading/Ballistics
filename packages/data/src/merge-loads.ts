import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import {
  compareKeys,
  type PublishedLoads,
  parseRef,
  publishedLoads,
  sourceRecord,
} from '@open-reloading/schema'
import {
  type IncomingLoads,
  type MergeReport,
  mergePublishedLoads,
  withLoadIds,
} from './published-load-merge.ts'
import { readKind } from './read-kind.ts'
import { resolveRecord, type SourceIndex, sourceIndex } from './sources.ts'

const repository = join(import.meta.dirname, '..', '..', '..')

/** The options of `npm run loads:merge`. */
export type MergeOptions = {
  /** The folder that holds `loads/<cartridge>/<table>.json`. */
  incoming: string
  /** The records root to merge into. */
  records: string
  accept: ReadonlySet<string> | 'all'
  dryRun: boolean
}

/** The arguments `<incoming folder> [--accept <id>... | --accept-all] [--dry-run]`, or an error. */
export function parseMergeArgs(
  args: readonly string[],
  cwd: string,
  records: string,
): MergeOptions | { error: string } {
  const usage = 'usage: loads:merge <incoming folder> [--accept <id>... | --accept-all] [--dry-run]'
  const option = (a: string) => a.startsWith('--')
  const unknown = args.find(
    (a) => option(a) && !['--accept', '--accept-all', '--dry-run'].includes(a),
  )
  if (unknown !== undefined) return { error: `unknown option ${unknown}\n${usage}` }
  // the ids follow each --accept up to the next option
  const ids: string[] = []
  const folders: string[] = []
  let accepting = false
  for (const a of args) {
    if (option(a)) accepting = a === '--accept'
    else (accepting ? ids : folders).push(a)
  }
  const all = args.includes('--accept-all')
  if (folders.length !== 1) return { error: `one incoming folder, before the options\n${usage}` }
  if (args.includes('--accept') && ids.length === 0)
    return { error: `--accept needs the ids of the loads\n${usage}` }
  if (all && ids.length > 0)
    return { error: `--accept and --accept-all exclude each other\n${usage}` }
  return {
    incoming: resolve(cwd, folders[0] as string),
    records,
    accept: all ? 'all' : new Set(ids),
    dryRun: args.includes('--dry-run'),
  }
}

/**
 * `json` written the way the records are: two spaces, formatted by the repository's Biome (which
 * keeps every object on its own lines and puts a short array on one), and a final newline.
 */
export function formatRecord(json: unknown) {
  const run = spawnSync(
    process.execPath,
    [
      join(repository, 'node_modules', '@biomejs', 'biome', 'bin', 'biome'),
      'format',
      '--stdin-file-path=packages/data/records/loads/merged.json',
    ],
    { cwd: repository, input: JSON.stringify(json, null, 2), encoding: 'utf8' },
  )
  if (run.status !== 0) throw new Error(`biome format failed: ${run.stderr}`)
  return run.stdout.endsWith('\n') ? run.stdout : `${run.stdout}\n`
}

/** One incoming file and what became of it. */
export type FileOutcome =
  | { path: string; status: 'merged'; report: MergeReport; written: boolean }
  | { path: string; status: 'waiting' }

/** What a merge run did: the outcome per file, or the schema errors of the incoming files. */
export type MergeRun = { files: FileOutcome[]; errors: string[] }

/** The incoming files `loads/<cartridge>/<table>.json` of `folder`, as paths relative to it. */
function incomingFiles(folder: string) {
  const loads = join(folder, 'loads')
  if (!existsSync(loads)) return []
  return readdirSync(loads, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(compareKeys)
    .flatMap((cartridge) =>
      readdirSync(join(loads, cartridge))
        .filter((f) => f.endsWith('.json'))
        .sort(compareKeys)
        .map((f) => `loads/${cartridge}/${f}`),
    )
}

/** The rules of a file's place: its folder is its cartridge, its name its id, the maker's table. */
function placement(path: string, file: PublishedLoads) {
  const found: string[] = []
  const folder = basename(dirname(path))
  if ((parseRef(file.cartridge)?.id ?? file.cartridge) !== folder)
    found.push(`${path}: cartridge "${file.cartridge}" is not the folder "${folder}"`)
  if (file.id !== basename(path, '.json'))
    found.push(`${path}: id "${file.id}" does not match the file name`)
  const name = file.producedBy === 'customer' ? `${file.maker}-customer` : file.maker
  if (file.id !== name)
    found.push(`${path}: a table produced by the ${file.producedBy} is named "${name}"`)
  return found
}

/** A source entry as it compares: a reference resolved to its source record. */
const resolving = (sources: SourceIndex) => (entry: unknown) =>
  (
    resolveRecord({ provenance: { sources: [entry] } }, sources, 'source', []) as {
      provenance: { sources: unknown[] }
    }
  ).provenance.sources[0]

/**
 * Reads and checks every incoming file against `publishedLoads`, its ids set by the id rule and
 * its source references resolved from the records' sources. Nothing is merged when one fails.
 */
function readIncoming(options: MergeOptions, sources: SourceIndex, errors: string[]) {
  const read: { path: string; file: IncomingLoads }[] = []
  for (const path of incomingFiles(options.incoming)) {
    let json: IncomingLoads
    try {
      json = JSON.parse(readFileSync(join(options.incoming, path), 'utf8'))
    } catch (e) {
      errors.push(`${path}: invalid JSON: ${(e as Error).message}`)
      continue
    }
    const before = errors.length
    let withIds: unknown = json
    try {
      withIds = withLoadIds(json)
    } catch {
      // a load too broken for the id rule: the schema below names what is missing
    }
    const parsed = publishedLoads.safeParse(resolveRecord(withIds, sources, path, errors))
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        errors.push(`${path}: ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    else errors.push(...placement(path, parsed.data))
    if (errors.length === before) read.push({ path, file: json })
  }
  return read
}

/**
 * Merges every incoming file into the records' `loads/` folder (see {@link mergePublishedLoads}).
 * A file whose cartridge folder is no cartridge record is not written and is reported as waiting.
 * With `dryRun`, or when a file fails the schema, nothing is written.
 */
export function mergeLoadFolder(options: MergeOptions): MergeRun {
  const errors: string[] = []
  const sources = sourceIndex(
    readKind([options.records], 'sources', sourceRecord, { errors, optional: true }),
  )
  const read = readIncoming(options, sources, errors)
  if (errors.length > 0) return { files: [], errors }
  const files: FileOutcome[] = read.map(({ path, file }) => {
    const cartridge = basename(dirname(path))
    if (!existsSync(join(options.records, 'cartridges', `${cartridge}.json`)))
      return { path, status: 'waiting' }
    const target = join(options.records, path)
    const existing = existsSync(target)
      ? (JSON.parse(readFileSync(target, 'utf8')) as PublishedLoads)
      : undefined
    const merged = mergePublishedLoads(existing, file, options.accept, resolving(sources))
    if (merged.written && !options.dryRun) {
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, formatRecord(merged.file))
    }
    return { path, status: 'merged', report: merged.report, written: merged.written }
  })
  return { files, errors }
}

/** The counts of a report, or of several added up. */
type Counts = {
  created: number
  changed: number
  refused: number
  unchanged: number
  absent: number
}

const counts = (r: MergeReport): Counts => ({
  created: r.created.length,
  changed: r.changed.length,
  refused: r.changed.filter((c) => !c.accepted).length,
  unchanged: r.unchanged.length,
  absent: r.absent.length,
})

const countLine = (c: Counts) =>
  `${c.created} created, ${c.changed} changed (${c.refused} not accepted), ${c.unchanged} unchanged, ${c.absent} absent`

/** The lines of one merged file: its counts, its changed loads with their fields, its absent loads. */
function fileLines(path: string, report: MergeReport, state: string) {
  return [
    `${path}: ${countLine(counts(report))}; ${state}`,
    ...report.changed.map(
      (c) => `  changed ${c.id}${c.accepted ? '' : ' (not accepted)'}: ${c.fields.join(', ')}`,
    ),
    ...report.absent.map((id) => `  absent ${id}: kept`),
  ]
}

/** The report of a run: per file and in total, as printed lines. */
export function reportLines(run: MergeRun, dryRun: boolean) {
  if (run.errors.length > 0)
    return [...run.errors, `${run.errors.length} errors in the incoming files, nothing merged`]
  const total: Counts = { created: 0, changed: 0, refused: 0, unchanged: 0, absent: 0 }
  const lines: string[] = []
  const waiting: string[] = []
  for (const f of run.files) {
    if (f.status === 'waiting') {
      waiting.push(f.path)
      continue
    }
    const c = counts(f.report)
    for (const k of Object.keys(total) as (keyof Counts)[]) total[k] += c[k]
    const state = f.written ? (dryRun ? 'would be written' : 'written') : 'not changed'
    lines.push(...fileLines(f.path, f.report, state))
  }
  if (waiting.length > 0)
    lines.push('waiting for a cartridge record (not written):', ...waiting.map((p) => `  ${p}`))
  lines.push(
    `total: ${countLine(total)}, ${waiting.length} waiting${dryRun ? ' (dry run, nothing written)' : ''}`,
  )
  return lines
}

/** Runs `npm run loads:merge` with the command line `args`; returns the exit code. */
export function main(args: readonly string[], cwd: string, records: string) {
  const options = parseMergeArgs(args, cwd, records)
  if ('error' in options) {
    console.error(options.error)
    return 2
  }
  const run = mergeLoadFolder(options)
  const print = run.errors.length > 0 ? console.error : console.log
  for (const line of reportLines(run, options.dryRun)) print(line)
  return run.errors.length > 0 ? 1 : 0
}

if (import.meta.main)
  process.exitCode = main(
    process.argv.slice(2),
    process.env.INIT_CWD ?? process.cwd(),
    join(import.meta.dirname, '..', 'records'),
  )
