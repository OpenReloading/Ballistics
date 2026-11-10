import { describe, expect, it, vi } from 'vitest'
import { fit, verify } from '../src/commands.ts'
import { loadModel } from '../src/model.ts'
import { recordRoots, records, rowsCsv, type Spec, writeRows } from './fixture.ts'

vi.mock('@open-reloading/tools/catalog', async (original) =>
  (await import('./records-memo.ts')).memoRecords(
    await original<typeof import('@open-reloading/tools/catalog')>(),
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
  const training = printed(['30-br', '308-match'])
  const rows = writeRows(rowsCsv(training))

  it('finds a factor per basis and leaves the burn coefficients at the record values', async () => {
    const r = await fit({ ...options, rows, pressureSigma: 0.05 })
    expect(r.pressure?.factors['case-contact']?.factor).toBeCloseTo(0.9, 3)
    expect(r.pressure?.factors.transducer?.factor).toBeCloseTo(1.1, 3)
    expect(r.powders[dp40]?.factor).toBeCloseTo(1, 3)
    expect(r.powders[sp20]?.factor).toBeCloseTo(1, 3)
  })

  it('moves the burn coefficient of a powder whose pressures are off its basis, and not the factor', async () => {
    const off = ['308-match'].flatMap((cartridge) =>
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
    const withValidation = writeRows(rowsCsv([...training, ...printed(['308-win', '308-win'])]))
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
