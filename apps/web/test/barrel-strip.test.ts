import { describe, expect, it } from 'vitest'
import { type StripFigure, stripModel } from '../src/lib/barrel-strip.ts'
import { drawable } from '../src/lib/cartridge-sheet.ts'
import { cartridgeRecord } from './records.ts'

const { values, table } = drawable(cartridgeRecord('308-win'))
// a bullet's half outline [r, z] mm from its base: a cylinder with a pointed nose
const bullet: StripFigure['bullet'] = [
  [0, 0],
  [3.9, 0],
  [3.9, 15],
  [0, 28],
]
const figure: StripFigure = { values, table, bullet, base: 60 }

describe('stripModel', () => {
  it('runs the bore out to the seated base plus the travel, mm', () => {
    const m = stripModel(figure, 0.6)
    expect(m?.base).toBe(60)
    expect(m?.muzzle).toBeCloseTo(660, 9)
  })

  it('frames the strip from 1 mm behind the head over the muzzle plus 2 mm, centred on the axis', () => {
    const m = stripModel(figure, 0.6)
    if (!m) throw new Error('no model')
    const [x, y, width, height] = m.view
    expect(x).toBe(-1)
    expect(width).toBeCloseTo(m.muzzle + 2, 9)
    expect(y).toBeCloseTo(-height / 2, 9)
    expect(height).toBeGreaterThan(0)
  })

  it('draws the cavity, steel, outline, cartridge and bullet as paths', () => {
    const m = stripModel(figure, 0.6)
    for (const key of ['cavity', 'steel', 'outline', 'cartridge', 'bullet'] as const)
      expect(m?.[key]).toMatch(/^M/)
  })

  it('draws the same case and chamber for another travel and moves only the muzzle and the width', () => {
    const [a, b] = [stripModel(figure, 0.3), stripModel(figure, 0.6)]
    if (!a || !b) throw new Error('no model')
    expect(a.cartridge).toBe(b.cartridge)
    expect(a.muzzle).toBeLessThan(b.muzzle)
    expect(a.view[2]).toBeLessThan(b.view[2])
  })

  it('is undefined for a record without the values the outlines need', () => {
    expect(stripModel({ ...figure, values: [] }, 0.6)).toBeUndefined()
  })
})
