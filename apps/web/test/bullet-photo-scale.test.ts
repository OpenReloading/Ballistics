import type { BulletDimensions } from '@open-reloading/drawing/bullet'
import { describe, expect, it } from 'vitest'
import { scaleOf } from '../src/lib/bullet-photo.ts'
import { segmentPhoto } from '../src/lib/bullet-photo-colour.ts'
import { measureOutline } from '../src/lib/bullet-photo-measure.ts'
import { fitOutline } from '../src/lib/bullet-photo-outline.ts'
import { renderPhoto } from '../src/lib/bullet-photo-sample.ts'
import { resolveScale } from '../src/lib/bullet-photo-scale.ts'
import { defined } from './defined.ts'

const shape: BulletDimensions = {
  diameter: 7.82,
  length: 30,
  noseLength: 17.5,
  meplatDiameter: 0.5,
  ogive: { form: 'secant', radiusRatio: 0.75 },
  base: { type: 'boat-tail', length: 5.5, angle: 7 },
}

/** The photograph of the bullet at 20 px per mm, measured at 1 px per mm (its values are px), and the scale of its ruler. */
function photographed() {
  const photo = renderPhoto({
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
  })
  const span = defined(photo.span)
  const seg = segmentPhoto(photo.image, [span.a, span.b])
  const outline = defined(fitOutline(seg, { edgeSpread: seg.edgeSpread }))
  return {
    px: measureOutline(outline, { pxPerMm: 1, relUncertainty: 0 }),
    outline,
    ruler: defined(scaleOf([span])),
  }
}

describe('the scale from caliper sizes', () => {
  const { px, outline, ruler } = photographed()

  it('takes the scale from the diameter and the length without a ruler, and measures with it', () => {
    const { scale, notes } = resolveScale(px, undefined, { diameter: 7.82, length: 30 })
    expect(notes).toEqual([])
    expect(Math.abs(defined(scale).pxPerMm / 20 - 1)).toBeLessThan(0.01)
    const m = measureOutline(outline, defined(scale))
    for (const [key, want] of [
      ['length', 30],
      ['diameter', 7.82],
      ['noseLength', 17.5],
    ] as const) {
      const v = defined(m.values[key])
      expect(Math.abs(v.value - want), key).toBeLessThanOrEqual(Math.max(3 * v.uncertainty, 0.1))
    }
  })

  it('takes the scale from one size alone', () => {
    for (const known of [{ diameter: 7.82 }, { length: 30 }]) {
      const { scale, notes } = resolveScale(px, undefined, known)
      expect(notes).toEqual([])
      expect(Math.abs(defined(scale).pxPerMm / 20 - 1)).toBeLessThan(0.02)
    }
  })

  it('has no scale without a ruler or a size, and ignores a size that is not positive', () => {
    expect(resolveScale(px, undefined, {}).scale).toBeUndefined()
    expect(resolveScale(px, undefined, { diameter: 0, length: -3 }).scale).toBeUndefined()
  })

  it('keeps the ruler and says nothing when the sizes agree with it', () => {
    const r = resolveScale(px, ruler, { diameter: 7.82, length: 30 })
    expect(r.scale).toBe(ruler)
    expect(r.notes).toEqual([])
  })

  it('says which size is away from the ruler, in percent', () => {
    const r = resolveScale(px, ruler, { diameter: 8.5, length: 30 })
    expect(r.scale).toBe(ruler)
    expect(r.notes).toHaveLength(1)
    expect(r.notes[0]).toMatch(/diameter in the photograph is \d+\.\d %/)
  })

  it('says that two sizes give scales apart, and uses their mean with the difference in its uncertainty', () => {
    const agree = defined(resolveScale(px, undefined, { diameter: 7.82, length: 30 }).scale)
    const r = resolveScale(px, undefined, { diameter: 8.5, length: 30 })
    expect(r.notes).toHaveLength(1)
    expect(r.notes[0]).toMatch(/scales \d+\.\d % apart/)
    expect(defined(r.scale).relUncertainty).toBeGreaterThan(3 * agree.relUncertainty)
  })
})
