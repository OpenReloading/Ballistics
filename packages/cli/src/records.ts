import { readRecords } from '@open-reloading/data'
import type {
  Bullet,
  Cartridge,
  CatalogueCase,
  CatalogueCaseCapacity,
  Powder,
} from '@open-reloading/schema'
import { parseRef } from '@open-reloading/schema'
import { byText } from './stats.ts'

/** The records a run reads, by id; a cartridge's capacity and case (one with a stated water capacity) are the first by id. */
export interface Records {
  cartridges: Map<string, Cartridge>
  bullets: Map<string, Bullet>
  powders: Map<string, Powder>
  capacities: Map<string, CatalogueCaseCapacity>
  cases: Map<string, CatalogueCase>
  /** Problems the records reader reported; the records that have none still serve. */
  issues: number
}

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((r) => [r.id, r]))

/** The first of `list` by id for each cartridge it names. */
function firstPerCartridge<T extends { id: string; cartridge: string }>(list: T[]) {
  const out = new Map<string, T>()
  for (const r of list.toSorted((a, b) => byText(a.id, b.id))) {
    const cartridge = parseRef(r.cartridge)?.id ?? r.cartridge
    if (!out.has(cartridge)) out.set(cartridge, r)
  }
  return out
}

/** Reads the records of `roots` as one set, or the records of the data package without roots. */
export function loadRecords(roots: readonly string[]): Records {
  const { bundle, errors } = readRecords(roots.length > 0 ? roots : undefined)
  return {
    cartridges: byId(bundle.cartridges),
    bullets: byId(bundle.bullets),
    powders: byId(bundle.powders),
    capacities: firstPerCartridge(bundle.capacities),
    cases: firstPerCartridge(bundle.cases.filter((c) => c.waterCapacity)),
    issues: errors.length,
  }
}
