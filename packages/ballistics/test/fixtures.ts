import type { InteriorLoad } from '../src/index.ts'

/** An M3 load shared by the interior tests; the numbers are made up. */
export const m3Load: InteriorLoad = {
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: Math.sqrt((4 * 3.75e-5) / Math.PI) },
  barrel: { length: 0.6, twist: 0 },
  bullet: { mass: 0.0095 },
  charge: 0.0028,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1 / 1600,
    burn: {
      kind: 'vivacity',
      vivacity: 0.56,
      exponent: 1,
      referencePressure: 98066.5,
      form: { kind: 'constant' },
    },
  },
  propellantTemperature: 294.15,
  ignitionPressure: 1e6,
  startPressure: 0,
}
