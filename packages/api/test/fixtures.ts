import {
  type InteriorLoad,
  lbPerSqInToKgPerSqM,
  type Projectile,
  type TrajectoryInput,
} from '@openreloading/core'
import type { Bundle } from '@openreloading/data'
import {
  type AnalysisKey,
  analysisKinds,
  type Cartridge,
  fromSi,
  ladderStepKinds,
  type Provenance,
  userDataFormat,
  userDataVersion,
} from '@openreloading/schema'

const published: Provenance = { kind: 'published', sources: [{ title: 'Test standard' }] }

const sheet = (c: Pick<Cartridge, 'id' | 'name' | 'table' | 'values' | 'aliases'>): Cartridge => ({
  ...c,
  published: '2020-01-01',
  verification: 'unverified',
  provenance: published,
})

/** Synthetic records; the numbers are made up. */
export const bundle: Bundle = {
  cartridges: [
    sheet({
      id: 'alpha-rifle',
      name: 'Alpha Rifle',
      aliases: ['Alpha 7,62'],
      table: 'I',
      values: [
        {
          side: 'cartridge',
          symbol: 'L1',
          quantity: 'length',
          value: 40,
          tolerance: { lower: -0.2 },
        },
        { side: 'chamber', symbol: 'i', quantity: 'angle', value: 1.5, raw: `1°30'0"` },
        { symbol: 'Pmax', quantity: 'pressure', value: 4000 },
      ],
    }),
    sheet({
      id: 'beta-pistol',
      name: 'Beta Pistol',
      table: 'IV',
      values: [
        { side: 'cartridge', symbol: 'L3', quantity: 'length', value: 20 },
        { side: 'cartridge', symbol: 'L6', quantity: 'length', value: 30.1, variant: 'b' },
        { side: 'cartridge', symbol: 'L6', quantity: 'length', value: 29.7, variant: 'a' },
        { side: 'cartridge', symbol: 'G1', quantity: 'length', value: 9.03, variant: 'b' },
        { side: 'cartridge', symbol: 'G1', quantity: 'length', value: 9.02, variant: 'a' },
        { side: 'chamber', symbol: 'G1', quantity: 'length', value: 8.9 },
        { side: 'chamber', symbol: 'Q', quantity: 'area', value: 47.51 },
      ],
    }),
    sheet({
      id: 'gamma-100-percent',
      name: 'Gamma 100% Mag.',
      table: 'I',
      values: [{ symbol: 'M', quantity: 'length', raw: '25/30' }],
    }),
  ],
  manufacturers: [
    { id: 'example-a', name: 'Example A', aliases: ['Old A'], provenance: published },
    ...['b', 'c', 'f'].map((x) => ({
      id: `example-${x}`,
      name: `Example ${x.toUpperCase()}`,
      provenance: published,
    })),
  ],
  powders: [
    {
      id: 'example-a-fast',
      manufacturer: 'example-a',
      name: 'Fast',
      bulkDensity: { value: 0.9, raw: 'VMD 0.072 cm³/gr' },
      provenance: { kind: 'derived', sources: [{ title: 'Test chart', fields: ['bulkDensity'] }] },
    },
    { id: 'example-b-slow', manufacturer: 'example-b', name: 'Slow', provenance: published },
  ],
  bullets: [
    {
      id: 'example-a-1',
      manufacturer: 'example-a',
      productNumber: '1',
      name: 'Test 168',
      diameter: { value: 7.82 },
      mass: { value: 10.89 },
      ballisticCoefficients: [{ dragModel: 'G1', value: 0.46 }],
      provenance: published,
    },
  ],
  capacities: [
    {
      id: 'alpha-rifle-test',
      cartridge: 'alpha-rifle',
      waterCapacity: { value: 3.6, raw: '55.6 gr H2O' },
      provenance: published,
    },
  ],
  loads: [],
  chronoSessions: [],
  firings: [],
  rangeFirings: [],
  targetFaces: [
    {
      id: 'test-face',
      name: 'Test Face',
      organization: 'Test',
      rings: [
        { value: 9, diameter: { value: 20 } },
        { value: 10, diameter: { value: 10 } },
      ],
      innerTen: { diameter: { value: 5 }, rule: 'touch' },
      blackDiameter: { value: 20 },
      decimal: true,
      events: [
        {
          name: 'Test event',
          distance: { value: 10000 },
          gauge: { value: 4.5 },
          category: 'air-rifle',
        },
      ],
      provenance: published,
    },
  ],
  federations: [
    {
      id: 'test-federation',
      name: 'Test Federation',
      abbreviation: 'Test',
      country: 'international',
      ruleBooks: [
        {
          title: 'Test rule book',
          edition: '2026',
          url: 'https://example.org/rules.pdf',
          sha256: '0'.repeat(64),
        },
      ],
      provenance: published,
    },
  ],
  disciplines: [
    {
      id: 'test-discipline',
      federation: 'test-federation',
      name: 'Test discipline',
      number: '1',
      section: '1.1',
      page: 'p. 1',
      distance: { value: 10000 },
      category: 'air-pistol',
      caliberClasses: { ids: ['air-4-5'], basis: 'stated' },
      provenance: published,
    },
  ],
  targetMappings: [
    {
      id: 'test-discipline-test-face',
      discipline: 'test-discipline',
      face: 'test-face',
      event: 'Test event',
      gauge: { value: 4.5 },
      shotCount: 60,
      provenance: published,
    },
  ],
}

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

/**
 * The data of a user load from SI values and plain catalogue ids, as the load file holds it: the
 * charge as a stored quantity, every other key under `analysis.overrides` in its stored unit (an
 * unknown key stays as given), the ladder with its step in the stored unit of its kind. Other
 * fields pass through.
 */
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
    name: 'Load',
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
        id: 'l1',
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
