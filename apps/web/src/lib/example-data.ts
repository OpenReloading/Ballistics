import { defaultStartPressure, handgunBarrelLengthLimit, icao } from '@open-reloading/core'
import { seat } from '@open-reloading/drawing/seating'
import { fromSi, toSi } from '@open-reloading/schema'
import type { InteriorKey } from './interior-input.ts'
import type { LadderDirection } from './seating-ladder.ts'
import type { ManualKey, ShotKey, zeroKeys } from './trajectory-input.ts'
import { kilogramsPerGrain, unitsOf, waterDensityGramsPerCm3 } from './units.ts'

/**
 * The .308 Win. example of both forms: an invented load, the demo powder under the demo
 * 168 gr bullet at COAL 71.12 mm, in a 24 in barrel. Record values are embedded as stored (mm, g,
 * cm³, bar) with their record ids; `apps/web/test/examples.test.ts` checks them against the committed
 * records and runs the interior example through core.
 */
export const exampleRecords = {
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
  /** CIP 308 Win.: cartridge G1, L3 and L6; chamber F (bore), Z (groove), Q (bore area, mm²), u (twist). */
  spec: {
    id: 'cip-308-win-2008-09-23',
    G1: 7.85,
    L3: 51.18,
    L6: 71.12,
    F: 7.62,
    Z: 7.82,
    Q: 47.51,
    u: 305,
    Pmax: 4150,
  },
  /** The demo brass and its stated water capacity, g. */
  case: { id: 'demo-case-308-brass', water: 3.6 },
  /** The M3 parameters as stored (energy J/kg, density g/cm³, pressures bar). */
  powder: {
    id: 'demo-powder-dp40',
    name: 'Demo Powder Co. DP40',
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
  cartridge: { id: '308-win', name: '308 Win.' },
} as const

const { bullet, spec, case: brass, powder } = exampleRecords

/** The invented load: start and maximum charge, g. Barrel, sight height and zero are example choices. */
const published = { start: 2.4, max: 2.55 }
/**
 * The example charge, g: the start charge, with a ladder of 5 steps of 0.2 gr down from it. The
 * barrel is a common 24 in (609.6 mm) rifle barrel.
 */
const choices = {
  barrel: 609.6,
  sightHeight: 50,
  zero: 100,
  charge: published.start,
}

/** The example's charge ladder (SI): 5 steps of 0.2 gr down from the start charge. */
const exampleLadder = {
  steps: 5,
  step: 0.2 * kilogramsPerGrain,
  direction: 'down',
} as const

/** The bullet seated to L6 (`@open-reloading/drawing/seating`): volume behind it, cm³, and travel, mm. */
const seated = seat({
  bullet,
  chamber: { caseLength: spec.L3, cartridgeL6: spec.L6 },
  waterCapacity: brass.water,
  waterDensity: waterDensityGramsPerCm3,
  barrelLength: choices.barrel,
  by: { kind: 'overallLength', value: spec.L6 },
})
export const exampleChamberVolume = seated.volumeBehindBullet?.value as number
const travel = seated.travel?.value as number
/** The seated-bullet preview of the example: bullet id, barrel length (m) and COAL (m), at L6. */
export const exampleSeating = {
  bullet: bullet.id,
  barrel: toSi('length', choices.barrel),
  seating: { by: 'overallLength' as const, value: toSi('length', spec.L6) },
}
/** Mass of the example rifle, kg. */
const exampleFirearmMass = 7
/** The example's seating ladder step size, m (an example choice). */
const exampleSeatStep = 0.5e-3

/** Simulated muzzle velocity of the interior example, m/s (checked by the unit test). */
export const exampleMuzzleVelocity = 729

/** Interior form values, SI, keyed like `interiorFields`. */
export const exampleInterior = {
  volume: unitsOf.capacity.cm3.toSi(exampleChamberVolume),
  boreDiameter: toSi('length', spec.F),
  boreArea: toSi('area', spec.Q),
  travel: toSi('length', travel),
  twist: toSi('length', spec.u),
  bulletMass: toSi('mass', bullet.mass),
  charge: toSi('mass', choices.charge),
  propellantTemperature: icao.temperature,
  // the powder record's fit, as the workbench fills it (`powderModelValues` of core)
  propellantEnergy: powder.interior.energy,
  gamma: powder.interior.gamma,
  density: toSi('density', powder.interior.density),
  covolume: powder.interior.covolume,
  vivacity: powder.interior.vivacity,
  exponent: powder.interior.pressureExponent,
  referencePressure: toSi('pressure', powder.interior.referencePressure),
  ignitionPressure: toSi('pressure', powder.interior.ignitionPressure),
  startPressure: defaultStartPressure(handgunBarrelLengthLimit).value,
  formA: powder.interior.burnForm.a,
  formM: powder.interior.burnForm.m,
  formQ: powder.interior.burnForm.q,
  formZ1: powder.interior.burnForm.z1,
} satisfies Record<
  Exclude<
    InteriorKey,
    'sebert' | 'leakArea' | 'boreFriction' | 'engravingPressure' | 'engravingLength'
  >,
  number
>

/** Trajectory form values, SI, keyed like `shotFields` and `manualBulletFields` (manual G7 drag). */
export const exampleTrajectory = {
  mass: toSi('mass', bullet.mass),
  diameter: toSi('length', bullet.diameter),
  length: toSi('length', bullet.length),
  ballisticCoefficient: toSi('ballisticCoefficient', bullet.g7),
  muzzleVelocity: exampleMuzzleVelocity,
  sightHeight: toSi('length', choices.sightHeight),
  twist: toSi('length', spec.u),
  zeroRange: choices.zero,
  temperature: icao.temperature,
  pressure: icao.pressure,
  altitude: 0,
  humidity: 0,
  windSpeed: 0,
  windFrom: Math.PI / 2,
  maxRange: 1000,
  rangeStep: 100,
} satisfies Record<Exclude<ShotKey, (typeof zeroKeys)[number]> | ManualKey, number>

/** Source lines shown next to each button. */
export const trajectorySources = [
  `Bullet: ${bullet.id} (mass, diameter, length, G7 BC ${bullet.g7})`,
  `Twist: ${spec.id} (u ${spec.u} mm)`,
  `Muzzle velocity: ${exampleMuzzleVelocity} m/s, simulated for the interior example (${choices.barrel} mm barrel)`,
  'Air: ICAO standard atmosphere at sea level, no wind',
  `Example choices: sight height ${choices.sightHeight} mm, zero ${choices.zero} m`,
]

export const interiorSources = [
  `Load: invented, 308 Win., ${powder.name}, ${bullet.id}, COAL ${spec.L6} mm: start ${published.start} g, maximum ${published.max} g`,
  `Bullet: ${bullet.id} (mass, length), invented values`,
  `Powder: ${powder.id}, invented model parameters and bore resistance`,
  `Bore diameter F, bore area Q, twist u, L3, L6, Pmax ${spec.Pmax} bar: ${spec.id}`,
  `Chamber volume: water capacity ${brass.water} g of ${brass.id} at ${waterDensityGramsPerCm3} g/cm³ minus the bullet seated at COAL ${spec.L6} mm (its shape from ${bullet.id})`,
  `Travel: barrel ${choices.barrel} mm minus the bullet base at COAL ${spec.L6} mm`,
  'Propellant temperature: ICAO 15 °C',
  `Charge ladder: 5 steps of 0.2 gr down from the start charge ${published.start} g (example choice)`,
]

/**
 * The example's rifle: built in, never stored; the firearm library lists it read-only and the
 * example load selects it. Its barrel and twist are the example's (`choices.barrel`, `spec.u`).
 */
export const exampleFirearm = {
  kind: 'firearm',
  id: '3b7e6d1c-5a2f-4e0b-8c94-1d6f0a9b2e57',
  name: 'Example rifle, 308 Win.',
  saved: '2026-10-14T00:00:00.000Z',
  data: {
    origin: 'user',
    name: 'Example rifle, 308 Win.',
    cartridge: `catalogue:${exampleRecords.cartridge.id}`,
    barrelLength: { value: choices.barrel },
    twist: { value: spec.u },
    twistHand: 'right',
    firearmMass: { value: fromSi('mass', exampleFirearmMass) },
    // a scope at the example's sight height and zero, so the Trajectory tab has a result
    optics: [{ id: 'scope', kind: 'scope', name: 'Example scope' }],
    configurations: [
      {
        id: 'example',
        name: 'Example',
        mounts: [
          {
            optic: 'scope',
            sightHeight: { value: choices.sightHeight },
            zeroRange: { value: fromSi('length', choices.zero) },
          },
        ],
      },
    ],
    active: 'example',
  },
} as const

/** The example of the load workbench and the trajectory page: records, fit values and a published load. */
type LoadExample = {
  cartridge: { id: string; name: string; g1: number; land: number; groove: number }
  /** Record ids. */
  bulletId: string
  powderId: string
  /** Interior form values, SI, keyed like `interiorFields`. */
  interior: Record<
    Exclude<
      InteriorKey,
      'sebert' | 'leakArea' | 'boreFriction' | 'engravingPressure' | 'engravingLength'
    >,
    number
  >
  interiorSources: readonly string[]
  /** Trajectory form values, SI, keyed like `shotFields` and `manualBulletFields`. */
  trajectory: Record<Exclude<ShotKey, (typeof zeroKeys)[number]> | ManualKey, number>
  trajectorySources: readonly string[]
  ladder: { steps: number; step: number; direction: LadderDirection }
  seating: { bullet: string; barrel: number; seating: { by: 'overallLength'; value: number } }
  /** The case record the Cartridge card chooses, and the seating ladder's step size, m. */
  caseId: string
  seatStep: number
  /** The built-in rifle's mass, kg, as the Gun and barrel card shows it. */
  firearmMass: number
  /** The built-in rifle, never stored; the firearm library lists it read-only. */
  firearm: {
    kind: 'firearm'
    id: string
    name: string
    saved: string
    data: Record<string, unknown>
  }
}

/** The 308 Win. example load: records, form values in SI and source lines. */
export const loadExample: LoadExample = {
  cartridge: { ...exampleRecords.cartridge, g1: spec.G1, land: spec.F, groove: spec.Z },
  bulletId: bullet.id,
  powderId: powder.id,
  interior: exampleInterior,
  interiorSources,
  trajectory: exampleTrajectory,
  trajectorySources,
  ladder: exampleLadder,
  seating: exampleSeating,
  caseId: brass.id,
  seatStep: exampleSeatStep,
  firearmMass: exampleFirearmMass,
  firearm: exampleFirearm,
}
