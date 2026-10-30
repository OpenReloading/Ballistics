import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  applyOverrides,
  type Bullet,
  bulletOverrides,
  type Cartridge,
  cartridgeOverrides,
  cartridgeValueOverride,
  powderDraft,
} from '../src/index.ts'

const bullet = {
  id: 'b1',
  manufacturer: 'm1',
  productNumber: '1',
  name: '168 gr',
  diameter: { value: 7.82, raw: '.308' },
  mass: { value: 10.89 },
  base: { type: 'boat-tail', length: { value: 5 }, angle: { value: 9 } },
  ogive: { form: 'tangent', radius: { value: 80 } },
  ballisticCoefficients: [{ dragModel: 'G7', value: 0.25 }],
} as unknown as Bullet

const cartridge = {
  id: 'c1',
  name: '308 Win',
  table: 'I',
  values: [
    {
      side: 'cartridge',
      symbol: 'L3',
      quantity: 'length',
      value: 51.18,
      tolerance: { lower: -0.4 },
    },
    { side: 'chamber', symbol: 'L3', quantity: 'length', value: 51.2 },
    { side: 'chamber', symbol: 'F', quantity: 'length', value: 7.8, variant: 'a' },
    { symbol: 'Pmax', quantity: 'pressure', value: 4150 },
  ],
} as unknown as Cartridge

describe('applyOverrides', () => {
  it('returns the base values without overrides and leaves the base untouched', () => {
    const before = structuredClone(bullet)
    expect(applyOverrides(bullet, undefined)).toEqual(bullet)
    expect(applyOverrides(bullet, {})).toEqual(bullet)
    applyOverrides(bullet, { name: 'x', base: { type: null }, mass: { value: 1 } })
    expect(bullet).toEqual(before)
  })

  it('merges objects by key', () => {
    const r = applyOverrides(bullet, { base: { length: { value: 6 } }, ogive: { form: 'secant' } })
    expect(r.base).toEqual({ type: 'boat-tail', length: { value: 6 }, angle: { value: 9 } })
    expect(r.ogive).toEqual({ form: 'secant', radius: { value: 80 } })
  })

  it('replaces a quantity as a whole, so the base text does not outlive its number', () => {
    expect(applyOverrides(bullet, { diameter: { value: 7.9 } }).diameter).toEqual({ value: 7.9 })
  })

  it('replaces arrays as a whole', () => {
    const r = applyOverrides(bullet, {
      ballisticCoefficients: [{ dragModel: 'G1', value: 0.5 }],
    })
    expect(r.ballisticCoefficients).toEqual([{ dragModel: 'G1', value: 0.5 }])
    expect(Array.isArray(r.ballisticCoefficients)).toBe(true)
  })

  it('skips a field whose override is undefined', () => {
    const r = applyOverrides({ name: 'a' } as Partial<Bullet>, { name: undefined, note: undefined })
    expect(r).toEqual({ name: 'a' })
    expect('note' in r).toBe(false)
  })

  it('removes a field and a nested object with an explicit null', () => {
    const r = applyOverrides(bullet, { base: { type: null }, ogive: null, mass: null })
    expect(r.base).toEqual({ length: { value: 5 }, angle: { value: 9 } })
    expect('ogive' in r).toBe(false)
    expect('mass' in r).toBe(false)
  })

  it('keeps no null from an override that adds an object the base lacks', () => {
    const r = applyOverrides({ name: 'a' } as Partial<Bullet>, {
      tip: { type: 'hollow-point', length: null },
    })
    expect(r.tip).toEqual({ type: 'hollow-point' })
  })

  it('applies overrides to an empty base', () => {
    expect(applyOverrides({} as Partial<Bullet>, { diameter: { value: 7.8 } })).toEqual({
      diameter: { value: 7.8 },
    })
  })
})

describe('applyOverrides on cartridge values', () => {
  it('replaces the value of one (side, symbol, variant) and keeps the others in order', () => {
    const r = applyOverrides(cartridge, {
      values: [{ side: 'chamber', symbol: 'L3', quantity: 'length', value: 52 }],
    })
    expect(r.values.map((v) => v.value)).toEqual([51.18, 52, 7.8, 4150])
    // the same symbol on the other side and the same symbol with a variant are other values
    expect(r.values[0]?.tolerance).toEqual({ lower: -0.4 })
  })

  it('replaces the whole entry, so a printed tolerance does not outlive a changed number', () => {
    const r = applyOverrides(cartridge, {
      values: [{ side: 'cartridge', symbol: 'L3', quantity: 'length', value: 50 }],
    })
    expect(r.values[0]).toEqual({ side: 'cartridge', symbol: 'L3', quantity: 'length', value: 50 })
  })

  it('adds a value the base lacks at the end', () => {
    const r = applyOverrides(cartridge, {
      values: [{ side: 'chamber', symbol: 'F', quantity: 'length', value: 7.7 }],
    })
    expect(r.values.at(-1)).toEqual({
      side: 'chamber',
      symbol: 'F',
      quantity: 'length',
      value: 7.7,
    })
    expect(r.values).toHaveLength(5)
  })

  it('removes the entry of a null value, a variant apart from its plain value', () => {
    const r = applyOverrides(cartridge, {
      values: [
        { side: 'chamber', symbol: 'F', variant: 'a', quantity: 'length', value: null },
        { symbol: 'Pmax', quantity: 'pressure', value: null },
      ],
    })
    expect(r.values.map((v) => `${v.side}.${v.symbol}`)).toEqual(['cartridge.L3', 'chamber.L3'])
  })

  it('drops the removal of a value the base lacks', () => {
    const r = applyOverrides(cartridge, {
      values: [{ symbol: 'P1', quantity: 'length', value: null }],
    })
    expect(r.values).toEqual(cartridge.values)
  })

  it('takes every value as new without a base value list, dropping removals', () => {
    const r = applyOverrides({} as Partial<Cartridge>, {
      table: 'III',
      values: [
        { side: 'cartridge', symbol: 'L3', quantity: 'length', value: 50 },
        { side: 'cartridge', symbol: 'R', quantity: 'length', value: null },
      ],
    })
    expect(r).toEqual({
      table: 'III',
      values: [{ side: 'cartridge', symbol: 'L3', quantity: 'length', value: 50 }],
    })
  })
})

