import type { BulletDimensions } from '@open-reloading/drawing/bullet'
import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import { grayOf, scaleOf, segment } from '../src/lib/bullet-photo.ts'
import { segmentPhoto } from '../src/lib/bullet-photo-colour.ts'
import { measureOutline, type PhotoField } from '../src/lib/bullet-photo-measure.ts'
import { fitOutline, type Outline } from '../src/lib/bullet-photo-outline.ts'
import { minWidthPx, outlineHints } from '../src/lib/bullet-photo-quality.ts'
import { type PhotoSpec, renderPhoto } from '../src/lib/bullet-photo-sample.ts'
import { say, type Wording } from '../src/lib/wording.ts'
import { defined } from './defined.ts'

/** The English text of sentences for the user. */
const text = (w: readonly Wording[]) => w.map((x) => say(english.t, x)).join(' ')

const area = (s: { alpha: Uint8Array }) => s.alpha.reduce((n, v) => n + (v >= 128 ? 1 : 0), 0)

const shape: BulletDimensions = {
  diameter: 7.82,
  length: 30,
  noseLength: 17.5,
  meplatDiameter: 0.5,
  ogive: { form: 'secant', radiusRatio: 0.75 },
  base: { type: 'boat-tail', length: 5.5, angle: 7 },
}

const spec = (over: Partial<PhotoSpec> = {}): PhotoSpec => ({
  shape,
  pxPerMm: 20,
  width: 900,
  height: 420,
  base: { x: 130, y: 200 },
  angle: (3 * Math.PI) / 180,
  paper: 225,
  bullet: 110,
  gradient: 0,
  shading: 0,
  noise: 1,
  blur: 0.6,
  ruler: { x0: 20, y: 340, heightPx: 50, lengthMm: 30, toEdges: true },
  seed: 5,
  ...over,
})

/** The photograph of `s` cut out (by luma, or by colour where luma does not tell), outlined and measured, with the exact scale of its ruler. */
function measured(s: PhotoSpec) {
  const photo = renderPhoto(s)
  const span = defined(photo.span)
  const seg = segmentPhoto(photo.image, [span.a, span.b])
  const outline = defined(fitOutline(seg, { edgeSpread: seg.edgeSpread }))
  const scale = defined(scaleOf([span]))
  return { seg, outline, scale, m: measureOutline(outline, scale) }
}

/** The length-like values of the drawing, mm. */
const truth: Partial<Record<PhotoField, number>> = {
  length: 30,
  diameter: 7.82,
  noseLength: 17.5,
  'base.length': 5.5,
}

/** Every value of `m` that has a truth is within `k` standard uncertainties of it, or 2 px if that is more. */
function expectNear(m: ReturnType<typeof measured>, k: number) {
  for (const [key, want] of Object.entries(truth)) {
    const got = defined(m.m.values[key as PhotoField])
    expect(Math.abs(got.value - want), key).toBeLessThanOrEqual(
      Math.max(k * got.uncertainty, 2 / m.scale.pxPerMm),
    )
  }
}

describe('a photograph that is hard to cut out', () => {
  it('keeps a tip much paler than the shank', () => {
    const r = measured(spec({ tip: { from: 17, grey: 175 } }))
    expectNear(r, 3)
    expect(Math.abs(r.outline.length / r.scale.pxPerMm - 30)).toBeLessThan(0.2)
  })

  it('keeps the whole length when a reflection along the axis opens to the tip', () => {
    const r = measured(spec({ glare: { from: 12, widthPx: 12 } }))
    expect(Math.abs(r.outline.length / r.scale.pxPerMm - 30)).toBeLessThan(0.2)
  })

  it('cuts a bullet out from black bars at the sides', () => {
    const r = measured(spec({ bars: 60, base: { x: 190, y: 200 } }))
    expect(Math.abs(r.outline.length / r.scale.pxPerMm - 30)).toBeLessThan(0.2)
  })

  it('tells a bullet from a background of the same brightness by colour', () => {
    const luma = segment(grayOf(renderPhoto(spec({ bullet: 190, chroma: 40 })).image))
    expect(luma.warnings.length).toBeGreaterThan(0)
    const r = measured(spec({ bullet: 190, chroma: 40 }))
    expect(Math.abs(r.outline.length / r.scale.pxPerMm - 30)).toBeLessThan(0.2)
    expectNear(r, 3)
  })
})

