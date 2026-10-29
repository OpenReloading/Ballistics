import { InputError, interior } from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { constructionOf, outcomes, predict } from '../src/evaluate.ts'
import type { Records } from '../src/records.ts'
import type { Row } from '../src/rows.ts'
import { familyOf } from '../src/unseen.ts'
import { records } from './fixture.ts'

const row: Row = {
  line: 2,
  cartridge: '308-win',
  bullet: 'demo-bullet-168',
  powder: 'demo-powder-dp40',
  charge: 2.2,
  velocity: 750,
  barrel: 600,
}

const bullet = records.bullets.get('demo-bullet-168')
const cartridge = records.cartridges.get('308-win')
if (!bullet || !cartridge) throw new Error('fixture records missing')

/** The records with one cartridge or bullet replaced. */
const changed = (parts: Partial<Pick<Records, 'bullets' | 'cartridges'>>): Records => ({
  ...records,
  ...parts,
})

describe('predict', () => {
  it('gives the model velocity in m/s and the peak pressure in Pa', () => {
    const p = predict(row, records, interior)
    expect(p).toMatchObject({ velocity: expect.any(Number), pressure: expect.any(Number) })
    if ('reason' in p) throw new Error(p.reason)
    expect(p.velocity).toBeGreaterThan(500)
    expect(p.pressure).toBeGreaterThan(1e8)
  })

  it('moves with the temperature of the run only for a powder with a temperature sensitivity', () => {
    const cold = predict({ ...row, temperature: -30 }, records, interior)
    expect(cold).toEqual(predict(row, records, interior))
  })

  it('uses the COAL of the row', () => {
    const long = predict({ ...row, coal: 80 }, records, interior)
    expect(long).not.toEqual(predict(row, records, interior))
  })

  it.each([
    [
      'a bullet without a length',
      changed({ bullets: new Map([[row.bullet, { ...bullet, length: undefined }]]) }),
      'noBulletLength',
    ],
    [
      'a bullet that has no outline',
      changed({ bullets: new Map([[row.bullet, { ...bullet, diameter: { value: 0 } }]]) }),
      'noBulletShape',
    ],
    [
      'a cartridge without a chamber diameter',
      changed({
        cartridges: new Map([
          [
            row.cartridge,
            { ...cartridge, values: cartridge.values.filter((v) => v.symbol !== 'F') },
          ],
        ]),
      }),
      'missingCartridgeValue',
    ],
    [
      'a cartridge without a case length',
      changed({
        cartridges: new Map([
          [
            row.cartridge,
            { ...cartridge, values: cartridge.values.filter((v) => v.symbol !== 'L3') },
          ],
        ]),
      }),
      'missingCartridgeValue',
    ],
  ])('names the reason for %s', (_name, recs, reason) => {
    expect(predict(row, recs, interior)).toEqual({ reason })
  })

  it('takes a COAL from the row for a cartridge sheet without L6', () => {
    const noL6 = changed({
      cartridges: new Map([
        [
          row.cartridge,
          { ...cartridge, values: cartridge.values.filter((v) => v.symbol !== 'L6') },
        ],
      ]),
    })
    expect(predict(row, noL6, interior)).toEqual({ reason: 'missingCartridgeValue' })
    expect(predict({ ...row, coal: 71.12 }, noL6, interior)).toEqual(
      predict(row, records, interior),
    )
  })

  it('names a model that refuses or throws an input error, and lets a defect through', () => {
    expect(predict(row, records, () => ({ valid: false, reason: 'stuck' }))).toEqual({
      reason: 'modelRefused',
    })
    expect(
      predict(row, records, () => {
        throw new InputError('x')
      }),
    ).toEqual({ reason: 'modelRefused' })
    for (const muzzleVelocity of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -300,
      0,
    ])
      expect(
        predict(row, records, (load) => ({ ...interior(load), muzzleVelocity }) as never),
      ).toEqual({ reason: 'modelRefused' })
    expect(
      predict(
        row,
        records,
        (load) => ({ ...interior(load), peakBreechPressure: Number.NaN }) as never,
      ),
    ).toEqual({ reason: 'modelRefused' })
    expect(() =>
      predict(row, records, () => {
        throw new Error('defect')
      }),
    ).toThrow('defect')
  })
})

describe('familyOf', () => {
  it('names propellant base and grain form, with unspecified for a missing part', () => {
    expect(familyOf({ propellantBase: 'single', grainForm: 'ball' })).toBe('single/ball')
    expect(familyOf({})).toBe('unspecified/unspecified')
    expect(familyOf(undefined)).toBe('unknown')
  })
})

describe('constructionOf', () => {
  it('names the structure, else the core material, else unspecified', () => {
    expect(constructionOf(undefined)).toBe('unknown')
    expect(constructionOf(bullet)).toBe('cup-and-core')
    expect(constructionOf({ ...bullet, construction: undefined })).toBe('unspecified')
    const raw = { raw: 'x' }
    expect(constructionOf({ ...bullet, construction: { ...raw, structure: 'bonded' } })).toBe(
      'bonded',
    )
    expect(
      constructionOf({ ...bullet, construction: { ...raw, core: { material: 'lead' } } }),
    ).toBe('lead-core')
  })
})

describe('outcomes', () => {
  it('keeps the rows of the wanted splits, with their split and family', () => {
    const rows = [row, { ...row, cartridge: '30-br' }, { ...row, cartridge: '30-06-spring' }]
    const out = outcomes(rows, records, interior, ['validation', 'training'])
    expect(out.map((o) => o.split)).toEqual(['validation', 'training'])
    expect(out[0]?.family).toBe('double/extruded')
  })
})
