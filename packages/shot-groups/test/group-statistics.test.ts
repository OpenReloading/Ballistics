import { chiSquareQuantile, InputError, nth, seededUniforms } from '@rangefoundry/statistics'
import { describe, expect, it } from 'vitest'
import {
  dispersionEllipse,
  type GroupShot,
  groupStatistics,
  pooledGroupStatistics,
  predictionEllipse,
  subtendedAngle,
} from '../src/group-statistics.ts'

const mm = 1e-3
/** Asserts that `actual` is defined and within `rel` of `expected`. */
const expectClose = (actual: number | undefined, expected: number, rel = 1e-12) => {
  expect(actual).toBeDefined()
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(
    rel * Math.abs(expected) + 1e-18,
  )
}
const shots = (points: [number, number][]): GroupShot[] =>
  points.map(([x, y]) => ({ x: x * mm, y: y * mm }))

// Five shots, mm: center (2, 2); deviations (-2,-2) (0,-1) (2,2) (-1,1) (1,0); Sxx = 10, Syy = 10, Sxy = 7; radii sqrt8, 1, sqrt8, sqrt2, 1 (sum of squares 20).
const five = shots([
  [0, 0],
  [2, 1],
  [4, 4],
  [1, 3],
  [3, 2],
])

/** The aim offset's compass point of one shot at (dx, dy) from the aim. */
const aimCompass = (dx: number, dy: number) =>
  groupStatistics({ shots: [{ x: dx, y: dy }], distance: 100, aim: { x: 0, y: 0 } }).aimOffset
    ?.compass

// bivariate normal: axis SDs 10 mm and 4 mm, major axis at 30 degrees, center (5, -3) mm (Box-Muller)
const drawShots = (random: () => number, count: number): GroupShot[] => {
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

const insideEllipse = (
  e: { semiMajor: number; semiMinor: number; angle: number },
  c: { x: number; y: number },
  { x, y }: GroupShot,
) => {
  const u = ((x - c.x) * Math.cos(e.angle) + (y - c.y) * Math.sin(e.angle)) / e.semiMajor
  const v = (-(x - c.x) * Math.sin(e.angle) + (y - c.y) * Math.cos(e.angle)) / e.semiMinor
  return u * u + v * v <= 1
}

// Each trial a new group of n shots and one further shot: the prediction ellipse holds the further shot with probability `coverage` over trials, the sample ellipse less often.
const coverageTrials = (n: number, trials: number) => {
  const rng = seededUniforms(1000 + n)
  let predicted = 0
  let sampled = 0
  for (let t = 0; t < trials; t++) {
    const group = groupStatistics({ shots: drawShots(rng, n), distance: 100 })
    const next = nth(drawShots(rng, 1), 0)
    const pe = predictionEllipse(group, 0.9)
    const se = dispersionEllipse(group, 0.9)
    if (!pe || !se || !group.centre) throw new Error('no ellipse')
    if (insideEllipse(pe, group.centre, next)) predicted++
    if (insideEllipse(se, group.centre, next)) sampled++
  }
  return { predicted, sampled }
}

// four shots (+-1, 0), (0, +-q): uncorrelated axes, minor over major standard deviation q
const cepsOf = (q: number) => {
  const s = groupStatistics({
    shots: [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: q },
      { x: 0, y: -q },
    ],
    distance: 100,
  })
  const major = Math.sqrt(2 / 3)
  return { circular: (s.cep as number) / major, elliptical: (s.cepElliptical as number) / major }
}

// share of the population inside radius r (in major standard deviations), midpoint rule
const shareInside = (r: number, q: number) => {
  const n = 20000
  let sum = 0
  for (let i = 0; i < n; i++) {
    const phi = ((i + 0.5) * Math.PI) / (2 * n)
    sum += Math.exp((-r * r) / (2 * (Math.cos(phi) ** 2 + q * q * Math.sin(phi) ** 2)))
  }
  return 1 - sum / n
}

