import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import {
  airAt,
  type DragInput,
  type DragTable,
  dragCoefficient,
  dragModels,
  dragSegment,
  dragTableOf,
  dragTables,
  heldSegment,
  InputError,
  inDragTable,
  lbPerSqInToKgPerSqM,
  segmentCoefficient,
  speedOfSound,
  standardAtmosphere,
  type TrajectoryInput,
  trajectory,
} from '../src/index.ts'

describe('drag tables', () => {
  it('lists every drag model once, in table order', () => {
    expect(dragModels).toEqual(['G1', 'G2', 'G5', 'G6', 'G7', 'G8', 'GI', 'GS'])
    expect(dragModels).toEqual(Object.keys(dragTables))
  })

  it('takes the table of a BC model or the curve itself', () => {
    const curve: DragTable = [
      [0, 0.3],
      [2, 0.5],
    ]
    expect(
      dragTableOf({
        kind: 'bc',
        model: 'G7',
        bands: [{ ballisticCoefficient: 1, minVelocity: 0 }],
      }),
    ).toBe(dragTables.G7)
    expect(dragTableOf({ kind: 'curve', curve })).toBe(curve)
  })

  it('returns every printed node exactly', () => {
    for (const table of Object.values(dragTables))
      for (const [mach, cd] of table) {
        expect(dragCoefficient(table, mach)).toBe(cd)
        expect(inDragTable(table, mach)).toBe(true)
      }
  })

  it('returns the mean at the midpoint between nodes', () => {
    for (const table of Object.values(dragTables))
      for (let k = 1; k < table.length; k++) {
        const [m0, c0] = nth(table, k - 1)
        const [m1, c1] = nth(table, k)
        expect(dragCoefficient(table, (m0 + m1) / 2)).toBeCloseTo((c0 + c1) / 2, 14)
      }
  })

  it('holds the last value beyond the table and flags it', () => {
    const g7 = dragTables.G7
    expect(dragCoefficient(g7, 7)).toBe(0.1618)
    expect(inDragTable(g7, 5.01)).toBe(false)
    expect(dragCoefficient(dragTables.GS, 4.5)).toBe(0.928)
  })

  it('converts lb/in2 to kg/m2', () => {
    expect(lbPerSqInToKgPerSqM).toBeCloseTo(703.0695796, 7)
  })
})

const mass = 0.0113
const diameter = 0.00782
const bc = 0.3 * lbPerSqInToKgPerSqM
const air = standardAtmosphere(300, 0.4)
const shot = (drag: TrajectoryInput['projectile']['drag']): TrajectoryInput => ({
  projectile: { mass, diameter, drag },
  muzzleVelocity: 850,
  firearm: { sightHeight: 0.04 },
  air,
  zero: { elevationAngle: 0.002, windageAngle: 0 },
})
const ranges = [100, 300, 600, 900, 1200]
const tight = { relativeTolerance: 1e-12, absoluteTolerance: 1e-12 }

