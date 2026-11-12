import type { ArrayColumns } from '@open-reloading/ui'

const kinds = ['FMJ', 'HPBT', 'SP', 'VLD', 'Solid', 'Wadcutter'] as const

/** A bullet-shaped row: two text, four numeric, one enumerated and one date column. */
export interface GridRow {
  readonly index: number
  readonly name: string
  readonly maker: string
  readonly diameter: number
  readonly weight: number
  readonly bc: number
  readonly length: number
  readonly kind: (typeof kinds)[number]
  readonly released: string
}

const syllables = ['ka', 'lo', 'mer', 'tis', 'van', 'dor', 'ex', 'ru', 'sil', 'qua', 'bel', 'nor']
const makers = ['Arden', 'Brisk', 'Corvo', 'Dunmore', 'Elkhart', 'Fenwick', 'Galt', 'Holloway']
const day = 86_400_000
const firstDay = Date.UTC(1990, 0, 1)

// mulberry32: a small seeded generator, so every run builds the same 200,000 rows
function generator(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function generateRows(count: number, seed = 9): GridRow[] {
  const next = generator(seed)
  const pick = <T>(list: readonly T[]) => list[Math.floor(next() * list.length)] as T
  return Array.from({ length: count }, (_, index) => {
    const name = `${pick(syllables)}${pick(syllables)}${pick(syllables)} ${String(index).padStart(6, '0')}`
    return {
      index,
      name: name[0]?.toUpperCase() + name.slice(1),
      maker: pick(makers),
      diameter: Math.round((5 + next() * 8) * 100) / 100,
      weight: Math.round(30 + next() * 470),
      bc: Math.round((0.1 + next() * 0.7) * 1000) / 1000,
      length: Math.round((10 + next() * 40) * 10) / 10,
      kind: pick(kinds),
      released: new Date(firstDay + Math.floor(next() * 12_000) * day).toISOString().slice(0, 10),
    }
  })
}

/** How `arraySource` filters and sorts these rows: a case-blind substring on the text columns. */
export const gridColumns: ArrayColumns<GridRow> = {
  matches: (row, id, value) => {
    const cell = row[id as keyof GridRow]
    return String(cell).toLowerCase().includes(String(value).toLowerCase())
  },
  sortKey: (row, id) => row[id as keyof GridRow],
}
