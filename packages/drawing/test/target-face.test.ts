import { describe, expect, it } from 'vitest'
import { type FaceShape, targetFaceFigure } from '../src/target/index.ts'

const mm = (value: number) => ({ value })

const flat: FaceShape = {
  rings: [
    { value: 1, diameter: mm(100) },
    { value: 2, diameter: mm(80) },
    { value: 3, diameter: mm(60) },
  ],
  innerTen: { diameter: mm(10) },
  blackDiameter: mm(60),
}

describe('targetFaceFigure', () => {
  it('draws each ring at half its diameter', () => {
    const { lines } = targetFaceFigure(flat)
    expect(lines.filter((l) => l.ring).map((l) => [l.ring, l.rx * 2, l.ry * 2])).toEqual([
      [1, 100, 100],
      [2, 80, 80],
      [3, 60, 60],
    ])
    expect(lines.at(-1)).toEqual({ rx: 5, ry: 5, colour: 'white' })
  })

  it('draws an oval ring with its height', () => {
    const { lines } = targetFaceFigure({
      ...flat,
      rings: flat.rings.map((r) => ({ ...r, height: mm(r.diameter.value * 1.5) })),
    })
    expect(lines[1]).toMatchObject({ rx: 40, ry: 60 })
  })

  it('fills the black area, or each ring in its colour when the rings have one', () => {
    expect(targetFaceFigure(flat).zones.map((z) => [z.colour, z.rx])).toEqual([
      ['white', 50],
      ['black', 30],
    ])
    const coloured = targetFaceFigure({
      ...flat,
      rings: flat.rings.map((r, i) => ({ ...r, fill: i < 2 ? 'white' : 'black' })),
    })
    expect(coloured.zones.map((z) => z.colour)).toEqual(['white', 'white', 'white', 'black'])
  })

  it('draws a ring line white on the black zone and the ring line colour where given', () => {
    const colours = (f: FaceShape) => targetFaceFigure(f).lines.map((l) => l.colour)
    expect(colours(flat)).toEqual(['black', 'black', 'white', 'white'])
    const red = {
      ...flat,
      rings: flat.rings.map((r, i) => ({ ...r, line: i ? undefined : 'red' })),
    }
    expect(colours(red)[0]).toBe('red')
  })

  it('frames the outer ring with a margin', () => {
    expect(targetFaceFigure(flat).frame).toEqual({ x: -52, y: -52, width: 104, height: 104 })
  })
})
