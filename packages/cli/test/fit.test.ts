import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fit, verify } from '../src/commands.ts'
import { UsageError } from '../src/errors.ts'
import { loadModel } from '../src/model.ts'
import { recordRoots, records, rowsCsv, type Spec, writeRows } from './fixture.ts'

vi.mock('@rangefoundry/tools/catalog', async (original) =>
  (await import('./records-memo.ts')).memoRecords(
    await original<typeof import('@rangefoundry/tools/catalog')>(),
  ),
)

const dp40 = 'demo-powder-dp40'
const sp20 = 'demo-powder-sp20'
const sp21 = 'demo-powder-sp21'

const record = records.powders.get(dp40)
if (!record?.interior) throw new Error(`${dp40} has no interior parameters`)
/** The planted truth: the fixture records with the burn coefficient of dp40 at 0.66096, 1.08 times its record value 0.612. */
const planted = {
  ...records,
  powders: new Map(records.powders).set(dp40, {
    ...record,
    interior: { ...record.interior, vivacity: { ...record.interior.vivacity, value: 0.66096 } },
  }),
}

/** Training rows of dp40 in three cartridges and two validation rows, printed from the planted truth. */
const specs: Spec[] = [
  ...[
    ['30-br', 2.0],
    ['30-br', 2.2],
    ['30-br', 2.4],
    ['30-br', 2.6],
    ['308-win', 2.0],
    ['308-win', 2.2],
    ['308-win', 2.4],
    ['30-06-spring', 2.2],
    ['30-06-spring', 2.4],
    ['30-06-spring', 2.6],
  ].map(([cartridge, charge]) => ({
    cartridge: cartridge as string,
    charge: charge as number,
    velocity: 0,
  })),
  { cartridge: '308-match', charge: 2.0, velocity: 0 },
  { cartridge: '308-match', charge: 2.2, velocity: 0 },
]

const options = {
  rows: writeRows(rowsCsv(specs, planted)),
  records: recordRoots,
  split: 'validation',
  final: false,
} as const

describe('fit', () => {
  it('finds the planted burn coefficient from the training rows only', async () => {
    const r = await fit(options)
    const p = r.powders[dp40]
    expect(p?.vivacity.value).toBeCloseTo(0.66096, 5)
    expect(p?.factor).toBeCloseTo(1.08, 4)
    expect(p?.rows).toBe(10)
    expect(p?.cartridges).toBe(3)
    expect(r.notFitted).toEqual({})
  })

  it('lists a powder whose training rows hold one charge, and keeps it without a value', async () => {
    const rows = writeRows(
      rowsCsv(
        [
          ...specs,
          { cartridge: '30-br', powder: sp20, charge: 2.0, velocity: 0 },
          { cartridge: '308-match', powder: sp20, charge: 2.4, velocity: 0 },
        ],
        planted,
      ),
    )
    expect((await fit({ ...options, rows })).notFitted[sp20]).toBe('unresolved')
    const r = await verify({ ...options, rows, params: 'fit-on-training' })
    expect(r.byPowder[sp20]?.rows.notUsed).toEqual({ noPowderModel: 1 })
  })
})

describe('verify with --params fit-on-training', () => {
  it('evaluates the validation split with the fitted burn coefficient', async () => {
    const fitted = await verify({ ...options, params: 'fit-on-training' })
    expect(fitted.overall.velocity?.median).toBeCloseTo(0, 6)
    expect(fitted.overall.rows.used).toBe(2)
    const recorded = await verify(options)
    expect(recorded.overall.velocity?.median).toBeGreaterThan(0.005)
  })

  it('fits under the model it evaluates', async () => {
    const worse = new URL('./fixtures/worse-model.mjs', import.meta.url).pathname
    const rows = writeRows(rowsCsv(specs, planted, (await loadModel(worse)).interior))
    const r = await verify({ ...options, rows, params: 'fit-on-training' }, worse)
    expect(r.overall.velocity?.median).toBeCloseTo(0, 6)
  })

  it('has its own model version on the same inputs', async () => {
    const recorded = await verify({ ...options, params: 'records' })
    const fitted = await verify({ ...options, params: 'fit-on-training' })
    expect(fitted.modelVersion).not.toBe(recorded.modelVersion)
    expect(fitted.inputs).toEqual(recorded.inputs)
  })
})

