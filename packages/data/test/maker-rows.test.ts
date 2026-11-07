import { describe, expect, it } from 'vitest'
import { makerRows } from '../src/maker-rows.ts'
import { type Bundle, readRecords } from '../src/records.ts'

const maker = { title: 'Maker page', origin: 'manufacturer' }
const book = { title: 'Rule book' }
const cited = (id: string, kind: string, ...sources: object[]) => ({
  id,
  provenance: { kind, sources },
})
const bundleOf = (parts: Record<string, object[]>) => parts as unknown as Bundle

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

  it('decides by the sources alone: a derived powder that cites a maker leaves, a fitted one that does not stays', () => {
    const rows = makerRows(
      bundleOf({ powders: [cited('p1', 'derived', maker), cited('p2', 'fitted', book)] }),
    )
    expect(rows).toEqual({ powders: [{ id: 'p1' }] })
  })

  it('keeps manufacturer records as identity records', () => {
    expect(makerRows(bundleOf({ manufacturers: [cited('m1', 'published', maker)] }))).toEqual({})
  })
})

describe('the committed records', () => {
  it('cite no manufacturer source, except the manufacturer records', () => {
    const { bundle, errors } = readRecords()
    expect(errors).toEqual([])
    expect(makerRows(bundle)).toEqual({})
  })
})
