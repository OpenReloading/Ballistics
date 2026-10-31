import { bulletWindow } from '@open-reloading/core'
import { canonicalJson, sha256 } from '../hash.ts'
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
    const record = Object.hasOwn(byId, id) ? byId[id] : undefined
    if (record === undefined) return undefined
    return { ...record, kind, origin: 'catalogue', revision: revisionOf(record) } as Catalogued<K>
  }
  let dataHash: Promise<string> | undefined
  const cartridgeItems = new Map(index.cartridges.map((r) => [r.item.id, r.item]))
  return {
    cartridges: ({ table, ...paging } = {}) =>
      select(index.cartridges, paging, (c) => !table || c.table === table),
    manufacturers: () => select(index.manufacturers, {}),
    powders: ({ manufacturer, ...paging } = {}) =>
      select(index.powders, paging, (p) => !manufacturer || p.manufacturer === manufacturer),
    primers: ({ manufacturer, size, compound, ...paging } = {}) =>
      select(
        index.primers,
        paging,
        (p) =>
          (!manufacturer || p.manufacturer === manufacturer) &&
          (!size || p.size === size) &&
          (!compound || p.compound === compound),
      ),
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
          (window === undefined ||
            (b.diameter !== null && b.diameter > window.above && b.diameter <= window.upTo)),
      )
    },
    cases: ({ manufacturer, cartridge, ...paging } = {}) =>
      select(
        index.cases,
        paging,
        (c) =>
          (!manufacturer || c.manufacturer === manufacturer) &&
          (!cartridge || c.cartridge === cartridge),
      ),
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
    caliberClasses: () => select(index.caliberClasses, {}),
    get,
    renamed: (kind, id) => {
      const map = (index.renames as Record<string, Record<string, string> | undefined>)[kind]
      return map && Object.hasOwn(map, id) ? map[id] : undefined
    },
    capacities: (cartridge) => {
      const ids = Object.hasOwn(index.capacities, cartridge)
        ? index.capacities[cartridge]
        : undefined
      return (ids ?? []).flatMap((id) => get('caseCapacity', id) ?? [])
    },
    dataHash: () =>
      (dataHash ??= (async () =>
        sha256(canonicalJson({ records: load(), renames: index.renames })))().catch((error) => {
        // a failed read is not kept: the next call tries again
        dataHash = undefined
        throw error
      })),
  }
}
