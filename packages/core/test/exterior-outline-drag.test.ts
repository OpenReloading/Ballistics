import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import { estimateDragFromOutline, InputError, outlineDragMach } from '../src/index.ts'

// Printed outputs of McCoy, ARBRL-TR-02293, Figures 26 to 28 (pp. 57 to 59), three decimals, so a
// computed value matches within half a unit of the last printed digit plus 1e-5 for the constants
// the report's listing rounds (0.4343, 1.2732, 1.4286, 3.1416). Columns: C_D0, C_DH, C_DSF,
// C_DRB, C_DBT, C_DB, p_B / p_inf.
type Row = readonly [number, number, number, number, number, number, number]
const half = 0.0005 + 1e-5

const brl1: readonly Row[] = [
  [0.112, 0.0, 0.069, 0.0, 0.0, 0.043, 0.987],
  [0.111, 0.0, 0.065, 0.0, 0.0, 0.046, 0.98],
  [0.111, 0.0, 0.062, 0.0, 0.0, 0.049, 0.97],
  [0.112, 0.0, 0.059, 0.0, 0.0, 0.053, 0.958],
  [0.113, 0.0, 0.058, 0.0, 0.0, 0.055, 0.951],
  [0.118, 0.0, 0.057, 0.0, 0.004, 0.056, 0.944],
  [0.135, 0.013, 0.057, 0.0, 0.008, 0.057, 0.94],
  [0.158, 0.027, 0.056, 0.0, 0.016, 0.058, 0.935],
  [0.198, 0.039, 0.056, 0.0, 0.044, 0.059, 0.931],
  [0.281, 0.051, 0.055, 0.0, 0.09, 0.084, 0.896],
  [0.313, 0.119, 0.053, 0.0, 0.056, 0.084, 0.875],
  [0.316, 0.106, 0.052, 0.0, 0.075, 0.083, 0.853],
  [0.308, 0.099, 0.05, 0.0, 0.077, 0.082, 0.829],
  [0.297, 0.093, 0.049, 0.0, 0.074, 0.081, 0.804],
  [0.286, 0.09, 0.047, 0.0, 0.07, 0.08, 0.779],
  [0.276, 0.086, 0.046, 0.0, 0.066, 0.078, 0.754],
  [0.267, 0.084, 0.045, 0.0, 0.062, 0.077, 0.728],
  [0.258, 0.081, 0.044, 0.0, 0.058, 0.075, 0.702],
  [0.242, 0.078, 0.042, 0.0, 0.052, 0.071, 0.652],
  [0.228, 0.075, 0.04, 0.0, 0.047, 0.066, 0.604],
  [0.209, 0.071, 0.037, 0.0, 0.041, 0.06, 0.538],
  [0.183, 0.066, 0.033, 0.0, 0.034, 0.05, 0.449],
  [0.162, 0.063, 0.03, 0.0, 0.028, 0.041, 0.383],
  [0.145, 0.06, 0.028, 0.0, 0.023, 0.034, 0.334],
]

const minuteman: readonly Row[] = [
  [1.058, 0.0, 0.043, 0.0, 0.0, 1.014, 0.933],
  [1.059, 0.0, 0.042, 0.0, 0.0, 1.017, 0.904],
  [1.059, 0.0, 0.04, 0.0, 0.0, 1.019, 0.869],
  [1.057, 0.0, 0.039, 0.0, 0.0, 1.018, 0.828],
  [1.106, 0.05, 0.039, 0.0, 0.0, 1.017, 0.806],
  [1.207, 0.132, 0.038, 0.0, 0.021, 1.016, 0.783],
  [1.262, 0.171, 0.038, 0.0, 0.04, 1.014, 0.771],
  [1.344, 0.207, 0.037, 0.0, 0.087, 1.013, 0.759],
  [1.523, 0.241, 0.037, 0.0, 0.234, 1.011, 0.747],
  [1.885, 0.272, 0.037, 0.0, 0.476, 1.1, 0.71],
  [1.948, 0.543, 0.036, 0.0, 0.296, 1.073, 0.658],
  [2.565, 0.551, 0.035, 0.0, 0.936, 1.043, 0.604],
  [2.291, 0.544, 0.034, 0.0, 0.702, 1.011, 0.55],
  [2.131, 0.523, 0.033, 0.0, 0.596, 0.978, 0.495],
  [2.016, 0.505, 0.032, 0.0, 0.535, 0.944, 0.441],
  [1.925, 0.49, 0.032, 0.0, 0.495, 0.909, 0.387],
  [1.846, 0.477, 0.031, 0.0, 0.466, 0.873, 0.335],
  [1.776, 0.466, 0.03, 0.0, 0.443, 0.837, 0.285],
  [1.652, 0.448, 0.029, 0.0, 0.41, 0.766, 0.193],
  [1.544, 0.433, 0.028, 0.0, 0.386, 0.698, 0.11],
  [1.404, 0.415, 0.026, 0.0, 0.36, 0.604, 0.006],
  [1.217, 0.392, 0.023, 0.0, 0.33, 0.472, -0.12],
  [1.075, 0.374, 0.021, 0.0, 0.308, 0.372, -0.201],
  [0.967, 0.36, 0.02, 0.0, 0.291, 0.297, -0.253],
]

