import { describe, expect, it } from 'vitest'
import { boxAround, exportSize, pinchView, printLayout } from '../src/lib/target-view.ts'

describe('export sizes', () => {
  const photo = { width: 1600, height: 1200 }
  it('the rendered image has the photo pixel size; a drawn target 10 px per mm', () => {
    expect(exportSize(photo, { x: 0, y: 0, w: 1600, h: 1200 })).toEqual({ w: 1600, h: 1200 })
    expect(exportSize(undefined, { x: -120, y: -120, w: 240, h: 180 })).toEqual({
      w: 2400,
      h: 1800,
    })
  })

  it('a box inside the photo keeps the photo resolution', () => {
    expect(exportSize(photo, { x: 400.2, y: 300, w: 399.6, h: 299.7 })).toEqual({ w: 400, h: 300 })
  })
})

describe('print layout', () => {
  it('takes the largest 1, 2, 5 scale that fits and a ruler of a round length', () => {
    // 400 px at 0.1 mm per px: 40 mm of target; 5:1 is 200 mm, too wide for 170 mm, so 2:1
    const p = printLayout({ w: 400, h: 300 }, 1e-4, 1e-3)
    expect(p.scale).toBe(2)
    expect(p.width).toBeCloseTo(80, 9)
    expect(p.height).toBeCloseTo(60, 9)
    // the ruler: a round number of display units, its printed length that times the scale
    expect(p.ruler.length).toBe(20)
    expect(p.ruler.mm).toBeCloseTo(40, 9)
  })

  it('prints a 1600 x 1200 px photo at 10 px per mm 1:1 with a 50 mm ruler', () => {
    // 160 x 120 mm of target fits 170 x 140 mm at 1:1
    const p = printLayout({ w: 1600, h: 1200 }, 1e-4, 1e-3)
    expect(p.scale).toBe(1)
    expect(p.width).toBeCloseTo(160, 9)
    expect(p.height).toBeCloseTo(120, 9)
    expect(p.ruler.length).toBe(50)
    expect(p.ruler.mm).toBeCloseTo(50, 9)
  })

  it('shrinks a large view and measures in inches', () => {
    // 300 x 300 mm of target: 1:2 is 150 mm, too high for 140 mm, so 1:5
    const p = printLayout({ w: 3000, h: 3000 }, 1e-4, 0.0254)
    expect(p.scale).toBe(0.2)
    expect(p.height).toBeCloseTo(60, 9)
    // at most 60 mm of paper: 10 in print 50.8 mm
    expect(p.ruler.length).toBe(10)
    expect(p.ruler.mm).toBeCloseTo(10 * 25.4 * 0.2, 9)
  })
})

describe('pinch zoom', () => {
  const box = { x: 0, y: 0, w: 1000, h: 800 }
  it('fingers twice as far apart halve the view about the point between them', () => {
    // the point between the fingers (view 600, 400) stays under them
    const b = pinchView(box, 2, { x: 600, y: 400 }, { x: 50, y: 60 }, { x: 50, y: 60 }, 0.5)
    expect(b).toEqual({ x: 300, y: 200, w: 500, h: 400 })
  })

  it('two fingers moved together pan the view by their way in view units', () => {
    const b = pinchView(box, 2, { x: 600, y: 400 }, { x: 50, y: 60 }, { x: 60, y: 50 }, 1)
    expect(b).toEqual({ x: -20, y: 20, w: 1000, h: 800 })
  })
})

describe('box around points', () => {
  it('adds 10 % of the larger side on each side', () => {
    expect(
      boxAround([
        { x: 0, y: 0 },
        { x: 200, y: 100 },
      ]),
    ).toEqual({ x: -20, y: -20, w: 240, h: 140 })
  })

  it('a face outline wider than 200 mm sets the box, not the default square', () => {
    const outline = [
      { x: -250, y: 0 },
      { x: 250, y: 0 },
      { x: 0, y: -250 },
      { x: 0, y: 250 },
    ]
    expect(boxAround(outline).w).toBe(600)
  })

  it('without points a 1000 unit square', () => {
    expect(boxAround([])).toEqual({ x: 0, y: 0, w: 1000, h: 1000 })
  })
})
