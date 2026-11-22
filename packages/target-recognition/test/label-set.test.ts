import { describe, expect, it } from 'vitest'
import { labelSet } from '../src/label-set.ts'

const photo = {
  sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  source: 'own photo',
  license: 'CC0-1.0',
  author: 'Test Labeler',
  session: '2026-05-02 range A',
  kind: 'printed',
  usable: true,
  complete: true,
  size: [400, 300],
  visibleDiameterPx: 12.5,
  holes: [{ x: 100, y: 150, uncertain: false }],
}
const issues = (p: object) => labelSet.safeParse({ photos: { 'a.jpg': p } }).error?.issues

describe('label set schema', () => {
  it('accepts a complete photo entry', () => {
    expect(issues(photo)).toBeUndefined()
  })

  for (const key of ['sha256', 'license', 'author'] as const)
    it(`rejects a photo without ${key}`, () => {
      const { [key]: _, ...rest } = photo
      expect(issues(rest)).toMatchObject([
        { code: 'invalid_type', expected: 'string', path: ['photos', 'a.jpg', key] },
      ])
    })

  it('rejects a sha256 that is not 64 hex characters', () => {
    expect(issues({ ...photo, sha256: '9f86d081' })).toMatchObject([
      { code: 'invalid_format', format: 'regex', path: ['photos', 'a.jpg', 'sha256'] },
    ])
  })

  it('rejects an unknown key', () => {
    expect(issues({ ...photo, color: 'black' })).toMatchObject([
      { code: 'unrecognized_keys', keys: ['color'], path: ['photos', 'a.jpg'] },
    ])
  })

  it('rejects a hole outside the photo', () => {
    expect(issues({ ...photo, holes: [{ x: 401, y: 150, uncertain: false }] })).toMatchObject([
      { code: 'custom', message: 'hole outside the photo', path: ['photos', 'a.jpg', 'holes', 0] },
    ])
  })

  it('rejects a negative diameter', () => {
    expect(issues({ ...photo, visibleDiameterPx: -1 })).toMatchObject([
      { code: 'too_small', minimum: 0, path: ['photos', 'a.jpg', 'visibleDiameterPx'] },
    ])
  })
})
