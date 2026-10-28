import { describe, expect, it } from 'vitest'
import { cylinderInertia, InputError, outlineInertia } from '../src/index.ts'

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b)

describe('outlineInertia', () => {
  it('matches the closed forms of a cone', () => {
    const [m, d, h] = [0.01, 0.008, 0.024]
    const r = outlineInertia({ mass: m, diameter: d, length: h, noseLength: h, headShape: 0 })
    const a = d / 2
    expect(rel(r.volume, (Math.PI * a * a * h) / 3)).toBeLessThan(1e-6)
    expect(rel(r.centreFromBase, h / 4)).toBeLessThan(1e-6)
    expect(rel(r.axial, 0.3 * m * a * a)).toBeLessThan(1e-6)
    expect(rel(r.transverse, m * ((3 / 20) * a * a + (3 / 80) * h * h))).toBeLessThan(1e-6)
  })

  it('matches the closed forms of a cylinder (a nose of no drop)', () => {
    const [m, d, h] = [0.01, 0.008, 0.024]
    const r = outlineInertia({
      mass: m,
      diameter: d,
      length: h,
      noseLength: h / 2,
      headShape: 0,
      meplatDiameter: d * (1 - 1e-10),
    })
    const c = cylinderInertia(m, d, h)
    expect(rel(r.axial, c.axial)).toBeLessThan(1e-6)
    expect(rel(r.transverse, c.transverse)).toBeLessThan(1e-6)
    expect(rel(r.centreFromBase, h / 2)).toBeLessThan(1e-6)
  })

  it('has both moments below the cylinder of a bullet with a nose and a boat tail', () => {
    const [m, d, l] = [0.010886, 0.007823, 0.0305]
    const r = outlineInertia({
      mass: m,
      diameter: d,
      length: l,
      noseLength: 0.016,
      headShape: 0.55,
      boatTailLength: 0.0038,
      baseDiameter: 0.00662,
      meplatDiameter: 0.0016,
    })
    const c = cylinderInertia(m, d, l)
    expect(r.axial).toBeLessThan(c.axial)
    expect(r.transverse).toBeLessThan(c.transverse)
    // the light nose puts the centre of mass behind the middle
    expect(r.centreFromBase).toBeLessThan(l / 2)
    expect(r.centreFromBase).toBeGreaterThan(0.35 * l)
  })

  it('scales with the mass and refuses an outline that does not close', () => {
    const o = { mass: 0.01, diameter: 0.008, length: 0.03, noseLength: 0.015, headShape: 1 }
    const one = outlineInertia(o)
    expect(rel(outlineInertia({ ...o, mass: 0.02 }).transverse, 2 * one.transverse)).toBeLessThan(
      1e-12,
    )
    expect(() => outlineInertia({ ...o, noseLength: 0.02, boatTailLength: 0.012 })).toThrow(
      InputError,
    )
    expect(() => outlineInertia({ ...o, headShape: 2 })).toThrow(InputError)
    expect(() => outlineInertia({ ...o, mass: 0 })).toThrow(InputError)
  })
})
