import { type BulletDimensions, bulletProfile } from '@open-reloading/drawing/bullet'
import { describe, expect, it } from 'vitest'
import {
  grayOf,
  paintDisc,
  pointUncertainty,
  type Segmentation,
  scaleOf,
  segment,
} from '../src/lib/bullet-photo.ts'
import { measureOutline, type PhotoField } from '../src/lib/bullet-photo-measure.ts'
import { fitOutline } from '../src/lib/bullet-photo-outline.ts'
import { type PhotoSpec, renderPhoto, sampleShape } from '../src/lib/bullet-photo-sample.ts'
import { defined } from './defined.ts'

const spec = (shape: BulletDimensions, over: Partial<PhotoSpec> = {}): PhotoSpec => ({
  shape,
  pxPerMm: 24,
  width: 1300,
  height: 640,
  base: { x: 180, y: 250 },
  angle: (4 * Math.PI) / 180,
  paper: 225,
  bullet: 110,
  gradient: 0,
  shading: 0,
  noise: 0,
  blur: 0.6,
  ruler: { x0: 30, y: 540, heightPx: 70, lengthMm: 45, toEdges: true },
  seed: 3,
  ...over,
})

const tangent: BulletDimensions = {
  diameter: 7.82,
  length: 30,
  noseLength: 17.5,
  meplatDiameter: 0.5,
  ogive: { form: 'tangent', radiusRatio: 1 },
}

/** The bullets of the acceptance criterion: tangent, secant, boat tail, flat base, meplat. */
const bullets: Record<string, BulletDimensions> = {
  'tangent, flat base': tangent,
  'secant, flat base': { ...tangent, ogive: { form: 'secant', radiusRatio: 0.7 } },
  'tangent, boat tail': { ...tangent, base: { type: 'boat-tail', length: 5.5, angle: 7 } },
  'secant, boat tail': {
    ...tangent,
    ogive: { form: 'secant', radiusRatio: 0.75 },
    base: { type: 'boat-tail', length: 6, angle: 8 },
  },
  'tangent, wide meplat': { ...tangent, meplatDiameter: 2.2 },
  'tangent, boat tail, cannelure': sampleShape,
}

/** The photograph of `s` cut out, outlined and measured, with the exact scale of its ruler. */
function measured(s: PhotoSpec) {
  const photo = renderPhoto(s)
  const span = defined(photo.span)
  const seg = segment(grayOf(photo.image), [span.a, span.b])
  const outline = defined(fitOutline(seg))
  const scale = defined(scaleOf([span]))
  return { photo, seg, outline, scale, m: measureOutline(outline, scale) }
}

/** The value a drawing gives for each field, mm, ratio and degrees. */
function truthOf(shape: BulletDimensions): Partial<Record<PhotoField, number>> {
  const p = bulletProfile(shape, () => true, 'entered')
  if ('reason' in p) throw new Error(p.reason)
  const o = p.outline
  return {
    length: shape.length,
    diameter: shape.diameter,
    noseLength: o.noseLength,
    bearingLength: o.bearingLength,
    meplatDiameter: shape.meplatDiameter ?? 0,
    ...(shape.base?.type === 'boat-tail' && { 'base.length': defined(shape.base.length) }),
    ...(shape.cannelure && {
      'cannelure.start': shape.cannelure.start,
      'cannelure.width': shape.cannelure.width,
    }),
  }
}

describe('scaleOf', () => {
  it('reads the px per mm from one span, with the uncertainty of the two placed points', () => {
    const s = defined(scaleOf([{ a: { x: 0, y: 0 }, b: { x: 600, y: 0 }, mm: 20 }]))
    expect(s.pxPerMm).toBe(30)
    expect(s.relUncertainty).toBeCloseTo((Math.SQRT2 * pointUncertainty) / 600, 12)
  })

  it('adds half the disagreement of two spans', () => {
    const one = defined(scaleOf([{ a: { x: 0, y: 0 }, b: { x: 600, y: 0 }, mm: 20 }]))
    const two = defined(
      scaleOf([
        { a: { x: 0, y: 0 }, b: { x: 600, y: 0 }, mm: 20 },
        { a: { x: 0, y: 10 }, b: { x: 306, y: 10 }, mm: 10 },
      ]),
    )
    expect(two.pxPerMm).toBeCloseTo(30.3, 9)
    expect(two.relUncertainty).toBeGreaterThan(one.relUncertainty)
    expect(two.relUncertainty).toBeGreaterThan(0.004)
  })

  it('gives none for no span or a span of no length', () => {
    expect(scaleOf([])).toBeUndefined()
    expect(scaleOf([{ a: { x: 5, y: 5 }, b: { x: 5, y: 5 }, mm: 10 }])).toBeUndefined()
  })
})