// each run fits every powder at nine factors
describe('--energy prior', { timeout: 120_000 }, () => {
  const sp30 = 'demo-powder-sp30'
  /** The fixture records with each powder's energy, burn coefficient and, where given, pressure exponent set as given. */
  const plant = (
    values: Record<string, [energy: number, vivacity: number, pressureExponent?: number]>,
  ) => {
    const powders = new Map(records.powders)
    for (const [id, [energy, vivacity, exponent]] of Object.entries(values)) {
      const p = records.powders.get(id)
      if (!p?.interior) throw new Error(`${id} has no interior parameters`)
      powders.set(id, {
        ...p,
        interior: {
          ...p.interior,
          energy: { ...p.interior.energy, value: energy },
          vivacity: { ...p.interior.vivacity, value: vivacity },
          ...(exponent !== undefined && { pressureExponent: exponent }),
        },
      })
    }
    return { ...records, powders }
  }
  /** Energy 0.8 times the prior impetus over gamma - 1: sp30's own 1.0e6 J/kg over 0.25, the single-base median 1.05e6 over 0.215 for sp20, the pooled median 1.05e6 over 0.215 for the double-base dp40. */
  const truth = plant({
    [sp30]: [3.2e6, 0.8],
    [sp20]: [3906976.744, 0.7],
    [dp40]: [3906976.744, 1.0],
  })
  const training = (powder: string) =>
    [
      ['30-br', 2.0],
      ['30-br', 2.4],
      ['308-win', 2.2],
    ].map(([cartridge, charge]) => ({
      cartridge: cartridge as string,
      powder,
      charge: charge as number,
      velocity: 0,
      pressure: 0,
    }))

  it('takes the energy-level factor of the planted energies from the training pressures', async () => {
    const rows = writeRows(rowsCsv([sp30, sp20, dp40].flatMap(training), truth))
    const r = await fit({ ...options, rows, energy: 'prior' })
    expect(r.energy?.factor).toBe(0.8)
    expect(r.energy?.priors).toEqual({ own: 1, byBase: 1, pooled: 1 })
    expect(r.powders[sp30]?.energy).toEqual({ value: 3.2e6, prior: 'own' })
    expect(r.powders[sp20]?.energy?.prior).toBe('base')
    expect(r.powders[sp20]?.energy?.value).toBeCloseTo(3906976.744, 2)
    expect(r.powders[dp40]?.energy?.prior).toBe('pooled')
    expect(r.powders[dp40]?.energy?.value).toBeCloseTo(3906976.744, 2)
    expect(r.powders[sp30]?.vivacity.value.toPrecision(3)).toBe('0.800')
    expect(r.powders[sp20]?.vivacity.value.toPrecision(3)).toBe('0.700')
    expect(r.powders[dp40]?.vivacity.value.toPrecision(3)).toBe('1.00')
  })

  it('leaves out a factor at which fewer than 90 % of the powders are fitted', async () => {
    const limit = new URL('./fixtures/burn-limit-model.mjs', import.meta.url).pathname
    const rows = writeRows(rowsCsv([sp30, sp20, dp40].flatMap(training), truth))
    const r = await fit({ ...options, rows, energy: 'prior' }, limit)
    expect(r.energy?.objective.map((o) => o !== null)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ])
    expect(r.energy?.factor).toBe(0.8)
  })

  it('compares every factor on the rows of the powders fitted at all of them', async () => {
    const at = (impetus: number, gamma: number) => (0.8 * impetus) / (gamma - 1)
    const ten = plant({
      'demo-powder-dp15': [at(1.05e6, 1.225), 0.7],
      'demo-powder-dp30': [at(1.05e6, 1.22), 0.7],
      [dp40]: [at(1.05e6, 1.215), 1.0],
      'demo-powder-dp70': [at(1.05e6, 1.24), 0.7],
      [sp20]: [at(1.05e6, 1.215), 0.7],
      'demo-powder-sp21': [at(1.05e6, 1.215), 0.7],
      'demo-powder-sp22': [at(1.05e6, 1.215), 0.7],
      'demo-powder-sp25': [at(1.05e6, 1.215), 0.7],
      [sp30]: [at(1.0e6, 1.25), 0.7],
      'demo-powder-sp31': [at(1.1e6, 1.25), 0.7],
    })
    const specs = [...ten.powders.keys()]
      .filter((id) => /^demo-powder-(dp|sp)\d/.test(id))
      .flatMap((powder) =>
        [2.0, 2.4].map((charge) => ({
          cartridge: '30-br',
          powder,
          charge,
          velocity: 0,
          pressure: 0,
        })),
      )
    const rows = writeRows(rowsCsv(specs, ten))
    const r = await fit({ ...options, rows, energy: 'prior' })
    // dp40 is not resolved at 0.60 and 0.65, which still take part with 9 of 10 powders
    expect(r.energy?.objective.every((o) => o !== null)).toBe(true)
    expect(r.energy?.pressureRows).toBe(18)
    expect(r.energy?.factor).toBe(0.8)
  })

  // 63 fits: 7 s locally, 20 s under coverage
  it('chooses the family exponent at each factor and the factor on the pressures of the fits at it', {
    timeout: 180_000,
  }, async () => {
    const rows = writeRows(rowsCsv(training(sp30), plant({ [sp30]: [3.2e6, 3.6, 0.8] })))
    const r = await fit({ ...options, rows, exponent: 'family', energy: 'prior' })
    expect(r.energy?.factor).toBe(0.8)
    expect(r.exponent?.families).toEqual({ 'single/ball': { exponent: 0.8, powders: 1 } })
    expect(r.powders[sp30]?.pressureExponent).toBe(0.8)
    expect(r.powders[sp30]?.energy).toEqual({ value: 3.2e6, prior: 'own' })
    expect(r.powders[sp30]?.vivacity.value.toPrecision(3)).toBe('3.60')
  })

  it('evaluates the held-out rows with the energy and burn coefficient of the fit', async () => {
    const rows = writeRows(
      rowsCsv(
        [
          ...training(sp30),
          { cartridge: '308-match', powder: sp30, charge: 2.0, velocity: 0, pressure: 0 },
          { cartridge: '308-match', powder: sp30, charge: 2.3, velocity: 0, pressure: 0 },
        ],
        truth,
      ),
    )
    const prior = await verify({ ...options, rows, params: 'fit-on-training', energy: 'prior' })
    expect(prior.overall.velocity?.median).toBeCloseTo(0, 4)
    expect(prior.overall.pressure?.median).toBeCloseTo(0, 4)
    const record = await verify({ ...options, rows, params: 'fit-on-training' })
    expect(record.overall.pressure?.median).toBeGreaterThan(0.02)
  })

  it('is bad input without a training row that prints a pressure', async () => {
    const rows = writeRows(
      rowsCsv(
        training(sp30).map(({ pressure: _, ...s }) => s),
        truth,
      ),
    )
    await expect(fit({ ...options, rows, energy: 'prior' })).rejects.toThrow(UsageError)
  })

  it('is bad input without a powder record with a thermochemistry', async () => {
    const rows = writeRows(rowsCsv(training(dp40), truth))
    await expect(
      fit({ ...options, rows, records: [recordRoots[0] as string], energy: 'prior' }),
    ).rejects.toThrow(UsageError)
  })

  it('has another model version when a prior from a powder the rows do not name changes', async () => {
    const rows = writeRows(rowsCsv(training(sp20), truth))
    const root = mkdtempSync(join(tmpdir(), 'cli-records-'))
    cpSync(recordRoots[1] as string, root, { recursive: true })
    const path = join(root, 'powders/demo-powder-sp31.json')
    const sp31 = JSON.parse(readFileSync(path, 'utf8'))
    // impetus and flame temperature scale together, so the record keeps impetus = R T / M
    for (const key of ['impetus', 'flameTemperature'])
      for (const end of ['value', 'min', 'max']) sp31.thermochemistry[key][end] *= 1.1
    writeFileSync(path, JSON.stringify(sp31))
    const a = await fit({ ...options, rows, energy: 'prior' })
    const b = await fit({
      ...options,
      rows,
      records: [recordRoots[0] as string, root],
      energy: 'prior',
    })
    expect(b.inputs).toEqual(a.inputs)
    expect(b.modelVersion).not.toBe(a.modelVersion)
  })
})