const m549: readonly Row[] = [
  [0.129, 0.0, 0.052, 0.0, 0.0, 0.077, 0.981],
  [0.131, 0.0, 0.05, 0.0, 0.0, 0.08, 0.972],
  [0.133, 0.0, 0.049, 0.0, 0.0, 0.084, 0.96],
  [0.137, 0.0, 0.047, 0.001, 0.0, 0.088, 0.945],
  [0.139, 0.0, 0.047, 0.003, 0.0, 0.09, 0.937],
  [0.147, 0.0, 0.046, 0.005, 0.004, 0.092, 0.927],
  [0.162, 0.009, 0.046, 0.008, 0.007, 0.093, 0.922],
  [0.187, 0.022, 0.045, 0.01, 0.015, 0.094, 0.917],
  [0.225, 0.034, 0.045, 0.01, 0.041, 0.095, 0.912],
  [0.309, 0.045, 0.045, 0.01, 0.084, 0.126, 0.877],
  [0.336, 0.107, 0.044, 0.009, 0.052, 0.125, 0.853],
  [0.327, 0.097, 0.042, 0.008, 0.056, 0.123, 0.827],
  [0.319, 0.092, 0.041, 0.008, 0.057, 0.121, 0.801],
  [0.309, 0.088, 0.04, 0.007, 0.054, 0.119, 0.773],
  [0.298, 0.085, 0.039, 0.007, 0.05, 0.117, 0.745],
  [0.288, 0.083, 0.039, 0.006, 0.047, 0.114, 0.716],
  [0.279, 0.08, 0.038, 0.006, 0.043, 0.111, 0.688],
  [0.27, 0.079, 0.037, 0.006, 0.041, 0.108, 0.659],
  [0.254, 0.075, 0.035, 0.006, 0.036, 0.102, 0.605],
  [0.239, 0.073, 0.034, 0.005, 0.032, 0.095, 0.553],
  [0.22, 0.07, 0.032, 0.005, 0.028, 0.085, 0.484],
  [0.192, 0.066, 0.029, 0.005, 0.023, 0.07, 0.39],
  [0.169, 0.063, 0.026, 0.005, 0.019, 0.057, 0.322],
  [0.152, 0.061, 0.024, 0.005, 0.016, 0.047, 0.272],
]

// Inputs of pp. 26 to 30 in calibers; lengths in m for a 1 m reference diameter times d.
function input(
  d: number,
  c: { lt: number; ln: number; rtr: number; lbt: number; db: number; dm: number; drb: number },
) {
  return {
    diameter: d / 1000,
    length: (c.lt * d) / 1000,
    noseLength: (c.ln * d) / 1000,
    headShape: c.rtr,
    boatTailLength: (c.lbt * d) / 1000,
    baseDiameter: (c.db * d) / 1000,
    meplatDiameter: (c.dm * d) / 1000,
    bandDiameter: (c.drb * d) / 1000,
  }
}

const cases = [
  {
    name: 'BRL-1 (Figure 26)',
    rows: brl1,
    in: {
      ...input(5.69, { lt: 5.48, ln: 3, rtr: 0.5, lbt: 1, db: 0.754, dm: 0, drb: 1 }),
      boundaryLayer: 'laminar-nose' as const,
    },
  },
  {
    name: 'Minuteman model (Figure 27)',
    rows: minuteman,
    in: {
      ...input(55.6, { lt: 3.25, ln: 0.967, rtr: 0, lbt: 1.18, db: 1.63, dm: 0.2, drb: 1 }),
      boundaryLayer: 'turbulent' as const,
    },
  },
  {
    name: 'M549 (Figure 28)',
    rows: m549,
    in: {
      ...input(155, { lt: 5.65, ln: 3.01, rtr: 0.5, lbt: 0.58, db: 0.848, dm: 0.09, drb: 1.02 }),
      boundaryLayer: 'turbulent' as const,
    },
  },
]

