import { describe, expect, it } from 'vitest'
import { InputError, nth } from '../src/errors.ts'
import { chiSquareCdf, chiSquareQuantile, chiSquareSurvival } from '../src/groups/chi-square.ts'
import { fQuantileTwoNumeratorDegrees } from '../src/groups/f-distribution.ts'
import {
  dispersionEllipse,
  type GroupShot,
  groupStatistics,
  pooledGroupStatistics,
  predictionEllipse,
  subtendedAngle,
} from '../src/groups/statistics.ts'
import { studentTwoSidedQuantile } from '../src/groups/student-t.ts'
import { uniforms } from './random.ts'

const mm = 1e-3
const close = (actual: number | undefined, expected: number, rel = 1e-12) => {
  expect(actual).toBeDefined()
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(
    rel * Math.abs(expected) + 1e-18,
  )
}
const shots = (points: [number, number][]): GroupShot[] =>
  points.map(([x, y]) => ({ x: x * mm, y: y * mm }))

// Five shots, mm. Centre (2, 2); deviations (-2,-2) (0,-1) (2,2) (-1,1) (1,0).
// Sxx = 10, Syy = 10, Sxy = 7; radii sqrt8, 1, sqrt8, sqrt2, 1 (sum of squares 20).
const five = shots([
  [0, 0],
  [2, 1],
  [4, 4],
  [1, 3],
  [3, 2],
])

