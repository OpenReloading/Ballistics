import { seededUniforms } from '@open-reloading/statistics'
import {
  findHoles,
  type HoleDetectionInput,
  type RgbaImage,
} from '@open-reloading/target-recognition'
import { describe, expect, it } from 'vitest'
import type { Point } from '../src/lib/target-geometry.ts'
import { defined } from './defined.ts'
import { sheetInk, sheetSvg } from './zero-target-render.ts'

const detectHoles = (input: HoleDetectionInput) => findHoles(input).proposals

// A synthetic photo of the sheet at 8 px/mm with 7.62 mm bullets, a hole about 61 px across.
const pxPerMm = 8
const pxPerM = pxPerMm * 1000
const bullet = 0.00762
const D = bullet * pxPerM
const PAPER = 225

type Box = [x0: number, y0: number, x1: number, y1: number]

// The members of the detector tests' scene that this photo uses (packages/target-recognition/test/hole-detection.test.ts), so it draws the same random numbers.
class Scene {
  lum: Float32Array
  rnd = seededUniforms(7)
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.lum = new Float32Array(width * height).fill(PAPER)
  }
  paint([x0, y0, x1, y1]: Box, inside: (x: number, y: number) => boolean, v: number) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.height, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.width, Math.ceil(x1)); x++)
        if (inside(x, y)) this.lum[y * this.width + x] = v
  }
  /** The scene's ring of radius r / 2 and width r. */
  disc(cx: number, cy: number, r: number, v: number) {
    const box: Box = [cx - r / 2 - r, cy - r / 2 - r, cx + r / 2 + r, cy + r / 2 + r]
    this.paint(box, (x, y) => Math.abs(Math.hypot(x - cx, y - cy) - r / 2) <= r / 2, v)
  }
  /** A hole with a torn, wavy edge; `backing` is what shows through it; white fibers on its rim. */
  hole(c: Point, backing: number, diameter = D) {
    const r = diameter / 2
    const [p1, p2] = [this.rnd() * 6, this.rnd() * 6]
    this.paint(
      [c.x - 1.2 * r, c.y - 1.2 * r, c.x + 1.2 * r, c.y + 1.2 * r],
      (x, y) => {
        const a = Math.atan2(y - c.y, x - c.x)
        const edge = r * (1 + 0.05 * Math.sin(5 * a + p1) + 0.03 * Math.sin(11 * a + p2))
        return Math.hypot(x - c.x, y - c.y) <= edge
      },
      backing,
    )
    for (let i = 0; i < 6; i++) {
      const a = this.rnd() * 2 * Math.PI
      this.disc(c.x + 1.03 * r * Math.cos(a), c.y + 1.03 * r * Math.sin(a), 0.06 * diameter, PAPER)
    }
  }
  image(noise = 6): RgbaImage {
    const data = new Uint8ClampedArray(this.width * this.height * 4)
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const i = y * this.width + x
        const g = Math.sqrt(-2 * Math.log(1 - this.rnd())) * Math.cos(2 * Math.PI * this.rnd())
        const v = defined(this.lum[i]) + noise * g
        data.set([v + 4, v, v - 6, 255], i * 4)
      }
    return { width: this.width, height: this.height, data }
  }
}

describe('the printed zero target', () => {
  it('finds five holes on the sheet: two in the black square, one on a grid line, two on paper', () => {
    const s = new Scene(210 * pxPerMm, 297 * pxPerMm)
    const ink = sheetInk(sheetSvg({ rifle: 'Rifle 1', distance: '100', group: 'Group 1' }))
    for (let y = 0; y < s.height; y++)
      for (let x = 0; x < s.width; x++) s.lum[y * s.width + x] = ink(x / pxPerMm, y / pxPerMm)
    // sheet mm right and up of the center to photo px
    const at = (x: number, y: number) => ({ x: (105 + x) * pxPerMm, y: (148.5 - y) * pxPerMm })
    const inSquare = [at(-6, 5), at(5, -6)]
    const onPaper = [at(30, 10), at(-25, 18), at(20, -30)]
    for (const t of inSquare) s.hole(t, 140)
    for (const t of onPaper) s.hole(t, 60)
    const truth = [...inSquare, ...onPaper]
    const image = s.image()
    // a run finds one polarity: the light holes in a region about the black square, then the dark ones on the whole sheet
    const square = { x: at(-20, 0).x, y: at(0, 20).y, width: 40 * pxPerMm, height: 40 * pxPerMm }
    const options = { image, pxPerM, expectedHoleDiameter: bullet }
    const found = [
      ...detectHoles({ ...options, region: square, polarity: 'light' }),
      ...detectHoles({
        ...options,
        region: { x: 0, y: 0, width: s.width, height: s.height },
        polarity: 'dark',
      }),
    ]
    const near = (p: Point) => truth.some((t) => Math.hypot(p.x - t.x, p.y - t.y) < 0.5 * D)
    for (const t of truth)
      expect(found.some((p) => Math.hypot(p.x - t.x, p.y - t.y) < 0.2 * D)).toBe(true)
    // no proposal on the print: the dark run reads the black square with the two light holes in it as print, and the marks, digits, cross and bar give none
    expect(found.filter((p) => !near(p))).toEqual([])
  })
})
