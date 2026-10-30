import { describe, expect, it } from 'vitest'
import { seededRandom } from '../src/lib/ellipse.ts'
import {
  autoDetect,
  detectFromExample,
  findHoles,
  type HoleDetectionInput,
  type HoleProposal,
  MAX_WORK_PIXELS,
  workBlockSize,
} from '../src/lib/hole-detection.ts'
import { expectedHoleSize, MIN_HOLES_TO_LEARN_SIZE } from '../src/lib/hole-proposals.ts'
import type { RgbaImage } from '../src/lib/image.ts'
import type { Point } from '../src/lib/target-geometry.ts'
import { paperOutline } from '../src/lib/target-paper.ts'
import { defined } from './defined.ts'
import { sheetInk, sheetSvg } from './zero-target-render.ts'

const detectHoles = (input: HoleDetectionInput): HoleProposal[] => findHoles(input).proposals

// Synthetic target photos: 8 px/mm, 7.62 mm bullets, so a hole is about 61 px across.
const pxPerMm = 8
const pxPerM = pxPerMm * 1000
const bullet = 0.00762
const D = bullet * pxPerM
const PAPER = 225
const BLACK = 35

class Scene {
  lum: Float32Array
  /** Pixels painted in colour (R, G, B); the others are grey with the tint of `image`. */
  colour = new Map<number, [number, number, number]>()
  rnd = seededRandom(7)
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.lum = new Float32Array(width * height).fill(PAPER)
  }
  paint(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    inside: (x: number, y: number) => boolean,
    v: number,
  ) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.height, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.width, Math.ceil(x1)); x++)
        if (inside(x, y)) this.lum[y * this.width + x] = v
  }
  rect(x0: number, y0: number, x1: number, y1: number, v: number) {
    this.paint(x0, y0, x1, y1, () => true, v)
  }
  ring(cx: number, cy: number, r: number, w: number, v: number) {
    this.paint(
      cx - r - w,
      cy - r - w,
      cx + r + w,
      cy + r + w,
      (x, y) => {
        return Math.abs(Math.hypot(x - cx, y - cy) - r) <= w / 2
      },
      v,
    )
  }
  disc(cx: number, cy: number, r: number, v: number) {
    this.ring(cx, cy, r / 2, r, v)
  }
  /** A hole with a torn, wavy edge; `backing` is what shows through it; white fibres on its rim. */
  hole(c: Point, backing: number, diameter = D) {
    const r = diameter / 2
    const [p1, p2] = [this.rnd() * 6, this.rnd() * 6]
    this.paint(
      c.x - 1.2 * r,
      c.y - 1.2 * r,
      c.x + 1.2 * r,
      c.y + 1.2 * r,
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
  /** A hole through which a backing of colour `rgb` shows, round, `diameter` px across. */
  colourHole(c: Point, rgb: [number, number, number], diameter = D) {
    const r = diameter / 2
    for (let y = Math.floor(c.y - r); y <= Math.ceil(c.y + r); y++)
      for (let x = Math.floor(c.x - r); x <= Math.ceil(c.x + r); x++)
        if (Math.hypot(x - c.x, y - c.y) <= r) this.colour.set(y * this.width + x, rgb)
  }
  /** A hole on a dark area whose torn paper shows as a light ring around a dark middle. */
  tornHole(c: Point, middle: number, rim: number) {
    this.disc(c.x, c.y, D / 2, rim)
    this.disc(c.x, c.y, 0.25 * D, middle)
  }
  /** A printed face: outer dark rings on paper, a dark square with light rings, digits and a light bull with a cross. */
  face(cx: number, cy: number) {
    const mm = pxPerMm
    for (const r of [40, 46]) this.ring(cx, cy, r * mm, 0.4 * mm, BLACK)
    this.rect(cx - 35 * mm, cy - 35 * mm, cx + 35 * mm, cy + 35 * mm, BLACK)
    for (const r of [12, 18, 24, 30]) this.ring(cx, cy, r * mm, 0.6 * mm, PAPER)
    this.disc(cx, cy, 8.5 * mm, PAPER)
    this.ring(cx, cy, 4 * mm, 0.3 * mm, BLACK)
    this.rect(cx - 3 * mm, cy - 0.2 * mm, cx + 3 * mm, cy + 0.2 * mm, BLACK)
    this.rect(cx - 0.2 * mm, cy - 3 * mm, cx + 0.2 * mm, cy + 3 * mm, BLACK)
    const digit = (x: number, y: number, v: number) => {
      for (const [a, b, c, d] of [
        [0, 0, 2.5, 0.6],
        [0, 1.7, 2.5, 2.3],
        [0, 3.4, 2.5, 4],
        [0, 0, 0.6, 4],
        [1.9, 0, 2.5, 4],
      ] satisfies [number, number, number, number][])
        this.rect(x + a * mm, y + b * mm, x + c * mm, y + d * mm, v)
    }
    for (const r of [15, 21, 27]) digit(cx + r * 0.7 * mm, cy - r * 0.7 * mm, PAPER)
    digit(cx + 37 * mm, cy + 37 * mm, BLACK)
  }
  image({
    noise = 6,
    gradient,
  }: {
    noise?: number
    gradient?: (x: number, y: number) => number
  } = {}): RgbaImage {
    const data = new Uint8ClampedArray(this.width * this.height * 4)
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const i = y * this.width + x
        const g = Math.sqrt(-2 * Math.log(1 - this.rnd())) * Math.cos(2 * Math.PI * this.rnd())
        const f = gradient ? gradient(x, y) : 1
        const v = defined(this.lum[i]) * f + noise * g
        const c = this.colour.get(i)
        data.set(
          c
            ? [c[0] * f + noise * g, c[1] * f + noise * g, c[2] * f + noise * g, 255]
            : [v + 4, v, v - 6, 255],
          i * 4,
        )
      }
    return { width: this.width, height: this.height, data }
  }
}

