import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type Bullet,
  bullet,
  type CaliberClass,
  type Cartridge,
  type CatalogueCase,
  type CatalogueCaseCapacity,
  type CatalogueLoad,
  type CatalogueSession,
  caliberClass,
  cartridge,
  catalogueCase,
  catalogueCaseCapacity,
  catalogueLoad,
  catalogueSession,
  type Discipline,
  discipline,
  type Federation,
  type FiringSeries,
  federation,
  firingSeries,
  type LoadTables,
  loadTable,
  type Manufacturer,
  manufacturer,
  type Powder,
  parseRef,
  powder,
  type RangeFirings,
  type Renames,
  rangeFirings,
  sourceRecord,
  type TargetFace,
  type TargetMapping,
  targetFace,
  targetMapping,
} from '@open-reloading/schema'
import { z } from 'zod'
import { checkCaliberClasses } from './caliber-classes.ts'
import { checkCoverage } from './coverage.ts'
import { checkFederations } from './federations.ts'
import { checkFittedSources } from './load-tables.ts'
import { checkNames, type LocatedFinding } from './names.ts'
import {
  checkBullet,
  checkCapacity,
  checkCase,
  checkChronoSession,
  checkPowder,
  checkSpec,
} from './plausibility.ts'
import { readKind } from './read-kind.ts'
import {
  checkCartridgeReferences,
  checkLoadCapacityReferences,
  checkLoadComponentReferences,
  checkLoadReferences,
  checkLoadSessionReferences,
  checkManufacturerReferences,
  recordIds,
} from './references.ts'
import { checkRenames, readRenames } from './renames.ts'
import { checkSources, sourceIndex } from './sources.ts'

/** Directory `records/` of the data package, the default root of {@link readRecords}. */
const recordsDir = join(import.meta.dirname, '..', 'records')

/** Parses one entry of `load-tables.json` into `tables`, or adds its issues to `found`. */
function readLoadTable(file: string, entry: unknown, tables: LoadTables, found: string[]) {
  const parsed = loadTable.safeParse(entry)
  if (parsed.success) tables[file] = parsed.data
  else
    for (const issue of parsed.error.issues)
      found.push(`load-tables.json: ${[file, ...issue.path].join('.')}: ${issue.message}`)
}

/**
 * The load tables listed in `load-tables.json` of a records folder (none without it). An entry
 * that breaks `loadTable` is left out and adds its issues to `errors`; without `errors` it throws.
 */
export function readLoadTables(dir: string, errors?: string[]): LoadTables {
  const path = join(dir, 'load-tables.json')
  if (!existsSync(path)) return {}
  let json: unknown
  try {
    json = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new Error(`${path}: invalid JSON: ${(e as Error).message}`)
  }
  const listed = z.record(z.string(), z.unknown()).safeParse(json)
  const found: string[] = errors ?? []
  const tables: LoadTables = {}
  if (!listed.success) found.push('load-tables.json: not an object of tables by row file')
  else
    for (const [file, entry] of Object.entries(listed.data))
      readLoadTable(file, entry, tables, found)
  if (!errors && found.length) throw new Error(found.join('\n'))
  return tables
}

/** The records of a records root, one array per kind. */
export type Bundle = {
  cartridges: Cartridge[]
  caliberClasses: CaliberClass[]
  manufacturers: Manufacturer[]
  powders: Powder[]
  bullets: Bullet[]
  cases: CatalogueCase[]
  capacities: CatalogueCaseCapacity[]
  loads: CatalogueLoad[]
  chronoSessions: CatalogueSession[]
  firings: FiringSeries[]
  rangeFirings: RangeFirings[]
  targetFaces: TargetFace[]
  federations: Federation[]
  disciplines: Discipline[]
  targetMappings: TargetMapping[]
  /** `renames.json` of the records roots; absent: none. */
  renames?: Renames | undefined
}

/**
 * What {@link readRecords} returns: the records and the error messages. Valid data has no errors.
 */
export type ReadRecordsResult = {
  bundle: Bundle
  errors: string[]
}

/** Reads every kind directory of `roots`, in this order, the source records first. */
function readBundle(roots: string[], errors: string[]): Bundle {
  const sources = sourceIndex(readKind(roots, 'sources', sourceRecord, { errors }))
  const read = <T extends { id: string }>(dir: string, schema: z.ZodType<T>, optional = false) =>
    readKind(roots, dir, schema, { errors, sources, optional })
  const bundle = {
    cartridges: read('cartridges', cartridge),
    caliberClasses: read('caliber-classes', caliberClass),
    manufacturers: read('manufacturers', manufacturer),
    powders: read('powders', powder),
    bullets: read('bullets', bullet),
    cases: read('cases', catalogueCase),
    capacities: read('capacities', catalogueCaseCapacity),
    loads: read('loads', catalogueLoad),
    chronoSessions: read('chrono', catalogueSession),
    firings: read('firings', firingSeries, true),
    rangeFirings: read('range', rangeFirings, true),
    targetFaces: read('target-faces', targetFace),
    federations: read('federations', federation),
    disciplines: read('disciplines', discipline),
    targetMappings: read('target-mappings', targetMapping),
    renames: readRenames(roots, errors),
  }
  checkSources(sources, errors)
  return bundle
}