describe('groupStatistics: hand calculation', () => {
  const s = groupStatistics({ shots: five, distance: 100 })

  it('centre, sizes and radii', () => {
    expect(s.shotCount).toBe(5)
    expect(s.excludedCount).toBe(0)
    close(s.centre?.x, 2 * mm)
    close(s.centre?.y, 2 * mm)
    // largest pair (0,0)-(4,4): sqrt 32
    close(s.extremeSpread, Math.sqrt(32) * mm)
    close(s.width, 4 * mm)
    close(s.height, 4 * mm)
    // (2 sqrt8 + 1 + 1 + sqrt2) / 5 = sqrt2 + 0.4
    close(s.meanRadius, (Math.SQRT2 + 0.4) * mm)
    // sum (r - rbar)^2 = 20 - 5 (sqrt2 + 0.4)^2 = 9.2 - 4 sqrt2, divisor n - 1
    close(s.radiusStandardDeviation, Math.sqrt((9.2 - 4 * Math.SQRT2) / 4) * mm)
  })

  it('standard deviations, covariance and CEP use n - 1', () => {
    close(s.standardDeviationX, Math.sqrt(10 / 4) * mm)
    close(s.standardDeviationY, Math.sqrt(10 / 4) * mm)
    close(s.radialStandardDeviation, Math.sqrt(5) * mm)
    close(s.cep, Math.sqrt(2 * Math.LN2) * Math.sqrt(2.5) * mm)
    close(s.covariance?.xx, 2.5 * mm * mm)
    close(s.covariance?.yy, 2.5 * mm * mm)
    close(s.covariance?.xy, 1.75 * mm * mm)
    // equal variances, positive covariance: major axis at 45 degrees
    close(s.principalAxisAngle, Math.PI / 4)
    // eigenvalues 2.5 +- 1.75 mm^2
    const e = dispersionEllipse(s, 0.9)
    const k = Math.sqrt(-2 * Math.log(0.1))
    close(e?.semiMajor, k * Math.sqrt(4.25) * mm)
    close(e?.semiMinor, k * Math.sqrt(0.75) * mm)
    close(e?.angle, Math.PI / 4)
  })

  it('pair distances', () => {
    // 10 pairs: sqrt5 (4 times), sqrt2, sqrt32 = 4 sqrt2, sqrt10 (2), sqrt13 (2); smallest (2,1)-(3,2)
    close(s.minPairDistance, Math.SQRT2 * mm)
    const sum = 5 * Math.SQRT2 + 4 * Math.sqrt(5) + 2 * Math.sqrt(10) + 2 * Math.sqrt(13)
    close(s.meanPairDistance, (sum / 10) * mm)
  })

  it('prediction ellipse: F(2, n - 2) factor of NIST/SEMATECH 6.5.4.3.4', () => {
    // k^2 = 2 (n^2 - 1) / (n (n - 2)) F, F(2, 3) at 0.9 = (3/2) (0.1^(-2/3) - 1)
    const k = Math.sqrt(((2 * 24) / 15) * 1.5 * (0.1 ** (-2 / 3) - 1))
    const e = predictionEllipse(s, 0.9)
    close(e?.semiMajor, k * Math.sqrt(4.25) * mm)
    close(e?.semiMinor, k * Math.sqrt(0.75) * mm)
    close(e?.angle, Math.PI / 4)
  })

  it('has no offsets without excluded shots, aim or velocities', () => {
    expect(s.excludedOffset).toBeUndefined()
    expect(s.aimOffset).toBeUndefined()
    expect(s.velocityCorrelation).toBeUndefined()
  })

  it('confidence intervals from chi-square quantiles', () => {
    expect(s.confidence).toBeDefined()
    const c = s.confidence as NonNullable<typeof s.confidence>
    expect(c.confidenceLevel).toBe(0.95)
    expect(c.axisDegreesOfFreedom).toBe(4)
    expect(c.circularDegreesOfFreedom).toBe(8)
    const lo4 = chiSquareQuantile(0.025, 4)
    const hi4 = chiSquareQuantile(0.975, 4)
    close(c.standardDeviationX.lower, Math.sqrt(10 / hi4) * mm)
    close(c.standardDeviationX.upper, Math.sqrt(10 / lo4) * mm)
    const lo8 = chiSquareQuantile(0.025, 8)
    const hi8 = chiSquareQuantile(0.975, 8)
    close(c.sigma.lower, Math.sqrt(20 / hi8) * mm)
    close(c.sigma.upper, Math.sqrt(20 / lo8) * mm)
    close(c.radialStandardDeviation.lower, Math.SQRT2 * c.sigma.lower)
    close(c.cep.upper, Math.sqrt(2 * Math.LN2) * c.sigma.upper)
    // the point estimate lies inside its interval
    expect(c.cep.lower).toBeLessThan(s.cep as number)
    expect(c.cep.upper).toBeGreaterThan(s.cep as number)
  })

  it('takes the confidence level from the input', () => {
    const c = groupStatistics({ shots: five, distance: 100, confidenceLevel: 0.9 }).confidence
    expect(c?.confidenceLevel).toBe(0.9)
    close(c?.sigma.lower, Math.sqrt(20 / chiSquareQuantile(0.95, 8)) * mm)
  })
})