const all = (s: Scene) => ({ x: 0, y: 0, width: s.width, height: s.height })

/** Every true hole has one proposal within `tol` bullet diameters, and there are no others. */
function expectHoles(found: HoleProposal[], truth: Point[], tol: number) {
  expect(found).toHaveLength(truth.length)
  for (const t of truth) {
    const d = Math.min(...found.map((p) => Math.hypot(p.x - t.x, p.y - t.y)))
    expect(d / D).toBeLessThan(tol)
  }
}

/**
 * Printed faces hold shapes that look like holes (the quarters of a bull, digits): the true holes
 * are the `truth.length` most confident proposals, each within `tol` bullet diameters of one hole.
 */
function expectTop(found: HoleProposal[], truth: Point[], tol: number) {
  const top = found.slice(0, truth.length)
  expect(top).toHaveLength(truth.length)
  for (const t of truth) {
    const d = Math.min(...top.map((p) => Math.hypot(p.x - t.x, p.y - t.y)))
    expect(d / D).toBeLessThan(tol)
  }
}

/** The proposals of a run from the hole under `at`. */
function from(s: Scene, at: Point, extra: Partial<HoleDetectionInput> = {}) {
  return detectFromExample(
    { image: s.image(), region: all(s), pxPerM, expectedHoleDiameter: bullet, ...extra },
    at,
  )
}

