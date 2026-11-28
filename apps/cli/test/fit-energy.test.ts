import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fit, verify } from '../src/commands.ts'
import { UsageError } from '../src/errors.ts'
import { loadRecords } from '../src/records.ts'
import { dp40, options, sp20 } from './fit-rows.ts'
import { recordRoots, records, rowsCsv, writeRows } from './fixture.ts'

vi.mock('@rangefoundry/catalog-files', async (original) =>
  (await import('./records-memo.ts')).memoRecords(
    await original<typeof import('@rangefoundry/catalog-files')>(),
  ),
)

describe('--energy prior', { timeout: 120_000 }, () => {
  // the priors are medians over every powder with a thermochemistry, so the catalogue keeps only its demo powders
  const catalog = mkdtempSync(join(tmpdir(), 'cli-catalog-'))
  cpSync(recordRoots[0] as string, catalog, {
    recursive: true,
    filter: (path) => !/[/\\]powders[/\\](?!demo-)[^/\\]*$/.test(path),
  })
  const demo = { ...options, records: [catalog, recordRoots[1] as string] }
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
    const r = await fit({ ...demo, rows, energy: 'prior' })
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

  it('screens a fit with --energy prior under the version of a full run with it', async () => {
    const rows = writeRows(rowsCsv(training(sp30), truth))
    const saved = writeRows(
      JSON.stringify(await fit({ ...demo, rows, energy: 'prior' })),
      'fit.json',
    )
    const on = { ...demo, rows, split: 'training' } as const
    const full = await verify({ ...on, params: 'fit-on-training', energy: 'prior' })
    expect((await verify({ ...on, fit: saved })).screen?.version).toBe(full.modelVersion)
  })

  it('leaves out a factor at which fewer than 90 % of the powders are fitted', async () => {
    const limit = new URL('./fixtures/burn-limit-model.mjs', import.meta.url).pathname
    const rows = writeRows(rowsCsv([sp30, sp20, dp40].flatMap(training), truth))
    const r = await fit({ ...demo, rows, energy: 'prior' }, limit)
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
    const r = await fit({ ...demo, rows, energy: 'prior' })
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
    const r = await fit({ ...demo, rows, exponent: 'family', energy: 'prior' })
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
    const prior = await verify({ ...demo, rows, params: 'fit-on-training', energy: 'prior' })
    expect(prior.overall.velocity?.median).toBeCloseTo(0, 4)
    expect(prior.overall.pressure?.median).toBeCloseTo(0, 4)
    const record = await verify({ ...demo, rows, params: 'fit-on-training' })
    expect(record.overall.pressure?.median).toBeGreaterThan(0.02)
  })

  it('is bad input without a training row that prints a pressure', async () => {
    const rows = writeRows(
      rowsCsv(
        training(sp30).map(({ pressure: _, ...s }) => s),
        truth,
      ),
    )
    await expect(fit({ ...demo, rows, energy: 'prior' })).rejects.toThrow(UsageError)
  })

  it('is bad input without a powder record with a thermochemistry', async () => {
    const rows = writeRows(rowsCsv(training(dp40), truth))
    await expect(fit({ ...demo, rows, records: [catalog], energy: 'prior' })).rejects.toThrow(
      UsageError,
    )
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
    const a = await fit({ ...demo, rows, energy: 'prior' })
    const b = await fit({
      ...demo,
      rows,
      records: [catalog, root],
      energy: 'prior',
    })
    expect(b.inputs).toEqual(a.inputs)
    expect(b.modelVersion).not.toBe(a.modelVersion)
  })
})