describe('a bullet darker than the paper on one side and brighter on the other', () => {
  /** The photograph of `s` with the bullet's lower half recoloured pale copper, brighter than the grey paper. */
  function highlighted(s: PhotoSpec) {
    const photo = renderPhoto(s)
    const { data, width } = photo.image
    for (let y = s.base.y + 1; y < s.base.y + 100; y++)
      for (let x = s.base.x; x < s.base.x + 30 * s.pxPerMm; x++) {
        const i = 4 * (y * width + x)
        const cover = Math.min(1, Math.max(0, (s.paper - (data[i] ?? 0)) / (s.paper - s.bullet)))
        ;[235, 190, 170].forEach((v, c) => {
          data[i + c] = s.paper + cover * (v - s.paper)
        })
      }
    return photo
  }

  it('is cut out whole where the brightness alone gives the dark half', () => {
    const s = spec({ paper: 150, bullet: 100, angle: 0 })
    const photo = highlighted(s)
    const span = defined(photo.span)
    const covered = (a: Uint8Array) => a.filter((v) => v >= 128).length
    const luma = segment(grayOf(photo.image), [span.a, span.b])
    const seg = segmentPhoto(photo.image, [span.a, span.b])
    expect(covered(luma.alpha)).toBeLessThan(0.7 * covered(seg.alpha))
    const outline = defined(fitOutline(seg, { edgeSpread: seg.edgeSpread }))
    const scale = defined(scaleOf([span]))
    expect(Math.abs(outline.length / scale.pxPerMm - 30)).toBeLessThan(0.2)
    expect(defined(measureOutline(outline, scale).values.diameter).value).toBeCloseTo(7.82, 0)
  })
})

describe('more than one bullet in the photograph', () => {
  it('says that another object is in the photograph, and says nothing for a single bullet', () => {
    const tall = {
      height: 560,
      ruler: { x0: 20, y: 470, heightPx: 50, lengthMm: 30, toEdges: true },
    }
    const [a, b] = [
      spec({ ...tall, base: { x: 130, y: 100 } }),
      spec({ ...tall, base: { x: 130, y: 290 } }),
    ]
    const [one, two] = [renderPhoto(a), renderPhoto(b)]
    const both = one.image.data.map((v, i) => Math.min(v, two.image.data[i] ?? v))
    const image = { ...one.image, data: both }
    const span = defined(one.span)
    const seg = segmentPhoto(image, [span.a, span.b])
    expect(text(seg.warnings)).toMatch(/Another object/)
    expect(text(segmentPhoto(one.image, [span.a, span.b]).warnings)).not.toMatch(/Another object/)
  })
})

describe('a photograph of more than 900 px', () => {
  it('is cut at its own size and gives the same bullet', () => {
    const big = spec({
      pxPerMm: 40,
      width: 1800,
      height: 840,
      base: { x: 260, y: 400 },
      ruler: { x0: 40, y: 680, heightPx: 100, lengthMm: 30, toEdges: true },
    })
    const photo = renderPhoto(big)
    const span = defined(photo.span)
    const seg = segmentPhoto(photo.image, [span.a, span.b])
    expect([seg.width, seg.height, seg.alpha.length]).toEqual([1800, 840, 1800 * 840])
    const outline = defined(fitOutline(seg, { edgeSpread: seg.edgeSpread }))
    expect(Math.abs(outline.length / 40 - 30)).toBeLessThan(0.2)
  })
})