describe('bulletOverrides', () => {
  it('accepts the partial records the designer saves: a diameter alone, a cleared field', () => {
    expect(bulletOverrides.safeParse({ diameter: { value: 7.82 } }).success).toBe(true)
    expect(bulletOverrides.safeParse({ base: { type: null }, tip: null }).success).toBe(true)
    expect(bulletOverrides.safeParse({}).success).toBe(true)
  })

  it('checks the leaves against the bullet schema', () => {
    for (const bad of [
      { diameter: { value: 'x' } },
      { base: { type: 'round' } },
      { ogive: { form: 'ogival' } },
      { mass: 3 },
      { meplatDiameter: { value: -1 } },
    ])
      expect(bulletOverrides.safeParse(bad).success).toBe(false)
  })
})

/** The description of each property of the JSON Schema of `schema`. */
const descriptions = (schema: z.ZodType) =>
  Object.fromEntries(
    Object.entries(
      (
        z.toJSONSchema(schema, { unrepresentable: 'any' }) as {
          properties: Record<string, { description?: string }>
        }
      ).properties,
    ).map(([k, v]) => [k, v.description]),
  )
/** The JSON Schema of the array items at `field` of `schema`'s properties. */
const items = (schema: z.ZodType, field: string) =>
  (
    z.toJSONSchema(schema, { unrepresentable: 'any' }) as {
      properties: Record<string, { anyOf: { items?: z.core.JSONSchema.BaseSchema }[] }>
    }
  ).properties[field]?.anyOf.find((s) => s.items)?.items

describe('override schema descriptions', () => {
  it('describes a field without one by its path and record', () => {
    expect(descriptions(bulletOverrides).mass).toBe(
      'The `mass` of the bullet record. `null` removes it.',
    )
    expect(descriptions(cartridgeOverrides).table).toBe(
      'The `table` of the cartridge record. `null` removes it.',
    )
    expect(items(bulletOverrides, 'ballisticCoefficients')?.properties?.dragModel).toMatchObject({
      description:
        'The `ballisticCoefficients.[].dragModel` of the bullet record. `null` removes it.',
    })
  })

  it('keeps the own description of an array item field and of a whole described item', () => {
    expect(items(cartridgeOverrides, 'values')?.properties?.value).toMatchObject({
      description:
        'In the stored unit of `quantity`. `null` removes the value of this side, symbol and variant.',
    })
    expect(items(cartridgeOverrides, 'values')?.properties?.side).toMatchObject({
      description:
        'Column the value is printed in. Absent for pressures, energies and measuring positions.',
    })
    expect(items(powderDraft, 'composition')?.properties).toMatchObject({
      name: { description: 'Name of the ingredient as the safety data sheet prints it.' },
      cas: { description: 'CAS registry number of the ingredient.' },
      min: { description: 'Lower end of the mass percent range.' },
      max: { description: 'Upper end of the mass percent range.' },
    })
  })
})

describe('cartridgeValueOverride', () => {
  it('takes a value, a null value or a raw text, and refuses an entry with neither', () => {
    const entry = { symbol: 'L3', quantity: 'length' }
    expect(cartridgeValueOverride.safeParse({ ...entry, value: 51 }).success).toBe(true)
    expect(cartridgeValueOverride.safeParse({ ...entry, value: null }).success).toBe(true)
    expect(cartridgeValueOverride.safeParse({ ...entry, raw: '25/30' }).success).toBe(true)
    expect(cartridgeValueOverride.safeParse(entry).error?.issues).toMatchObject([
      { code: 'custom', message: 'a value needs value or raw' },
    ])
    expect(cartridgeOverrides.safeParse({ values: [entry] }).success).toBe(false)
    expect(cartridgeOverrides.safeParse({ values: [{ ...entry, value: null }] }).success).toBe(true)
  })
})

describe('powderDraft', () => {
  it('takes a number outside the bounds of the powder record, but not one of another type', () => {
    const draft = { temperatureSensitivity: { reference: { value: -1 } } }
    expect(powderDraft.safeParse(draft).success).toBe(true)
    expect(
      bulletOverrides.safeParse({ ballisticCoefficients: [{ dragModel: 'G1', value: -1 }] })
        .success,
    ).toBe(false)
    expect(
      powderDraft.safeParse({ temperatureSensitivity: { reference: { value: 'x' } } }).success,
    ).toBe(false)
    expect(powderDraft.safeParse({ composition: [{ min: -5, max: 120 }] }).success).toBe(true)
    expect(powderDraft.safeParse({ composition: [{ min: 'x' }] }).success).toBe(false)
  })

  it('drops the listed cartridges, which need a source the designer does not write', () => {
    expect(powderDraft.parse({ listedCartridges: ['308-win'] })).toEqual({})
  })
})
