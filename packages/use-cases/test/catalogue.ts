import type { Bundle, Catalogue } from '@open-reloading/catalog'

const lists = {
  cartridge: 'cartridges',
  manufacturer: 'manufacturers',
  powder: 'powders',
  bullet: 'bullets',
} as const

/** `data` as a catalogue: `get` of the kinds the use cases look up, the one call they make. */
export function testCatalogue(data: Bundle): Catalogue {
  const get = (kind: keyof typeof lists, id: string) => {
    const record = (data[lists[kind]] as { id: string }[]).find((r) => r.id === id)
    return record && { ...record, kind, origin: 'catalogue', revision: 'test' }
  }
  return { get } as unknown as Catalogue
}
