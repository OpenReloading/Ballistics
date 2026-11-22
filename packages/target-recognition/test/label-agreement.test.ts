import { describe, expect, it } from 'vitest'
import { agreement } from '../scripts/label-agreement.mts'
import type { LabeledPhoto, LabelSet } from '../src/label-set.ts'

const photo = (n: number, facts: Partial<LabeledPhoto> = {}): LabeledPhoto => ({
  sha256: n.toString(16).padStart(64, '0'),
  source: 'own photo',
  license: 'CC0-1.0',
  author: 'Test Labeler',
  session: '2026-05-02 range A',
  kind: 'printed',
  usable: true,
  complete: true,
  size: [400, 300],
  visibleDiameterPx: 10,
  holes: [],
  ...facts,
})

const set = (photos: LabeledPhoto[], prefix: string): LabelSet => ({
  photos: Object.fromEntries(photos.map((p, i) => [`${prefix}${i}.jpg`, p])),
})

// radius 3 for a, 7 for b, 5 for their mean: the 4 px apart pair matches only on the mean or on b's
const a = set(
  [
    photo(1, { visibleDiameterPx: 6, holes: [{ x: 100, y: 100, uncertain: false }] }),
    photo(2),
    photo(3),
  ],
  'a',
)
const b = set(
  [
    photo(3, { complete: false }),
    photo(2, { usable: false }),
    photo(1, {
      visibleDiameterPx: 14,
      holes: [
        { x: 104, y: 100, uncertain: false },
        { x: 150, y: 100, uncertain: true },
      ],
    }),
  ],
  'b',
)

describe('label agreement', () => {
  it('pairs photos by hash and compares those both mark usable and complete', () => {
    const expected = {
      photos: 3,
      usableDisagreements: 1,
      usableIncomplete: 1,
      corrections: { photos: 1, median: 1, max: 1 },
    }
    expect(agreement(a, b)).toEqual(expected)
    expect(agreement(b, a)).toEqual(expected)
  })

  it('refuses sets of different photos', () => {
    expect(() => agreement(a, set([photo(1), photo(2), photo(4)], 'b'))).toThrow(
      'the two sets hold different photos',
    )
  })

  it('gives the 90th percentile from 20 compared photos on', () => {
    const photos = Array.from({ length: 20 }, (_, n) => photo(n))
    expect(agreement(set(photos, 'a'), set(photos, 'b')).corrections).toEqual({
      photos: 20,
      median: 0,
      p90: 0,
      max: 0,
    })
    const oneIncomplete = photos.with(0, photo(0, { complete: false }))
    expect(agreement(set(photos, 'a'), set(oneIncomplete, 'b')).corrections).toEqual({
      photos: 19,
      median: 0,
      max: 0,
    })
  })
})
