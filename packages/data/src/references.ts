import { parseRef } from '@openreloading/schema'
import type { LoadTables } from './load-tables.ts'
import type { Bundle } from './records.ts'

// Federation, discipline and target mapping references are checked with their other rules in
// checkFederations (federations.ts).

/** The ids a record may reference, by kind: the records and the ids `renames.json` replaces. */
type RecordIds = {
  cartridges: Set<string>
  loads: Set<string>
  manufacturers: Set<string>
}

/** The ids of the referenced kinds in `bundle`. */
export function recordIds(
  bundle: Pick<Bundle, 'cartridges' | 'loads' | 'manufacturers' | 'renames'>,
): RecordIds {
  const renamed = (kind: 'cartridges' | 'manufacturers') =>
    Object.keys(bundle.renames?.[kind] ?? {})
  return {
    cartridges: new Set([...bundle.cartridges.map((c) => c.id), ...renamed('cartridges')]),
    loads: new Set(bundle.loads.map((l) => l.id)),
    manufacturers: new Set([...bundle.manufacturers.map((m) => m.id), ...renamed('manufacturers')]),
  }
}

/** The cartridge of every capacity, load and firing series. */
export function checkCartridgeReferences(
  bundle: Pick<Bundle, 'capacities' | 'loads' | 'firings'>,
  ids: RecordIds,
  errors: string[],
) {
  const unknown = (dir: string, id: string, cartridge: string, found: string | undefined) => {
    if (!ids.cartridges.has(found ?? cartridge))
      errors.push(`${dir}/${id}.json: unknown cartridge "${cartridge}"`)
  }
  for (const [dir, records] of [
    ['capacities', bundle.capacities],
    ['firings', bundle.firings],
  ] as const)
    for (const r of records) unknown(dir, r.id, r.cartridge, undefined)
  // a load names its cartridge by reference
  for (const l of bundle.loads) unknown('loads', l.id, l.cartridge, parseRef(l.cartridge)?.id)
}

/** The bullet and powder of every load that names a record. */
export function checkLoadComponentReferences(
  bundle: Pick<Bundle, 'loads' | 'bullets' | 'powders'>,
  errors: string[],
) {
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

/** The load of every shot string of a chronograph session. */
export function checkLoadReferences(
  bundle: Pick<Bundle, 'chronoSessions'>,
  ids: RecordIds,
  errors: string[],
) {
  for (const session of bundle.chronoSessions) {
    for (const string of session.strings) {
      if (!ids.loads.has(string.load)) {
        errors.push(`chrono/${session.id}.json: unknown load "${string.load}"`)
      }
    }
  }
}

/** The manufacturer of every powder, bullet and listed load table, and the case manufacturer of a capacity. */
export function checkManufacturerReferences(
  bundle: Pick<Bundle, 'powders' | 'bullets' | 'capacities'>,
  loadTables: LoadTables,
  ids: RecordIds,
  errors: string[],
) {
  const check = (where: string, field: string, id: string | undefined) => {
    if (id !== undefined && !ids.manufacturers.has(id))
      errors.push(`${where}: unknown ${field} "${id}"`)
  }
  for (const p of bundle.powders) check(`powders/${p.id}.json`, 'manufacturer', p.manufacturer)
  for (const b of bundle.bullets) check(`bullets/${b.id}.json`, 'manufacturer', b.manufacturer)
  for (const c of bundle.capacities)
    check(`capacities/${c.id}.json`, 'caseManufacturer', c.caseManufacturer)
  // load-tables.json is read without a schema: a table without the id is an error, not skipped
  for (const [file, table] of Object.entries(loadTables)) {
    const where = `load-tables.json: ${file}`
    if (typeof table.manufacturer !== 'string') errors.push(`${where}: needs a manufacturer id`)
    else check(where, 'manufacturer', table.manufacturer)
  }
}
