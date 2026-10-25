import { describe, expect, it } from 'vitest'
import { type Burn, burnError, burnForm, type Grain, lensArea, sliverArea } from '../src/index.ts'

const geometric = (grain: Grain): Burn => ({
  kind: 'geometric',
  coefficient: 1e-9,
  exponent: 1,
  grain,
})
const grains: Grain[] = [
  { shape: 'sphere', diameter: 5e-4 },
  { shape: 'cylinder', diameter: 8e-4, length: 1.5e-3 },
  { shape: 'cylinder', diameter: 2e-3, length: 6e-4 },
  { shape: 'tube', diameter: 1e-3, perforationDiameter: 2e-4, length: 2e-3 },
  { shape: 'sevenPerf', diameter: 1.25e-3, perforationDiameter: 1.5e-4, length: 2e-3 },
  { shape: 'sevenPerf', diameter: 7e-3, perforationDiameter: 1e-3, length: 1.2e-2 },
]

/** Burning surface relative to the initial one, from a central difference of Z. */
const surface = (z: (f: number) => number, f: number, h = 1e-6) =>
  (z(f + h) - z(f - h)) / (z(h) - z(-h))

describe('geometric form functions', () => {
  it.each(grains)('$shape: Z(0) = 0, Z(end) = 1, Z rising', (grain) => {
    const form = burnForm(geometric(grain))
    expect(burnError(geometric(grain))).toBeUndefined()
    expect(form.z(0)).toBeCloseTo(0, 14)
    expect(form.z(form.end)).toBeCloseTo(1, 12)
    let last = 0
    for (let i = 1; i <= 1000; i++) {
      const z = form.z((form.end * i) / 1000)
      expect(z).toBeGreaterThanOrEqual(last)
      last = z
    }
    for (const b of form.breaks)
      expect(Math.abs(form.z(b + 1e-12) - form.z(b - 1e-12))).toBeLessThan(1e-9)
  })

  // initial surface over volume of one grain, from its dimensions
  it.each([
    [grains[0], 6 / 5e-4],
    [grains[1], 4 / 8e-4 + 2 / 1.5e-3],
    [grains[2], 4 / 2e-3 + 2 / 6e-4],
    [grains[3], 2 / 4e-4 + 2 / 2e-3],
    [grains[4], (4 * (1.25e-3 + 7 * 1.5e-4)) / (1.25e-3 ** 2 - 7 * 1.5e-4 ** 2) + 2 / 2e-3],
  ] as [Grain, number][])("$0.shape: Z'(0) / e1 = S0 / V0", (grain, sv) => {
    const form = burnForm(geometric(grain))
    const h = 1e-6
    const slope = (form.z(h) - form.z(-h)) / (2 * h)
    expect(Math.abs(slope / form.halfWeb - sv) / sv).toBeLessThan(1e-6)
  })

  it('reduces to the sphere, long-cylinder and long-tube surface laws', () => {
    const sphere = burnForm(geometric({ shape: 'sphere', diameter: 1e-3 }))
    const rod = burnForm(geometric({ shape: 'cylinder', diameter: 1e-3, length: 1e3 }))
    const tube = burnForm(
      geometric({ shape: 'tube', diameter: 1e-3, perforationDiameter: 4e-4, length: 1e3 }),
    )
    for (const f of [0.1, 0.4, 0.8]) {
      expect(surface(sphere.z, f)).toBeCloseTo((1 - sphere.z(f)) ** (2 / 3), 6)
      expect(surface(rod.z, f)).toBeCloseTo((1 - rod.z(f)) ** (1 / 2), 5)
      expect(surface(tube.z, f)).toBeCloseTo(1, 5)
    }
  })
})

