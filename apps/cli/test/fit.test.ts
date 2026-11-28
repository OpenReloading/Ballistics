import { describe, expect, it, vi } from 'vitest'
import { fit, verify } from '../src/commands.ts'
import { loadModel } from '../src/model.ts'
import { loadRecords } from '../src/records.ts'
import { dp40, options, planted, sp20, sp21, specs } from './fit-rows.ts'
import { recordRoots, rootWithEstimate, rowsCsv, type Spec, writeRows } from './fixture.ts'

vi.mock('@rangefoundry/catalog-files', async (original) =>
  (await import('./records-memo.ts')).memoRecords(
    await original<typeof import('@rangefoundry/catalog-files')>(),
  ),
)

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

  it('fits on measured capacities only, with an estimate on a training cartridge', async () => {
    const estimate = rootWithEstimate('30-40-krag', 3.6)
    const truth = { ...loadRecords([...recordRoots, estimate]), powders: planted.powders }
    // 5 % slower than the planted truth, so a fit that read the estimate would move the burn coefficient of dp40
    const krag = [2.0, 2.2, 2.4].map((charge) => ({
      cartridge: '30-40-krag',
      charge,
      velocity: 0.05,
    }))
    const run = {
      ...options,
      rows: writeRows(rowsCsv([...specs, ...krag], truth)),
      params: 'fit-on-training',
    } as const
    const measured = await verify(run)
    const estimated = await verify({ ...run, records: [...recordRoots, estimate] })
    expect(estimated.fit).toEqual(measured.fit)
    expect(estimated.overall).toEqual(measured.overall)
    expect(estimated.byPowder).toEqual(measured.byPowder)
    expect(estimated.byFamily).toEqual(measured.byFamily)
    const p = (await fit({ ...run, records: [...recordRoots, estimate] })).powders[dp40]
    expect(p?.vivacity.value).toBeCloseTo(0.66096, 5)
    expect(p?.rows).toBe(10)
  })
})

describe('verify with --fit', () => {
  it('evaluates the values of a saved fit as --params fit-on-training does, marked as a screen', async () => {
    const saved = writeRows(JSON.stringify(await fit(options)), 'fit.json')
    const { screen, ...screened } = await verify({ ...options, fit: saved, perRow: true })
    const full = await verify({ ...options, params: 'fit-on-training', perRow: true })
    expect(screen).toEqual({ version: full.modelVersion })
    expect(screened.overall.velocity?.median).toBeCloseTo(0, 6)
    expect(screened).toEqual(full)
  })

  it("keeps the version of a fit of another build and records this build's beside it", async () => {
    const other = { ...(await fit(options)), modelVersion: 'another build' }
    const saved = writeRows(JSON.stringify(other), 'fit.json')
    const r = await verify({ ...options, fit: saved })
    expect(r.modelVersion).toBe('another build')
    expect(r.screen?.version).toBe(
      (await verify({ ...options, params: 'fit-on-training' })).modelVersion,
    )
  })

  it('refuses a fit of other rows', async () => {
    const saved = writeRows(JSON.stringify(await fit(options)), 'fit.json')
    const rows = writeRows(rowsCsv(specs.slice(1), planted))
    await expect(verify({ ...options, rows, fit: saved })).rejects.toThrow(
      'the --fit fit was run on other rows or records',
    )
  })
})

// each run fits every powder at nine factors

describe('a model that refuses a load by throwing', () => {
  it('lists the powder and goes on', async () => {
    const refusing = new URL('./fixtures/refusing-model.mjs', import.meta.url).pathname
    const r = await fit(options, refusing)
    expect(r.notFitted[dp40]).toBe('invalid')
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

  it('finds a factor per cartridge with --pressure-factor cartridge, one for the basis by default', async () => {
    const byCartridge = writeRows(
      rowsCsv(
        [dp40, sp20].flatMap((powder) =>
          [
            ['30-br', 1 / 1.2 - 1],
            ['308-win', 1 / 0.8 - 1],
          ].flatMap(([cartridge, pressure]) =>
            [2.0, 2.2, 2.4].map((charge) => ({
              cartridge: cartridge as string,
              powder,
              charge,
              velocity: 0,
              pressure: pressure as number,
              pressureBasis: 'transducer',
            })),
          ),
        ),
      ),
    )
    const r = await fit({
      ...options,
      rows: byCartridge,
      pressureSigma: 0.05,
      pressureFactor: 'cartridge',
    })
    expect(r.pressure?.by).toBe('cartridge')
    expect(Object.keys(r.pressure?.factors ?? {})).toEqual(['30-br', '308-win'])
    expect(r.pressure?.factors['30-br']?.factor).toBeCloseTo(1.2, 3)
    expect(r.pressure?.factors['308-win']?.factor).toBeCloseTo(0.8, 3)
    const basis = await fit({ ...options, rows: byCartridge, pressureSigma: 0.05 })
    expect(basis.pressure?.by).toBe('basis')
    // the median of six logs of 1.2 and six of 0.8: the root of 0.96
    expect(basis.pressure?.factors.transducer?.factor).toBeCloseTo(0.98, 2)
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