describe('detectFromExample', () => {
  it('finds dark holes on light paper with noise, from any hole as the example', () => {
    const s = new Scene(700, 500)
    const truth = [
      { x: 150, y: 140 },
      { x: 420, y: 180 },
      { x: 300.5, y: 370.25 },
    ]
    for (const t of truth) s.hole(t, 60)
    for (const at of truth) {
      const found = from(s, at)?.proposals ?? []
      expectHoles(found, truth, 0.1)
      for (const p of found) {
        expect(p.clusterSize).toBe(1)
        expect(p.confidence).toBeGreaterThan(0.6)
      }
    }
    const first = from(s, defined(truth[0]))?.proposals ?? []
    expect(new Set(first.map((p) => p.clusterId)).size).toBe(3)
    // sorted by confidence
    expect(first.map((p) => p.confidence)).toEqual(
      first.map((p) => p.confidence).sort((a, b) => b - a),
    )
  })

  it('reports the polarity, the colour and the size of the picked hole', () => {
    const s = new Scene(700, 500)
    const truth = [
      { x: 150, y: 140 },
      { x: 420, y: 180 },
    ]
    for (const t of truth) s.hole(t, 60)
    const found = from(s, defined(truth[0]))
    expect(found?.example.polarity).toBe('dark')
    expect(found?.example.backing.r).toBeLessThan(100)
    expect(Math.abs((found?.holeDiameter ?? 0) / bullet - 1)).toBeLessThan(0.2)
    // light holes on a dark area
    const dark = new Scene(900, 900)
    dark.face(450, 450)
    const light = [
      { x: 450 + 15 * pxPerMm, y: 450 + 9 * pxPerMm },
      { x: 450 - 21 * pxPerMm, y: 450 - 5 * pxPerMm },
    ]
    for (const t of light) dark.hole(t, 140)
    expect(from(dark, defined(light[0]))?.example.polarity).toBe('light')
  })

  it('finds light holes on the dark aiming area, also across its edge, and not the dark ones on paper', () => {
    const s = new Scene(900, 900)
    s.face(450, 450)
    const mm = pxPerMm
    const truth = [
      { x: 450 + 15 * mm, y: 450 + 9 * mm },
      { x: 450 - 21 * mm, y: 450 - 5 * mm },
      { x: 450 + 20 * mm, y: 450 + 26 * mm },
    ]
    for (const t of truth) s.hole(t, 140)
    const onPaper = { x: 450 + 50 * mm, y: 450 - 50 * mm }
    s.hole(onPaper, 60)
    const found = from(s, defined(truth[0]))?.proposals ?? []
    expectTop(found, truth, 0.12)
    // the hole on paper is dark: its own example finds it
    expect(
      from(s, onPaper)?.proposals.some(
        (p) => Math.hypot(p.x - onPaper.x, p.y - onPaper.y) < 0.1 * D,
      ),
    ).toBe(true)
  })

  it('finds holes under a curled-paper brightness gradient', () => {
    const s = new Scene(900, 900)
    s.face(450, 450)
    const mm = pxPerMm
    const truth = [
      { x: 450 - 15 * mm, y: 450 + 15 * mm },
      { x: 450 + 20 * mm, y: 450 - 3 * mm },
      { x: 450 - 28 * mm, y: 450 - 28 * mm },
    ]
    for (const t of truth) s.hole(t, 140)
    const curl = (x: number, y: number) => 0.7 + 0.3 * (x / 900) - 0.1 * (y / 900) ** 2
    const found = detectFromExample(
      { image: s.image({ gradient: curl }), region: all(s), pxPerM, expectedHoleDiameter: bullet },
      defined(truth[0]),
    )
    expectTop(found?.proposals ?? [], truth, 0.12)
  })

  it('splits two and three touching holes into one shot per peak and lowers nothing else', () => {
    const s = new Scene(900, 500)
    const pair = [
      { x: 200, y: 250 },
      { x: 200 + 0.85 * D, y: 250 + 0.1 * D },
    ]
    const c = { x: 600, y: 250 }
    const three = [0, 1, 2].map((k) => ({
      x: c.x + 0.6 * D * Math.cos((2 * Math.PI * k) / 3 + 0.3),
      y: c.y + 0.6 * D * Math.sin((2 * Math.PI * k) / 3 + 0.3),
    }))
    for (const t of [...pair, ...three]) s.hole(t, 60)
    const found = from(s, defined(pair[0]))?.proposals ?? []
    expectHoles(found, [...pair, ...three], 0.2)
    const left = found.filter((p) => p.x < 450)
    const right = found.filter((p) => p.x >= 450)
    expect(left.map((p) => p.clusterSize)).toEqual([2, 2])
    expect(right.map((p) => p.clusterSize)).toEqual([3, 3, 3])
    expect(new Set(left.map((p) => p.clusterId)).size).toBe(1)
  })

  it('takes the hole size from the holes of the photo, not from the prior or the picked hole', () => {
    // holes at 0.8 of the bullet and a prior of the bullet: the size comes out near the holes'
    const s = new Scene(900, 600)
    const d = 0.8 * D
    const truth = [
      { x: 150, y: 150 },
      { x: 450, y: 200 },
      { x: 700, y: 400 },
      { x: 250, y: 450 },
    ]
    for (const t of truth) s.hole(t, 60, d)
    for (const prior of [0.85, 1, 1.25]) {
      const found = from(s, defined(truth[0]), { expectedHoleDiameter: bullet * prior })
      expectHoles(found?.proposals ?? [], truth, 0.12)
      expect(
        Math.abs((found?.holeDiameter ?? 0) / (d / pxPerM) - 1),
        `prior ${prior}`,
      ).toBeLessThan(0.3)
    }
  })

  it('finds nothing when the pick is on blank paper, and proposes only inside the region from a pick outside it', () => {
    const s = new Scene(600, 400)
    s.hole({ x: 150, y: 150 }, 60)
    s.hole({ x: 400, y: 250 }, 60)
    expect(from(s, { x: 300, y: 120 })?.proposals ?? []).toEqual([])
    const found = from(s, { x: 150, y: 150 }, { region: { x: 300, y: 0, width: 300, height: 400 } })
    expectHoles(found?.proposals ?? [], [{ x: 400, y: 250 }], 0.1)
    // a pick far outside the photo finds nothing and does not throw
    expect(from(s, { x: -5000, y: -5000 })).toBeUndefined()
    expect(from(s, { x: 9000, y: 200 })).toBeUndefined()
  })

  it('proposes only holes whose centre is inside the region', () => {
    const s = new Scene(800, 600)
    const inside = { x: 300, y: 300 }
    const nearEdge = { x: 300, y: 300 - 0.9 * D }
    const far = { x: 650, y: 120 }
    for (const t of [inside, nearEdge, far]) s.hole(t, 60)
    const square = [
      { x: 200, y: 300 - 0.5 * D },
      { x: 420, y: 300 - 0.5 * D },
      { x: 420, y: 450 },
      { x: 200, y: 450 },
    ]
    // the hole just outside the square touches the one inside and pulls its peak a little
    expectHoles(from(s, inside, { region: square })?.proposals ?? [], [inside], 0.2)
  })
})

