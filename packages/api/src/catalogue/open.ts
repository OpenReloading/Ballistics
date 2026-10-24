import { bulletWindow } from '@openreloading/core'
import { revisionOf } from './derive.ts'
import { select } from './list.ts'
import {
  type Catalogue,
  type CatalogueData,
  type Catalogued,
  type CatalogueHeader,
  type CatalogueKind,
  catalogueFormat,
  deriveVersion,
  type RecordFile,
} from './types.ts'

/** Refuses a file that another format or another version of the derivation built. */
function checkHeader(what: string, file: Partial<CatalogueHeader>) {
  if (file.format !== catalogueFormat)
    throw new Error(`catalogue ${what} format ${file.format} is not ${catalogueFormat}: rebuild it`)
  if (file.derive !== deriveVersion)
    throw new Error(
      `catalogue ${what} derive version ${file.derive} is not ${deriveVersion}: rebuild it`,
    )
}

/**
 * Opens a catalogue on an index and a record file: no I/O, the index is used as it is (a few
 * milliseconds for a parsed prebuilt one). A record file given as a function is read on the first
 * `get`, so a page that only lists never loads it.
 */
export function openCatalogue({ index, records }: CatalogueData): Catalogue {
  checkHeader('index', index)
  let file: RecordFile | undefined
  const load = () => {
    if (!file) {
      const read = typeof records === 'function' ? records() : records
      checkHeader('record file', read)
      file = read
    }
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
      select(index.cartridges, paging, (c) => !table || c.table === table),
    manufacturers: () => select(index.manufacturers, {}),
    powders: ({ manufacturer, ...paging } = {}) =>
      select(index.powders, paging, (p) => !manufacturer || p.manufacturer === manufacturer),
    bullets: ({ manufacturer, cartridge, ...paging } = {}) => {
      let window: ReturnType<typeof bulletWindow> | undefined
      if (cartridge) {
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
          (!manufacturer || b.manufacturer === manufacturer) &&
          (window === undefined || (b.diameter > window.above && b.diameter <= window.upTo)),
      )
    },
    targetFaces: () => select(index.targetFaces, {}),
    federations: () => select(index.federations, {}),
    disciplines: ({ federation } = {}) =>
      select(index.disciplines, {}, (d) => !federation || d.federation === federation),
    targetMappings: ({ discipline, face } = {}) =>
      select(
        index.targetMappings,
        {},
        (m) => (!discipline || m.discipline === discipline) && (!face || m.face === face),
      ),
    get,
    renamed: (kind, id) => {
      const map = index.renames[kind]
      return map && Object.hasOwn(map, id) ? map[id] : undefined
    },
    capacities: (cartridge) =>
      (Object.hasOwn(index.capacities, cartridge) ? index.capacities[cartridge] : []).flatMap(
        (id) => get('caseCapacity', id) ?? [],
      ),
  }
}