describe('bullets of known size, rendered with a ruler', () => {
  for (const [name, shape] of Object.entries(bullets))
    it(`${name}: every length within 2 px, the nose form told, each value inside its uncertainty`, () => {
      const s = spec(shape)
      const { m, scale } = measured(s)
      const truth = truthOf(shape)
      const px = 2 / scale.pxPerMm
      for (const [key, want] of Object.entries(truth)) {
        const got = defined(m.values[key as PhotoField])
        expect(
          Math.abs(got.value - want),
          `${key}: ${got.value} against ${want}`,
        ).toBeLessThanOrEqual(key === 'cannelure.width' ? 3 / scale.pxPerMm : px)
        expect(got.uncertainty).toBeGreaterThan(0)
        expect(Math.abs(got.value - want), `${key} inside 3 u`).toBeLessThanOrEqual(
          3 * got.uncertainty,
        )
      }
      expect(m.ogiveForm).toBe(shape.ogive?.form)
      expect(m.baseType).toBe(shape.base?.type === 'boat-tail' ? 'boat-tail' : 'flat')
      expect(Boolean(m.values['cannelure.start'])).toBe(shape.cannelure !== undefined)
    })

  it('finds the ogive radius and Rt/R of the drawing', () => {
    const shape = { ...tangent, ogive: { form: 'secant', radiusRatio: 0.7 } }
    const { m } = measured(spec(shape))
    const p = bulletProfile(shape, () => true, 'entered')
    if ('reason' in p) throw new Error(p.reason)
    const k = 7.82 / 2 - 0.25
    const rt = (p.outline.noseLength ** 2 + k ** 2) / (2 * k)
    const ratio = defined(m.values['ogive.radiusRatio'])
    const radius = defined(m.values['ogive.radius'])
    expect(Math.abs(ratio.value - 0.7)).toBeLessThanOrEqual(3 * ratio.uncertainty)
    expect(Math.abs(radius.value - rt / 0.7)).toBeLessThanOrEqual(3 * radius.uncertainty)
  })

  it('holds with the bullet at any angle and the nose to the left', () => {
    const where: [number, number, number][] = [
      [Math.PI, 1000, 250],
      [-0.6, 250, 600],
      [2.4, 1100, 200],
    ]
    for (const [angle, x, y] of where) {
      const s = spec(tangent, {
        angle,
        base: { x, y },
        height: 900,
        ruler: { x0: 30, y: 810, heightPx: 70, lengthMm: 45, toEdges: true },
      })
      const { m, scale } = measured(s)
      expect(Math.abs(defined(m.values.length).value - 30)).toBeLessThanOrEqual(2 / scale.pxPerMm)
      expect(m.ogiveForm).toBe('tangent')
    }
  })

  it('holds with a lighting gradient, side shading, noise and blur', () => {
    const s = spec(bullets['tangent, boat tail'] as BulletDimensions, {
      gradient: 60,
      shading: 30,
      noise: 5,
      blur: 1.2,
    })
    const { m, scale } = measured(s)
    expect(Math.abs(defined(m.values.length).value - 30)).toBeLessThanOrEqual(2 / scale.pxPerMm)
    expect(Math.abs(defined(m.values.diameter).value - 7.82)).toBeLessThanOrEqual(2 / scale.pxPerMm)
    expect(m.ogiveForm).toBe('tangent')
  })

  it('holds for a light bullet on a dark background', () => {
    const s = spec(bullets['secant, boat tail'] as BulletDimensions, { paper: 30, bullet: 190 })
    const { m, scale } = measured(s)
    expect(Math.abs(defined(m.values.length).value - 30)).toBeLessThanOrEqual(2 / scale.pxPerMm)
    expect(m.ogiveForm).toBe('secant')
  })

  it('leaves out the ruler that does not touch the photograph edge, by the clicked points', () => {
    const s = spec(tangent, {
      ruler: { x0: 30, y: 540, heightPx: 70, lengthMm: 45, toEdges: false },
    })
    const { m, scale } = measured(s)
    expect(Math.abs(defined(m.values.length).value - 30)).toBeLessThanOrEqual(2 / scale.pxPerMm)
  })

  it('states a wider uncertainty for a scale from two spans that disagree', () => {
    const s = spec(tangent)
    const photo = renderPhoto(s)
    const span = defined(photo.span)
    const outline = defined(fitOutline(segment(grayOf(photo.image), [span.a, span.b])))
    const exact = measureOutline(outline, defined(scaleOf([span])))
    const off = measureOutline(
      outline,
      defined(
        scaleOf([span, { a: span.a, b: { x: span.a.x + 10 * 24 * 1.02, y: span.a.y }, mm: 10 }]),
      ),
    )
    expect(defined(off.values.length).uncertainty).toBeGreaterThan(
      defined(exact.values.length).uncertainty,
    )
  })
})

describe('segment', () => {
  it('finds nothing in a photograph of one grey', () => {
    const photo = renderPhoto(spec(tangent, { bullet: 225, ruler: undefined }))
    const s = segment(grayOf(photo.image))
    expect(s.alpha.every((v) => v === 0)).toBe(true)
    expect(s.warnings).not.toHaveLength(0)
  })

  it('warns when the cut-out touches the edge of the photograph', () => {
    const photo = renderPhoto(spec(tangent, { base: { x: 2, y: 250 }, ruler: undefined }))
    expect(segment(grayOf(photo.image)).warnings.join(' ')).toMatch(/edge/)
  })
})

describe('the brush', () => {
  it('paints a disc of its radius with the bullet or the background, clipped at the photograph edge', () => {
    const seg: Segmentation = { width: 20, height: 20, alpha: new Uint8Array(400), warnings: [] }
    paintDisc(seg, { x: 10, y: 10 }, 3, 255)
    expect(seg.alpha[10 * 20 + 10]).toBe(255)
    expect(seg.alpha[10 * 20 + 14]).toBe(0)
    paintDisc(seg, { x: 10, y: 10 }, 1, 0)
    expect(seg.alpha[10 * 20 + 10]).toBe(0)
    expect(seg.alpha[10 * 20 + 12]).toBe(255)
    paintDisc(seg, { x: 0, y: 0 }, 4, 255)
    expect(seg.alpha[0]).toBe(255)
  })

  it('moves the outline with the correction', () => {
    const photo = renderPhoto(spec(tangent))
    const span = defined(photo.span)
    const seg = segment(grayOf(photo.image), [span.a, span.b])
    const before = defined(fitOutline(seg))
    // the base end rubbed out
    paintDisc(seg, { x: 195, y: 252 }, 40, 0)
    expect(defined(fitOutline(seg)).length).toBeLessThan(before.length - 20)
  })
})