describe('a model that refuses a load by throwing', () => {
  it('lists the powder and goes on', async () => {
    const refusing = new URL('./fixtures/refusing-model.mjs', import.meta.url).pathname
    const r = await fit(options, refusing)
    expect(r.notFitted[dp40]).toBe('invalid')
  })
})

// each run fits every powder at seven exponents; the eight-powder case took 114 s on the CI runner, which measures coverage
describe('fit --exponent family', { timeout: 300_000 }, () => {
  /** The fixture records with the pressure exponent and the burn coefficient of each powder of `truth` replaced. */
  const plant = (truth: Record<string, [number, number]>) => ({
    ...records,
    powders: new Map(
      [...records.powders].map(([id, p]) => {
        const [n, value] = truth[id] ?? []
        if (n === undefined || value === undefined || !p.interior) return [id, p]
        const interior = { ...p.interior, pressureExponent: n, vivacity: { value } }
        return [id, { ...p, interior }]
      }),
    ),
  })
  /** Burn coefficients at the exponent 0.8, near the record value times (2000 bar / reference pressure)^0.2. */
  const at08: Record<string, number> = {
    'demo-powder-dp15': 14.7,
    'demo-powder-dp30': 3.95,
    'demo-powder-dp40': 2.81,
    'demo-powder-dp70': 1.75,
  }
  /** Burn coefficients of the single/ball powders at the exponent 1.1, near the record value times (2000 bar / reference pressure)^-0.1. */
  const at11: Record<string, number> = {
    'demo-powder-sp20': 0.233,
    'demo-powder-sp21': 0.243,
    'demo-powder-sp22': 0.223,
    'demo-powder-sp25': 0.28,
  }
  /** Rows of `powder` in `cartridge` at `charges`. */
  const ladder = (powder: string, cartridge: string, charges: number[]) =>
    charges.map((charge) => ({ cartridge, powder, charge, velocity: 0 }))
  /** Three charges in each of two training cartridges. */
  const training = (powder: string, charges = [1.4, 1.8, 2.2]) => [
    ...ladder(powder, '30-br', charges),
    ...ladder(powder, '308-win', charges),
  ]
  const truth = plant({
    ...Object.fromEntries(Object.entries(at08).map(([id, b]) => [id, [0.8, b]])),
    ...Object.fromEntries(Object.entries(at11).map(([id, b]) => [id, [1.1, b]])),
  })

  it('lets a family of four powders outweigh the pooled exponent', async () => {
    const specs = [...Object.keys(at08), ...Object.keys(at11)].flatMap((powder) =>
      powder === 'demo-powder-dp15' ? training(powder, [1.0, 1.4, 1.8]) : training(powder),
    )
    const r = await fit({ ...options, rows: writeRows(rowsCsv(specs, truth)), exponent: 'family' })
    expect(r.exponent?.pooled).toBe(1)
    expect(r.exponent?.families).toEqual({
      'double/ball': { exponent: 1, powders: 1 },
      'double/extruded': { exponent: 1, powders: 1 },
      'double/flake': { exponent: 1, powders: 1 },
      'single/ball': { exponent: 1.1, powders: 4 },
      'single/extruded': { exponent: 1, powders: 1 },
    })
    for (const [id, b] of Object.entries(at11)) {
      expect(r.powders[id]?.pressureExponent).toBe(1.1)
      expect(r.powders[id]?.vivacity.value.toPrecision(4)).toBe(b.toPrecision(4))
    }
    expect(r.notFitted).toEqual({})
  })

  it('evaluates the validation split at the fitted exponent and burn coefficient', async () => {
    const specs = [...training(dp40), ...ladder(dp40, '308-match', [1.2, 1.6])]
    const rows = writeRows(rowsCsv(specs, truth))
    const chosen = await verify({ ...options, rows, params: 'fit-on-training', exponent: 'family' })
    expect(chosen.overall.velocity?.median).toBeCloseTo(0, 6)
    const record = await verify({ ...options, rows, params: 'fit-on-training' })
    expect(record.overall.velocity?.median).toBeGreaterThan(0.001)
  })

  it('pulls a family of one powder with two rows toward the pooled exponent', async () => {
    const dp15 = ladder('demo-powder-dp15', '30-br', [1.0, 1.4])
    const others = [...training(dp40), ...training('demo-powder-dp70')]
    const truth = plant({ 'demo-powder-dp15': [0.8, 14.7] })
    const all = await fit({
      ...options,
      rows: writeRows(rowsCsv([...dp15, ...others], truth)),
      exponent: 'family',
    })
    expect(all.exponent?.families['double/flake']?.exponent).toBe(1)
    expect(all.exponent?.pooled).toBe(1)
    const alone = await fit({
      ...options,
      rows: writeRows(rowsCsv(dp15, truth)),
      exponent: 'family',
    })
    expect(alone.exponent?.families['double/flake']?.exponent).toBe(0.8)
  })
})

