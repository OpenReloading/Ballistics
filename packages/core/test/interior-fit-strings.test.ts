import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import {
  type ChronographString,
  fitPowder,
  InputError,
  type InteriorLoad,
  interior,
  pooledVelocitySd,
  stringLadder,
} from '../src/index.ts'
import { normals } from './random.ts'

/** Synthetic rifle load (apps/docs/docs/models/interior-powder-fit.md): truth B_a 0.45 1/s. */
const load = (vivacity = 0.45): InteriorLoad => ({
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 6.9e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge: 0.0028,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'vivacity',
      vivacity,
      exponent: 1,
      referencePressure: 98066.5,
      form: { kind: 'twoStage', a: 0.8, m: 0.5, q: 0.5, z1: 0.8 },
    },
  },
  propellantTemperature: 294.15,
  ignitionPressure: 5e6,
  startPressure: 30e6,
})

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
      const b = nth(fitPowder(load(0.38), stringLadder(strings)).parameters, 0)
      if (Math.abs(b.value - 0.45) <= 2 * (b.standardUncertainty ?? 0)) inside++
    }
    expect(inside / seeds).toBeGreaterThanOrEqual(0.9)
  }, 120_000)
})
