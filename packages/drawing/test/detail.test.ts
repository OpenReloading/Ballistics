import { describe, expect, it } from 'vitest'
import {
  type DetailSpec,
  detailMargin,
  detailSpecs,
  detailWindow,
} from '../src/cartridge/detail.ts'
import type { Profile } from '../src/cartridge/profile.ts'

const spec = (region: DetailSpec['region'], sizes: DetailSpec['sizes'] = []): DetailSpec => ({
  letter: 'A',
  side: 'cartridge',
  region,
  anchor: [region[0], region[1]],
  sizes,
})

describe('detailWindow', () => {
  it('takes the largest scale whose window fits the cap', () => {
    // 2 mm along, 1 mm across: 10 times is 26 by 16 mm with the margin, 20 times too long
    const { scale, window } = detailWindow(spec([5, 0, 6, 2]), 5)
    expect(scale).toBe(10)
    expect(window).toEqual([50 - detailMargin, -detailMargin, 60 + detailMargin, 20 + detailMargin])
  })

  it('raises the scale until every size reaches its px, and cuts the window about the anchor', () => {
    // a 0.01 mm step at 5 px per mm needs 20 times for 1 px; 3 mm along is 66 mm, cut to 32
    const s: DetailSpec = { ...spec([5, 0, 5.01, 3], [{ mm: 0.01, px: 1 }]), anchor: [5, 3] }
    const { scale, window } = detailWindow(s, 5)
    expect(scale).toBe(20)
    expect(window[3] - window[1]).toBe(32)
    // the anchor at the region's end: the cut keeps the end with its margin
    expect(window[3]).toBe(60 + detailMargin)
  })

  it('stops at 50 times and at 2 times', () => {
    expect(detailWindow(spec([0, 0, 0.001, 0.001], [{ mm: 0.001, px: 1 }]), 1).scale).toBe(50)
    expect(detailWindow(spec([0, 0, 30, 30]), 5).scale).toBe(2)
  })

  it('keeps the window within a narrower room across', () => {
    const { window } = detailWindow(spec([5, 0, 6, 2]), 5, 12)
    expect(window[2] - window[0]).toBeLessThanOrEqual(12)
  })
})

describe('detailSpecs', () => {
  const profile = (symbols: string[], extra: Partial<Profile['annotation']> = {}): Profile => ({
    points: [
      [0, 0],
      [6, 0],
      [6, 1.2],
      [5.2, 1.2],
      [5.2, 2],
      [5.9, 3],
      [4.4, 50],
      [3.9, 50.5],
      [3.9, 51],
      [3.8, 55],
    ],
    notes: [],
    annotation: {
      dimensions: [
        { kind: 'diameter', symbol: 'P1', value: 11.8, from: 3, to: 3, radius: 5.9 },
        { kind: 'diameter', symbol: 'H2', value: 8.8, from: 50, to: 50, radius: 4.4 },
        ...symbols.map((symbol) => ({ kind: 'length' as const, symbol, value: 1, from: 0, to: 1 })),
      ],
      angles: [],
      radii: [],
      edges: [],
      conventions: [],
      ...extra,
    },
  })

  it('draws a head detail only with E, e, R, E1 or delta', () => {
    expect(detailSpecs('cartridge', profile(['R'])).map((d) => d.letter)).toEqual(['A'])
    expect(detailSpecs('cartridge', profile(['L3']))).toEqual([])
  })

  it('draws a throat detail only on the chamber with G1 and F and i, or h, or s', () => {
    const throat = (symbols: string[], i = false) =>
      detailSpecs(
        'chamber',
        profile(['G1', ...symbols], {
          angles: i
            ? [
                {
                  kind: 'angle',
                  symbol: 'i',
                  value: 1,
                  stored: { side: 'chamber', symbol: 'i', quantity: 'angle', value: 1 },
                  vertex: [3.9, 51],
                  flanks: [
                    [3.9, 55],
                    [3.8, 55],
                  ],
                },
              ]
            : [],
        }),
      ).map((d) => d.letter)
    expect(throat(['F'], true)).toEqual(['B'])
    expect(throat(['h'])).toEqual(['B'])
    expect(throat(['F'])).toEqual([])
    expect(detailSpecs('cartridge', profile(['G1', 'h']))).toEqual([])
  })

  it('spans the throat from H2 at L3 to the G1 stub', () => {
    const [b] = detailSpecs(
      'chamber',
      profile(['G1', 'h'], { conventions: [{ kind: 'g1Stub', r: 3.9, from: 51, to: 55 }] }),
    ).filter((d) => d.letter === 'B')
    expect(b.region).toEqual([3.9, 50, 4.4, 51])
    expect(b.anchor).toEqual([4.4, 50])
  })
})