describe('autoDetect and findHoles', () => {
  it('finds dark holes on paper without a pick', () => {
    const s = new Scene(700, 500)
    const truth = [
      { x: 150, y: 140 },
      { x: 420, y: 180 },
      { x: 300.5, y: 370.25 },
      { x: 560, y: 380 },
    ]
    for (const t of truth) s.hole(t, 60)
    const found = autoDetect({
      image: s.image(),
      region: all(s),
      pxPerM,
      expectedHoleDiameter: bullet,
    })
    expectHoles(found?.proposals ?? [], truth, 0.1)
    expect(Math.abs((found?.holeDiameter ?? 0) / bullet - 1)).toBeLessThan(0.2)
    expectHoles(
      detectHoles({ image: s.image(), region: all(s), pxPerM, expectedHoleDiameter: bullet }),
      truth,
      0.1,
    )
  })

  it('finds light holes on a dark area without a pick', () => {
    const s = new Scene(900, 900)
    s.rect(0, 0, 900, 900, BLACK)
    const truth = [
      { x: 250, y: 300 },
      { x: 600, y: 250 },
      { x: 450, y: 600 },
    ]
    for (const t of truth) s.hole(t, 150)
    expectHoles(
      detectHoles({ image: s.image(), region: all(s), pxPerM, expectedHoleDiameter: bullet }),
      truth,
      0.1,
    )
  })

  it('proposes nothing on blank paper, also with noise and a brightness gradient', () => {
    const curl = (x: number, y: number) => 0.7 + 0.3 * (x / 900) - 0.1 * (y / 900) ** 2
    const paper = new Scene(600, 400)
    for (const noise of [6, 10])
      expect(
        detectHoles({
          image: paper.image({ noise, gradient: curl }),
          region: all(paper),
          pxPerM,
          expectedHoleDiameter: bullet,
        }),
      ).toEqual([])
  })

  it('does not take the ends of a printed bar, a third of a hole wide, for holes', () => {
    const s = new Scene(1300, 700)
    s.rect(200, 590, 1100, 610, BLACK)
    const truth = [
      { x: 300, y: 200 },
      { x: 700, y: 250 },
      { x: 1000, y: 400 },
      { x: 500, y: 420 },
    ]
    for (const t of truth) s.hole(t, 60)
    expectHoles(
      detectHoles({ image: s.image(), region: all(s), pxPerM, expectedHoleDiameter: bullet }),
      truth,
      0.1,
    )
    expectHoles(from(s, defined(truth[0]))?.proposals ?? [], truth, 0.1)
  })

  it('proposes nothing from a single stain', () => {
    const s = new Scene(600, 400)
    s.hole({ x: 300, y: 200 }, 60)
    expect(
      detectHoles({ image: s.image(), region: all(s), pxPerM, expectedHoleDiameter: bullet }),
    ).toEqual([])
  })

  it('with a backing colour looks for that colour only', () => {
    const paperRgb: [number, number, number] = [PAPER + 4, PAPER, PAPER - 6]
    const s = new Scene(900, 900)
    s.face(450, 450)
    const mm = pxPerMm
    const yellow: [number, number, number] = [250, 228, 120]
    const truth = [
      { x: 450 + 28 * mm, y: 450 - 28 * mm },
      { x: 450 - 27 * mm, y: 450 + 28 * mm },
      { x: 450 + 28 * mm, y: 450 + 28 * mm },
    ]
    for (const t of truth) s.colourHole(t, yellow)
    const options = { image: s.image(), region: all(s), pxPerM, expectedHoleDiameter: bullet }
    const found = detectHoles({ ...options, backing: { r: yellow[0], g: yellow[1], b: yellow[2] } })
    for (const t of truth)
      expect(Math.min(...found.map((p) => Math.hypot(p.x - t.x, p.y - t.y))) / D).toBeLessThan(0.12)
    expect(paperRgb[0]).toBeGreaterThan(0)
  })

  it('refuses a backing colour channel that is not a number from 0 to 255', () => {
    const s = new Scene(200, 200)
    const ok = { image: s.image(), region: all(s), pxPerM, expectedHoleDiameter: bullet }
    for (const backing of [
      { r: Number.NaN, g: 0, b: 0 },
      { r: 0, g: 300, b: 0 },
    ])
      expect(() => detectHoles({ ...ok, backing })).toThrow(RangeError)
  })

  it('without a region looks on the paper only, not on the background around it', () => {
    const s = new Scene(1100, 800)
    s.rect(0, 0, 1100, 800, 50)
    s.rect(250, 150, 850, 650, PAPER)
    for (const m of [
      { x: 100, y: 100 },
      { x: 120, y: 650 },
      { x: 980, y: 400 },
    ])
      s.disc(m.x, m.y, D / 2, 150)
    const truth = [
      { x: 450, y: 350 },
      { x: 560, y: 420 },
      { x: 500, y: 480 },
      { x: 700, y: 300 },
    ]
    for (const t of truth) s.hole(t, 60)
    const image = s.image()
    const area = paperOutline(image)
    expect(Math.min(...area.map((p) => p.x))).toBeGreaterThan(200)
    expect(Math.max(...area.map((p) => p.x))).toBeLessThan(900)
    expectHoles(detectHoles({ image, pxPerM, expectedHoleDiameter: bullet }), truth, 0.1)
  })

  it('takes the whole photo as the target when no light area fills a tenth of it', () => {
    const s = new Scene(600, 400)
    s.rect(0, 0, 600, 400, BLACK)
    expect(paperOutline(s.image())).toEqual([
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 400 },
      { x: 0, y: 400 },
    ])
  })

  it('drops a proposal far from the group but keeps a flier and a second group', () => {
    const s = new Scene(1600, 1000)
    const group = [
      { x: 300, y: 300 },
      { x: 400, y: 330 },
      { x: 340, y: 420 },
      { x: 250, y: 400 },
    ]
    const flier = { x: 560, y: 520 }
    const second = [
      { x: 900, y: 300 },
      { x: 1000, y: 340 },
    ]
    const stain = { x: 1500, y: 900 }
    for (const t of [...group, flier, ...second, stain]) s.hole(t, 60)
    const found = from(s, defined(group[0]))?.proposals ?? []
    expectHoles(found, [...group, flier, ...second], 0.1)
  })

  it('finds 12 holes on a 4000 x 3000 px region with 4 px work blocks', () => {
    const s = new Scene(4000, 3000)
    const truth: Point[] = []
    for (let k = 0; k < 12; k++)
      truth.push({ x: 300 + (k % 4) * 1000, y: 400 + Math.floor(k / 4) * 1000 })
    for (const t of truth) s.hole(t, 60)
    const image = s.image()
    const start = performance.now()
    const found = detectFromExample(
      { image, region: all(s), pxPerM, expectedHoleDiameter: bullet },
      defined(truth[0]),
    )
    const ms = performance.now() - start
    expectHoles(found?.proposals ?? [], truth, 0.1)
    // the time is a measure, not a check: it depends on the machine
    console.log(`detectFromExample on 4000 x 3000 px: ${Math.round(ms)} ms`)
    // blocks of 4 px: 1000 x 750 working px, a hole about 15 px across
    expect(workBlockSize(D, 4000, 3000)).toBe(4)
  })

  it('refuses an infinite scale or size, a pixel count other than width x height and a region point that is not a number', () => {
    const s = new Scene(200, 200)
    const image = s.image()
    const ok = { image, region: all(s), pxPerM, expectedHoleDiameter: bullet }
    expect(detectHoles(ok)).toEqual([])
    for (const bad of [
      { pxPerM: Number.POSITIVE_INFINITY },
      { expectedHoleDiameter: Number.POSITIVE_INFINITY },
      { holeScale: Number.POSITIVE_INFINITY },
      { minContrast: Number.NaN },
      { image: { ...image, data: image.data.subarray(4) } },
      { image: { ...image, width: 199.5 } },
      {
        region: [
          { x: 0, y: 0 },
          { x: Number.NaN, y: 0 },
          { x: 100, y: 100 },
        ],
      },
    ])
      expect(() => detectHoles({ ...ok, ...bad }), JSON.stringify(Object.keys(bad))).toThrow(
        RangeError,
      )
  })
})