describe('soft edges', () => {
  it('flags a blurred photograph and widens the uncertainty', () => {
    const sharp = measured(spec())
    const soft = measured(spec({ blur: 5 }))
    expect(sharp.seg.warnings).toEqual([])
    expect(text(soft.seg.warnings)).toMatch(/soft/)
    expect(defined(soft.m.values.diameter).uncertainty).toBeGreaterThan(
      3 * defined(sharp.m.values.diameter).uncertainty,
    )
    expectNear(soft, 3)
  })

  it('flags a soft shadow beside the bullet and keeps the diameter within its uncertainty', () => {
    const r = measured(spec({ shadow: { dx: 0, dy: 40, blur: 14, depth: 0.3 } }))
    expect(text(r.seg.warnings)).toMatch(/soft/)
    expectNear(r, 3)
  })
})

describe('the size of the bullet in the photograph', () => {
  const outlineOf = (halfWidth: number, length: number): Outline => ({
    origin: { x: 0, y: 0 },
    angle: 0,
    length,
    z: Array.from({ length: length - 2 }, (_, i) => i + 1),
    r: Array.from({ length: length - 2 }, () => halfWidth),
    ambiguous: false,
    edge: 0.3,
  })

  it('names no ragged edge where no cut-out was found', () => {
    const grey = { width: 80, height: 60, data: new Uint8ClampedArray(80 * 60 * 4).fill(120) }
    const seg = segmentPhoto(grey)
    expect(area(seg)).toBe(0)
    expect(text(seg.warnings)).not.toMatch(/ragged/)
  })

  it('refuses a bullet too narrow to measure and says how to fix it', () => {
    const h = outlineHints(outlineOf(minWidthPx / 2 - 2, 200))
    expect(text(h.unusable ? [h.unusable] : [])).toMatch(/too small to measure/)
    expect(text(h.unusable ? [h.unusable] : [])).toMatch(/closer/)
  })

  it('refuses a cut-out that is not longer than wide', () => {
    const long = outlineHints(outlineOf(90, 120)).unusable
    expect(text(long ? [long] : [])).toMatch(/not the shape of a bullet/)
  })

  it('gives a hint for a narrow bullet and none for a wide one', () => {
    const narrow = outlineHints(outlineOf(15, 200))
    expect(narrow.unusable).toBeUndefined()
    expect(narrow.hints).toHaveLength(1)
    expect(text(narrow.hints)).toMatch(/px across/)
    expect(outlineHints(outlineOf(60, 400))).toEqual({ hints: [] })
  })

  it('withholds the values of a photograph at 1 px per mm and measures one at 20', () => {
    const tiny = renderPhoto(
      spec({ pxPerMm: 1.5, blur: 0.4, ruler: undefined, base: { x: 100, y: 200 } }),
    )
    const seg = segmentPhoto(tiny.image)
    const outline = defined(fitOutline(seg))
    expect(outlineHints(outline).unusable).toBeDefined()
    expect(outlineHints(measured(spec()).outline)).toEqual({ hints: [] })
  })
})

describe('no confident wrong number', () => {
  const faults: Record<string, Partial<PhotoSpec>> = {
    'a deep shadow': { shadow: { dx: 0, dy: 30, blur: 10, depth: 0.5 } },
    'a faint shadow': { shadow: { dx: 10, dy: 40, blur: 16, depth: 0.15 } },
    'a heavy blur': { blur: 7 },
    'a pale bullet': { bullet: 170 },
    noise: { noise: 12 },
    'a lighting gradient': { gradient: 50, shading: 30 },
  }
  for (const [name, over] of Object.entries(faults))
    it(`${name}: every value is within 3 uncertainties of the truth, or a warning says it may not be`, () => {
      const r = measured(spec(over))
      const warned = r.seg.warnings.length > 0 || outlineHints(r.outline).hints.length > 0
      if (warned) return
      expectNear(r, 3)
    })
})
