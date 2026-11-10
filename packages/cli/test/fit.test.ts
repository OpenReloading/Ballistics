import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fit, verify } from '../src/commands.ts'
import { UsageError } from '../src/errors.ts'
import { loadModel } from '../src/model.ts'
import { recordRoots, records, rowsCsv, type Spec, writeRows } from './fixture.ts'

vi.mock('@open-reloading/tools/catalog', async (original) =>
  (await import('./records-memo.ts')).memoRecords(
    await original<typeof import('@open-reloading/tools/catalog')>(),
  ),
)

const dp40 = 'demo-powder-dp40'
const sp20 = 'demo-powder-sp20'

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
    ['308-match', 2.0],
    ['308-match', 2.2],
    ['308-match', 2.4],
    ['7-62-x-54-r', 2.2],
    ['7-62-x-54-r', 2.4],
    ['7-62-x-54-r', 2.6],
  ].map(([cartridge, charge]) => ({
    cartridge: cartridge as string,
    charge: charge as number,
    velocity: 0,
  })),
  { cartridge: '308-win', charge: 2.0, velocity: 0 },
  { cartridge: '308-win', charge: 2.2, velocity: 0 },
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
          { cartridge: '308-win', powder: sp20, charge: 2.4, velocity: 0 },
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

describe('--energy prior', () => {
  const sp30 = 'demo-powder-sp30'
  /** The fixture records with each powder's energy and burn coefficient set as given. */
  const plant = (values: Record<string, [energy: number, vivacity: number]>) => {
    const powders = new Map(records.powders)
    for (const [id, [energy, vivacity]] of Object.entries(values)) {
      const p = records.powders.get(id)
      if (!p?.interior) throw new Error(`${id} has no interior parameters`)
      powders.set(id, {
        ...p,
        interior: {
          ...p.interior,
          energy: { ...p.interior.energy, value: energy },
          vivacity: { ...p.interior.vivacity, value: vivacity },
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
      ['308-match', 2.2],
    ].map(([cartridge, charge]) => ({
      cartridge: cartridge as string,
      powder,
      charge: charge as number,
      velocity: 0,
      pressure: 0,
    }))

  it('takes the loss factor of the planted energies from the training pressures', async () => {
    const rows = writeRows(rowsCsv([sp30, sp20, dp40].flatMap(training), truth))
    const r = await fit({ ...options, rows, energy: 'prior' })
    expect(r.energy?.loss).toBe(0.8)
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

  it('evaluates the held-out rows with the energy and burn coefficient of the fit', async () => {
    const rows = writeRows(
      rowsCsv(
        [
          ...training(sp30),
          { cartridge: '308-win', powder: sp30, charge: 2.0, velocity: 0, pressure: 0 },
          { cartridge: '308-win', powder: sp30, charge: 2.3, velocity: 0, pressure: 0 },
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
      { cartridge: '308-match', charge: 2.2, velocity: 0 },
    ]
    expect((await fitted(specs, 0.03))?.chiSquarePerDegree).toBeTypeOf('number')
  })
})
