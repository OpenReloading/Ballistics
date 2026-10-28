import { describe, expect, it } from 'vitest'
import { flierScreen, InputError } from '../src/index.ts'
import { normals } from './random.ts'

const strings = (n: number, count: number, seed: number, plant = 0) => {
  const normal = normals(seed)
  return Array.from({ length: count }, () => {
    const x = Array.from({ length: n }, () => normal())
    x[0] = (x[0] as number) + plant
    return x
  })
}

describe('flierScreen', () => {
  it('flags about 1 % of clean strings of 10, 20 and 30 shots', () => {
    for (const n of [10, 20, 30]) {
      const flagged = strings(n, 100_000, 100 + n).filter((x) => flierScreen(x)?.flagged).length
      expect(flagged / 100_000).toBeGreaterThan(0.005)
      expect(flagged / 100_000).toBeLessThan(0.015)
    }
  })

  it('finds a planted flier of 8 standard deviations in more than 90 % of strings', () => {
    for (const n of [10, 20]) {
      const found = strings(n, 20_000, 200 + n, 8).filter((x) => {
        const r = flierScreen(x)
        return r?.flagged && r.index === 0
      }).length
      expect(found / 20_000).toBeGreaterThan(0.9)
    }
  })

  it('reports the standard deviation with and without the farthest shot', () => {
    const x = [10, 10.1, 9.9, 10, 10.2, 9.8, 10.1, 9.9, 10, 10.1, 14]
    const r = flierScreen(x)
    expect(r?.flagged).toBe(true)
    expect(r?.index).toBe(10)
    expect(r?.standardDeviation).toBeGreaterThan(1)
    expect(r?.standardDeviationWithout).toBeCloseTo(Math.sqrt(0.129 / 9), 3)
  })

  it('gives no screen outside 10 to 30 shots and rejects a non-finite value', () => {
    expect(flierScreen(Array.from({ length: 9 }, (_, i) => i))).toBeUndefined()
    expect(flierScreen(Array.from({ length: 31 }, (_, i) => i))).toBeUndefined()
    expect(() => flierScreen([...Array.from({ length: 10 }, () => 1), Number.NaN])).toThrow(
      InputError,
    )
  })
})