describe('groupStatistics: hand calculation', () => {
  const s = groupStatistics({ shots: five, distance: 100 })

  it('center, sizes and radii', () => {
    expect(s.shotCount).toBe(5)
    expect(s.excludedCount).toBe(0)
    expectClose(s.centre?.x, 2 * mm)
    expectClose(s.centre?.y, 2 * mm)
    // largest pair (0,0)-(4,4): sqrt 32
    expectClose(s.extremeSpread, Math.sqrt(32) * mm)
    expectClose(s.width, 4 * mm)
    expectClose(s.height, 4 * mm)
    // (2 sqrt8 + 1 + 1 + sqrt2) / 5 = sqrt2 + 0.4
    expectClose(s.meanRadius, (Math.SQRT2 + 0.4) * mm)
    // sum (r - rbar)^2 = 20 - 5 (sqrt2 + 0.4)^2 = 9.2 - 4 sqrt2, divisor n - 1
    expectClose(s.radiusStandardDeviation, Math.sqrt((9.2 - 4 * Math.SQRT2) / 4) * mm)
  })

  it('standard deviations, covariance and CEP use n - 1', () => {
    expectClose(s.standardDeviationX, Math.sqrt(10 / 4) * mm)
    expectClose(s.standardDeviationY, Math.sqrt(10 / 4) * mm)
    expectClose(s.radialStandardDeviation, Math.sqrt(5) * mm)
    expectClose(s.cep, Math.sqrt(2 * Math.LN2) * Math.sqrt(2.5) * mm)
    expectClose(s.covariance?.xx, 2.5 * mm * mm)
    expectClose(s.covariance?.yy, 2.5 * mm * mm)
    expectClose(s.covariance?.xy, 1.75 * mm * mm)
    // equal variances, positive covariance: major axis at 45 degrees
    expectClose(s.principalAxisAngle, Math.PI / 4)
    // eigenvalues 2.5 +- 1.75 mm^2
    const e = dispersionEllipse(s, 0.9)
    const k = Math.sqrt(-2 * Math.log(0.1))
    expectClose(e?.semiMajor, k * Math.sqrt(4.25) * mm)
    expectClose(e?.semiMinor, k * Math.sqrt(0.75) * mm)
    expectClose(e?.angle, Math.PI / 4)
  })
})