describe('measured hole size', () => {
  it('gives each proposal the diameter of a disc of its area per shot', () => {
    const s = new Scene(800, 400)
    const singles = [
      { x: 150, y: 200, d: D },
      { x: 400, y: 200, d: 0.9 * D },
      { x: 700, y: 120, d: D },
    ]
    for (const t of singles) s.hole(t, 60, t.d)
    const found = from(s, defined(singles[0]))?.proposals ?? []
    for (const t of singles) {
      const p = found.find((f) => Math.hypot(f.x - t.x, f.y - t.y) < 0.2 * D)
      expect(p?.clusterSize).toBe(1)
      expect(Math.abs((p?.diameter ?? 0) / t.d - 1)).toBeLessThan(0.25)
    }
  })
})

describe('progress', () => {
  it('reports the share of the work done, rising to 1', () => {
    const s = new Scene(500, 400)
    s.hole({ x: 150, y: 150 }, 60)
    s.hole({ x: 350, y: 250 }, 60)
    const done: number[] = []
    detectFromExample(
      {
        image: s.image(),
        region: all(s),
        pxPerM,
        expectedHoleDiameter: bullet,
        onProgress: (d) => done.push(d),
      },
      { x: 150, y: 150 },
    )
    expect(done.length).toBeGreaterThan(2)
    expect(done).toEqual([...done].sort((a, b) => a - b))
    expect(done.at(-1)).toBe(1)
  })
})

