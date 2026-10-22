import { describe, expect, it } from 'vitest'
import table from '../src/core/advances.json' with { type: 'json' }
import { fallbackAdvance, textWidth } from '../src/core/text.ts'

describe('textWidth', () => {
  it('adds the advances of the drawing font, the fallback for other characters', () => {
    const { advances } = table as { advances: Record<string, number> }
    expect(textWidth('L3', 2)).toBeCloseTo(2 * (advances.L + advances['3']), 9)
    expect(textWidth('☃', 1)).toBe(fallbackAdvance)
    for (const c of ['∅', 'α', 'δ', '°', '−']) expect(advances[c]).toBeGreaterThan(0)
  })
})