describe('groupStatistics: hand calculation, pairs and confidence', () => {
  const s = groupStatistics({ shots: five, distance: 100 })

  it('pair distances', () => {
    // 10 pairs: sqrt5 (4 times), sqrt2, sqrt32 = 4 sqrt2, sqrt10 (2), sqrt13 (2); smallest (2,1)-(3,2)
    expectClose(s.minPairDistance, Math.SQRT2 * mm)
    const sum = 5 * Math.SQRT2 + 4 * Math.sqrt(5) + 2 * Math.sqrt(10) + 2 * Math.sqrt(13)
    expectClose(s.meanPairDistance, (sum / 10) * mm)
  })

  it('prediction ellipse: F(2, n - 2) factor of NIST/SEMATECH 6.5.4.3.4', () => {
    // k^2 = 2 (n^2 - 1) / (n (n - 2)) F, F(2, 3) at 0.9 = (3/2) (0.1^(-2/3) - 1)
    const k = Math.sqrt(((2 * 24) / 15) * 1.5 * (0.1 ** (-2 / 3) - 1))
    const e = predictionEllipse(s, 0.9)
    expectClose(e?.semiMajor, k * Math.sqrt(4.25) * mm)
    expectClose(e?.semiMinor, k * Math.sqrt(0.75) * mm)
    expectClose(e?.angle, Math.PI / 4)
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
    expectClose(c.standardDeviationX.lower, Math.sqrt(10 / hi4) * mm)
    expectClose(c.standardDeviationX.upper, Math.sqrt(10 / lo4) * mm)
    const lo8 = chiSquareQuantile(0.025, 8)
    const hi8 = chiSquareQuantile(0.975, 8)
    expectClose(c.sigma.lower, Math.sqrt(20 / hi8) * mm)
    expectClose(c.sigma.upper, Math.sqrt(20 / lo8) * mm)
    expectClose(c.radialStandardDeviation.lower, Math.SQRT2 * c.sigma.lower)
    expectClose(c.cep.upper, Math.sqrt(2 * Math.LN2) * c.sigma.upper)
    expect(c.cep.lower).toBeLessThan(s.cep as number)
    expect(c.cep.upper).toBeGreaterThan(s.cep as number)
  })

  it('takes the confidence level from the input', () => {
    const c = groupStatistics({ shots: five, distance: 100, confidenceLevel: 0.9 }).confidence
    expect(c?.confidenceLevel).toBe(0.9)
    expectClose(c?.sigma.lower, Math.sqrt(20 / chiSquareQuantile(0.95, 8)) * mm)
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
    expectClose(s.extremeSpread, Math.sqrt(32) * mm)
    // excluded center (11, 8) minus group center (2, 2)
    expectClose(s.excludedOffset?.x, 9 * mm)
    expectClose(s.excludedOffset?.y, 6 * mm)
    expectClose(s.aimOffset?.dx, 2 * mm)
    expectClose(s.aimOffset?.dy, 2 * mm)
    expectClose(s.aimOffset?.distance, Math.sqrt(8) * mm)
    expect(s.aimOffset?.compass).toBe('NE')
  })

  it('names the 8 compass points and the center', () => {
    expect(aimCompass(0, 0.01)).toBe('N')
    expect(aimCompass(0.01, 0.01)).toBe('NE')
    expect(aimCompass(0.01, 0)).toBe('E')
    expect(aimCompass(0.01, -0.01)).toBe('SE')
    expect(aimCompass(0, -0.01)).toBe('S')
    expect(aimCompass(-0.01, -0.01)).toBe('SW')
    expect(aimCompass(-0.01, 0)).toBe('W')
    expect(aimCompass(-0.01, 0.01)).toBe('NW')
    // 22 degrees from N is still N, 23 degrees is NE
    expect(aimCompass(Math.sin((22 * Math.PI) / 180), Math.cos((22 * Math.PI) / 180))).toBe('N')
    expect(aimCompass(Math.sin((23 * Math.PI) / 180), Math.cos((23 * Math.PI) / 180))).toBe('NE')
    expect(aimCompass(0, 0)).toBe('centre')
    // a mean that rounds next to the aim is still the center
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

  it('one shot: center only', () => {
    const s = groupStatistics({ shots: shots([[3, -4]]), distance: 100 })
    expectClose(s.centre?.x, 3 * mm)
    expectClose(s.centre?.y, -4 * mm)
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
})

describe('groupStatistics: boundary cases, two and three shots', () => {
  it('two shots', () => {
    const s = groupStatistics({
      shots: shots([
        [0, 0],
        [3, 4],
      ]),
      distance: 100,
    })
    expectClose(s.extremeSpread, 5 * mm)
    expectClose(s.meanRadius, 2.5 * mm)
    expectClose(s.radiusStandardDeviation, 0)
    // Sxx = 4.5, Syy = 8, divisor 1
    expectClose(s.standardDeviationX, Math.sqrt(4.5) * mm)
    expectClose(s.radialStandardDeviation, (5 * mm) / Math.SQRT2)
    expectClose(s.principalAxisAngle, Math.atan2(4, 3))
    expectClose(s.minPairDistance, 5 * mm)
    expectClose(s.meanPairDistance, 5 * mm)
    expect(predictionEllipse(s, 0.5)).toBeUndefined()
    // 2 degrees of freedom: quantile -2 ln(1 - q)
    const c = s.confidence
    expect(c?.circularDegreesOfFreedom).toBe(2)
    expectClose(c?.sigma.lower, Math.sqrt(12.5 / (-2 * Math.log(0.025))) * mm, 1e-9)
    expectClose(c?.sigma.upper, Math.sqrt(12.5 / (-2 * Math.log(0.975))) * mm, 1e-9)
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
    expectClose(s.principalAxisAngle, Math.PI / 4)
    const e = dispersionEllipse(s, 0.9)
    const k = Math.sqrt(-2 * Math.log(0.1))
    // variance along the line: (2 + 0 + 2) / 2 = 2 mm^2
    expectClose(e?.semiMajor, k * Math.sqrt(2) * mm)
    expect(e?.semiMinor as number).toBeLessThan(1e-6 * (e?.semiMajor as number))
    expectClose(e?.angle, Math.PI / 4)
    // all spread on one line: half of a normal variable lies within 0.6744897501960817 SD of its mean
    expectClose(s.cepElliptical, 0.6744897501960817 * Math.sqrt(2) * mm, 1e-9)
  })
})

describe('groupStatistics: boundary cases, axes and input', () => {
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
    expectClose(e?.semiMajor, e?.semiMinor as number)
    // circular spread: the elliptical CEP is the circular one
    expectClose(s.cepElliptical, s.cep as number)
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
    expectClose(s.principalAxisAngle, Math.PI / 2)
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
    expectClose(s.velocityCorrelation?.correlation, 1, 1e-12)
    expectClose(s.velocityCorrelation?.slope, 0.001)
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

describe('pooling', () => {
  it('two groups with the same shots relative to their centers', () => {
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
    expectClose(pooled.standardDeviationX, one.standardDeviationX as number)
    expectClose(pooled.standardDeviationY, one.standardDeviationY as number)
    expectClose(pooled.radialStandardDeviation, one.radialStandardDeviation as number)
    expectClose(pooled.cep, one.cep as number)
    expectClose(pooled.meanExtremeSpread, one.extremeSpread as number)
    expect(pooled.confidence?.axisDegreesOfFreedom).toBe(8)
    expect(pooled.confidence?.circularDegreesOfFreedom).toBe(16)
    expectClose(pooled.confidence?.sigma.lower, Math.sqrt(40 / chiSquareQuantile(0.975, 16)) * mm)
    // the same values in angle: lengths over the distance
    expectClose(pooled.angular?.standardDeviationX, (one.standardDeviationX as number) / 100)
    expectClose(pooled.angular?.cep, (one.cep as number) / 100)
    expectClose(pooled.angular?.meanExtremeSpread, (one.extremeSpread as number) / 100)
    expectClose(
      pooled.angular?.confidence.sigma.upper,
      (pooled.confidence?.sigma.upper as number) / 100,
    )
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
    expectClose(pooled.standardDeviationX, Math.sqrt(12 / 5) * mm)
    expectClose(pooled.standardDeviationY, Math.sqrt(10 / 5) * mm)
    expectClose(pooled.meanExtremeSpread, ((2 + Math.sqrt(32)) / 2) * mm)
  })
})

describe('pooling: empty and mixed distances', () => {
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
    expectClose(pooled.angular?.standardDeviationX, (one.standardDeviationX as number) / 100)
    expectClose(
      pooled.angular?.radialStandardDeviation,
      (one.radialStandardDeviation as number) / 100,
    )
    expectClose(pooled.angular?.meanExtremeSpread, (one.extremeSpread as number) / 100)
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
    expectClose(mixed.angular?.standardDeviationX, Math.sqrt((2e-6 / 2500 + 10e-6 / 1e4) / 5))
    expectClose(mixed.angular?.meanExtremeSpread, (2e-3 / 50 + (Math.sqrt(32) * 1e-3) / 100) / 2)
  })
})

describe('subtendedAngle', () => {
  it('exact angle of a segment centered on the line of sight', () => {
    expectClose(subtendedAngle(0.1, 100), 2 * Math.atan(0.0005))
    expectClose(subtendedAngle(2, 1), Math.PI / 2)
    expect(() => subtendedAngle(0.1, 0)).toThrow(InputError)
  })
})

describe('ellipse and CEP coverage (seeded simulation)', () => {
  const count = 20000
  const random = seededUniforms(272)
  const sample = drawShots(random, count)
  const fresh = drawShots(random, count)
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

  it('the elliptical CEP holds half of further shots, the circular one more', () => {
    if (!s.centre) throw new Error('no center')
    const { x: cx, y: cy } = s.centre
    const share = (r: number) =>
      fresh.filter(({ x, y }) => Math.hypot(x - cx, y - cy) <= r).length / count
    expect(Math.abs(share(s.cepElliptical as number) - 0.5)).toBeLessThan(
      4 * Math.sqrt(0.25 / count),
    )
    expect(share(s.cep as number)).toBeGreaterThan(0.55)
  })

  for (const n of [3, 5, 10]) {
    it(`prediction ellipse covers 0.9 of new shots at n = ${n}`, () => {
      const trials = 4000
      const { predicted, sampled } = coverageTrials(n, trials)
      expect(Math.abs(predicted / trials - 0.9)).toBeLessThan(4 * Math.sqrt(0.09 / trials))
      expect(sampled / trials).toBeLessThan(0.9 - 4 * Math.sqrt(0.09 / trials))
    })
  }
})

describe('circular against elliptical CEP by axis ratio', () => {
  for (const [ratio, over, share] of [
    [1, 1, 0.5],
    [1.5, 1.02577, 0.51725],
    [2, 1.0694, 0.5432],
    [3, 1.14228, 0.57516],
    [5, 1.20286, 0.58992],
    [10, 1.22687, 0.59382],
  ] as const) {
    it(`axis ratio ${ratio}: circular over elliptical ${over}, ${share} inside the circular`, () => {
      const { circular, elliptical } = cepsOf(1 / ratio)
      expectClose(circular / elliptical, over, 1e-5)
      expectClose(shareInside(circular, 1 / ratio), share, 1e-4)
      expectClose(shareInside(elliptical, 1 / ratio), 0.5, 1e-6)
    })
  }

  it('one axis only: the ratio of the circular CEP to the median of |z|', () => {
    // circular sqrt(ln 2) sigma, elliptical the 0.75 quantile of the standard normal
    const { circular, elliptical } = cepsOf(0)
    expectClose(circular, Math.sqrt(Math.log(2)), 1e-12)
    expectClose(elliptical, 0.6744897501960817, 1e-6)
    expectClose(circular / elliptical, 1.23435, 1e-5)
    expectClose(shareInside(circular, 0), 0.5949, 1e-4)
  })
})

describe('groupStatistics: inputs, signs and limits', () => {
  it('names each invalid input', () => {
    const level = 'confidence-level'
    for (const confidenceLevel of [0, 1])
      expect(() => groupStatistics({ shots: five, distance: 100, confidenceLevel })).toThrow(level)
    expect(() => pooledGroupStatistics([{ shots: five, distance: 100 }], 1)).toThrow(level)
    expect(() => groupStatistics({ shots: five, distance: 0 })).toThrow(/^distance$/)
    expect(() =>
      pooledGroupStatistics([{ shots: [{ x: 0, y: Number.NaN }], distance: 100 }]),
    ).toThrow('shot-coordinates')
    expect(() =>
      groupStatistics({ shots: [{ x: 0, y: 0, velocity: Number.NaN }], distance: 100 }),
    ).toThrow('shot-velocity')
    expect(() =>
      groupStatistics({ shots: five, distance: 100, aim: { x: 0, y: Number.NaN } }),
    ).toThrow(/^aim$/)
    const s = groupStatistics({ shots: five, distance: 100 })
    for (const coverage of [0, 1]) {
      expect(() => dispersionEllipse(s, coverage)).toThrow(/^coverage$/)
      expect(() => predictionEllipse(s, coverage)).toThrow(/^coverage$/)
    }
    expect(() => subtendedAngle(0.1, 0)).toThrow(/^distance$/)
  })

  it('measures width, height and aim offset of a group off the origin', () => {
    const s = groupStatistics({
      shots: shots([
        [5, 7],
        [8, 9],
        [6, 13],
      ]),
      distance: 100,
      aim: { x: 1 * mm, y: 3 * mm },
    })
    expectClose(s.width, 3 * mm)
    expectClose(s.height, 6 * mm)
    // center (19/3, 29/3) mm
    expectClose(s.aimOffset?.dx, (19 / 3 - 1) * mm)
    expectClose(s.aimOffset?.dy, (29 / 3 - 3) * mm)
  })
})

describe('groupStatistics: limits', () => {
  it('has no velocity correlation when the heights do not vary', () => {
    const s = groupStatistics({
      shots: [790, 800, 810].map((velocity, i) => ({ x: i * mm, y: 0, velocity })),
      distance: 100,
    })
    expect('velocityCorrelation' in s).toBe(false)
  })

  it('brackets the elliptical CEP of a spread above one meter', () => {
    // variance 6 m2 on both axes: the elliptical CEP equals the circular one
    const s = groupStatistics({
      shots: [
        { x: 3, y: 0 },
        { x: 0, y: 3 },
        { x: -3, y: 0 },
        { x: 0, y: -3 },
      ],
      distance: 100,
    })
    expectClose(s.cepElliptical, Math.sqrt(2 * Math.LN2 * 6), 1e-9)
  })

  it('pools without excluded shots and with distances equal to 1e-9', () => {
    const pooled = pooledGroupStatistics([
      { shots: [...five, { x: 50 * mm, y: 50 * mm, excluded: true }], distance: 100 },
      { shots: five, distance: 100 + 5e-8 },
    ])
    expect(pooled.shotCount).toBe(10)
    expectClose(pooled.angular?.meanExtremeSpread, (Math.sqrt(32) * mm) / 100, 1e-8)
    expect(pooled.standardDeviationX).toBeDefined()
  })
})