describe('drag inputs', () => {
  it.each(['linear', 'monotone-cubic'] as const)(
    'gives the same trajectory for a BC and the equivalent custom curve (%s)',
    (interpolation) => {
      const i = mass / (bc * diameter ** 2)
      const a = trajectory(
        shot({
          kind: 'bc',
          model: 'G7',
          bands: [{ ballisticCoefficient: bc, minVelocity: 0 }],
          interpolation,
        }),
        ranges,
        tight,
      )
      const curve = dragTables.G7.map(([m, cd]) => [m, i * cd] as const)
      const b = trajectory(shot({ kind: 'curve', curve, interpolation }), ranges, tight)
      expect(b.dragModel).toBe('custom')
      a.points.forEach((p, k) => {
        const q = nth(b.points, k)
        expect(Math.abs(q.height - p.height)).toBeLessThan(1e-9 * Math.abs(p.height))
        expect(Math.abs(q.velocity / p.velocity - 1)).toBeLessThan(1e-9)
      })
    },
  )

  it('gives the same trajectory for two equal bands as for one', () => {
    const one = trajectory(
      shot({ kind: 'bc', model: 'G1', bands: [{ ballisticCoefficient: bc, minVelocity: 0 }] }),
      ranges,
      tight,
    )
    const two = trajectory(
      shot({
        kind: 'bc',
        model: 'G1',
        bands: [
          { ballisticCoefficient: bc, minVelocity: 0 },
          { ballisticCoefficient: bc, minVelocity: 600 },
        ],
      }),
      ranges,
      tight,
    )
    two.points.forEach((p, k) => {
      expect(Math.abs(p.height - nth(one.points, k).height)).toBeLessThan(1e-8)
      expect(Math.abs(p.time - nth(one.points, k).time)).toBeLessThan(1e-9)
    })
  })

  it('switches band at the threshold airspeed, not at the ground speed', () => {
    // 583 m/s over the ground into a 20 m/s headwind: 603 m/s airspeed, above the 600 m/s threshold
    const windy = (drag: TrajectoryInput['projectile']['drag']): TrajectoryInput => ({
      ...shot(drag),
      muzzleVelocity: 583,
      wind: [{ endDistance: Infinity, speed: 20, fromDirection: 0 }],
    })
    const near = Array.from({ length: 81 }, (_, k) => k / 2)
    const upper = trajectory(
      windy({ kind: 'bc', model: 'G7', bands: [{ ballisticCoefficient: bc, minVelocity: 0 }] }),
      near,
    )
    const banded = trajectory(
      windy({
        kind: 'bc',
        model: 'G7',
        bands: [
          { ballisticCoefficient: bc, minVelocity: 600 },
          { ballisticCoefficient: bc / 2, minVelocity: 0 },
        ],
      }),
      near,
    )
    let before = 0
    let close = 0
    let after = 0
    banded.points.forEach((p, k) => {
      const q = nth(upper.points, k)
      const airspeed = q.mach * speedOfSound(airAt(air, q.heightAboveFiringPoint))
      if (airspeed > 600.25) {
        before++
        if (airspeed < 602) close++
        expect(Math.abs(p.height - q.height)).toBeLessThanOrEqual(1e-9 * Math.abs(q.height))
        expect(p.velocity).toBe(q.velocity)
      } else if (airspeed < 599.75) {
        after++
        expect(p.velocity).toBeLessThan(q.velocity - 1e-6)
      }
    })
    expect(before).toBeGreaterThan(1)
    expect(close).toBeGreaterThan(0)
    expect(after).toBeGreaterThan(0)
  })

  it('rejects invalid drag inputs', () => {
    const bad: TrajectoryInput['projectile']['drag'][] = [
      { kind: 'bc', model: 'G7', bands: [] },
      { kind: 'bc', model: 'G7', bands: [{ ballisticCoefficient: 0, minVelocity: 0 }] },
      {
        kind: 'bc',
        model: 'G7',
        bands: [
          { ballisticCoefficient: bc, minVelocity: 0 },
          { ballisticCoefficient: bc, minVelocity: 0 },
        ],
      },
      { kind: 'curve', curve: [[0, 0.2]] },
      {
        kind: 'curve',
        curve: [
          [1, 0.2],
          [0.5, 0.3],
        ],
      },
      {
        kind: 'curve',
        curve: [
          [0, 0.2],
          [1, -0.1],
        ],
      },
    ]
    for (const drag of bad) expect(() => trajectory(shot(drag), ranges)).toThrow(RangeError)
  })
})