describe('the uncertainty of a fit', () => {
  /** The fitted dp40 of `specs`, printed from the fixture records, at `velocitySigma`. */
  const fitted = async (specs: Spec[], velocitySigma: number) => {
    const rows = writeRows(rowsCsv(specs))
    return (await fit({ ...options, rows, velocitySigma })).powders[dp40]
  }
  const ladder = (offsets: number[]) =>
    [2.0, 2.2, 2.4, 2.6].map((charge, i) => ({
      cartridge: '30-br',
      charge,
      velocity: offsets[i] ?? 0,
    }))
  const ratio = async (specs: Spec[]) =>
    ((await fitted(specs, 0.02))?.vivacity.standardUncertainty ?? Number.NaN) /
    ((await fitted(specs, 0.01))?.vivacity.standardUncertainty ?? Number.NaN)

  it('follows the velocity sigma when the rows fit within it', async () => {
    expect(await ratio(ladder([0, 0, 0, 0]))).toBeCloseTo(2, 6)
  })

  it('follows the residuals when they are far above the velocity sigma', async () => {
    expect(await ratio(ladder([0.05, -0.05, 0.05, -0.05]))).toBeCloseTo(1, 6)
  })

  it('counts the prior rows of the rifle effects in the degrees of freedom', async () => {
    const specs = [
      { cartridge: '30-br', charge: 2.0, velocity: 0 },
      { cartridge: '308-win', charge: 2.2, velocity: 0 },
    ]
    expect((await fitted(specs, 0.03))?.chiSquarePerDegree).toBeTypeOf('number')
  })
})

