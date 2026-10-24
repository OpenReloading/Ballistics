import { bulletWindow } from '@openreloading/core'
import { revisionOf } from './derive.ts'
import { select } from './list.ts'
import {
  type Catalogue,
  type CatalogueData,
  type Catalogued,
  type CatalogueKind,
  catalogueFormat,
  type RecordFile,
} from './types.ts'

/**
 * Opens a catalogue on an index and a record file: no I/O, the index is used as it is (a few
 * milliseconds for a parsed prebuilt one). A record file given as a function is read on the first
 * `get`, so a page that only lists never loads it.
 */
export function openCatalogue({ index, records }: CatalogueData): Catalogue {
  if (index.format !== catalogueFormat)
    throw new Error(`catalogue index format ${index.format} is not ${catalogueFormat}`)
  let file: RecordFile | undefined
  const load = () => {
    file ??= typeof records === 'function' ? records() : records
    return file
  }
  const get = <K extends CatalogueKind>(kind: K, id: string): Catalogued<K> | undefined => {
    const byId = load()[kind] as Record<string, object>
    if (!Object.hasOwn(byId, id)) return undefined
    const record = byId[id]
    return { ...record, kind, origin: 'catalogue', revision: revisionOf(record) } as Catalogued<K>
  }
  const cartridgeItems = new Map(index.cartridges.map((r) => [r.item.id, r.item]))
  return {
    cartridges: ({ table, ...paging } = {}) =>
      select(index.cartridges, paging, (c) => table === undefined || c.table === table),
    manufacturers: () => select(index.manufacturers, {}),
    powders: ({ manufacturer, ...paging } = {}) =>
      select(
        index.powders,
        paging,
        (p) => manufacturer === undefined || p.manufacturer === manufacturer,
      ),
    bullets: ({ manufacturer, cartridge, ...paging } = {}) => {
      let window: ReturnType<typeof bulletWindow> | undefined
      if (cartridge !== undefined) {
        const c = cartridgeItems.get(cartridge)
        const { maxBulletDiameter: g1, boreDiameter: land, grooveDiameter: groove } = c ?? {}
        if (g1 === undefined || land === undefined || groove === undefined)
          return { total: 0, items: [] }
        window = bulletWindow({ g1, land, groove })
      }
      return select(
        index.bullets,
        paging,
        (b) =>
          (manufacturer === undefined || b.manufacturer === manufacturer) &&
          (window === undefined || (b.diameter > window.above && b.diameter <= window.upTo)),
      )
    },
    targetFaces: () => select(index.targetFaces, {}),
    federations: () => select(index.federations, {}),
    disciplines: ({ federation } = {}) =>
      select(index.disciplines, {}, (d) => federation === undefined || d.federation === federation),
    targetMappings: ({ discipline, face } = {}) =>
      select(
        index.targetMappings,
        {},
        (m) =>
          (discipline === undefined || m.discipline === discipline) &&
          (face === undefined || m.face === face),
      ),
    get,
    capacities: (cartridge) =>
      (Object.hasOwn(index.capacities, cartridge) ? index.capacities[cartridge] : []).flatMap(
        (id) => get('caseCapacity', id) ?? [],
      ),
  }
}