describe('expectedHoleSize', () => {
  const bulletM = 0.00762
  it('takes the size typed first, then the median of confirmed holes once there are enough, then the bullet, then the marker', () => {
    const holes = [0.0081, 0.0079, 0.0102]
    expect(
      expectedHoleSize({
        typedDiameter: 0.007,
        confirmedDiameters: holes,
        bulletDiameter: bulletM,
        markerDiameter: 0.006,
      }),
    ).toEqual({
      diameter: 0.007,
      source: 'typed',
    })
    expect(expectedHoleSize({ confirmedDiameters: holes, bulletDiameter: bulletM })).toEqual({
      diameter: 0.0081,
      source: 'learned',
    })
    expect(expectedHoleSize({ confirmedDiameters: [0.008, 0.009, 0.0081, 0.0084] })).toEqual({
      diameter: (0.0081 + 0.0084) / 2,
      source: 'learned',
    })
    expect(
      expectedHoleSize({
        confirmedDiameters: holes.slice(0, MIN_HOLES_TO_LEARN_SIZE - 1),
        bulletDiameter: bulletM,
      }),
    ).toEqual({
      diameter: bulletM,
      source: 'bullet',
    })
    expect(expectedHoleSize({ confirmedDiameters: [], markerDiameter: 0.006 })).toEqual({
      diameter: 0.006,
      source: 'marker',
    })
    expect(expectedHoleSize({ confirmedDiameters: [] })).toBeUndefined()
  })
})