describe('BC reference atmosphere', () => {
  const bands = [
    { ballisticCoefficient: bc, minVelocity: 600 },
    { ballisticCoefficient: 0.9 * bc, minVelocity: 0 },
  ]
  const zeroed = (drag: DragInput): TrajectoryInput => ({ ...shot(drag), zero: { range: 100 } })

  it('flies a metro or ICAO BC as a BC without reference', () => {
    const none = trajectory(zeroed({ kind: 'bc', model: 'G7', bands }), ranges)
    for (const reference of ['metro', 'icao'] as const)
      expect(trajectory(zeroed({ kind: 'bc', model: 'G7', bands, reference }), ranges)).toEqual(
        none,
      )
  })

  it('rejects an unknown reference and an unknown interpolation', () => {
    const bad = [
      { kind: 'bc', model: 'G7', bands, reference: 'Metro' },
      { kind: 'bc', model: 'G7', bands, interpolation: 'cubic' },
      { kind: 'curve', curve: dragTables.G7, interpolation: 'spline' },
    ] as unknown as DragInput[]
    for (const drag of bad) expect(() => trajectory(shot(drag), ranges)).toThrow(InputError)
  })
})

describe('monotone cubic interpolation', () => {
  const cubic = (table: DragTable, mach: number) => dragCoefficient(table, mach, 'monotone-cubic')

  it('returns every printed node exactly', () => {
    for (const table of Object.values(dragTables))
      for (const [mach, cd] of table) expect(cubic(table, mach)).toBe(cd)
  })

  /** Samples every segment 50 times: monotone along the secant and between the node values. */
  const checkShape = (table: DragTable) => {
    for (let k = 0; k + 1 < table.length; k++) {
      const [m0, c0] = nth(table, k)
      const [m1, c1] = nth(table, k + 1)
      let previous = c0
      for (let i = 1; i <= 50; i++) {
        const c = cubic(table, i === 50 ? m1 : m0 + ((m1 - m0) * i) / 50)
        expect(c).toBeGreaterThanOrEqual(Math.min(c0, c1))
        expect(c).toBeLessThanOrEqual(Math.max(c0, c1))
        if (c1 >= c0) expect(c).toBeGreaterThanOrEqual(previous)
        else expect(c).toBeLessThanOrEqual(previous)
        previous = c
      }
    }
  }

  it('stays monotone and inside the node values on every table segment', () => {
    for (const table of Object.values(dragTables)) checkShape(table)
  })

  it('keeps a peak, a flat run and zeros of a custom curve', () => {
    const curve: DragTable = [
      [0, 0],
      [1, 1],
      [2, 1],
      [3, 0.2],
      [4, 0],
    ]
    checkShape(curve)
    expect(cubic(curve, 1.5)).toBe(1)
    expect(cubic(curve, 3.7)).toBeGreaterThanOrEqual(0)
  })

  it('matches the closed form on three nodes and the line on two', () => {
    // interior slope 2 min(1, 1/2, 5/12) = 5/6; ends take the secants 1 and 1/2
    const curve: DragTable = [
      [0, 0],
      [1, 1],
      [3, 2],
    ]
    expect(Math.abs(cubic(curve, 0.5) / (25 / 48) - 1)).toBeLessThan(1e-15)
    expect(Math.abs(cubic(curve, 2) / (19 / 12) - 1)).toBeLessThan(1e-15)
    const line: DragTable = [
      [0.5, 0.3],
      [2.5, 0.7],
    ]
    for (const m of [0.6, 1, 1.7, 2.4])
      expect(Math.abs(cubic(line, m) / (0.3 + 0.2 * (m - 0.5)) - 1)).toBeLessThan(1e-15)
    // secants 1 and 5, parabola slope 3: the secant 1 bounds the interior slope, 2 min(1, 5, 3/2) = 2
    const steep: DragTable = [
      [0, 0],
      [1, 1],
      [2, 6],
    ]
    expect(Math.abs(cubic(steep, 0.5) / (3 / 8) - 1)).toBeLessThan(1e-15)
    expect(Math.abs(cubic(steep, 1.5) / (25 / 8) - 1)).toBeLessThan(1e-15)
  })

  it('extends the cubic of a segment past its nodes', () => {
    const curve: DragTable = [
      [0, 0],
      [1, 1],
      [3, 2],
    ]
    const c = segmentCoefficient(curve, 0, 1.5, 'monotone-cubic')
    expect(Math.abs(c / (21 / 16) - 1)).toBeLessThan(1e-15)
  })

  it('holds a steep segment at its node values past its nodes', () => {
    // a Cd jump of 0.3 over 1e-5 Mach: the line 1e-4 below the segment would read -2.65
    const curve: DragTable = [
      [1.3, 0.36],
      [1.35, 0.35],
      [1.35 + 1e-5, 0.65],
      [1.4, 0.36],
    ]
    for (const interpolation of ['linear', 'monotone-cubic'] as const) {
      expect(segmentCoefficient(curve, 1, 1.35 - 1e-4, interpolation)).toBe(0.35)
      expect(segmentCoefficient(curve, 1, 1.35 + 1e-4, interpolation)).toBe(0.65)
    }
  })

  it('holds a sign-crossing steep coefficient segment by the width rule only', () => {
    // a lift slope from -1 to 1 over 0.01 Mach: 200 per Mach relative to the larger node value
    const lift: DragTable = [
      [1.5, -1],
      [1.6, -1],
      [1.61, 1],
      [1.7, 1],
    ]
    expect([heldSegment(lift, 1), heldSegment(lift, 1, false)]).toEqual([true, false])
    expect(segmentCoefficient(lift, 1, 1.62)).toBe(1)
    expect(segmentCoefficient(lift, 1, 1.62, 'linear', false)).toBeCloseTo(3, 12)
    expect(
      heldSegment(
        [
          [1.6, -1],
          [1.6 + 1e-7, 1],
        ],
        0,
        false,
      ),
    ).toBe(true)
  })

  it('has a continuous slope at every interior node', () => {
    const h = 1e-7
    let worst = 0
    let linear = 0
    for (const table of Object.values(dragTables))
      for (let j = 1; j + 1 < table.length; j++) {
        const [m, c] = nth(table, j)
        const jump = (read: (x: number) => number) =>
          Math.abs((read(m + h) - c) / h - (c - read(m - h)) / h)
        worst = Math.max(
          worst,
          jump((x) => cubic(table, x)),
        )
        linear = Math.max(
          linear,
          jump((x) => dragCoefficient(table, x)),
        )
      }
    expect(worst).toBeLessThan(1e-4)
    expect(linear).toBeGreaterThan(1)
  })

  it('leaves the linear default unchanged', () => {
    const g1: DragInput = {
      kind: 'bc',
      model: 'G1',
      bands: [{ ballisticCoefficient: bc, minVelocity: 0 }],
    }
    const curve: DragInput = { kind: 'curve', curve: dragTables.G7 }
    for (const drag of [g1, curve])
      expect(trajectory(shot({ ...drag, interpolation: 'linear' }), ranges)).toEqual(
        trajectory(shot(drag), ranges),
      )
  })

  it('integrates the cubic: equals a dense linear resample of it', () => {
    // G1 BC 0.25 lb/in2 at 310 m/s; resample at multiples of 0.0005 Mach, which hit every node
    const g1bc = 0.25 * lbPerSqInToKgPerSqM
    const drag: DragInput = {
      kind: 'bc',
      model: 'G1',
      bands: [{ ballisticCoefficient: g1bc, minVelocity: 0 }],
    }
    const slow = (d: DragInput): TrajectoryInput => ({
      ...shot(d),
      muzzleVelocity: 310,
      air: standardAtmosphere(0),
    })
    const ranges = [100, 200, 300]
    const a = trajectory(slow({ ...drag, interpolation: 'monotone-cubic' }), ranges)
    const i = mass / (g1bc * diameter ** 2)
    const curve = Array.from(
      { length: 10001 },
      (_, k) => [k / 2000, i * cubic(dragTables.G1, k / 2000)] as const,
    )
    const b = trajectory(slow({ kind: 'curve', curve }), ranges)
    const linear = trajectory(slow(drag), ranges)
    a.points.forEach((p, k) => {
      expect(Math.abs(p.height - nth(b.points, k).height)).toBeLessThan(1e-5)
      expect(Math.abs(p.time - nth(b.points, k).time)).toBeLessThan(1e-6)
    })
    expect(Math.abs(nth(a.points, 2).height - nth(linear.points, 2).height)).toBeGreaterThan(5e-4)
  })

  it('keeps the error proportional to the tolerance (G1)', () => {
    const g1bc = 0.25 * lbPerSqInToKgPerSqM
    for (const [v0, elevation, range] of [
      [300, 0.1178, 1200],
      [450, 0.06, 1000],
    ] as const) {
      const s: TrajectoryInput = {
        projectile: {
          mass: 0.01,
          diameter: 0.0078,
          drag: {
            kind: 'bc',
            model: 'G1',
            bands: [{ ballisticCoefficient: g1bc, minVelocity: 0 }],
            interpolation: 'monotone-cubic',
          },
        },
        muzzleVelocity: v0,
        firearm: { sightHeight: 0.04 },
        air: standardAtmosphere(0),
        zero: { elevationAngle: elevation, windageAngle: 0 },
      }
      const height = (tol: number) =>
        nth(
          trajectory(s, [range], { relativeTolerance: tol, absoluteTolerance: tol, maxSteps: 1e6 })
            .points,
          0,
        ).height
      const exact = height(1e-13)
      for (const tol of [1e-6, 1e-8, 1e-10])
        expect(Math.abs(height(tol) - exact)).toBeLessThan(tol * range)
    }
  })
})