describe('groupStatistics: excluded shots and aim', () => {
  it('keeps excluded shots out and reports their offset', () => {
    const s = groupStatistics({
      shots: [
        ...five,
        { x: 10 * mm, y: 10 * mm, excluded: true },
        { x: 12 * mm, y: 6 * mm, excluded: true },
      ],
      distance: 100,
      aim: { x: 0, y: 0 },
    })
    expect(s.shotCount).toBe(5)
    expect(s.excludedCount).toBe(2)
    close(s.extremeSpread, Math.sqrt(32) * mm)
    // excluded centre (11, 8) minus group centre (2, 2)
    close(s.excludedOffset?.x, 9 * mm)
    close(s.excludedOffset?.y, 6 * mm)
    close(s.aimOffset?.dx, 2 * mm)
    close(s.aimOffset?.dy, 2 * mm)
    close(s.aimOffset?.distance, Math.sqrt(8) * mm)
    expect(s.aimOffset?.compass).toBe('NE')
  })

  it('names the 8 compass points and the centre', () => {
    const compass = (dx: number, dy: number) =>
      groupStatistics({ shots: [{ x: dx, y: dy }], distance: 100, aim: { x: 0, y: 0 } }).aimOffset
        ?.compass
    expect(compass(0, 0.01)).toBe('N')
    expect(compass(0.01, 0.01)).toBe('NE')
    expect(compass(0.01, 0)).toBe('E')
    expect(compass(0.01, -0.01)).toBe('SE')
    expect(compass(0, -0.01)).toBe('S')
    expect(compass(-0.01, -0.01)).toBe('SW')
    expect(compass(-0.01, 0)).toBe('W')
    expect(compass(-0.01, 0.01)).toBe('NW')
    // 22 degrees from N is still N, 23 degrees is NE
    expect(compass(Math.sin((22 * Math.PI) / 180), Math.cos((22 * Math.PI) / 180))).toBe('N')
    expect(compass(Math.sin((23 * Math.PI) / 180), Math.cos((23 * Math.PI) / 180))).toBe('NE')
    expect(compass(0, 0)).toBe('centre')
    // a mean that rounds next to the aim is still the centre
    const s = groupStatistics({
      shots: shots([
        [0.1, 0],
        [0.2, 0],
        [0.3, 0],
      ]),
      distance: 100,
      aim: { x: 0.2 * mm, y: 0 },
    })
    expect(s.aimOffset?.compass).toBe('centre')
  })
})

