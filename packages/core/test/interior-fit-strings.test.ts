import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import {
  type ChronographString,
  fitPowder,
  InputError,
  interior,
  pooledVelocitySd,
  stringLadder,
} from '../src/index.ts'
import { load } from './powder-load.ts'
import { normals } from './random.ts'

describe('string ladder', () => {
  // Means 800 and 810; squares about the means 8 (798, 800, 802) and 2 (809, 811); 3 degrees of
  // freedom: pooled SD sqrt(10 / 3).
  const strings: ChronographString[] = [
    { charge: 2.7e-3, velocities: [798, 800, 802] },
    { charge: 2.8e-3, velocities: [809, 811], barrelLength: 0.5 },
    { charge: 2.9e-3, velocities: [820] },
  ]

  it('pools the shots about their string means', () => {
    expect(pooledVelocitySd(strings)).toBeCloseTo(Math.sqrt(10 / 3), 12)
  })

  it('weights each mean by the pooled SD over the root of its shot count', () => {
    const sd = Math.sqrt(10 / 3)
    const points = stringLadder(strings)
    expect(points.map((x) => x.muzzleVelocity)).toEqual([800, 810, 820])
    expect(points.map((x) => x.velocitySigma)).toEqual([sd / Math.sqrt(3), sd / Math.sqrt(2), sd])
    expect(nth(points, 1).barrelLength).toBe(0.5)
    expect(nth(points, 1)).not.toHaveProperty('velocities')
  })

  it('leaves the sigma out without a string of 2 shots or with no spread', () => {
    expect(pooledVelocitySd([{ charge: 2.8e-3, velocities: [800] }])).toBeUndefined()
    expect(stringLadder([{ charge: 2.8e-3, velocities: [800] }])).toEqual([
      { charge: 2.8e-3, muzzleVelocity: 800 },
    ])
    expect(stringLadder([{ charge: 2.8e-3, velocities: [800, 800] }])).toEqual([
      { charge: 2.8e-3, muzzleVelocity: 800 },
    ])
  })

  it('refuses a string without a shot', () => {
    expect(() => stringLadder([{ charge: 2.8e-3, velocities: [] }])).toThrow(InputError)
  })

  it('keeps the truth inside the 2 sigma interval in at least 90 % of 200 noisy 5-charge ladders', () => {
    const charges = [2.6e-3, 2.7e-3, 2.8e-3, 2.9e-3, 3e-3]
    const truth = charges.map((charge) => {
      const r = interior({ ...load(), charge })
      if (!r.valid) throw new Error(r.reason)
      return r.muzzleVelocity
    })
    const seeds = 200
    let inside = 0
    for (let seed = 1; seed <= seeds; seed++) {
      const noise = normals(seed)
      const strings = charges.map((charge, i) => ({
        charge,
        velocities: Array.from({ length: 5 }, () => nth(truth, i) + 4 * noise()),
      }))
      // the fit reads only muzzle velocity and peak pressure, which the 10 times coarser curve
      // spacing (also the largest step) moves by less than 1e-6 m/s here, at a sixth of the run time
      const fit = fitPowder(load(0.38), stringLadder(strings), { options: { outputStep: 2e-5 } })
      const b = nth(fit.parameters, 0)
      if (Math.abs(b.value - 0.45) <= 2 * (b.standardUncertainty ?? 0)) inside++
    }
    expect(inside / seeds).toBeGreaterThanOrEqual(0.9)
  }, 120_000)
})
