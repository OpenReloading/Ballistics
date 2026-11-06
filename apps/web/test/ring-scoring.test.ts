import { readRecords } from '@open-reloading/data'
import type { TargetFace } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import de from '../src/i18n/de.json'
import { english, translator } from '../src/i18n/translate.ts'
import { faceAlignment, scoreGroupOnFace } from '../src/lib/ring-scoring.ts'

// The adapter over the ring scoring of shot-groups (packages/shot-groups/test holds the scoring
// tests): an issue becomes its message in the language shown.

const rifle50 = readRecords().bundle.targetFaces.find(
  (f) => f.id === 'issf-50m-rifle',
) as TargetFace
const group = { shots: [{ x: 0, y: 0 }] }

describe('scoreGroupOnFace in the language shown', () => {
  it('scores a group, or names a missing hole size and ring marks that do not fit', () => {
    const scored = scoreGroupOnFace(
      rifle50,
      { id: rifle50.id, event: '50m-rifle-prone' },
      group,
      undefined,
      english.t,
    )
    expect('error' in scored ? scored.error : scored.score.total).toBe(10)
    expect(scoreGroupOnFace(rifle50, { id: rifle50.id }, group, undefined, english.t)).toEqual({
      error: 'No hole size: set Marker, or choose a discipline or event with a gauge.',
    })
    const marks = [0, 1, 2, 3].map((i) => ({ ring: 8 + (i % 2), x: 0, y: 0 }))
    expect(scoreGroupOnFace(rifle50, { id: rifle50.id, marks }, group, 5e-3, english.t)).toEqual({
      error: 'The ring marks do not fit: Points are degenerate. Mark them again.',
    })
  })

  it('words marks on one line in German, the reason too', () => {
    const german = translator(de, 'de').t
    const marks = [0, 1, 2, 3].map((i) => ({ ring: 8 + Math.floor(i / 2), x: i * 1e-3, y: 0 }))
    const scored = scoreGroupOnFace(rifle50, { id: rifle50.id, marks }, group, 5e-3, german)
    expect('error' in scored && scored.error).toMatch(
      /^Die Ringmarkierungen passen nicht: Die Punkte sind entartet\. /,
    )
  })
})

describe('faceAlignment in the language shown', () => {
  it('throws why ring marks do not fit, with the ring value', () => {
    expect(() => faceAlignment(rifle50, [{ ring: 11, x: 0, y: 0 }], undefined, english.t)).toThrow(
      'The target has no ring 11',
    )
    expect(() => faceAlignment(rifle50, [{ ring: 9, x: 0, y: 0 }], undefined, english.t)).toThrow(
      'Marks on at least two rings are needed',
    )
    expect(faceAlignment(rifle50, undefined, { x: 1, y: 2 }, english.t)).toEqual({
      centre: { x: 1, y: 2 },
      scale: 1,
    })
  })
})