describe('workBlockSize', () => {
  it('averages a hole to about 16 working px while the region is small enough', () => {
    expect(workBlockSize(20, 1000, 1000)).toBe(1)
    expect(workBlockSize(61, 4000, 3000)).toBe(4)
    expect(workBlockSize(61, 4000, 3000) * 16).toBeGreaterThan(61 - 16)
  })

  it('averages over larger blocks when the working pixels would pass the cap', () => {
    for (const [hole, w, h] of [
      [20, 4000, 3000],
      [24, 8000, 6000],
      [60, 20000, 20000],
    ] satisfies [number, number, number][]) {
      const s = workBlockSize(hole, w, h)
      expect(Math.ceil(w / s) * Math.ceil(h / s), `${hole} ${w} ${h}`).toBeLessThanOrEqual(
        MAX_WORK_PIXELS,
      )
      expect(hole / s).toBeGreaterThanOrEqual(4)
    }
  })

  it('refuses a region too large for its holes instead of working on too few px per hole', () => {
    expect(() => workBlockSize(5, 20000, 20000)).toThrow(RangeError)
  })
})

describe('the printed zero target', () => {
  it('finds five holes on the sheet: two in the black square, one on a grid line, two on paper', () => {
    const s = new Scene(210 * pxPerMm, 297 * pxPerMm)
    const ink = sheetInk(sheetSvg({ rifle: 'Rifle 1', distance: '100', group: 'Group 1' }))
    for (let y = 0; y < s.height; y++)
      for (let x = 0; x < s.width; x++) s.lum[y * s.width + x] = ink(x / pxPerMm, y / pxPerMm)
    // sheet mm right and up of the centre to photo px
    const at = (x: number, y: number) => ({ x: (105 + x) * pxPerMm, y: (148.5 - y) * pxPerMm })
    const inSquare = [at(-6, 5), at(5, -6)]
    const onPaper = [at(30, 10), at(-25, 18), at(20, -30)]
    for (const t of inSquare) s.hole(t, 140)
    for (const t of onPaper) s.hole(t, 60)
    const truth = [...inSquare, ...onPaper]
    const image = s.image()
    // a run finds one polarity: the light holes in a region about the black square, then the dark
    // ones on the whole sheet
    const square = { x: at(-20, 0).x, y: at(0, 20).y, width: 40 * pxPerMm, height: 40 * pxPerMm }
    const options = { image, pxPerM, expectedHoleDiameter: bullet }
    const found = [
      ...detectHoles({ ...options, region: square, polarity: 'light' }),
      ...detectHoles({ ...options, region: all(s), polarity: 'dark' }),
    ]
    const near = (p: Point) => truth.some((t) => Math.hypot(p.x - t.x, p.y - t.y) < 0.5 * D)
    for (const t of truth)
      expect(found.some((p) => Math.hypot(p.x - t.x, p.y - t.y) < 0.2 * D)).toBe(true)
    // no proposal on the print: the dark run reads the black square with the two light holes in it
    // as print, and the marks, digits, cross and bar give none
    expect(found.filter((p) => !near(p))).toEqual([])
  })
})
