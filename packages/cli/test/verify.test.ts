import { describe, expect, it } from 'vitest'
import { verify } from '../src/commands.ts'
import { Refusal } from '../src/errors.ts'
import { rowsPath } from './data.ts'
import { recordRoots, rowsCsv, writeRows } from './fixture.ts'

const options = { rows: rowsPath, records: recordRoots, split: 'validation', final: false } as const

describe('verify on the validation split', () => {
  it('gives the errors the rows were built with', async () => {
    const r = await verify(options)
    expect(r.overall.rows).toEqual({
      inSplit: 12,
      used: 5,
      notUsed: {
        unknownCartridge: 1,
        unknownBullet: 1,
        unknownPowder: 1,
        noPowderModel: 1,
        noCaseCapacity: 1,
        noBarrelLength: 1,
        modelRefused: 1,
      },
    })
    // errors 0.01, 0.02, 0.03, 0.04, 0.10
    expect(r.overall.velocity?.median).toBeCloseTo(0.03, 9)
    expect(r.overall.velocity?.p90).toBeCloseTo(0.076, 9)
    // pressure errors 0.1 and 0.2
    expect(r.overall.pressure?.rows).toBe(2)
    expect(r.overall.pressure?.median).toBeCloseTo(0.15, 9)
    expect(r.overall.pressure?.p90).toBeCloseTo(0.19, 9)
  })

  it('calibrates the interval on the training split and counts the rows inside it', async () => {
    const r = await verify(options)
    // training errors 0.01 to 0.10: the 90th percentile is 0.091
    expect(r.interval.trainingRows).toBe(10)
    expect(r.interval.halfWidth).toBeCloseTo(0.091, 9)
    // the band is the model velocity times (1 +/- h): a printed velocity v is inside when
    // |model - v| / model <= h. The row printed 10 % below the model is at 0.0909 of the model,
    // inside; against the printed velocity its error is 0.10, outside.
    expect(r.overall.interval?.coverage).toBeCloseTo(1, 12)
  })

  it('groups by powder family and by powder', async () => {
    const r = await verify(options)
    expect(Object.keys(r.byFamily)).toEqual([
      'double/extruded',
      'single/ball',
      'unknown',
      'unspecified/flake',
    ])
    const double = r.byFamily['double/extruded']
    // dp40: errors 0.01, 0.02 and 0.10 (and the unused rows of unknown cartridge, bullet and barrel)
    expect(double?.rows.used).toBe(3)
    expect(double?.velocity?.median).toBeCloseTo(0.02, 9)
    expect(double?.velocity?.p90).toBeCloseTo(0.084, 9)
    // sp20: errors 0.03 and 0.04
    const single = r.byFamily['single/ball']
    expect(single?.velocity?.median).toBeCloseTo(0.035, 9)
    expect(single?.velocity?.p90).toBeCloseTo(0.039, 9)
    expect(single?.pressure).toBeNull()
    expect(r.byFamily.unknown?.rows).toMatchObject({ inSplit: 1, used: 0 })
    expect(r.byFamily.unknown?.velocity).toBeNull()
    expect(r.byPowder['demo-powder-sp20']?.rows.used).toBe(2)
    expect(r.byPowder['no-powder']?.rows.notUsed).toEqual({ unknownPowder: 1 })
  })

  it('prints the model version, and no table label', async () => {
    const r = await verify(options)
    expect(r.modelVersion).toMatch(/^[0-9a-f]{64}$/)
    expect(r.model).toBe('m3')
    expect(r.split).toBe('validation')
    expect(r.final).toBe(false)
    expect(JSON.stringify(r)).not.toMatch(/table(One|Two)/)
  })

  it('changes the model version with the rows and with the model, not with the split', async () => {
    const same = await verify(options)
    expect((await verify({ ...options, split: 'training' })).modelVersion).toBe(same.modelVersion)
    const other = writeRows(
      rowsCsv([
        { cartridge: '308-win', charge: 2.0, velocity: 0.01 },
        { cartridge: '30-br', charge: 2.0, velocity: 0.01 },
      ]),
    )
    expect((await verify({ ...options, rows: other })).modelVersion).not.toBe(same.modelVersion)
    const worse = await verify(
      options,
      new URL('./fixtures/worse-model.mjs', import.meta.url).pathname,
    )
    expect(worse.modelVersion).not.toBe(same.modelVersion)
    expect(worse.model).toMatch(/worse-model\.mjs$/)
  })
})

describe('verify with --group-by', () => {
  it('adds the groups of the key, here the cartridge', async () => {
    const r = await verify({ ...options, groupBy: 'cartridge' })
    expect(r.grouped?.by).toBe('cartridge')
    const groups = r.grouped?.groups ?? {}
    expect(Object.keys(groups)).toEqual(['30-30-win', '308-win', '8-x-57-is', 'unknown-3'])
    // 30-30-win: errors 0.04 and 0.10
    expect(groups['30-30-win']?.velocity?.median).toBeCloseTo(0.07, 9)
    expect(groups['8-x-57-is']?.rows.notUsed).toEqual({ noCaseCapacity: 1 })
  })

  it('groups by bullet construction', async () => {
    const r = await verify({ ...options, groupBy: 'construction' })
    expect(Object.keys(r.grouped?.groups ?? {})).toEqual(['cup-and-core', 'unknown'])
  })

  it('has no groups without the option', async () => {
    expect((await verify(options)).grouped).toBeUndefined()
  })
})

describe('verify on the other splits', () => {
  it('refuses the test split without --final, and runs it with it', async () => {
    await expect(verify({ ...options, split: 'test' })).rejects.toThrow(Refusal)
    const r = await verify({ ...options, split: 'test', final: true })
    expect(r.final).toBe(true)
    // errors 0.02, 0.05, 0.06
    expect(r.overall.velocity?.median).toBeCloseTo(0.05, 9)
    expect(r.overall.velocity?.p90).toBeCloseTo(0.058, 9)
  })

  it('runs the training split on its own rows', async () => {
    const r = await verify({ ...options, split: 'training' })
    expect(r.overall.rows).toMatchObject({ inSplit: 10, used: 10 })
    expect(r.overall.velocity?.median).toBeCloseTo(0.055, 9)
    expect(r.overall.interval?.coverage).toBeCloseTo(0.9, 12)
  })

  it('refuses a split without a row that can be used', async () => {
    const only = writeRows(rowsCsv([{ cartridge: '308-win', charge: 2.0, velocity: 0.01 }]))
    await expect(verify({ ...options, rows: only, split: 'test', final: true })).rejects.toThrow(
      /no row of the test split could be evaluated \(0 in the split\)/,
    )
  })

  it('has no interval without a training row', async () => {
    const only = writeRows(rowsCsv([{ cartridge: '308-win', charge: 2.0, velocity: 0.01 }]))
    const r = await verify({ ...options, rows: only })
    expect(r.interval).toEqual({ basis: 'training', halfWidth: null, trainingRows: 0 })
    expect(r.overall.interval).toBeNull()
  })
})