describe('groupStatistics: boundary cases', () => {
  it('no shots', () => {
    const s = groupStatistics({ shots: [], distance: 100, aim: { x: 0, y: 0 } })
    expect(s.shotCount).toBe(0)
    expect(s.excludedCount).toBe(0)
    expect(s.centre).toBeUndefined()
    expect(s.extremeSpread).toBeUndefined()
    expect(s.aimOffset).toBeUndefined()
    expect(s.confidence).toBeUndefined()
  })

  it('all excluded', () => {
    const s = groupStatistics({ shots: five.map((p) => ({ ...p, excluded: true })), distance: 100 })
    expect(s.shotCount).toBe(0)
    expect(s.excludedCount).toBe(5)
    expect(s.centre).toBeUndefined()
    expect(s.excludedOffset).toBeUndefined()
  })

  it('one shot: centre only', () => {
    const s = groupStatistics({ shots: shots([[3, -4]]), distance: 100 })
    close(s.centre?.x, 3 * mm)
    close(s.centre?.y, -4 * mm)
    for (const v of [
      s.extremeSpread,
      s.width,
      s.height,
      s.meanRadius,
      s.standardDeviationX,
      s.standardDeviationY,
      s.radialStandardDeviation,
      s.radiusStandardDeviation,
      s.cep,
    ])
      expect(v).toBeUndefined()
    expect(s.covariance).toBeUndefined()
    expect(s.principalAxisAngle).toBeUndefined()
    expect(s.confidence).toBeUndefined()
    expect(dispersionEllipse(s, 0.5)).toBeUndefined()
  })

  it('two shots', () => {
    const s = groupStatistics({
      shots: shots([
        [0, 0],
        [3, 4],
      ]),
      distance: 100,
    })
    close(s.extremeSpread, 5 * mm)
    close(s.meanRadius, 2.5 * mm)
    close(s.radiusStandardDeviation, 0)
    // Sxx = 4.5, Syy = 8, divisor 1
    close(s.standardDeviationX, Math.sqrt(4.5) * mm)
    close(s.radialStandardDeviation, (5 * mm) / Math.SQRT2)
    close(s.principalAxisAngle, Math.atan2(4, 3))
    close(s.minPairDistance, 5 * mm)
    close(s.meanPairDistance, 5 * mm)
    expect(predictionEllipse(s, 0.5)).toBeUndefined()
    // 2 degrees of freedom: quantile -2 ln(1 - q)
    const c = s.confidence
    expect(c?.circularDegreesOfFreedom).toBe(2)
    close(c?.sigma.lower, Math.sqrt(12.5 / (-2 * Math.log(0.025))) * mm, 1e-9)
    close(c?.sigma.upper, Math.sqrt(12.5 / (-2 * Math.log(0.975))) * mm, 1e-9)
  })

  it('collinear shots: the ellipse is a segment', () => {
    const s = groupStatistics({
      shots: shots([
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
      distance: 100,
    })
    close(s.principalAxisAngle, Math.PI / 4)
    const e = dispersionEllipse(s, 0.9)
    const k = Math.sqrt(-2 * Math.log(0.1))
    // variance along the line: (2 + 0 + 2) / 2 = 2 mm^2
    close(e?.semiMajor, k * Math.sqrt(2) * mm)
    expect(e?.semiMinor as number).toBeLessThan(1e-6 * (e?.semiMajor as number))
    close(e?.angle, Math.PI / 4)
    // all spread on one line: half of a normal variable lies within 0.6744897501960817 SD of its mean
    close(s.cepElliptical, 0.6744897501960817 * Math.sqrt(2) * mm, 1e-9)
  })

  it('equal variances without covariance: no principal axis', () => {
    const s = groupStatistics({
      shots: shots([
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]),
      distance: 100,
    })
    expect(s.principalAxisAngle).toBeUndefined()
    const e = dispersionEllipse(s, 0.5)
    expect(e?.angle).toBe(0)
    close(e?.semiMajor, e?.semiMinor as number)
    // circular spread: the elliptical CEP is the circular one
    close(s.cepElliptical, s.cep as number)
  })

  it('a vertical group has its axis at +pi/2', () => {
    const s = groupStatistics({
      shots: shots([
        [0, 0],
        [0, 2],
        [0, 4],
      ]),
      distance: 100,
    })
    close(s.principalAxisAngle, Math.PI / 2)
  })

  it('rejects invalid input', () => {
    expect(() => groupStatistics({ shots: five, distance: 0 })).toThrow(InputError)
    expect(() => groupStatistics({ shots: [{ x: Number.NaN, y: 0 }], distance: 100 })).toThrow(
      InputError,
    )
    expect(() =>
      groupStatistics({
        shots: [{ x: 0, y: 0, velocity: Number.POSITIVE_INFINITY }],
        distance: 100,
      }),
    ).toThrow(InputError)
    expect(() => groupStatistics({ shots: five, distance: 100, confidenceLevel: 1 })).toThrow(
      InputError,
    )
    const s = groupStatistics({ shots: five, distance: 100 })
    expect(() => dispersionEllipse(s, 0)).toThrow(InputError)
    expect(() => dispersionEllipse(s, 1)).toThrow(InputError)
  })
})

describe('velocity correlation', () => {
  it('linear data: r = 1 and the slope', () => {
    const v = [790, 800, 810, 805]
    const s = groupStatistics({
      shots: [
        ...v.map((velocity, i) => ({ x: i * mm, y: 0.001 * (velocity - 800), velocity })),
        { x: 0, y: 1, velocity: 700, excluded: true },
        { x: 0, y: 0 },
      ],
      distance: 100,
    })
    expect(s.velocityCorrelation?.shotCount).toBe(4)
    close(s.velocityCorrelation?.correlation, 1, 1e-12)
    close(s.velocityCorrelation?.slope, 0.001)
  })

  it('hand calculation and missing cases', () => {
    // v deviations -10, 0, 10; y deviations 1, -2, 1 mm: Svy = 0, r = 0
    const s = groupStatistics({
      shots: [
        { x: 0, y: 1 * mm, velocity: 790 },
        { x: 0, y: -2 * mm, velocity: 800 },
        { x: 0, y: 1 * mm, velocity: 810 },
      ],
      distance: 100,
    })
    expect(Math.abs(s.velocityCorrelation?.correlation as number)).toBeLessThan(1e-12)
    const two = groupStatistics({
      shots: [
        { x: 0, y: 0, velocity: 800 },
        { x: 0, y: 1, velocity: 810 },
      ],
      distance: 100,
    })
    expect(two.velocityCorrelation).toBeUndefined()
    const flat = groupStatistics({
      shots: [0, 1, 2].map((i) => ({ x: 0, y: i * mm, velocity: 800 })),
      distance: 100,
    })
    expect(flat.velocityCorrelation).toBeUndefined()
  })
})

describe('chi-square distribution', () => {
  it('2 degrees of freedom: 1 - exp(-x/2)', () => {
    for (const p of [0.025, 0.5, 0.95, 0.975])
      close(chiSquareQuantile(p, 2), -2 * Math.log(1 - p), 1e-12)
  })

  it('even degrees of freedom: finite sum (DLMF 8.4.10)', () => {
    const finite = (x: number, df: number) => {
      let term = 1
      let sum = 1
      for (let k = 1; k < df / 2; k++) {
        term *= x / 2 / k
        sum += term
      }
      return 1 - Math.exp(-x / 2) * sum
    }
    // absolute: 1 - exp(-x/2) sum cancels where the probability is small
    for (const df of [4, 8, 20])
      for (const x of [0.5, 3, 10, 30])
        expect(Math.abs(chiSquareCdf(x, df) - finite(x, df))).toBeLessThan(1e-14)
  })

  it('1 degree of freedom: square of the normal quantile', () => {
    // z at 0.975 = 1.959963984540054
    close(chiSquareQuantile(0.95, 1), 1.959963984540054 ** 2, 1e-12)
  })

  it('odd degrees of freedom: integral of the density', () => {
    // df 5: density x^1.5 exp(-x/2) / (2^2.5 Gamma(2.5)), Gamma(2.5) = 0.75 sqrt(pi); Simpson rule
    const df = 5
    const norm = 2 ** 2.5 * 0.75 * Math.sqrt(Math.PI)
    const pdf = (x: number) => (x ** (df / 2 - 1) * Math.exp(-x / 2)) / norm
    const x = 7
    const m = 20000
    const h = x / m
    let sum = pdf(0) + pdf(x)
    for (let i = 1; i < m; i++) sum += (i % 2 ? 4 : 2) * pdf(i * h)
    close(chiSquareCdf(x, df), (sum * h) / 3, 1e-9)
  })

  it('large pooled degrees of freedom do not underflow', () => {
    const df = 4000
    const q = chiSquareQuantile(0.5, df)
    expect(q).toBeGreaterThan(df - 1)
    expect(q).toBeLessThan(df)
    close(chiSquareCdf(q, df), 0.5, 1e-10)
    close(chiSquareCdf(chiSquareQuantile(0.975, df), df), 0.975, 1e-10)
  })
})

describe('F distribution with 2 and m degrees of freedom', () => {
  it('2 and 2: the distribution function is x / (1 + x)', () => {
    for (const p of [0.05, 0.5, 0.9, 0.99]) close(fQuantileTwoNumeratorDegrees(p, 2), p / (1 - p))
  })

  it('upper critical values of NIST/SEMATECH 1.3.6.7.3', () => {
    const table: [number, number, number][] = [
      [1, 199.5, 49.5],
      [3, 9.552, 5.462],
      [8, 4.459, 3.113],
      [10, 4.103, 2.924],
      [20, 3.493, 2.589],
      [100, 3.087, 2.356],
    ]
    for (const [m, at95, at90] of table) {
      expect(Math.abs(fQuantileTwoNumeratorDegrees(0.95, m) - at95)).toBeLessThan(5e-4)
      expect(Math.abs(fQuantileTwoNumeratorDegrees(0.9, m) - at90)).toBeLessThan(5e-4)
    }
  })

  it('large m: chi-square with 2 degrees of freedom over 2', () => {
    close(fQuantileTwoNumeratorDegrees(0.95, 1e7), -Math.log(0.05), 1e-6)
  })

  it('rejects invalid input', () => {
    expect(() => fQuantileTwoNumeratorDegrees(1, 3)).toThrow(InputError)
    expect(() => fQuantileTwoNumeratorDegrees(0.5, 0)).toThrow(InputError)
  })
})

describe('pooling', () => {
  it('two groups with the same shots relative to their centres', () => {
    const shifted = five.map((p) => ({ x: p.x + 0.05, y: p.y - 0.03 }))
    const one = groupStatistics({ shots: five, distance: 100 })
    const pooled = pooledGroupStatistics([
      { shots: five, distance: 100 },
      { shots: shifted, distance: 100 },
      { shots: shots([[9, 9]]), distance: 100 },
    ])
    expect(pooled.groupCount).toBe(2)
    expect(pooled.shotCount).toBe(10)
    expect(pooled.groupSizes).toEqual([5, 5])
    close(pooled.standardDeviationX, one.standardDeviationX as number)
    close(pooled.standardDeviationY, one.standardDeviationY as number)
    close(pooled.radialStandardDeviation, one.radialStandardDeviation as number)
    close(pooled.cep, one.cep as number)
    close(pooled.meanExtremeSpread, one.extremeSpread as number)
    expect(pooled.confidence?.axisDegreesOfFreedom).toBe(8)
    expect(pooled.confidence?.circularDegreesOfFreedom).toBe(16)
    close(pooled.confidence?.sigma.lower, Math.sqrt(40 / chiSquareQuantile(0.975, 16)) * mm)
    // the same values in angle: lengths over the distance
    close(pooled.angular?.standardDeviationX, (one.standardDeviationX as number) / 100)
    close(pooled.angular?.cep, (one.cep as number) / 100)
    close(pooled.angular?.meanExtremeSpread, (one.extremeSpread as number) / 100)
    close(pooled.angular?.confidence.sigma.upper, (pooled.confidence?.sigma.upper as number) / 100)
  })

  it('weights groups by degrees of freedom', () => {
    // group A: (0,0) (2,0): Sxx = 2, df 1; group B: five, Sxx = 10, df 4
    const pooled = pooledGroupStatistics([
      {
        shots: shots([
          [0, 0],
          [2, 0],
        ]),
        distance: 100,
      },
      { shots: five, distance: 100 },
    ])
    close(pooled.standardDeviationX, Math.sqrt(12 / 5) * mm)
    close(pooled.standardDeviationY, Math.sqrt(10 / 5) * mm)
    close(pooled.meanExtremeSpread, ((2 + Math.sqrt(32)) / 2) * mm)
  })

  it('no group with two shots', () => {
    const empty = pooledGroupStatistics([{ shots: shots([[0, 0]]), distance: 100 }])
    expect(empty.groupCount).toBe(0)
    expect(empty.standardDeviationX).toBeUndefined()
    expect(empty.confidence).toBeUndefined()
    expect(empty.angular).toBeUndefined()
  })

  it('groups at two distances pool in angle, without lengths', () => {
    // the 200 m group is the 100 m group scaled by 2: the same angles
    const one = groupStatistics({ shots: five, distance: 100 })
    const far = five.map((p) => ({ x: 2 * p.x, y: 2 * p.y }))
    const pooled = pooledGroupStatistics([
      { shots: five, distance: 100 },
      { shots: far, distance: 200 },
    ])
    expect(pooled.shotCount).toBe(10)
    expect(pooled.standardDeviationX).toBeUndefined()
    expect(pooled.cep).toBeUndefined()
    expect(pooled.meanExtremeSpread).toBeUndefined()
    expect(pooled.confidence).toBeUndefined()
    close(pooled.angular?.standardDeviationX, (one.standardDeviationX as number) / 100)
    close(pooled.angular?.radialStandardDeviation, (one.radialStandardDeviation as number) / 100)
    close(pooled.angular?.meanExtremeSpread, (one.extremeSpread as number) / 100)
    expect(pooled.angular?.confidence.circularDegreesOfFreedom).toBe(16)
    // (0,0) (2,0) mm at 50 m: Sxx/D^2 = 2e-6 / 2500; five at 100 m: 10e-6 / 1e4; df 1 + 4
    const mixed = pooledGroupStatistics([
      {
        shots: shots([
          [0, 0],
          [2, 0],
        ]),
        distance: 50,
      },
      { shots: five, distance: 100 },
    ])
    close(mixed.angular?.standardDeviationX, Math.sqrt((2e-6 / 2500 + 10e-6 / 1e4) / 5))
    close(mixed.angular?.meanExtremeSpread, (2e-3 / 50 + (Math.sqrt(32) * 1e-3) / 100) / 2)
  })
})

describe('subtendedAngle', () => {
  it('exact angle of a segment centred on the line of sight', () => {
    close(subtendedAngle(0.1, 100), 2 * Math.atan(0.0005))
    close(subtendedAngle(2, 1), Math.PI / 2)
    expect(() => subtendedAngle(0.1, 0)).toThrow(InputError)
  })
})

describe('ellipse and CEP coverage (seeded simulation)', () => {
  // bivariate normal: axis SDs 10 mm and 4 mm, major axis at 30 degrees, centre (5, -3) mm (Box-Muller)
  const draw = (random: () => number, count: number): GroupShot[] => {
    const theta = Math.PI / 6
    const out: GroupShot[] = []
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(-2 * Math.log(1 - random()))
      const phi = 2 * Math.PI * random()
      const u = 10 * mm * r * Math.cos(phi)
      const v = 4 * mm * r * Math.sin(phi)
      out.push({
        x: 5 * mm + u * Math.cos(theta) - v * Math.sin(theta),
        y: -3 * mm + u * Math.sin(theta) + v * Math.cos(theta),
      })
    }
    return out
  }

  const count = 20000
  const random = uniforms(272)
  const sample = draw(random, count)
  const fresh = draw(random, count)
  const s = groupStatistics({ shots: sample, distance: 100 })

  it('recovers the axis direction', () => {
    expect(Math.abs((s.principalAxisAngle as number) - Math.PI / 6)).toBeLessThan(0.01)
  })

  for (const p of [0.3935, 0.5, 0.9, 0.99]) {
    it(`covers ${p} of further shots`, () => {
      const found = dispersionEllipse(s, p)
      expect(found).toBeDefined()
      expect(s.centre).toBeDefined()
      const e = found as NonNullable<typeof found>
      const { x: cx, y: cy } = s.centre as NonNullable<typeof s.centre>
      const c = Math.cos(e.angle)
      const sn = Math.sin(e.angle)
      const inside = fresh.filter(({ x, y }) => {
        const u = ((x - cx) * c + (y - cy) * sn) / e.semiMajor
        const v = (-(x - cx) * sn + (y - cy) * c) / e.semiMinor
        return u * u + v * v <= 1
      }).length
      expect(Math.abs(inside / count - p)).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / count))
    })
  }

  const insideEllipse = (
    e: { semiMajor: number; semiMinor: number; angle: number },
    c: { x: number; y: number },
    { x, y }: GroupShot,
  ) => {
    const u = ((x - c.x) * Math.cos(e.angle) + (y - c.y) * Math.sin(e.angle)) / e.semiMajor
    const v = (-(x - c.x) * Math.sin(e.angle) + (y - c.y) * Math.cos(e.angle)) / e.semiMinor
    return u * u + v * v <= 1
  }

  it('the elliptical CEP holds half of further shots, the circular one more', () => {
    if (!s.centre) throw new Error('no centre')
    const { x: cx, y: cy } = s.centre
    const share = (r: number) =>
      fresh.filter(({ x, y }) => Math.hypot(x - cx, y - cy) <= r).length / count
    expect(Math.abs(share(s.cepElliptical as number) - 0.5)).toBeLessThan(
      4 * Math.sqrt(0.25 / count),
    )
    expect(share(s.cep as number)).toBeGreaterThan(0.55)
  })

  // Each trial: a new group of n shots and one further shot; the prediction ellipse holds the
  // further shot with probability `coverage` over trials, the sample ellipse less often.
  const coverageTrials = (n: number, trials: number) => {
    const rng = uniforms(1000 + n)
    let predicted = 0
    let sampled = 0
    for (let t = 0; t < trials; t++) {
      const group = groupStatistics({ shots: draw(rng, n), distance: 100 })
      const next = nth(draw(rng, 1), 0)
      const pe = predictionEllipse(group, 0.9)
      const se = dispersionEllipse(group, 0.9)
      if (!pe || !se || !group.centre) throw new Error('no ellipse')
      if (insideEllipse(pe, group.centre, next)) predicted++
      if (insideEllipse(se, group.centre, next)) sampled++
    }
    return { predicted, sampled }
  }
  for (const n of [3, 5, 10]) {
    it(`prediction ellipse covers 0.9 of new shots at n = ${n}`, () => {
      const trials = 4000
      const { predicted, sampled } = coverageTrials(n, trials)
      expect(Math.abs(predicted / trials - 0.9)).toBeLessThan(4 * Math.sqrt(0.09 / trials))
      expect(sampled / trials).toBeLessThan(0.9 - 4 * Math.sqrt(0.09 / trials))
    })
  }
})