/** A value may appear once per side, symbol and variant. */
function checkSpecValues(spec: Cartridge, errors: string[]) {
  const seen = new Set<string>()
  for (const value of spec.values) {
    const key = `${value.side ?? '-'} ${value.symbol} ${value.variant ?? '-'}`
    if (seen.has(key)) errors.push(`cartridges/${spec.id}.json: duplicate value ${key}`)
    seen.add(key)
  }
}

/** Every plausibility finding of the sheet is in its `exceptions`, and every exception still occurs. */
function applyExceptions(spec: Cartridge, errors: string[]) {
  const where = `cartridges/${spec.id}.json`
  const findings = checkSpec(spec)
  const acknowledged = new Set(spec.exceptions?.map((e) => e.finding))
  for (const finding of findings) {
    if (!acknowledged.has(finding.finding)) {
      errors.push(`${where}: ${finding.finding}: ${finding.message}`)
    }
  }
  const found = new Set(findings.map((f) => f.finding))
  for (const exception of spec.exceptions ?? []) {
    if (!found.has(exception.finding)) {
      errors.push(`${where}: exception "${exception.finding}" no longer applies; remove it`)
    }
  }
}

/** Every data field of the source-backed kinds is supported by a source. */
function checkSourceCoverage(bundle: Bundle, errors: string[]) {
  for (const [dir, records] of [
    ['manufacturers', bundle.manufacturers],
    ['caliber-classes', bundle.caliberClasses],
    ['powders', bundle.powders],
    ['bullets', bundle.bullets],
    ['cases', bundle.cases],
    ['capacities', bundle.capacities],
    ['federations', bundle.federations],
    ['disciplines', bundle.disciplines],
    ['target-mappings', bundle.targetMappings],
  ] as const) {
    for (const record of records) {
      for (const error of checkCoverage(record)) errors.push(`${dir}/${record.id}.json: ${error}`)
    }
  }
}

/**
 * A round of a report belongs to one projectile: the same round number of the same report (its one
 * source, by sha256) in two range records is a copy error.
 */
function checkRangeRounds(records: RangeFirings[], errors: string[]) {
  const roundOwner = new Map<string, string>()
  for (const r of records) {
    for (const { label: round } of r.rounds) {
      // The base round number: a split reduction "(a)" or a yaw-card mark "*" is part of one round.
      const key = `${r.provenance.sources[0]?.sha256} ${round.replace(/\(.\)|\*/g, '')}`
      const owner = roundOwner.get(key)
      if (owner && owner !== r.id) {
        errors.push(`range/${r.id}.json: round ${round} is also in ${owner}`)
      } else roundOwner.set(key, r.id)
    }
  }
}

/** The findings of duplicate names, cases, capacities, powders and sessions; each is an error. */
function collectFindings(bundle: Bundle, cartridges: Map<string, Cartridge>): LocatedFinding[] {
  const located = (dir: string, id: string, findings: { finding: string; message: string }[]) =>
    findings.map((f) => ({ file: `${dir}/${id}.json`, ...f }))
  return [
    ...checkNames(bundle),
    ...bundle.capacities.flatMap((c) =>
      located('capacities', c.id, checkCapacity(c, cartridges.get(c.cartridge))),
    ),
    ...bundle.cases.flatMap((c) =>
      located(
        'cases',
        c.id,
        checkCase(c, cartridges.get(parseRef(c.cartridge)?.id ?? c.cartridge)),
      ),
    ),
    ...bundle.powders.flatMap((p) => located('powders', p.id, checkPowder(p))),
    ...bundle.chronoSessions.flatMap((s) => located('chrono', s.id, checkChronoSession(s))),
  ]
}

/**
 * Reads, validates and cross-checks every record under `root`, or under each of several roots read
 * as one set (the first holds every kind directory, the second its `load-tables.json`).
 */
export function readRecords(root: string | readonly string[] = recordsDir): ReadRecordsResult {
  const errors: string[] = []
  const roots = typeof root === 'string' ? [root] : [...root]
  const bundle = readBundle(roots, errors)
  const ids = recordIds(bundle)
  for (const c of bundle.cartridges) {
    checkSpecValues(c, errors)
    applyExceptions(c, errors)
  }
  checkSourceCoverage(bundle, errors)
  errors.push(...checkFederations(bundle))
  errors.push(...checkCaliberClasses(bundle))
  checkRenames(bundle, errors)
  const loadRoot = roots[1] ?? roots[0]
  if (loadRoot === undefined) throw new Error('readRecords needs at least one records root')
  const loadTables = readLoadTables(loadRoot, errors)
  for (const p of bundle.powders) {
    for (const error of checkFittedSources(p, loadTables))
      errors.push(`powders/${p.id}.json: ${error}`)
  }
  for (const b of bundle.bullets) {
    for (const f of checkBullet(b)) errors.push(`bullets/${b.id}.json: ${f.finding}: ${f.message}`)
  }
  checkCartridgeReferences(bundle, ids, errors)
  checkManufacturerReferences(bundle, loadTables, ids, errors)
  checkRangeRounds(bundle.rangeFirings, errors)
  checkLoadReferences(bundle, ids, errors)
  checkLoadComponentReferences(bundle, errors)
  checkLoadCapacityReferences(bundle, errors)
  checkLoadSessionReferences(bundle, errors)
  for (const f of collectFindings(bundle, new Map(bundle.cartridges.map((c) => [c.id, c]))))
    errors.push(`${f.file}: ${f.finding}: ${f.message}`)
  return { bundle, errors }
}
