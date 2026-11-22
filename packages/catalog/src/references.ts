import { parseRef } from '@rangefoundry/schema'
import type { LoadTables } from './load-tables.ts'
import type { Bundle } from './records.ts'

// Federation, discipline and target mapping references are checked with their other rules in checkFederations (federations.ts).

/** The ids a record may reference, by kind. */
type RecordIds = {
  cartridges: Set<string>
  cases: Set<string>
  loads: Set<string>
  manufacturers: Set<string>
}

/** The ids of the referenced kinds in `bundle`. */
export function recordIds(
  bundle: Pick<Bundle, 'cartridges' | 'cases' | 'loads' | 'manufacturers'>,
): RecordIds {
  return {
    cartridges: new Set(bundle.cartridges.map((c) => c.id)),
    cases: new Set(bundle.cases.map((c) => c.id)),
    loads: new Set(bundle.loads.map((l) => l.id)),
    manufacturers: new Set(bundle.manufacturers.map((m) => m.id)),
  }
}

/** The cartridge of every case, capacity, load and firing series, and the cartridges a powder is listed for. */
export function checkCartridgeReferences(
  bundle: Pick<Bundle, 'cartridges' | 'cases' | 'capacities' | 'loads' | 'firings' | 'powders'>,
  ids: RecordIds,
  errors: string[],
): void {
  const unknown = (dir: string, id: string, cartridge: string, found: string | undefined) => {
    if (!ids.cartridges.has(found ?? cartridge))
      errors.push(`${dir}/${id}.json: unknown cartridge "${cartridge}"`)
  }
  for (const r of bundle.firings) unknown('firings', r.id, r.cartridge, undefined)
  // a case, a capacity and a load name their cartridge by reference
  for (const c of bundle.cases) unknown('cases', c.id, c.cartridge, parseRef(c.cartridge)?.id)
  for (const c of bundle.capacities)
    unknown('capacities', c.id, c.cartridge, parseRef(c.cartridge)?.id)
  for (const l of bundle.loads) unknown('loads', l.id, l.cartridge, parseRef(l.cartridge)?.id)
  checkListedCartridges(bundle.powders, ids, errors)
}

/** The cartridges a powder is listed for. */
function checkListedCartridges(powders: Bundle['powders'], ids: RecordIds, errors: string[]) {
  for (const p of powders)
    for (const c of p.listedCartridges ?? [])
      if (!ids.cartridges.has(c))
        errors.push(`powders/${p.id}.json: unknown listed cartridge "${c}"`)
}

/** The bullet and powder of every load that names a record. */
export function checkLoadComponentReferences(
  bundle: Pick<Bundle, 'loads' | 'bullets' | 'powders'>,
  errors: string[],
): void {
  const known = {
    bullet: new Set(bundle.bullets.map((b) => b.id)),
    powder: new Set(bundle.powders.map((p) => p.id)),
  }
  for (const l of bundle.loads)
    for (const k of ['bullet', 'powder'] as const) {
      const target = l[k]
      if (typeof target === 'string' && !known[k].has(parseRef(target)?.id ?? target))
        errors.push(`loads/${l.id}.json: unknown ${k} "${target}"`)
    }
}

/** The primer of every load that names one. */
export function checkLoadPrimerReferences(
  bundle: Pick<Bundle, 'loads' | 'primers'>,
  errors: string[],
): void {
  const known = new Set(bundle.primers.map((p) => p.id))
  for (const l of bundle.loads) {
    const record = l.primer?.record
    if (record !== undefined && !known.has(parseRef(record)?.id ?? record))
      errors.push(`loads/${l.id}.json: unknown primer "${record}"`)
  }
}

/** The capacity of every load that names one. */
export function checkLoadCapacityReferences(
  bundle: Pick<Bundle, 'loads' | 'capacities'>,
  errors: string[],
): void {
  const known = new Set(bundle.capacities.map((c) => c.id))
  for (const l of bundle.loads)
    if (l.capacity !== undefined && !known.has(parseRef(l.capacity)?.id ?? l.capacity))
      errors.push(`loads/${l.id}.json: unknown capacity "${l.capacity}"`)
}

/** The default capacity of every cartridge is a published or measured capacity of it; from a single root, a cartridge with such a record names one. */
export function checkDefaultCapacityReferences(
  bundle: Pick<Bundle, 'cartridges' | 'capacities'>,
  singleRoot: boolean,
  errors: string[],
): void {
  const known = new Map(bundle.capacities.map((c) => [c.id, c]))
  const eligible = bundle.capacities.filter(canBeDefault)
  const withCapacity = new Set(eligible.map((c) => parseRef(c.cartridge)?.id ?? c.cartridge))
  for (const c of bundle.cartridges) {
    const named = c.defaults?.capacity
    if (named !== undefined) checkNamedDefault(c.id, named, known, errors)
    else if (singleRoot && withCapacity.has(c.id))
      errors.push(
        `cartridges/${c.id}.json: has a published or measured capacity and names no default capacity`,
      )
  }
}

/** Whether a capacity can be a default: published or measured, so never an estimate. */
const canBeDefault = ({ provenance }: Bundle['capacities'][number]) =>
  provenance?.kind === 'published' || provenance?.kind === 'measured'

