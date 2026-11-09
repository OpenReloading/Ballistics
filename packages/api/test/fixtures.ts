import {
  type InteriorLoad,
  lbPerSqInToKgPerSqM,
  type Projectile,
  type TrajectoryInput,
} from '@open-reloading/ballistics'
import {
  type AnalysisKey,
  analysisKinds,
  fromSi,
  ladderStepKinds,
  userDataFormat,
  userDataVersion,
} from '@open-reloading/schema'

export { bundle } from '../../catalog/test/bundle.ts'

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

/** SI field values of a load, as the workbench saves them. */
export const siValues = {
  volume: 3.4e-6,
  boreDiameter: 7.82e-3,
  boreArea: 4.75e-5,
  travel: 0.6,
  twist: 0.305,
  bulletMass: 0.0109,
  charge: 0.0028,
  propellantEnergy: 4.0779e6,
  gamma: 1.22,
  density: 1600,
  covolume: 0.000983,
  vivacity: 0.59,
  exponent: 1,
  referencePressure: 98066.5,
  propellantTemperature: 294.15,
  ignitionPressure: 5e6,
  startPressure: 1e7,
}

/** A reference by a plain catalogue id or as given. */
const reference = (id: unknown) =>
  typeof id === 'string' && !id.includes(':') ? `catalogue:${id}` : id

/** As the load file holds it, from SI values and plain catalogue ids: the charge as a stored quantity, every other key under `analysis.overrides` in its stored unit (an unknown key as given), the ladder step in its kind's stored unit; other fields pass through. */
export function loadData(data: {
  siValues?: Record<string, number | undefined>
  cartridge?: string
  bullet?: string
  powder?: string
  ladder?: {
    kind?: 'charge' | 'seating' | 'temperature'
    chargeStep?: number
    stepCount?: number
    direction?: string
  }
  [key: string]: unknown
}) {
  const { siValues: si = {}, cartridge, bullet, powder, ladder, ...rest } = data
  const { charge, ...typed } = si
  const overrides = Object.fromEntries(
    Object.entries(typed)
      .filter((e): e is [string, number] => e[1] !== undefined)
      .map(([k, v]) => [
        k,
        Object.hasOwn(analysisKinds, k) ? fromSi(analysisKinds[k as AnalysisKey], v) : v,
      ]),
  )
  const { chargeStep, ...shape } = ladder ?? {}
  const step = chargeStep && fromSi(ladderStepKinds[shape.kind ?? 'charge'], chargeStep)
  return {
    origin: 'user',
    ...(charge !== undefined && { charge: { value: fromSi('mass', charge) } }),
    ...(cartridge && { cartridge: reference(cartridge) }),
    ...(bullet && { bullet: reference(bullet) }),
    ...(powder && { powder: reference(powder) }),
    analysis: {
      overrides,
      ...(ladder && { ladder: { ...shape, ...(step && { step }) } }),
    },
    ...rest,
  }
}

/** A user data file with one load record from `data` (see {@link loadData}); `extra` adds top-level fields. */
export function file(data: Parameters<typeof loadData>[0], extra: object = {}) {
  return {
    format: userDataFormat,
    version: userDataVersion,
    records: [
      {
        kind: 'load',
        id: '00000000-0000-4000-8000-0000000000b1',
        name: 'Load',
        saved: '2026-10-20T10:00:00.000Z',
        data: loadData(data),
      },
    ],
    ...extra,
  }
}

/** A G7 rifle bullet; the numbers are made up. */
export const rifleProjectile: Projectile = {
  mass: 0.01134,
  diameter: 0.00782,
  length: 0.0312,
  drag: {
    kind: 'bc',
    model: 'G7',
    bands: [{ ballisticCoefficient: 0.243 * lbPerSqInToKgPerSqM, minVelocity: 0 }],
  },
}

/** A shot of `rifleProjectile` in a crosswind, zeroed at 100 m. */
export const rifleShot: TrajectoryInput = {
  projectile: rifleProjectile,
  muzzleVelocity: 800,
  firearm: { sightHeight: 0.04, twist: 0.254, twistHand: 'right' },
  air: { altitude: 0, pressure: 101325, temperature: 288.15, humidity: 0.5 },
  wind: [{ endDistance: 1e6, speed: 4, fromDirection: Math.PI / 2 }],
  zero: { range: 100 },
}

/** A shot with a constant drag coefficient and no wind, zeroed at 100 m. */
export const flatShot: TrajectoryInput = {
  projectile: {
    mass: 0.01,
    diameter: 0.0078,
    drag: {
      kind: 'curve',
      curve: [
        [0, 0.3],
        [5, 0.3],
      ],
    },
  },
  muzzleVelocity: 800,
  firearm: { sightHeight: 0.04 },
  air: { altitude: 0, pressure: 101325, temperature: 288.15, humidity: 0 },
  zero: { range: 100 },
}
