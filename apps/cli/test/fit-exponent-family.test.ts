import { describe, expect, it, vi } from 'vitest'
import { fit, verify } from '../src/commands.ts'
import { dp40, options } from './fit-rows.ts'
import { records, rowsCsv, writeRows } from './fixture.ts'

vi.mock('@rangefoundry/catalog-files', async (original) =>
  (await import('./records-memo.ts')).memoRecords(
    await original<typeof import('@rangefoundry/catalog-files')>(),
  ),
)

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

  it('chooses the exponent on velocities and fits the pressure rows at it with --pressure-sigma', async () => {
    const specs = training(dp40).map((s) => ({
      ...s,
      pressure: 1 / 1.1 - 1,
      pressureBasis: 'transducer',
    }))
    const r = await fit({
      ...options,
      rows: writeRows(rowsCsv(specs, truth)),
      exponent: 'family',
      pressureSigma: 0.05,
    })
    expect(Object.values(r.exponent?.families ?? {})).toEqual([{ exponent: 0.8, powders: 1 }])
    expect(r.pressure?.factors.transducer?.factor).toBeCloseTo(1.1, 3)
    expect(r.powders[dp40]?.pressureExponent).toBe(0.8)
    expect(r.powders[dp40]?.pressureRows).toBe(6)
    expect(r.powders[dp40]?.vivacity.value.toPrecision(3)).toBe('2.81')
  })

  describe('with --family', () => {
    const specs = training(dp40).map((s) => ({
      ...s,
      pressure: 1 / 1.1 - 1,
      pressureBasis: 'transducer',
    }))
    const rows = writeRows(rowsCsv(specs, truth))
    const family = { ...options, rows, exponent: 'family' } as const
    // the fit is deterministic (the first test compares two runs byte for byte), so the tests share one run of it
    let familyRun: ReturnType<typeof fit> | undefined
    const familyFit = () => {
      familyRun ??= fit(family)
      return familyRun
    }

    it('takes the choice of a saved fit and gives the run that makes it byte for byte', async () => {
      const saved = writeRows(JSON.stringify(await familyFit()), 'family.json')
      const cold = await fit({ ...family, pressureSigma: 0.05 })
      const reused = await fit({ ...family, pressureSigma: 0.05, family: saved })
      expect(JSON.stringify(reused, null, 2)).toBe(JSON.stringify(cold, null, 2))
      expect(reused.powders[dp40]?.pressureExponent).toBe(0.8)
    })

    it('fits at the exponent the saved fit names', async () => {
      const cold = await familyFit()
      const families = Object.fromEntries(
        Object.keys(cold.exponent?.families ?? {}).map((name) => [
          name,
          { exponent: 1.2, powders: 1 },
        ]),
      )
      const saved = writeRows(
        JSON.stringify({ ...cold, exponent: { ...cold.exponent, families } }),
        'family.json',
      )
      const r = await fit({ ...family, family: saved })
      expect(r.powders[dp40]?.pressureExponent).toBe(1.2)
      expect(r.exponent?.families).toEqual(families)
    })

    it('refuses a saved fit of another velocity sigma', async () => {
      const saved = writeRows(JSON.stringify(await familyFit()), 'family.json')
      await expect(fit({ ...family, velocitySigma: 0.02, family: saved })).rejects.toThrow(
        'the --family fit has velocity sigma 0.03, this run 0.02',
      )
    })
  })
})
