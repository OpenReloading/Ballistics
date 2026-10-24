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
  for (const [dir, records] of [
    ['capacities', bundle.capacities],
    ['loads', bundle.loads],
    ['firings', bundle.firings],
  ] as const) {
    for (const record of records) {
      if (!ids.cartridges.has(record.cartridge)) {
        errors.push(`${dir}/${record.id}.json: unknown cartridge "${record.cartridge}"`)
      }
    }
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
