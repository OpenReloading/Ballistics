import { describe, expect, it } from 'vitest'
import { makerRows } from '../src/maker-rows.ts'
import type { Bundle } from '../src/records.ts'

const maker = { title: 'Maker page', origin: 'manufacturer' }
const book = { title: 'Rule book' }
const cited = (id: string, kind: string, ...sources: object[]) => ({
  id,
  provenance: { kind, sources },
})
const bundleOf = (parts: object) => parts as unknown as Bundle

describe('makerRows', () => {
  it('lists a record that cites a manufacturer, also beside other sources, and keeps the others', () => {
    const rows = makerRows(
      bundleOf({
        bullets: [
          cited('b1', 'published', maker),
          cited('b2', 'published', book, maker),
          cited('b3', 'published', book),
        ],
        cartridges: [cited('c1', 'published', book)],
      }),
    )
    expect(rows).toEqual({ bullets: [{ id: 'b1' }, { id: 'b2' }] })
  })

  it('lists a record that cites a maker or a fitted source without an origin, and keeps the others', () => {
    const open = { title: 'Fit to public data', origin: 'public' }
    const rows = makerRows(
      bundleOf({
        powders: [
          cited('p1', 'derived', maker),
          cited('p2', 'fitted', open),
          cited('p3', 'fitted', book),
          cited('p4', 'derived', { title: 'Fit', kind: 'fitted' }, open),
          cited('p5', 'derived', book),
          cited('p6', 'fitted', open, { title: 'Country page', kind: 'published' }),
        ],
      }),
    )
    expect(rows).toEqual({ powders: [{ id: 'p1' }, { id: 'p3' }, { id: 'p4' }] })
  })

  it('keeps manufacturer records as identity records', () => {
    expect(makerRows(bundleOf({ manufacturers: [cited('m1', 'published', maker)] }))).toEqual({})
  })
})
