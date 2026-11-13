import { canonicalJson } from '@open-reloading/schema'
import { bulletWindow } from '@rangefoundry/ballistics'
import { revisionOf } from './derive.ts'
import { sha256 } from './hash.ts'
import { select } from './list.ts'
import {
  type Catalogue,
  type CatalogueData,
  type Catalogued,
  type CatalogueHeader,
  type CatalogueIndex,
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

/** The bullet list: a `cartridge` filter keeps the diameters of its bullet window (`bulletWindow`). */
function bulletList(index: CatalogueIndex): Catalogue['bullets'] {
  const cartridgeItems = new Map(index.cartridges.map((r) => [r.item.id, r.item]))
  return ({ manufacturer, cartridge, ...paging } = {}) => {
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
  }
}

/** The lists of cartridges and components, with their filters. */
function componentLists(
  index: CatalogueIndex,
): Pick<Catalogue, 'cartridges' | 'manufacturers' | 'powders' | 'primers' | 'bullets' | 'cases'> {
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
    bullets: bulletList(index),
    cases: ({ manufacturer, cartridge, ...paging } = {}) =>
      select(
        index.cases,
        paging,
        (c) =>
          (!manufacturer || c.manufacturer === manufacturer) &&
          (!cartridge || c.cartridge === cartridge),
      ),
  }
}

/** The lists of the competition records, with their filters. */
function competitionLists(
  index: CatalogueIndex,
): Pick<
  Catalogue,
  'targetFaces' | 'federations' | 'disciplines' | 'targetMappings' | 'caliberClasses' | 'eventTypes'
> {
  return {
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
    eventTypes: () => select(index.eventTypes, {}),
  }
}

/**
 * Opens a catalogue on an index and a record file: no I/O, the index is used as it is. A record
 * file given as a function is read on the first `get`, so a page that only lists never loads it.
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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a stored record of `kind` with the fields every answer adds
    return { ...record, kind, origin: 'catalogue', revision: revisionOf(record) } as Catalogued<K>
  }
  let dataHash: Promise<string> | undefined
  return {
    ...componentLists(index),
    ...competitionLists(index),
    get,
    capacities: (cartridge) => {
      const ids = Object.hasOwn(index.capacities, cartridge)
        ? index.capacities[cartridge]
        : undefined
      return (ids ?? []).flatMap((id) => get('caseCapacity', id) ?? [])
    },
    dataHash: () =>
      (dataHash ??= (async () => sha256(canonicalJson({ records: load() })))().catch((error) => {
        // a failed read is not kept: the next call tries again
        dataHash = undefined
        throw error
      })),
  }
}