describe('drag table segments', () => {
  const curve: DragTable = [
    [0.5, 0.3],
    [1, 0.4],
    [2, 0.6],
    [2.5, 0.7],
  ]

  it('holds the end values below the first and above the last node', () => {
    expect(dragCoefficient(curve, 0.1)).toBe(0.3)
    expect(dragCoefficient(curve, 3)).toBe(0.7)
    expect(inDragTable(curve, 0.49)).toBe(false)
    expect(inDragTable(curve, 2.51)).toBe(false)
  })

  it('finds the segment of a Mach number, a node opening its segment', () => {
    expect(dragSegment(curve, 0.49)).toBe(-1)
    expect(dragSegment(curve, 0.5)).toBe(0)
    expect(dragSegment(curve, 1)).toBe(1)
    expect(dragSegment(curve, 2)).toBe(2)
    expect(dragSegment(curve, 2.49)).toBe(2)
    expect(dragSegment(curve, 2.5)).toBe(3)
  })

  it('reads the end values on the segments outside the table', () => {
    expect(segmentCoefficient(curve, -1, 2)).toBe(0.3)
    expect(segmentCoefficient(curve, 3, 1)).toBe(0.7)
    expect(heldSegment(curve, -1)).toBe(false)
    expect(heldSegment(curve, 3)).toBe(false)
  })

  it('holds a segment only below the width limit and above the slope limit', () => {
    const width: DragTable = [
      [0, 1],
      [1e-6, 1],
    ]
    expect(heldSegment(width, 0)).toBe(false)
    // a rise of 2 over 0.01 Mach is 100 per Mach times the larger node value 2
    const slope: DragTable = [
      [0, 0],
      [0.01, 2],
    ]
    expect(heldSegment(slope, 0)).toBe(false)
  })

  it('weights the interior cubic slope by unequal node spacing', () => {
    // secants 1/2 and 3/5 over widths 2 and 1: p = (1/2 + 6/5) / 3 = 17/30, slope 2 min(1/2, 3/5,
    // 17/60) = 17/30; at the middle of the first segment 1/8 + 1/2 - 17/120 = 29/60
    const uneven: DragTable = [
      [1, 0],
      [3, 1],
      [4, 1.6],
    ]
    expect(Math.abs(dragCoefficient(uneven, 2, 'monotone-cubic') / (29 / 60) - 1)).toBeLessThan(
      1e-15,
    )
  })
})
