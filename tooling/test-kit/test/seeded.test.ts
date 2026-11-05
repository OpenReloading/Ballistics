import { describe, expect, it } from 'vitest'
import { normals, normalsFrom, uniforms } from '../src/index.ts'

describe('uniforms', () => {
  it('gives the same numbers for the same seed and others for another seed', () => {
    expect(uniforms(42, 5)).toEqual(uniforms(42, 5))
    expect(uniforms(43, 5)).not.toEqual(uniforms(42, 5))
    expect(uniforms(42, 3)).toHaveLength(3)
  })

  it('lies in [0, 1) with the mean and variance of a uniform distribution', () => {
    const u = uniforms(7, 20_000)
    expect(u.every((x) => x >= 0 && x < 1)).toBe(true)
    const mean = u.reduce((a, x) => a + x, 0) / u.length
    const variance = u.reduce((a, x) => a + (x - mean) ** 2, 0) / (u.length - 1)
    // standard errors: 0.002 for the mean, 0.0006 for the variance
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.01)
    expect(Math.abs(variance - 1 / 12)).toBeLessThan(0.003)
  })
})

describe('normals', () => {
  it('gives the same numbers for the same seed, with mean 0 and variance 1', () => {
    expect(normals(42, 5)).toEqual(normals(42, 5))
    const z = normals(11, 20_000)
    expect(z).toHaveLength(20_000)
    const mean = z.reduce((a, x) => a + x, 0) / z.length
    const variance = z.reduce((a, x) => a + (x - mean) ** 2, 0) / (z.length - 1)
    // standard errors: 0.007 for the mean, 0.01 for the variance
    expect(Math.abs(mean)).toBeLessThan(0.035)
    expect(Math.abs(variance - 1)).toBeLessThan(0.05)
  })
})

describe('normalsFrom', () => {
  it('turns two uniforms into one normal number, the radius from the first', () => {
    const u = [0.5, 0.25, 0.9, 0]
    let i = 0
    const draw = normalsFrom(() => u[i++] ?? 0)
    // radius sqrt(-2 ln 0.5) at angle pi / 2, then sqrt(-2 ln 0.1) at angle 0
    expect(draw()).toBeCloseTo(0, 12)
    expect(draw()).toBeCloseTo(Math.sqrt(-2 * Math.log(0.1)), 12)
  })
})
