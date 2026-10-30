import type { TargetSheet } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { frameOf, viewToTarget } from '../src/lib/target-editor.ts'
import { applyMatrix, type Point, solveHomography } from '../src/lib/target-geometry.ts'
import {
  gridPitch,
  markCentres,
  page,
  sessionRefOf,
  zeroTargetShapes,
  zeroTargetSvg,
  zeroTargetValues,
} from '../src/lib/zero-target.ts'
import { defined } from './defined.ts'
import { sheetInk, sheetSvg } from './zero-target-render.ts'

describe('zero target geometry', () => {
  it('puts the mark centres 160 x 240 mm apart, top left, top right, bottom right, bottom left', () => {
    const [tl, tr, br, bl] = markCentres
    expect(tr.x - tl.x).toBeCloseTo(160, 2)
    expect(br.x - bl.x).toBeCloseTo(160, 2)
    expect(bl.y - tl.y).toBeCloseTo(240, 2)
    expect(br.y - tr.y).toBeCloseTo(240, 2)
    expect(tl).toEqual({ x: 25, y: 28.5 })
    expect(tr.y).toBe(tl.y)
    expect(br.x).toBe(tr.x)
    // the svg draws each mark at its centre
    const svg = sheetSvg()
    for (const c of markCentres) expect(svg).toContain(`cx="${c.x}" cy="${c.y}" r="5"`)
    // the top left mark alone has a second ring
    expect(zeroTargetShapes().rings.filter((r) => r.cx === tl.x && r.cy === tl.y)).toHaveLength(2)
    expect(zeroTargetShapes().rings).toHaveLength(5)
  })

  it('draws the grid at a 10 mm pitch through the page centre', () => {
    const thin = zeroTargetShapes().lines.filter((l) => l.width === 0.15)
    const xs = thin.filter((l) => l.x1 === l.x2).map((l) => l.x1)
    const ys = thin.filter((l) => l.y1 === l.y2).map((l) => l.y1)
    for (const v of [xs, ys])
      for (const [i, x] of v.slice(1).entries()) expect(x - defined(v[i])).toBeCloseTo(gridPitch, 6)
    expect(xs).toContain(page.width / 2)
    expect(ys).toContain(page.height / 2)
  })

  it('escapes the field text and writes a 210 x 297 mm document', () => {
    const svg = sheetSvg({ rifle: 'R&D <1>' })
    expect(svg).toContain('R&amp;D &lt;1&gt;')
    expect(svg).toContain('width="210mm" height="297mm" viewBox="0 0 210 297"')
    expect(svg).toContain('>100 mm<')
  })

  it('writes the footer it is given', () => {
    const svg = zeroTargetSvg({
      labels: zeroTargetValues(undefined),
      values: zeroTargetValues(undefined),
      check: 'check',
      footer: 'zero-a4 1 plain 160 x 240 mm 10 mm',
      plus: '+5',
      minus: '-5',
    })
    expect(svg).toContain('>zero-a4 1 plain 160 x 240 mm 10 mm<')
  })
})

describe('zero target fields', () => {
  const group = {
    name: 'Group 3',
    distance: 100,
    shots: [
      { id: 's1', x: 0, y: 0, placement: 'placed' as const },
      {
        id: 's2',
        x: 0,
        y: 0,
        placement: 'placed' as const,
        chrono: { session: 'user:abc', string: 0, shot: 1 },
      },
    ],
  }

  it('fills the fields from the records; the shooter stays blank', () => {
    expect(
      zeroTargetValues({ group, firearm: 'My rifle', cartridge: '.308 Win', date: '2026-10-30' }),
    ).toEqual({
      rifle: 'My rifle',
      date: '2026-10-30',
      caliber: '.308 Win',
      shooter: '',
      distance: '100',
      group: 'Group 3',
    })
  })

  it('leaves every field blank without a source, and what is missing blank', () => {
    const blank = { rifle: '', date: '', caliber: '', shooter: '', distance: '', group: '' }
    expect(zeroTargetValues(undefined)).toEqual(blank)
    expect(zeroTargetValues({})).toEqual(blank)
    expect(zeroTargetValues({ group: { name: 'G', distance: 45.72 } })).toEqual({
      ...blank,
      distance: '45.7',
      group: 'G',
    })
  })

  it('takes the session of the first shot linked to a chronograph shot', () => {
    expect(sessionRefOf(group)).toBe('user:abc')
    expect(sessionRefOf({ shots: [] })).toBeUndefined()
    expect(sessionRefOf(undefined)).toBeUndefined()
  })
})

describe('a photo of the printed sheet', () => {
  it('calibrated on the four mark centres reads the crossing 50 mm right and up within 1 mm', () => {
    // a photo taken at an angle: sheet mm to photo px through a perspective
    const corners = [
      { x: 0, y: 0 },
      { x: page.width, y: 0 },
      { x: page.width, y: page.height },
      { x: 0, y: page.height },
    ]
    const shot = [
      { x: 140, y: 90 },
      { x: 960, y: 130 },
      { x: 1010, y: 1430 },
      { x: 100, y: 1380 },
    ]
    const toPhoto = solveHomography(corners, shot)
    const toSheet = solveHomography(shot, corners)
    const [width, height] = [1100, 1500]
    const ink = sheetInk(sheetSvg())
    const lum = new Float32Array(width * height)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const p = applyMatrix(toSheet, { x, y })
        const inside = p.x >= 0 && p.x <= page.width && p.y >= 0 && p.y <= page.height
        lum[y * width + x] = inside ? ink(p.x, p.y) : 60
      }
    // a mark's centre on the photo: the centroid of its dark pixels near where it was printed
    const centreOf = (c: Point) => {
      const guess = applyMatrix(toPhoto, c)
      let [sx, sy, n] = [0, 0, 0]
      for (let y = Math.round(guess.y) - 45; y <= guess.y + 45; y++)
        for (let x = Math.round(guess.x) - 45; x <= guess.x + 45; x++) {
          const p = applyMatrix(toSheet, { x, y })
          // the window on the sheet: the mark, not the grid or the field row
          const dark = Math.hypot(p.x - c.x, p.y - c.y) <= 7.5 && defined(lum[y * width + x]) < 100
          if (dark) [sx, sy, n] = [sx + x, sy + y, n + 1]
        }
      return { x: sx / n, y: sy / n }
    }
    const [a, b, c, d] = markCentres.map(centreOf)
    const sheet: TargetSheet = {
      photo: 'p1',
      references: [
        {
          kind: 'rectangle',
          corners: [defined(a), defined(b), defined(c), defined(d)],
          width: 0.16,
          height: 0.24,
        },
      ],
      targetRotation: 0,
      targetOrigin: applyMatrix(toPhoto, { x: page.width / 2, y: page.height / 2 }),
      groups: [],
    }
    const frame = defined(frameOf(sheet))
    const crossing = applyMatrix(toPhoto, { x: page.width / 2 + 50, y: page.height / 2 - 50 })
    const q = viewToTarget(frame, crossing)
    expect(Math.abs(q.x - 0.05)).toBeLessThan(0.001)
    expect(Math.abs(q.y - 0.05)).toBeLessThan(0.001)
  })
})
