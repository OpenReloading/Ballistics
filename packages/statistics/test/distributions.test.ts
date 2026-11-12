import { near } from '@open-reloading/test-kit'
import { describe, expect, it } from 'vitest'
import { chiSquareCdf, chiSquareQuantile, chiSquareSurvival } from '../src/chi-square.ts'
import { InputError } from '../src/errors.ts'
import { fQuantileTwoNumeratorDegrees } from '../src/f-distribution.ts'
import { studentTwoSidedQuantile } from '../src/student-t.ts'

/** The chi-square distribution function for even `df` as a finite sum (DLMF 8.4.10). */
const evenChiSquareCdf = (x: number, df: number) => {
  let term = 1
  let sum = 1
  for (let k = 1; k < df / 2; k++) {
    term *= x / 2 / k
    sum += term
  }
  return 1 - Math.exp(-x / 2) * sum
}

describe('chi-square distribution', () => {
  it('2 degrees of freedom: 1 - exp(-x/2)', () => {
    for (const p of [0.025, 0.5, 0.95, 0.975])
      expect(chiSquareQuantile(p, 2)).toEqual(
        near(-2 * Math.log(1 - p), { relative: 1e-12, absolute: 1e-18 }),
      )
  })

  it('even degrees of freedom: finite sum (DLMF 8.4.10)', () => {
    // absolute: 1 - exp(-x/2) sum cancels where the probability is small
    for (const df of [4, 8, 20])
      for (const x of [0.5, 3, 10, 30])
        expect(Math.abs(chiSquareCdf(x, df) - evenChiSquareCdf(x, df))).toBeLessThan(1e-14)
  })

  it('1 degree of freedom: square of the normal quantile', () => {
    // z at 0.975 = 1.959963984540054
    expect(chiSquareQuantile(0.95, 1)).toEqual(
      near(1.959963984540054 ** 2, { relative: 1e-12, absolute: 1e-18 }),
    )
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
    expect(chiSquareCdf(x, df)).toEqual(near((sum * h) / 3, { relative: 1e-9, absolute: 1e-18 }))
  })

  it('large pooled degrees of freedom do not underflow', () => {
    const df = 4000
    const q = chiSquareQuantile(0.5, df)
    expect(q).toBeGreaterThan(df - 1)
    expect(q).toBeLessThan(df)
    expect(chiSquareCdf(q, df)).toEqual(near(0.5, { relative: 1e-10, absolute: 1e-18 }))
    expect(chiSquareCdf(chiSquareQuantile(0.975, df), df)).toEqual(
      near(0.975, { relative: 1e-10, absolute: 1e-18 }),
    )
  })
})

describe('F distribution with 2 and m degrees of freedom', () => {
  it('2 and 2: the distribution function is x / (1 + x)', () => {
    for (const p of [0.05, 0.5, 0.9, 0.99])
      expect(fQuantileTwoNumeratorDegrees(p, 2)).toEqual(
        near(p / (1 - p), { relative: 1e-12, absolute: 1e-18 }),
      )
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
    expect(fQuantileTwoNumeratorDegrees(0.95, 1e7)).toEqual(
      near(-Math.log(0.05), { relative: 1e-6, absolute: 1e-18 }),
    )
  })

  it('rejects invalid input', () => {
    expect(() => fQuantileTwoNumeratorDegrees(1, 3)).toThrow(InputError)
    expect(() => fQuantileTwoNumeratorDegrees(0.5, 0)).toThrow(InputError)
  })
})

describe('chi-square survival function', () => {
  it('keeps the upper tail where 1 minus the distribution function is 0', () => {
    // two degrees of freedom: exp(-x / 2); four: exp(-x / 2) (1 + x / 2); the true tail is 1e-85
    expect(1 - chiSquareCdf(400, 4)).toBe(0)
    expect(chiSquareSurvival(100, 2)).toEqual(
      near(Math.exp(-50), { relative: 1e-12, absolute: 1e-18 }),
    )
    expect(chiSquareSurvival(60, 4)).toEqual(
      near(Math.exp(-30) * 31, { relative: 1e-12, absolute: 1e-18 }),
    )
    expect(chiSquareSurvival(400, 4)).toEqual(
      near(Math.exp(-200) * 201, { relative: 1e-12, absolute: 1e-18 }),
    )
  })

  it('adds up with the distribution function on both sides of the switch', () => {
    for (const df of [1, 2, 3, 7, 30])
      for (const x of [0.5, 1, df - 0.5, df, df + 2 * Math.sqrt(df), 3 * df, 80]) {
        expect(chiSquareSurvival(x, df) + chiSquareCdf(x, df)).toEqual(
          near(1, { relative: 1e-13, absolute: 1e-18 }),
        )
      }
    expect(chiSquareSurvival(1, 1)).toEqual(
      near(0.31731050786291415, { relative: 1e-12, absolute: 1e-18 }),
    )
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

  it('keeps its digits for levels within 1e-15 of 1', () => {
    // mpmath 1.4.1 at 50 digits, t = sqrt(df (1 - x) / x) where I_x(df/2, 1/2) = 1 - level; SciPy 1.18.1 t.isf((1 - level) / 2, df) agrees to 3e-16
    const table: [level: number, df: number, t: number][] = [
      [1 - 1e-6, 1, 636619.7723487513],
      [1 - 1e-6, 2, 999.9992499854659],
      [1 - 1e-6, 3, 130.1545895571102],
      [1 - 1e-6, 10, 10.516489956882173],
      [1 - 1e-6, 30, 6.119075620373899],
      [1 - 1e-6, 1000, 4.922289523423825],
      [1 - 1e-9, 1, 636619790.3724186],
      [1 - 1e-9, 2, 31622.77702514332],
      [1 - 1e-9, 3, 1301.637179562648],
      [1 - 1e-9, 10, 21.622044216833572],
      [1 - 1e-9, 30, 8.721511235701241],
      [1 - 1e-9, 1000, 6.168430252449106],
      [1 - 1e-12, 1, 636633855803.5593],
      [1 - 1e-12, 2, 1000011.0610428281],
      [1 - 1e-12, 3, 13016.476782874553],
      [1 - 1e-12, 10, 43.457001115662806],
      [1 - 1e-12, 30, 11.722018886810611],
      [1 - 1e-12, 1000, 7.223957750518744],
      [1 - 1e-15, 1, 637129015469184.25],
      [1 - 1e-15, 2, 31635421.874750495],
      [1 - 1e-15, 3, 130198.5064176715],
      [1 - 1e-15, 10, 86.87227609687449],
      [1 - 1e-15, 30, 15.319947332312712],
      [1 - 1e-15, 1000, 8.160102707885518],
    ]
    for (const [level, df, t] of table)
      expect(studentTwoSidedQuantile(level, df)).toEqual(near(t, { relative: 1e-12 }))
  })
})

describe('Student t two-sided quantile at the lowest stated level', () => {
  it('keeps its digits at 1e-40', () => {
    // closed forms: df 1 t = tan(pi level / 2), df 2 t = level sqrt(2 / (1 - level^2))
    expect(studentTwoSidedQuantile(1e-40, 1)).toEqual(
      near(1.5707963267948964e-40, { relative: 1e-12 }),
    )
    expect(studentTwoSidedQuantile(1e-40, 2)).toEqual(
      near(1.4142135623730951e-40, { relative: 1e-12 }),
    )
  })
})