describe('seven-perforated grain', () => {
  const dp = 1
  const w = 1
  const s = dp + w
  const r0 = 1.5 * dp + 2 * w

  /** Uncovered cross-section inside the outer circle, counted on an n by n grid. */
  const gridArea = (y: number, n = 400) => {
    const rho = dp / 2 + y
    const r = r0 - y
    const centres: [number, number][] = [[0, 0]]
    for (let k = 0; k < 6; k++)
      centres.push([s * Math.cos((k * Math.PI) / 3), s * Math.sin((k * Math.PI) / 3)])
    const cell = (2 * r) / n
    let count = 0
    for (let i = 0; i < n; i++) {
      const x = -r + (i + 0.5) * cell
      for (let j = 0; j < n; j++) {
        const yy = -r + (j + 0.5) * cell
        if (
          x * x + yy * yy < r * r &&
          centres.every(([cx, cy]) => (x - cx) ** 2 + (yy - cy) ** 2 > rho * rho)
        )
          count++
      }
    }
    return count * cell * cell
  }

  it('has a sliver area equal to the web-phase remainder at the end of the web', () => {
    const { inner, outer } = sliverArea(s / 2, r0 - w / 2, s)
    expect(6 * (inner + outer)).toBeCloseTo((Math.PI / 2) * s * s, 12)
  })

  it('matches a grid count of the remaining cross-section during the sliver phase', () => {
    for (const y of [0.55, 0.62, 0.7, 0.8]) {
      const { inner, outer } = sliverArea(dp / 2 + y, r0 - y, s)
      const exact = 6 * (inner + outer)
      // grid error relative to the sliver area at the end of the web
      expect(Math.abs(gridArea(y) - exact)).toBeLessThan(1e-3 * (Math.PI / 2) * s * s)
    }
  })

  it('loses the inner slivers at rho = s / sqrt(3) and the outer ones at the end', () => {
    expect(sliverArea(s / Math.sqrt(3), r0, s).inner).toBeLessThan(1e-12)
    const form = burnForm(
      geometric({
        shape: 'sevenPerf',
        diameter: 3 * dp + 4 * w,
        perforationDiameter: dp,
        length: 50,
      }),
    )
    const yEnd = (form.end * w) / 2
    expect(sliverArea(dp / 2 + yEnd - 1e-9, r0 - yEnd + 1e-9, s).outer).toBeLessThan(1e-9)
    expect(form.breaks[1]).toBeCloseTo((2 * (s / Math.sqrt(3) - dp / 2)) / w, 12)
  })
})

describe('lens area', () => {
  it('covers the disjoint, contained and equal-radius cases', () => {
    expect(lensArea(1, 1, 2)).toBe(0)
    expect(lensArea(3, 1, 1.5)).toBeCloseTo(Math.PI, 14)
    expect(lensArea(1, 1, 1)).toBeCloseTo((2 * Math.PI) / 3 - Math.sqrt(3) / 2, 14)
  })
})

