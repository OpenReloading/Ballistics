import { describe, expect, it } from 'vitest'
import { correctionStats, corrections, matchHoles } from '../src/hole-matching.ts'

describe('hole matching', () => {
  it('matches a mark within half a hole diameter and no farther', () => {
    const holes = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    const marks = [
      { x: 4.9, y: 0 },
      { x: 105.1, y: 0 },
    ]
    expect(matchHoles(marks, holes, 10)).toEqual({ matched: 1, false: 1, missed: 1 })
  })

  it('matches two marks near one hole to that hole once', () => {
    const marks = [
      { x: 1, y: 0 },
      { x: 0, y: 2 },
    ]
    expect(matchHoles(marks, [{ x: 0, y: 0 }], 10)).toEqual({ matched: 1, false: 1, missed: 0 })
  })

  it('counts the larger of false marks and missed holes as corrections', () => {
    expect(corrections({ matched: 4, false: 1, missed: 3 })).toBe(3)
    expect(corrections({ matched: 0, false: 2, missed: 0 })).toBe(2)
  })

  it('gives the same corrections when the labelers swap', () => {
    const a = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 50, y: 50 },
    ]
    const b = [
      { x: 2, y: 0 },
      { x: 90, y: 10 },
      { x: 20, y: 80 },
      { x: 52, y: 51 },
    ]
    expect(matchHoles(b, a, 10)).toEqual({ matched: 2, false: 2, missed: 1 })
    expect(matchHoles(a, b, 10)).toEqual({ matched: 2, false: 1, missed: 2 })
    expect(corrections(matchHoles(b, a, 10))).toBe(corrections(matchHoles(a, b, 10)))
  })
})

describe('correction statistics', () => {
  const nineteen = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 3]

  it('gives no 90th percentile below 20 usable photos', () => {
    expect(correctionStats(nineteen)).toEqual({ photos: 19, median: 0, max: 3 })
  })

  it('gives the 90th percentile from 20 usable photos on', () => {
    const stats = correctionStats([5, ...nineteen])
    expect(stats).toMatchObject({ photos: 20, median: 0.5, max: 5 })
    expect(stats.p90).toBeCloseTo(2.1)
  })
})