describe('drag estimate from the outline', () => {
  for (const c of cases) {
    it(`reproduces the printed output for ${c.name}`, () => {
      const est = estimateDragFromOutline(c.in)
      expect(est.nodes.map((n) => n.mach)).toEqual([...outlineDragMach])
      for (const [i, n] of est.nodes.entries()) {
        const got = [
          n.dragCoefficient,
          n.head,
          n.skinFriction,
          n.band,
          n.boatTail,
          n.base,
          n.basePressureRatio,
        ]
        for (const [j, v] of got.entries()) {
          expect(
            Math.abs(v - nth(nth(c.rows, i), j)),
            `Mach ${n.mach} column ${j}`,
          ).toBeLessThanOrEqual(half)
        }
      }
      expect(est.dragTable).toEqual(est.nodes.map((n) => [n.mach, n.dragCoefficient]))
    })
  }

  it('takes the 5.7 mm printed in the BRL-1 header', () => {
    const est = estimateDragFromOutline({
      ...nth(cases, 0).in,
      diameter: 0.0057,
      length: 5.48 * 0.0057,
      noseLength: 3 * 0.0057,
      boatTailLength: 0.0057,
      baseDiameter: 0.754 * 0.0057,
      bandDiameter: 0.0057,
    })
    for (const [i, n] of est.nodes.entries())
      expect(Math.abs(n.dragCoefficient - nth(brl1, i)[0])).toBeLessThanOrEqual(half)
  })

  it('warns where the report warns', () => {
    expect(estimateDragFromOutline(nth(cases, 0).in).warnings).toEqual([])
    expect(estimateDragFromOutline(nth(cases, 1).in).warnings).toEqual([
      'nose-short',
      'base-pressure-negative',
    ])
    const blunt = {
      ...nth(cases, 0).in,
      noseLength: 0.8 * 0.00569,
      boatTailLength: 1.6 * 0.00569,
      baseDiameter: 0.6 * 0.00569,
    }
    expect(estimateDragFromOutline(blunt).warnings).toEqual(
      expect.arrayContaining(['nose-short', 'boat-tail-long', 'base-small']),
    )
    expect(
      estimateDragFromOutline({
        ...nth(cases, 0).in,
        diameter: 0.0039,
        length: 5.48 * 0.0039,
        noseLength: 3 * 0.0039,
        boatTailLength: 0.0039,
        baseDiameter: 0.754 * 0.0039,
        bandDiameter: 0.0039,
      }).warnings,
    ).toContain('diameter-range')
    expect(
      estimateDragFromOutline({
        ...nth(cases, 2).in,
        diameter: 0.5,
        length: 5.65 * 0.5,
        noseLength: 3.01 * 0.5,
        boatTailLength: 0.29,
        baseDiameter: 0.424,
        meplatDiameter: 0.045,
        bandDiameter: 0.51,
      }).warnings,
    ).toContain('diameter-range')
    expect(
      estimateDragFromOutline({ ...nth(cases, 0).in, machNumbers: [0.4, 2] }).warnings,
    ).toEqual(['mach-range'])
    expect(
      estimateDragFromOutline({ ...nth(cases, 0).in, machNumbers: [0.5, 5] }).warnings,
    ).toEqual([])
  })

  it('gives a flat base without a boat tail and a standard deviation per node', () => {
    const est = estimateDragFromOutline({
      diameter: 0.00762,
      length: 0.03,
      noseLength: 0.02,
      headShape: 1,
    })
    expect(est.nodes.every((n) => n.boatTail === 0 && n.band === 0)).toBe(true)
    expect(est.nodes.find((n) => n.mach === 0.95)?.relativeStandardDeviation).toBe(0.11)
    expect(est.nodes.find((n) => n.mach === 3)?.relativeStandardDeviation).toBe(0.03)
  })

  it('rejects an outline the method cannot take', () => {
    const ok = nth(cases, 0).in
    expect(() => estimateDragFromOutline({ ...ok, diameter: 0 })).toThrow(InputError)
    expect(() => estimateDragFromOutline({ ...ok, noseLength: ok.length })).toThrow(InputError)
    expect(() => estimateDragFromOutline({ ...ok, meplatDiameter: ok.diameter })).toThrow(
      InputError,
    )
    expect(() => estimateDragFromOutline({ ...ok, headShape: -1 })).toThrow(InputError)
    expect(() => estimateDragFromOutline({ ...ok, headShape: 3 })).toThrow(InputError)
  })

  it('rejects an outline whose drag comes out not positive or not finite', () => {
    const tail = {
      diameter: 0.00782,
      length: 0.03,
      noseLength: 0.018,
      headShape: 0.5,
      baseDiameter: 0.0065,
    }
    // a step from 7.82 to 6.5 mm over 1 um: Cd 10799 at Mach 0.9 and -307689 at Mach 1.5 before
    expect(() => estimateDragFromOutline({ ...tail, boatTailLength: 1e-6 })).toThrow(InputError)
    expect(() => estimateDragFromOutline({ ...tail, noseLength: 1e-6 })).toThrow(InputError)
    expect(() => estimateDragFromOutline({ ...tail, machNumbers: [1e-6] })).toThrow(InputError)
  })
})