describe('the pressure rows of a fit', () => {
  /** Rows of dp40 and sp20 printed from the fixture records, the pressure of case-contact rows times 0.9 and of transducer rows times 1.1. */
  const printed = (cartridges: string[]): Spec[] =>
    [dp40, sp20].flatMap((powder) =>
      cartridges.flatMap((cartridge, k) =>
        [2.0, 2.2, 2.4].map((charge) => ({
          cartridge,
          powder,
          charge,
          velocity: 0,
          ...(k % 2 === 0
            ? { pressure: 1 / 0.9 - 1, pressureBasis: 'case-contact' }
            : { pressure: 1 / 1.1 - 1, pressureBasis: 'transducer' }),
        })),
      ),
    )
  const training = printed(['30-br', '308-win'])
  const rows = writeRows(rowsCsv(training))

  it('finds a factor per basis and leaves the burn coefficients at the record values', async () => {
    const r = await fit({ ...options, rows, pressureSigma: 0.05 })
    expect(r.pressure?.factors['case-contact']?.factor).toBeCloseTo(0.9, 3)
    expect(r.pressure?.factors.transducer?.factor).toBeCloseTo(1.1, 3)
    expect(r.powders[dp40]?.factor).toBeCloseTo(1, 3)
    expect(r.powders[sp20]?.factor).toBeCloseTo(1, 3)
  })

  it('moves the burn coefficient of a powder whose pressures are off its basis, and not the factor', async () => {
    const off = ['308-win'].flatMap((cartridge) =>
      [2.0, 2.2, 2.4].map((charge) => ({
        cartridge,
        powder: sp21,
        charge,
        velocity: 0,
        pressure: 1 / (1.1 * 1.3) - 1,
        pressureBasis: 'transducer',
      })),
    )
    const r = await fit({
      ...options,
      rows: writeRows(rowsCsv([...training, ...off])),
      pressureSigma: 0.05,
    })
    expect(r.pressure?.factors.transducer?.factor).toBeCloseTo(1.1, 3)
    expect(r.powders[sp21]?.factor).toBeGreaterThan(1.03)
  })

  it('reports the factors in the evaluation and compares the held-out pressures with the model peak as it is', async () => {
    const withValidation = writeRows(rowsCsv([...training, ...printed(['308-match', '308-match'])]))
    const r = await verify({
      ...options,
      rows: withValidation,
      params: 'fit-on-training',
      pressureSigma: 0.05,
    })
    expect(r.fit?.pressure?.factors['case-contact']?.factor).toBeCloseTo(0.9, 3)
    expect(r.fit?.pressure?.factors.transducer?.factor).toBeCloseTo(1.1, 3)
    expect(r.overall.pressure?.median).toBeCloseTo(0.101, 3)
  })
})