/** The default capacity `named` of one cartridge, among the `known` capacities. */
function checkNamedDefault(
  cartridge: string,
  named: string,
  known: ReadonlyMap<string, Bundle['capacities'][number]>,
  errors: string[],
) {
  const where = `cartridges/${cartridge}.json`
  const capacity = known.get(parseRef(named)?.id ?? named)
  if (!capacity) errors.push(`${where}: unknown default capacity "${named}"`)
  else if (parseRef(capacity.cartridge)?.id !== cartridge)
    errors.push(`${where}: default capacity "${named}" is a capacity of another cartridge`)
  else if (!canBeDefault(capacity))
    errors.push(`${where}: default capacity "${named}" is neither published nor measured`)
}

/** The case record of every load that names one: it exists and is a case of the load's cartridge. */
export function checkLoadCaseReferences(
  bundle: Pick<Bundle, 'loads' | 'cases'>,
  ids: RecordIds,
  errors: string[],
): void {
  const cartridgeOfCase = new Map(
    bundle.cases.map((c) => [c.id, parseRef(c.cartridge)?.id ?? c.cartridge]),
  )
  for (const l of bundle.loads) {
    const record = l.case?.record
    if (record === undefined) continue
    const id = parseRef(record)?.id ?? record
    if (!ids.cases.has(id)) errors.push(`loads/${l.id}.json: unknown case "${record}"`)
    else if (cartridgeOfCase.get(id) !== (parseRef(l.cartridge)?.id ?? l.cartridge))
      errors.push(`loads/${l.id}.json: case "${record}" is a case of another cartridge`)
  }
}

/** The session of every load that names one. */
export function checkLoadSessionReferences(
  bundle: Pick<Bundle, 'loads' | 'chronoSessions'>,
  errors: string[],
): void {
  const known = new Set(bundle.chronoSessions.map((s) => s.id))
  for (const l of bundle.loads)
    for (const ref of l.sessions ?? [])
      if (!known.has(parseRef(ref)?.id ?? ref))
        errors.push(`loads/${l.id}.json: unknown session "${ref}"`)
}

/** The load of every shot string of a chronograph session. */
export function checkLoadReferences(
  bundle: Pick<Bundle, 'chronoSessions'>,
  ids: RecordIds,
  errors: string[],
): void {
  for (const session of bundle.chronoSessions) {
    for (const string of session.strings) {
      if (!ids.loads.has(parseRef(string.load)?.id ?? string.load)) {
        errors.push(`chrono/${session.id}.json: unknown load "${string.load}"`)
      }
    }
  }
}

/** Checks that `id`, where given, names a manufacturer record; the error names `where` and `field`. */
type MakerCheck = (where: string, field: string, id: string | undefined) => void

/** The manufacturers a load names: a described bullet or powder and the case. */
function checkLoadMakers(
  l: Pick<Bundle['loads'][number], 'id' | 'bullet' | 'powder' | 'case'>,
  check: MakerCheck,
) {
  const named = [
    ['bullet.manufacturer', typeof l.bullet === 'object' ? l.bullet.manufacturer : undefined],
    ['powder.manufacturer', typeof l.powder === 'object' ? l.powder.manufacturer : undefined],
    ['case.manufacturer', l.case?.manufacturer],
  ] as const
  for (const [field, maker] of named)
    check(`loads/${l.id}.json`, field, maker && parseRef(maker)?.id)
}

/** The manufacturer of every powder, primer, bullet and case, and the case manufacturer of a capacity. */
function checkComponentMakers(
  bundle: Pick<Bundle, 'powders' | 'primers' | 'bullets' | 'cases' | 'capacities'>,
  check: MakerCheck,
) {
  for (const p of bundle.powders) check(`powders/${p.id}.json`, 'manufacturer', p.manufacturer)
  for (const p of bundle.primers) check(`primers/${p.id}.json`, 'manufacturer', p.manufacturer)
  for (const b of bundle.bullets) check(`bullets/${b.id}.json`, 'manufacturer', b.manufacturer)
  for (const c of bundle.cases)
    check(`cases/${c.id}.json`, 'manufacturer', parseRef(c.manufacturer)?.id)
  for (const c of bundle.capacities)
    check(
      `capacities/${c.id}.json`,
      'caseManufacturer',
      c.caseManufacturer && (parseRef(c.caseManufacturer)?.id ?? c.caseManufacturer),
    )
}

/** Of every powder (and of its burn-rate charts), primer, bullet, case and listed load table, the case manufacturer of a capacity, the device manufacturer of a chronograph session and the manufacturers a load names (a described bullet or powder and the case). */
export function checkManufacturerReferences(
  bundle: Pick<
    Bundle,
    'powders' | 'primers' | 'bullets' | 'cases' | 'capacities' | 'chronoSessions' | 'loads'
  >,
  loadTables: LoadTables,
  ids: RecordIds,
  errors: string[],
): void {
  const check: MakerCheck = (where, field, id) => {
    if (id !== undefined && !ids.manufacturers.has(id))
      errors.push(`${where}: unknown ${field} "${id}"`)
  }
  checkComponentMakers(bundle, check)
  for (const p of bundle.powders)
    for (const c of p.burnRateCharts ?? [])
      check(`powders/${p.id}.json`, 'burn-rate chart manufacturer', c.chart.manufacturer)
  for (const s of bundle.chronoSessions)
    check(`chrono/${s.id}.json`, 'device.manufacturer', parseRef(s.device.manufacturer)?.id)
  for (const l of bundle.loads) checkLoadMakers(l, check)
  for (const [file, table] of Object.entries(loadTables))
    check(`load-tables.json: ${file}`, 'manufacturer', table.manufacturer)
}
