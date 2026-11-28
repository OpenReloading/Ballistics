import { describe, expect, it, vi } from 'vitest'
import { fit, verify } from '../src/commands.ts'
import { UsageError } from '../src/errors.ts'
import { dp40, options, planted, sp20, sp21 } from './fit-rows.ts'
import { rowsCsv, writeRows } from './fixture.ts'

vi.mock('@rangefoundry/catalog-files', async (original) =>
  (await import('./records-memo.ts')).memoRecords(
    await original<typeof import('@rangefoundry/catalog-files')>(),
  ),
)

// the fit files run side by side on the CI runner, which measures coverage: a test here took 64 s there
describe('--folds', { timeout: 180_000 }, () => {
  const cartridges = ['30-br', '308-win', '30-06-spring', '6-5-creedmoor', '308-match']
  /** dp40 at four charges in four training cartridges and the validation cartridge 308-match, sp20 in 30-br only, and sp21 in the test cartridge 307-win only. */
  const folded = {
    ...options,
    rows: writeRows(
      rowsCsv(
        [
          ...cartridges.flatMap((cartridge) =>
            [2.0, 2.2, 2.4, 2.6].map((charge) => ({ cartridge, charge, velocity: 0 })),
          ),
          ...[2.0, 2.2, 2.4].map((charge) => ({
            cartridge: '30-br',
            powder: sp20,
            charge,
            velocity: 0,
          })),
          ...[2.0, 2.2, 2.4].map((charge) => ({
            cartridge: '307-win',
            powder: sp21,
            charge,
            velocity: 0,
          })),
        ],
        planted,
      ),
    ),
  }

  it('scores each fold of the training and validation cartridges by a fit on the other folds', async () => {
    const r = await verify({ ...folded, folds: true })
    expect(r.split).toBe('training+validation')
    expect(r.folds?.each.map((f) => f.cartridges)).toEqual([
      ['30-06-spring'],
      ['308-match'],
      ['308-win'],
      ['30-br'],
      ['6-5-creedmoor'],
    ])
    // sp20 has rows in 30-br only, so the fit without fold 3 has no value for it
    expect(r.folds?.each[3]?.overall.rows).toMatchObject({
      used: 4,
      inSplit: 7,
      notUsed: { noPowderModel: 3 },
    })
    expect(r.folds?.each[1]?.overall.rows.used).toBe(4)
    // sp21 has rows in the test cartridge only, so no fold fits it; sp20 has no fit without fold 3
    expect(r.folds?.each.map((f) => f.fit.powders)).toEqual([2, 2, 2, 1, 2])
    // the rows of the test cartridge are not read
    expect(r.overall.rows).toMatchObject({ used: 20, inSplit: 23 })
    expect(r.folds?.aggregate.velocity).toMatchObject({ rows: 20, cartridges: 5 })
    // four cartridges of the planted truth fit it exactly
    expect(r.folds?.aggregate.velocity?.median.value).toBeCloseTo(0, 6)
  })

  it('takes the half width of a fold from the rows of the other folds', async () => {
    const rows = cartridges.flatMap((cartridge) =>
      [2.0, 2.2, 2.4, 2.6].map((charge, i) => ({
        cartridge,
        charge,
        // only 6-5-creedmoor, fold 4, prints errors
        velocity: cartridge === '6-5-creedmoor' ? (i % 2 === 0 ? 0.05 : -0.05) : 0,
      })),
    )
    const r = await verify({ ...options, rows: writeRows(rowsCsv(rows, planted)), folds: true })
    expect(r.folds?.each[4]?.interval.byBarrel?.rifle?.halfWidth).toBeLessThan(0.001)
    expect(r.folds?.each[0]?.interval.byBarrel?.rifle?.halfWidth).toBeGreaterThan(0.01)
  })

  it('scores each row of a fold by the half width of its barrel class in that fold', async () => {
    const rows = cartridges.flatMap((cartridge) =>
      [2.0, 2.2, 2.4, 2.6].flatMap((charge, i) => [
        { cartridge, charge, velocity: 0 },
        // only the handgun rows print errors
        { cartridge, charge, barrel: 250, velocity: i % 2 === 0 ? 0.05 : -0.05 },
      ]),
    )
    const r = await verify({ ...options, rows: writeRows(rowsCsv(rows, planted)), folds: true })
    for (const f of r.folds?.each ?? []) {
      expect(f.interval.byBarrel?.handgun?.trainingRows).toBe(16)
      expect(f.interval.byBarrel?.rifle?.trainingRows).toBe(16)
      expect(f.interval.byBarrel?.handgun?.halfWidth).toBeGreaterThan(0.04)
      expect(f.interval.byBarrel?.rifle?.halfWidth).toBeLessThan(0.01)
    }
    // under the rifle width the handgun rows, half of each fold, would be outside
    expect(r.folds?.each.map((f) => f.overall.interval?.coverage)).toEqual([0.75, 0.75, 0.75, 1, 1])
  })

  it('adds the folds to the fit of every training row', async () => {
    const r = await fit({ ...folded, folds: true })
    expect(r.powders[dp40]).toMatchObject({ rows: 16, cartridges: 4 })
    expect(r.powders[dp40]?.vivacity.value).toBeCloseTo(0.66096, 5)
    expect(r.folds?.each[1]?.cartridges).toEqual(['308-match'])
    expect(r.folds?.aggregate.velocity).toMatchObject({ rows: 20, cartridges: 5 })
  })

  it('leaves fit and verify without --folds unchanged', async () => {
    const f = await fit(folded)
    expect(f).not.toHaveProperty('folds')
    expect(f.powders[dp40]).toMatchObject({ rows: 16, cartridges: 4 })
    expect(f.powders[dp40]?.vivacity.value).toBeCloseTo(0.66096, 5)
    const r = await verify({ ...folded, params: 'fit-on-training' })
    expect(r).not.toHaveProperty('folds')
    expect(r.overall.rows).toMatchObject({ used: 4, inSplit: 4 })
    expect(r.overall.velocity?.median).toBeCloseTo(0, 6)
  })

  it('takes options that do not combine as bad input before it counts the cartridges', async () => {
    await expect(fit({ ...options, folds: true, pressureFactor: 'table' })).rejects.toThrow(
      UsageError,
    )
    await expect(verify({ ...options, folds: true, params: 'fit-on-training' })).rejects.toThrow(
      '--folds fits each fold and takes no --params or --fit',
    )
  })

  it('refuses fewer training and validation cartridges than folds', async () => {
    await expect(fit({ ...options, folds: true })).rejects.toThrow(
      '--folds needs 5 cartridges of the training and validation splits or more, the rows have 4',
    )
  })
})
