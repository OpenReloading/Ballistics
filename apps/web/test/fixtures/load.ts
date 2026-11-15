import { icao, startPressureOf } from '@rangefoundry/ballistics'
import { toSi } from '@rangefoundry/schema'
import { seat } from '@rangefoundry/svg-drawings/seating'
import type { InteriorKey } from '../../src/lib/interior-input.ts'
import { kilogramsPerGrain, unitsOf, waterDensityGramsPerCm3 } from '../../src/lib/units.ts'

/** An invented load on the demo records; record values embedded as stored (mm, g, cm³, bar). */
export const fixtureRecords = {
  /** The id, mass and G7 BC, then the shape fields as the seating preview reads them (`bulletDimensions`). */
  bullet: {
    id: 'demo-bullet-168',
    mass: 10.886,
    g7: 0.221,
    diameter: 7.823,
    length: 30.5,
    noseLength: 16,
    baseToOgive: 14.5,
    bearingLength: 10.7,
    meplatDiameter: 1.6,
    base: { type: 'boat-tail', length: 3.8, diameter: 6.62, angle: 9 },
    ogive: { form: 'secant', radius: 77.62, radiusRatio: 0.55 },
    tip: { type: 'hollow-point', mouthDiameter: 1 },
  },
  /** CIP 308 Win.: cartridge L3 and L6; chamber F (bore), Q (bore area, mm²), u (twist). */
  spec: { L3: 51.18, L6: 71.12, F: 7.62, Q: 47.51, u: 305 },
  /** The demo brass's stated water capacity, g. */
  case: { water: 3.6 },
  /** The M3 parameters as stored (energy J/kg, density g/cm³, pressures bar). */
  powder: {
    interior: {
      energy: 3950000,
      gamma: 1.215,
      density: 1.6,
      covolume: 0.00097,
      vivacity: 0.612,
      pressureExponent: 1,
      referencePressure: 0.980665,
      ignitionPressure: 50,
      burnForm: { a: 0.05, m: 0.5, q: 0.5, z1: 0.8 },
    },
  },
  cartridge: { id: '308-win' },
} as const

const { bullet, spec, case: brass, powder } = fixtureRecords

/** Barrel length, mm (24 in), and charge, g. */
const barrel = 609.6
const charge = 2.4

/** A charge ladder (SI): 5 steps of 0.2 gr down from the charge. */
export const fixtureLadder = { steps: 5, step: 0.2 * kilogramsPerGrain, direction: 'down' } as const

/** The bullet seated to L6: volume behind it, cm³, and travel, mm. */
const seated = seat({
  bullet,
  chamber: { caseLength: spec.L3, cartridgeL6: spec.L6 },
  waterCapacity: brass.water,
  waterDensity: waterDensityGramsPerCm3,
  barrelLength: barrel,
  by: { kind: 'overallLength', value: spec.L6 },
})

/** Interior form values, SI, keyed like `interiorFields`. */
export const fixtureInterior = {
  volume: unitsOf.capacity.cm3.toSi(seated.volumeBehindBullet?.value as number),
  boreDiameter: toSi('length', spec.F),
  boreArea: toSi('area', spec.Q),
  travel: toSi('length', seated.travel?.value as number),
  twist: toSi('length', spec.u),
  bulletMass: toSi('mass', bullet.mass),
  charge: toSi('mass', charge),
  propellantTemperature: icao.temperature,
  // the powder record's fit, as the workbench fills it (`powderModelValues` of ballistics)
  propellantEnergy: powder.interior.energy,
  gamma: powder.interior.gamma,
  density: toSi('density', powder.interior.density),
  covolume: powder.interior.covolume,
  vivacity: powder.interior.vivacity,
  exponent: powder.interior.pressureExponent,
  referencePressure: toSi('pressure', powder.interior.referencePressure),
  ignitionPressure: toSi('pressure', powder.interior.ignitionPressure),
  startPressure: startPressureOf(toSi('length', barrel), undefined).value,
  formA: powder.interior.burnForm.a,
  formM: powder.interior.burnForm.m,
  formQ: powder.interior.burnForm.q,
  formZ1: powder.interior.burnForm.z1,
} satisfies Record<
  Exclude<
    InteriorKey,
    'sebert' | 'leakArea' | 'throatWear' | 'boreFriction' | 'engravingPressure' | 'engravingLength'
  >,
  number
>
