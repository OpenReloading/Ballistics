import { describe, expect, it } from 'vitest'
import { fold, score, searchKey } from '../src/index.ts'

const rows = [
  { id: '308-win', texts: ['308 Win.', '.308 Winchester'] },
  { id: '308-marlin', texts: ['308 Marlin Express'] },
  { id: '7-62x51', texts: ['7,62 x 51 NATO', '7.62x51'] },
  { id: '30-06', texts: ['30-06 Springfield'] },
  { id: '9x19', texts: ['9 x 19 Parabellum', '9mm Luger'] },
  { id: '300-win-mag', texts: ['300 Win. Mag.'] },
  { id: 'cafe', texts: ['Café Crème'] },
]
const keys = rows.map((r) => ({ id: r.id, key: searchKey(r.texts) }))
const find = (query: string) =>
  keys
    .map(({ id, key }) => ({ id, s: score(key, query) }))
    .filter((r): r is { id: string; s: number } => r.s !== undefined)
    .sort((a, b) => b.s - a.s)
    .map((r) => r.id)

describe('fold', () => {
  it('drops accents, lower cases and writes a decimal comma as a point', () => {
    expect(fold('Café 7,62 x 51, ok')).toBe('cafe 7.62 x 51, ok')
  })
})

describe('score', () => {
  it('finds the same rows for every order of the words', () => {
    expect(find('win 308').sort()).toEqual(find('308 win').sort())
    expect(find('308 win').sort()).toEqual(['308-win'])
    for (const q of ['win 300 mag', 'mag win 300', '300 mag win'])
      expect(find(q)).toEqual(['300-win-mag'])
  })

  it('matches a number with or without its point, comma, spaces and hyphens', () => {
    expect(find('.308')).toContain('308-win')
    expect(find('308')).toContain('308-win')
    for (const q of ['7,62x51', '7.62x51', '7.62 x 51', '7,62 x 51', 'x 7.62 51'])
      expect(find(q)).toEqual(['7-62x51'])
    for (const q of ['30-06', '30 06', '3006']) expect(find(q)).toEqual(['30-06'])
    expect(find('9x19')).toEqual(['9x19'])
    expect(find('9mm')).toEqual(['9x19'])
  })

  it('ignores accents and case and has no match for a word no text holds', () => {
    expect(find('CAFE creme')).toEqual(['cafe'])
    expect(find('café')).toEqual(['cafe'])
    expect(find('308 lapua')).toEqual([])
  })

  it('matches every row for an empty query', () => {
    expect(find('   ')).toHaveLength(rows.length)
  })

  it('ranks the exact name over a word start over a substring', () => {
    const key = (name: string) => searchKey([name])
    const exact = score(key('308 Win.'), '308 win')
    const start = score(key('308 Win. Short Magnum'), '308 win')
    const inner = score(key('Super308 Win.'), '308 win')
    expect(exact).toBe(8)
    expect(start).toBe(4)
    expect(inner).toBe(3)
  })

  it('takes the name from the key, not from the first text, when it is given', () => {
    expect(score(searchKey(['Maker', '168 HPBT'], '168 HPBT'), '168 hpbt')).toBe(8)
    expect(score(searchKey(['Maker', '168 HPBT']), '168 hpbt')).toBe(4)
  })

  it('gives every permutation of the words of a query the same score', () => {
    const key = searchKey(['Maker', '168 HPBT Match'])
    const base = score(key, 'maker 168 match')
    for (const q of ['168 maker match', 'match 168 maker', 'match maker 168'])
      expect(score(key, q)).toBe(base)
  })
})