describe('vivacity form functions', () => {
  const vivacity = (form: Extract<Burn, { kind: 'vivacity' }>['form']): Burn => ({
    kind: 'vivacity',
    vivacity: 1,
    exponent: 1,
    referencePressure: 1e5,
    form,
  })

  it('two stages are continuous at z1, degressive to z = 1 and constant for a = 0, z1 = 1', () => {
    const form = burnForm(vivacity({ kind: 'twoStage', a: 1.2, m: 0.4, q: 0.3, z1: 0.45 }))
    expect(form.breaks).toEqual([0.45])
    expect(form.phi(0.45 + 1e-12)).toBeCloseTo(form.phi(0.45), 10)
    // 1.54^0.4 (0.3 / 0.55)^0.3
    expect(form.phi(0.7)).toBeCloseTo(0.9909137571728127, 14)
    expect(form.phi(1)).toBe(0)
    const flat = burnForm(vivacity({ kind: 'twoStage', a: 0, m: 0.4, q: 0.3, z1: 1 }))
    // z > 1 occurs inside the step that crosses burnout
    for (const z of [0, 0.5, 1, 1.5]) expect(flat.phi(z)).toBe(1)
    expect(flat.breaks).toEqual([])
    const single = burnForm(vivacity({ kind: 'twoStage', a: 0.5, m: 0.5, q: 2, z1: 1 }))
    expect(single.phi(1.01)).toBe(single.phi(1))
  })

  it('rejects a degressive exponent q >= 1, which never burns out', () => {
    const bad = vivacity({ kind: 'twoStage', a: 1.2, m: 0.4, q: 1, z1: 0.6 })
    expect(burnError(bad)).toBe('propellant.burn.form')
    expect(burnError(vivacity({ kind: 'twoStage', a: 1.2, m: 0.4, q: 2, z1: 1 }))).toBeUndefined()
  })

  const three = { kind: 'threeStage', a: 1.2, m: 0.4, q: 1.5, z1: 0.45, z2: 0.85, r: 0.3 } as const

  it('three stages are continuous at z1 and z2 and end at z = 1 in the third-stage variable', () => {
    const form = burnForm(vivacity(three))
    expect(form.breaks).toEqual([0.45, 0.85])
    for (const f of [0.45, 0.85]) {
      expect(Math.abs(form.phi(f + 1e-15) / form.phi(f) - 1)).toBeLessThan(1e-14)
      expect(Math.abs(form.z(f + 1e-15) - form.z(f))).toBeLessThan(1e-14)
    }
    expect(Math.abs(form.end - (0.85 + 0.15 / 0.7))).toBeLessThan(1e-15)
    expect(form.z(form.end)).toBe(1)
    expect(form.z(form.end + 0.1)).toBeGreaterThan(1)
    // dz/dt / (rate term) = phi(f) dz/df equals the z-space form phi2 ((1 - z)/(1 - z2))^r
    const phi2 = 1.54 ** 0.4 * (0.15 / 0.55) ** 1.5
    const h = 1e-6
    for (const f of [0.9, 0.95, 1, 1.05]) {
      const rate = (form.phi(f) * (form.z(f + h) - form.z(f - h))) / (2 * h)
      expect(Math.abs(rate / (phi2 * ((1 - form.z(f)) / 0.15) ** 0.3) - 1)).toBeLessThan(1e-8)
    }
    expect(form.phi(form.end + 0.1)).toBe(form.phi(0.9))
  })

  it('a three-stage tail with r = 0 stays at phi2 with f = z', () => {
    const form = burnForm(vivacity({ ...three, q: 0.3, z2: 0.8, r: 0 }))
    const phi2 = 1.54 ** 0.4 * (0.2 / 0.55) ** 0.3
    for (const z of [0.9, 1, 1.5]) expect(Math.abs(form.phi(z) / phi2 - 1)).toBeLessThan(1e-14)
    expect(form.end).toBe(1)
    for (const f of [0.85, 0.9, 0.99]) expect(Math.abs(form.z(f) - f)).toBeLessThan(1e-15)
  })

  it('checks the three-stage limits', () => {
    expect(burnError(vivacity(three))).toBeUndefined()
    expect(burnError(vivacity({ ...three, q: 2 }))).toBeUndefined()
    expect(burnError(vivacity({ ...three, r: 0 }))).toBeUndefined()
    expect(burnError(vivacity({ ...three, q: 0 }))).toBeUndefined()
    expect(burnError(vivacity({ ...three, r: 0.999 }))).toBeUndefined()
    for (const bad of [
      { z2: 0.45 },
      { z2: 0.4 },
      { z2: 1 },
      { z1: 0 },
      { r: 1 },
      { r: -0.1 },
      { q: -0.1 },
      { a: -1 / 0.45 },
      { m: Number.NaN },
      { r: Number.POSITIVE_INFINITY },
    ])
      expect(burnError(vivacity({ ...three, ...bad }))).toBe('propellant.burn.form')
  })
})
