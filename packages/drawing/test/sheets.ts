import { readdirSync, readFileSync } from 'node:fs'
import type { Figure, Side } from '../src/cartridge/figures.ts'
import type { SpecValue } from '../src/core/types.ts'

/** A cartridge record as `recordFigures` reads it: `id` is its C.I.P. sheet id. */
export interface SpecRecord {
  id: string
  standard: string
  table?: string
  values: (SpecValue & { side?: Side })[]
}

const dir = new URL('../../data/records/cartridges/', import.meta.url)

function read(file: string): SpecRecord {
  const c = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as SpecRecord & {
    id: string
    published: string
    revised?: string
  }
  // the figure ids carry the sheet id, `cip-<cartridge id>-<revised or published date>`
  return { ...c, id: `cip-${c.id}-${c.revised ?? c.published}`, standard: 'CIP' }
}

/** Every cartridge record, in the order of its sheet id. */
export const sheets = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map(read)
  .sort((a, b) => (a.id < b.id ? -1 : 1))

/** The record of a sheet id. */
export function sheet(id: string) {
  const record = sheets.find((r) => r.id === id)
  if (!record) throw new Error(`no record for sheet ${id}`)
  return record
}

/** The stored values the figures of a record do not dimension, a side not drawn included. */
export function undimensionedValues<V extends SpecValue>(values: V[], list: Figure[]) {
  const drawn = new Set<SpecValue>()
  for (const { drawn: sides } of list)
    for (const { p } of sides) {
      const { dimensions, angles, radii } = p.annotation
      for (const d of [...dimensions, ...angles, ...radii]) if (d.stored) drawn.add(d.stored)
    }
  return new Set(values.filter((v) => v.side && !drawn.has(v)))
}
