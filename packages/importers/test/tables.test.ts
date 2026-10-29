import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { headerUnit, headerWords, readNumber } from '../src/tables.ts'

// the expressions the scans replace, as the reference for their results
const wordsReference = (header: string) =>
  header
    .replace(/[([{].*?[)\]}]/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
const unitReference = (header: string) =>
  (
    /[([{]\s*([^)\]}]+?)\s*[)\]}]/.exec(header)?.[1] ?? /[_/ ]([a-z]{1,6})$/i.exec(header)?.[1]
  )?.toLowerCase()

describe('header scans', () => {
  it('match the bracket expressions on any header', () => {
    const header = fc.string({
      unit: fc.constantFrom('(', ')', '[', ']', '{', '}', ' ', '\t', '\n', 'a', 'B', '_', '/', '1'),
      maxLength: 24,
    })
    fc.assert(
      fc.property(header, (h) => {
        expect(headerWords(h)).toEqual(wordsReference(h))
        expect(headerUnit(h)).toEqual(unitReference(h))
      }),
      { seed: 20261028, numRuns: 2000 },
    )
  })

  it('reads the words and unit of a bracketed header', () => {
    expect(headerWords('Geschw. [m/s] (Mündung)')).toEqual(['geschw'])
    expect(headerUnit('Velocity ( FPS )')).toBe('fps')
    expect(headerUnit('mass_gr')).toBe('gr')
  })

  it('finishes quickly on a long hostile header', () => {
    const hostile = [`${'('.repeat(50000)}a`, `(${' '.repeat(50000)}a`, `{${' '.repeat(50000)}`]
    const start = performance.now()
    for (const h of hostile) {
      headerWords(h)
      headerUnit(h)
    }
    expect(performance.now() - start).toBeLessThan(200)
  })
})

describe('readNumber', () => {
  it('rejects a long cell that is no number in linear time', () => {
    const start = performance.now()
    expect(readNumber(`${'1'.repeat(50_000)}x`, '.')).toBeUndefined()
    expect(performance.now() - start).toBeLessThan(500)
  })
})