describe('chi-square survival function', () => {
  it('keeps the upper tail where 1 minus the distribution function is 0', () => {
    // two degrees of freedom: exp(-x / 2); four: exp(-x / 2) (1 + x / 2)
    // the true tail is 1e-85
    expect(1 - chiSquareCdf(400, 4)).toBe(0)
    close(chiSquareSurvival(100, 2), Math.exp(-50), 1e-12)
    close(chiSquareSurvival(60, 4), Math.exp(-30) * 31, 1e-12)
    close(chiSquareSurvival(400, 4), Math.exp(-200) * 201, 1e-12)
  })

  it('adds up with the distribution function on both sides of the switch', () => {
    for (const df of [1, 2, 3, 7, 30])
      for (const x of [0.5, 1, df - 0.5, df, df + 2 * Math.sqrt(df), 3 * df, 80]) {
        close(chiSquareSurvival(x, df) + chiSquareCdf(x, df), 1, 1e-13)
      }
    close(chiSquareSurvival(1, 1), 0.31731050786291415, 1e-12)
    expect(chiSquareSurvival(0, 3)).toBe(1)
    expect(chiSquareSurvival(Number.POSITIVE_INFINITY, 3)).toBe(0)
    expect(chiSquareCdf(Number.POSITIVE_INFINITY, 2)).toBe(1)
    expect(chiSquareCdf(1e12, 2)).toBe(1)
    expect(() => chiSquareSurvival(1, 0)).toThrow(InputError)
  })
})

describe('Student t two-sided quantile', () => {
  it('gives the tabulated 95 % values for odd and even degrees of freedom', () => {
    const table: [number, number][] = [
      [1, 12.7062],
      [2, 4.3027],
      [3, 3.1824],
      [4, 2.7764],
      [5, 2.5706],
      [10, 2.2281],
      [30, 2.0423],
    ]
    for (const [df, t] of table) expect(studentTwoSidedQuantile(0.95, df)).toBeCloseTo(t, 3)
  })

  it('approaches the normal quantile and rejects bad inputs', () => {
    expect(studentTwoSidedQuantile(0.95, 1000)).toBeCloseTo(1.96, 1)
    expect(studentTwoSidedQuantile(0.99, 2)).toBeCloseTo(9.9248, 3)
    expect(() => studentTwoSidedQuantile(1, 3)).toThrow(InputError)
    expect(() => studentTwoSidedQuantile(0.9, 0)).toThrow(InputError)
  })
})
