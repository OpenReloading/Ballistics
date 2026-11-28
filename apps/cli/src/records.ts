import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Bundle } from '@rangefoundry/catalog'
import { holdsEveryKind, type ReadRecordsResult, readRecords } from '@rangefoundry/catalog-files'
import type {
  Bullet,
  Cartridge,
  CatalogueCase,
  CatalogueCaseCapacity,
  Powder,
  PublishedLoads,
} from '@rangefoundry/schema'
import { compareKeys, defaultCapacity, isEstimatedCapacity, parseRef } from '@rangefoundry/schema'
import { DataError, NoInputError } from './errors.ts'

/** The records a run reads, by id; a cartridge's capacity is its default (`defaultCapacity`), only without one its case is the first by id with a stated water capacity, and with neither its capacity is an estimate. */
export interface Records {
  cartridges: Map<string, Cartridge>
  bullets: Map<string, Bullet>
  powders: Map<string, Powder>
  capacities: Map<string, CatalogueCaseCapacity>
  cases: Map<string, CatalogueCase>
  /** The published load files of the records. */
  published: PublishedLoads[]
  /** Problems the records reader reported; the records that have none still serve. */
  issues: number
}

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((r) => [r.id, r]))

/** The id of the cartridge a record names. */
const cartridgeIdOf = (record: { cartridge: string }) =>
  parseRef(record.cartridge)?.id ?? record.cartridge

/** The first of `list` by id for each cartridge it names. */
function firstPerCartridge<T extends { id: string; cartridge: string }>(list: T[]) {
  const out = new Map<string, T>()
  for (const r of list.toSorted((a, b) => compareKeys(a.id, b.id))) {
    const cartridge = cartridgeIdOf(r)
    if (!out.has(cartridge)) out.set(cartridge, r)
  }
  return out
}

/** `records` without their estimated capacities, which a fit does not read. */
export const withoutEstimates = (records: Records): Records => ({
  ...records,
  capacities: new Map([...records.capacities].filter(([, c]) => !isEstimatedCapacity(c))),
})

/** The bundle of the installed `@rangefoundry/catalog`, resolved from this module and never from the working directory. */
const catalogBundle = (): Bundle =>
  JSON.parse(
    readFileSync(fileURLToPath(import.meta.resolve('@rangefoundry/catalog/bundle.json')), 'utf8'),
  )

/** Whether the first of `roots` holds every kind directory, as the records folder of a repository clone: it then replaces the catalog bundle. */
export const fullRoot = (roots: readonly string[]) =>
  roots[0] !== undefined && holdsEveryKind(roots[0])

/** Reads the records of `roots` as one set: a first root with every kind directory replaces the catalog bundle, other roots add their records to it, and without roots the bundle alone; a `NoInputError` for a root that is not a folder, a `DataError` for a record file that is not JSON. */
export function readBundle(
  roots: readonly string[],
): Pick<ReadRecordsResult, 'bundle' | 'errors' | 'publishedLoads'> {
  for (const [i, root] of roots.entries())
    if (!statSync(root, { throwIfNoEntry: false })?.isDirectory())
      // NOSONAR: the path is the argument the user gave
      throw new NoInputError(
        `the --records path${roots.length > 1 ? ` ${i + 1} of ${roots.length}` : ''} (or BALLISTICS_RECORDS) does not exist or is not a folder`,
      )
  if (roots.length === 0) return { bundle: catalogBundle(), errors: [], publishedLoads: [] }
  const read = fullRoot(roots) ? readRecords(roots) : readRecords(roots, catalogBundle())
  const unparsed = read.errors.filter((e) => e.includes(': invalid JSON: '))
  if (unparsed.length > 0)
    throw new DataError(`a file of the --records roots is not JSON: ${unparsed[0]}`, {
      files: unparsed.map((e) => e.slice(0, e.indexOf(': invalid JSON: '))),
    })
  return read
}

/** The records of {@link readBundle} by id. */
export function loadRecords(roots: readonly string[]): Records {
  const { bundle, errors, publishedLoads } = readBundle(roots)
  const cartridges = byId(bundle.cartridges)
  const capacitiesOf = new Map<string, CatalogueCaseCapacity[]>()
  for (const c of bundle.capacities) {
    const id = cartridgeIdOf(c)
    capacitiesOf.set(id, [...(capacitiesOf.get(id) ?? []), c])
  }
  const capacities = new Map<string, CatalogueCaseCapacity>()
  for (const [id, cartridge] of cartridges) {
    const capacity = defaultCapacity(cartridge, capacitiesOf.get(id) ?? [])
    if (capacity) capacities.set(id, capacity)
  }
  const cases = firstPerCartridge(
    bundle.cases.filter((c) => c.waterCapacity && !capacities.has(cartridgeIdOf(c))),
  )
  const estimates = firstPerCartridge(bundle.capacities.filter(isEstimatedCapacity))
  for (const [cartridge, estimate] of estimates)
    if (!capacities.has(cartridge) && !cases.has(cartridge)) capacities.set(cartridge, estimate)
  return {
    cartridges,
    bullets: byId(bundle.bullets),
    powders: byId(bundle.powders),
    capacities,
    cases,
    published: publishedLoads,
    issues: errors.length,
  }
}