describe('--energy family', { timeout: 120_000 }, () => {
  it("pulls a sparse powder's energy to the impetus of the reference powders", async () => {
    // sp20's rows are printed at its record 3.7e6 J/kg, which three rows do not separate from its burn coefficient; the prior is dp40's impetus over the same gamma, 3.95e6
    const reference = [
      ['30-br', 'demo-bullet-168'],
      ['308-win', 'demo-bullet-168'],
      ['30-06-spring', 'demo-bullet-168'],
      ['6-5-creedmoor', 'demo-bullet-264-130'],
    ].flatMap(([cartridge, bullet]) =>
      [2.0, 2.1, 2.2, 2.3, 2.4].map((charge) => ({
        cartridge: cartridge as string,
        bullet: bullet as string,
        charge,
        velocity: 0,
      })),
    )
    const sparse = [
      ['30-br', 2.0],
      ['30-br', 2.4],
      ['308-win', 2.2],
    ].map(([cartridge, charge]) => ({
      cartridge: cartridge as string,
      powder: sp20,
      charge: charge as number,
      velocity: 0,
    }))
    const rows = writeRows(rowsCsv([...reference, ...sparse], records))
    const r = await fit({ ...options, rows, energy: 'family' })
    expect(r.powders[dp40]?.rows).toBe(20)
    expect(r.energyFamily?.pooled.impetus).toBeCloseTo(849250, 0)
    expect(r.powders[sp20]?.energy?.prior).toBe('pooled')
    expect(r.powders[sp20]?.energy?.value).toBeCloseTo(3.95e6, -3)
  })

  it('centers a sparse powder on the median impetus of its family with five reference powders', async () => {
    // impetus (gamma - 1) E of single/ball: 817,000 838,500 860,000 870,000 900,000 J/kg; dp40 (double/extruded, 849,250) joins only the pooled center
    const energies = { sp21: 3.8e6, sp22: 3.9e6, sp25: 4.0e6, sp30: 3.48e6, sp31: 3.6e6 }
    const root = mkdtempSync(join(tmpdir(), 'cli-records-'))
    cpSync(recordRoots[1] as string, root, { recursive: true })
    for (const [name, energy] of Object.entries(energies)) {
      const path = join(root, `powders/demo-powder-${name}.json`)
      const powder = JSON.parse(readFileSync(path, 'utf8'))
      powder.interior.energy.value = energy
      writeFileSync(path, JSON.stringify(powder))
    }
    const roots = [recordRoots[0] as string, root]
    const reference = [dp40, ...Object.keys(energies).map((name) => `demo-powder-${name}`)].flatMap(
      (powder) =>
        [
          ['30-br', 'demo-bullet-168'],
          ['308-win', 'demo-bullet-168'],
          ['30-06-spring', 'demo-bullet-168'],
          ['6-5-creedmoor', 'demo-bullet-264-130'],
        ].flatMap(([cartridge, bullet]) =>
          // repeated charges reuse the model runs of the fit, which keeps the test near 5 s
          [2.0, 2.0, 2.0, 2.4, 2.4].map((charge) => ({
            cartridge: cartridge as string,
            bullet: bullet as string,
            powder,
            charge,
            velocity: 0,
          })),
        ),
    )
    const sparse = [
      ['30-br', 2.0],
      ['30-br', 2.4],
      ['308-win', 2.2],
    ].map(([cartridge, charge]) => ({
      cartridge: cartridge as string,
      powder: sp20,
      charge: charge as number,
      velocity: 0,
    }))
    const rows = writeRows(rowsCsv([...reference, ...sparse], loadRecords(roots)))
    const r = await fit({ ...options, rows, records: roots, energy: 'family' })
    const family = r.energyFamily?.families['single/ball']
    expect(family?.powders).toBe(5)
    expect(family?.impetus).toBeCloseTo(860000, 0)
    // 1.4826 times the median of |ln(impetus / 860,000)|, 0.025318
    expect(family?.sigma).toBeCloseTo(0.037536, 5)
    expect(r.energyFamily?.pooled.impetus).toBeCloseTo(854625, 0)
    expect(r.powders[sp20]?.energy?.prior).toBe('family')
    // 860,000 J/kg over sp20's gamma 1.215 minus 1
    expect(r.powders[sp20]?.energy?.value).toBeCloseTo(4.0e6, -3)
    expect(r.powders[sp20]?.vivacity.standardUncertainty).toBeCloseTo(0.01102, 4)
  })
})
