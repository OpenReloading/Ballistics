import { describe, expect, it } from 'vitest'
import { loadRecords } from '../src/records.ts'
import { splitOf } from '../src/split.ts'

describe('splitOf', () => {
  it.each([
    ['30-06-spring', 'test'], // first byte 9
    ['7-62-x-39', 'test'], // 17
    ['308-win', 'validation'], // 58
    ['8-x-57-is', 'validation'], // 74
    ['30-30-win', 'validation'], // 97
    ['30-br', 'training'], // 119
    ['7-62-x-54-r', 'training'], // 125
    ['308-match', 'training'], // 128
    ['', 'training'], // 227
    ['ä', 'validation'], // 51, the first byte of the validation range
  ] as const)('puts %j in %s by the first byte of its SHA-256', (id, split) => {
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
