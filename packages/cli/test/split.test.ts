import { describe, expect, it } from 'vitest'
import { loadRecords } from '../src/records.ts'
import { splitOf } from '../src/split.ts'

describe('splitOf', () => {
  it.each([
    ['307-win', 'test'], // first byte 9
    ['300-win-mag', 'test'], // 24
    ['c144', 'test'], // 50, the last byte of the test range
    ['c1091', 'validation'], // 51, the first byte of the validation range
    ['30-30-win', 'validation'], // 65
    ['308-match', 'validation'], // 76
    ['c108', 'validation'], // 101, the last byte of the validation range
    ['c443', 'training'], // 102, the first byte of the training range
    ['30-06-spring', 'training'], // 122
    ['308-win', 'training'], // 200
    ['', 'training'], // 216
    ['ä', 'test'], // 0
  ] as const)('puts %j in %s by the first byte of the SHA-256 of the salt and it', (id, split) => {
    expect(splitOf(id)).toBe(split)
  })

  it('ignores the case of the id', () => {
    expect(splitOf('308-WIN')).toBe(splitOf('308-win'))
  })

  it('splits the cartridges of the data package about 20 %, 20 % and 60 %', () => {
    const ids = [...loadRecords([]).cartridges.keys()]
    const share = (s: string) => ids.filter((id) => splitOf(id) === s).length / ids.length
    expect(share('test')).toBeCloseTo(0.2, 1)
    expect(share('validation')).toBeCloseTo(0.2, 1)
    expect(share('training')).toBeCloseTo(0.6, 1)
  })
})
