import { describe, expect, it } from 'vitest'
import { dynamicVivacity, type VivacityBurn } from '../src/index.ts'

// demo powder DP40: twoStage form, covolume 0.97e-3 m3/kg, solid density 1600 kg/m3, energy 3.95 MJ/kg, gamma 1.215
const burn: VivacityBurn = {
  kind: 'vivacity',
  vivacity: 0.612,
  exponent: 1,
  referencePressure: 98066.5,
  form: { kind: 'twoStage', a: 0.05, m: 0.5, q: 0.5, z1: 0.8 },
}
const eta = 0.97e-3
const rho = 1600
const force = (1.215 - 1) * 3.95e6

/** chi of the Noble-Abel closed-vessel pressure Phi z / (1 + chi z) at normalised charge density D. */
const chiOf = (d: number) => ((1 - eta * rho) * d) / (1 - d)

/** Closed-vessel quantity (dp/dt) / (p p_max) from the dynamic vivacity (1/p) dz/dt at burnt fraction z. */
function closedVesselVivacity(z: number, d: number): number {
  const chi = chiOf(d)
  return (dynamicVivacity(burn, z) * (1 + chi)) / (1 + chi * z) ** 2
}

describe('closed-vessel vivacity against the dynamic vivacity', () => {
  for (const d of [0.1, 0.2, 0.3]) {
    it(`equals the numerical derivative of the closed-vessel pressure at D = ${d}`, () => {
      const phi = (force * rho * d) / (1 - d)
      const chi = chiOf(d)
      const p = (z: number) => (phi * z) / (1 + chi * z)
      const pMax = p(1)
      const h = 1e-5
      for (const z of [0.05, 0.2, 0.5, 0.79, 0.81, 0.95]) {
        const dzdt = dynamicVivacity(burn, z) * p(z)
        const dpdt = ((p(z + h) - p(z - h)) / (2 * h)) * dzdt
        const numeric = dpdt / (p(z) * pMax)
        expect(Math.abs(closedVesselVivacity(z, d) / numeric - 1)).toBeLessThan(1e-6)
      }
    })
  }
})
