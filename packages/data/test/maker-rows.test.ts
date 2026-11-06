import { describe, expect, it } from 'vitest'
import { makerRows, manufacturerExtras } from '../src/maker-rows.ts'
import { type Bundle, readRecords } from '../src/records.ts'

const maker = { title: 'Maker page', origin: 'manufacturer' }
const book = { title: 'Rule book' }
const cited = (id: string, ...sources: object[]) => ({
  id,
  provenance: { kind: 'published', sources },
})
const bundleOf = (parts: Record<string, object[]>) => parts as unknown as Bundle

describe('makerRows', () => {
  it('lists a record that cites a manufacturer, also beside other sources, and keeps the others', () => {
    const rows = makerRows(
      bundleOf({
        bullets: [cited('b1', maker), cited('b2', book, maker), cited('b3', book)],
        cartridges: [cited('c1', book)],
      }),
    )
    expect(rows).toEqual({
      bullets: [
        { id: 'b1', reason: 'manufacturer source' },
        { id: 'b2', reason: 'manufacturer source' },
      ],
    })
  })

  it('lists a derived or fitted powder without a manufacturer source, and only for powders', () => {
    const own = (id: string, kind: string) => ({ id, provenance: { kind, sources: [book] } })
    const rows = makerRows(
      bundleOf({
        powders: [own('p1', 'derived'), own('p2', 'fitted'), own('p3', 'measured')],
        bullets: [own('b1', 'derived')],
      }),
    )
    expect(rows).toEqual({
      powders: [
        { id: 'p1', reason: 'derived' },
        { id: 'p2', reason: 'fitted' },
      ],
    })
  })

  it('keeps manufacturer records and names the fields beyond name and website', () => {
    const bundle = bundleOf({
      manufacturers: [
        { ...cited('m1', maker), name: 'M1', website: 'https://example.org' },
        { ...cited('m2', maker), name: 'M2', aliases: ['Em Two'] },
      ],
    })
    expect(makerRows(bundle)).toEqual({})
    expect(manufacturerExtras(bundle)).toEqual([{ id: 'm2', fields: ['aliases'] }])
  })
})

describe('the maker rows of the committed records', () => {
  const { bundle, errors } = readRecords()

  it('are bullets and powders only: no other kind cites a manufacturer', () => {
    expect(errors).toEqual([])
    expect(Object.keys(makerRows(bundle)).toSorted()).toEqual(['bullets', 'powders'])
  })
})
