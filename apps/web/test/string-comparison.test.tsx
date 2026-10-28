import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StringComparison } from '../src/components/string-comparison.tsx'
import { compareSd } from '../src/lib/string-comparison.ts'
import { stringStats } from '../src/lib/string-stats.ts'

/** A string of `n` shots spread evenly around 800 m/s with the half-range `half`. */
const string = (n: number, half: number) =>
  stringStats(
    Array.from({ length: n }, (_, k) => ({
      velocity: { value: 800 + half * (n === 1 ? 0 : (2 * k) / (n - 1) - 1) },
    })),
  )

const defined = <T,>(x: T | undefined): T => {
  if (x === undefined) throw new Error('expected a value')
  return x
}

const text = (strings: Parameters<typeof StringComparison>[0]['strings']) =>
  renderToStaticMarkup(<StringComparison strings={strings} />)

describe('compareSd', () => {
  it('calls strings whose intervals overlap the same', () => {
    expect(compareSd(defined(string(10, 4)), defined(string(10, 5)))).toBe('same')
  })

  it('ranks strings of 10 shots whose intervals are apart', () => {
    const small = defined(string(10, 2))
    const large = defined(string(10, 20))
    expect(compareSd(small, large)).toBe('first')
    expect(compareSd(large, small)).toBe('second')
  })

  it('does not rank a string of fewer than 10 shots, or one without an interval', () => {
    expect(compareSd(defined(string(5, 0.5)), defined(string(30, 40)))).toBe('few')
    expect(compareSd(defined(string(2, 1)), defined(string(10, 4)))).toBe('few')
  })
})

describe('StringComparison', () => {
  it('says the difference is smaller than the uncertainty instead of ranking', () => {
    const html = text([
      { name: 'Load A', stats: string(10, 4) },
      { name: 'Load B', stats: string(10, 5) },
    ])
    expect(html).toContain('Load A and Load B: difference smaller than the uncertainty')
    expect(html).not.toContain('smaller SD')
  })

  it('names the string with the smaller SD when the intervals are apart', () => {
    const html = text([
      { name: 'Load A', stats: string(10, 20) },
      { name: 'Load B', stats: string(10, 2) },
    ])
    expect(html).toContain('Load A and Load B: Load B has the smaller SD')
  })

  it('asks for more shots, compares each pair and skips a string without statistics', () => {
    const html = text([
      { name: 'A', stats: string(4, 5) },
      { name: 'B', stats: string(30, 40) },
      { name: 'C', stats: undefined },
    ])
    expect(html).toContain('A and B: too few shots to compare')
    expect(html.match(/<li/g)).toHaveLength(1)
    expect(text([{ name: 'A', stats: string(4, 5) }])).toBe('')
  })
})
