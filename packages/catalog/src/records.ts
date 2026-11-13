import type {
  Bullet,
  CaliberClass,
  Cartridge,
  CatalogueCase,
  CatalogueCaseCapacity,
  CatalogueLoad,
  CatalogueSession,
  Discipline,
  EventType,
  Federation,
  FiringSeries,
  LoadTables,
  Manufacturer,
  Powder,
  Primer,
  RangeFirings,
  TargetFace,
  TargetMapping,
} from '@rangefoundry/schema'
import { parseRef } from '@rangefoundry/schema'
import { checkCaliberClasses } from './caliber-classes.ts'
import { checkCoverage } from './coverage.ts'
import { checkEventTypes } from './event-types.ts'
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
import {
  checkPublishedLoadPlausibility,
  checkPublishedLoads,
  type LocatedPublishedLoads,
} from './published-loads.ts'
import {
  checkCartridgeReferences,
  checkLoadCapacityReferences,
  checkLoadCaseReferences,
  checkLoadComponentReferences,
  checkLoadPrimerReferences,
  checkLoadReferences,
  checkLoadSessionReferences,
  checkManufacturerReferences,
  recordIds,
} from './references.ts'

/** The records of a records root, one array per kind. */
export type Bundle = {
  cartridges: Cartridge[]
  caliberClasses: CaliberClass[]
  manufacturers: Manufacturer[]
  powders: Powder[]
  primers: Primer[]
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
  /** Event types of competitions (`records/event-types/`); absent: none. */
  eventTypes?: EventType[] | undefined
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
    ['primers', bundle.primers],
    ['bullets', bundle.bullets],
    ['cases', bundle.cases],
    ['capacities', bundle.capacities],
    ['federations', bundle.federations],
    ['disciplines', bundle.disciplines],
    ['target-mappings', bundle.targetMappings],
    ['event-types', bundle.eventTypes ?? []],
  ] as const) {
    for (const record of records) {
      for (const error of checkCoverage(record)) errors.push(`${dir}/${record.id}.json: ${error}`)
    }
  }
}

/** The same round number of the same report (its one source, by sha256) in two range records is a copy error, as a round belongs to one projectile. */
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

/** The findings of the record `<dir>/<id>.json`. */
const located = (dir: string, id: string, findings: { finding: string; message: string }[]) =>
  findings.map((f) => ({ file: `${dir}/${id}.json`, ...f }))

/** The findings of duplicate names, cases, capacities, powders and sessions; each is an error. */
function collectFindings(bundle: Bundle, cartridges: Map<string, Cartridge>): LocatedFinding[] {
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

/** The references between records: cartridges, manufacturers, range rounds, loads and their parts. */
function checkReferences(
  bundle: Bundle,
  ids: ReturnType<typeof recordIds>,
  loadTables: LoadTables,
  errors: string[],
) {
  checkCartridgeReferences(bundle, ids, errors)
  checkManufacturerReferences(bundle, loadTables, ids, errors)
  checkRangeRounds(bundle.rangeFirings, errors)
  checkLoadReferences(bundle, ids, errors)
  checkLoadComponentReferences(bundle, errors)
  checkLoadPrimerReferences(bundle, errors)
  checkLoadCapacityReferences(bundle, errors)
  checkLoadCaseReferences(bundle, ids, errors)
  checkLoadSessionReferences(bundle, errors)
}

/** What the checks of {@link checkRecords} take: the records, the published load files and the load tables. */
export type RecordsRead = {
  bundle: Bundle
  published: LocatedPublishedLoads[]
  loadTables: LoadTables
}

/**
 * Cross-checks records read from a records root. Valid data has no errors; the warnings are
 * plausibility findings that do not fail validation, as a published load stays as printed.
 */
export function checkRecords({ bundle, published, loadTables }: RecordsRead): {
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const ids = recordIds(bundle)
  for (const c of bundle.cartridges) {
    checkSpecValues(c, errors)
    applyExceptions(c, errors)
  }
  checkSourceCoverage(bundle, errors)
  errors.push(...checkFederations(bundle))
  errors.push(...checkEventTypes(bundle))
  errors.push(...checkCaliberClasses(bundle))
  for (const p of bundle.powders) {
    for (const error of checkFittedSources(p, loadTables))
      errors.push(`powders/${p.id}.json: ${error}`)
  }
  for (const b of bundle.bullets) {
    for (const f of checkBullet(b)) errors.push(`bullets/${b.id}.json: ${f.finding}: ${f.message}`)
  }
  checkReferences(bundle, ids, loadTables, errors)
  checkPublishedLoads(
    published,
    {
      cartridges: ids.cartridges,
      manufacturers: ids.manufacturers,
      bullets: bundle.bullets,
      powders: bundle.powders,
      primers: bundle.primers,
    },
    errors,
  )
  const cartridges = new Map(bundle.cartridges.map((c) => [c.id, c]))
  for (const f of collectFindings(bundle, cartridges))
    errors.push(`${f.file}: ${f.finding}: ${f.message}`)
  const warnings = published.flatMap(({ folder, file }) =>
    checkPublishedLoadPlausibility(file, cartridges.get(folder)).map(
      (f) => `loads/${folder}/${file.id}.json: loads ${f.load}: ${f.finding}: ${f.message}`,
    ),
  )
  return { errors, warnings }
}
