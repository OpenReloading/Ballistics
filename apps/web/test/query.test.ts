import { overrideResistance, recordResistance } from '@open-reloading/core'
import { expect, it } from 'vitest'
import { fieldError, fieldValueFromText, initialFields } from '../src/lib/field-spec.ts'
import {
  droppedIds,
  inputsQuery,
  linkedLoad,
  linkParams,
  queryFields,
  recordValues,
  tabQuery,
  withRecordValues,
  withTab,
  workbenchHref,
} from '../src/lib/query.ts'
import { shotFields } from '../src/lib/trajectory-input.ts'
import { presetUnits } from '../src/lib/units.ts'

const us = presetUnits('us')
const metric = presetUnits('metric-grams')

it('writes the unit system, the choices and the SI value of each non-empty field', () => {
  const fields = {
    ...initialFields(shotFields, us),
    muzzleVelocity: fieldValueFromText('velocity', us, '2600'),
  }
  const query = new URLSearchParams(
    inputsQuery('us', fields, { bullet: 'alpha-30425', hand: undefined }),
  )
  expect(query.get('units')).toBe('us')
  expect(query.get('bullet')).toBe('alpha-30425')
  expect(query.has('hand')).toBe(false)
  expect(query.has('sightHeight')).toBe(false)
  expect(Number(query.get('muzzleVelocity'))).toBe(us.velocity.toSi(2600))
  expect(Number(query.get('zeroRange'))).toBe(100)
})

it('reads the fields back in the given units; unknown keys and bad numbers are left out', () => {
  const query = new URLSearchParams('units=imperial&muzzleVelocity=792.48&zeroRange=abc&other=1')
  const fields = queryFields(query, shotFields, us)
  expect(fields.muzzleVelocity).toEqual({ text: '2600', si: 792.48 })
  expect(fields.zeroRange).toEqual({ text: '', si: undefined })
  expect(fields.temperature).toEqual({ text: '', si: undefined })
  expect(Object.keys(fields)).toEqual(shotFields.map((s) => s.key))
})

it('names the field and its bounds in the validation messages', () => {
  const spec = {
    key: 'humidity',
    label: 'Relative humidity',
    quantity: 'percent',
    required: true,
    min: 0,
    max: 100,
  } as const
  expect(fieldError(spec, { text: '', si: undefined }, metric)).toBe(
    'Enter a number for Relative humidity.',
  )
  expect(fieldError(spec, { text: '-', si: undefined }, metric)).toBe(
    'Enter a number for Relative humidity.',
  )
  expect(fieldError(spec, fieldValueFromText('percent', metric, '-1'), metric)).toBe(
    'Relative humidity must be at least 0 %.',
  )
  expect(fieldError(spec, fieldValueFromText('percent', metric, '101'), metric)).toBe(
    'Relative humidity must be at most 100 %.',
  )
  // inclusive bounds, and an empty optional field is valid
  expect(fieldError(spec, fieldValueFromText('percent', metric, '0'), metric)).toBeUndefined()
  expect(fieldError(spec, fieldValueFromText('percent', metric, '100'), metric)).toBeUndefined()
  expect(
    fieldError({ ...spec, required: false }, { text: ' ', si: undefined }, metric),
  ).toBeUndefined()
  // greater than 0 and whole numbers, as the schema's positive and integer rules
  const mass = { key: 'mass', label: 'Mass', quantity: 'ratio', min: 0, positive: true } as const
  expect(fieldError(mass, fieldValueFromText('ratio', metric, '0'), metric)).toBe(
    'Mass must be greater than 0.',
  )
  expect(fieldError(mass, fieldValueFromText('ratio', metric, '0.1'), metric)).toBeUndefined()
  const count = {
    key: 'count',
    label: 'Round count',
    quantity: 'ratio',
    min: 0,
    integer: true,
  } as const
  expect(fieldError(count, fieldValueFromText('ratio', metric, '1.5'), metric)).toBe(
    'Round count must be a whole number.',
  )
  expect(fieldError(count, fieldValueFromText('ratio', metric, '2'), metric)).toBeUndefined()
  const gamma = {
    key: 'gamma',
    label: 'Ratio of specific heats',
    quantity: 'ratio',
    min: 1,
  } as const
  expect(fieldError(gamma, fieldValueFromText('ratio', metric, '0.9'), metric)).toBe(
    'Ratio of specific heats must be at least 1.',
  )
})

it('carries a result tab and its inputs under tab. and reads them back', () => {
  const link = withTab(
    'units=us&temperature=300',
    'trajectory',
    'units=us&temperature=290&hand=left',
  )
  const query = new URLSearchParams(link)
  expect(query.get('temperature')).toBe('300')
  expect(query.get('tab.temperature')).toBe('290')
  expect(query.has('tab.units')).toBe(false)
  expect(tabQuery(`?${link}`, 'trajectory')?.toString()).toBe('units=us&temperature=290&hand=left')
  expect(tabQuery(`?${link}`, 'groups')).toBeUndefined()
  expect(tabQuery('?tab=trajectory&tab.hand=left', 'trajectory')).toBeUndefined()
})

it('opens a record link as a new load from the records and a copied link as its values', () => {
  const read = (search: string) => linkedLoad(new URLSearchParams(search))
  expect(read('bullet=alpha-30425')).toEqual({ kind: 'records', bullet: 'alpha-30425' })
  expect(read('powder=echo-40')).toEqual({ kind: 'records', powder: 'echo-40' })
  expect(read('cartridge=308-win')).toEqual({ kind: 'records', cartridge: '308-win' })
  expect(read('bullet=alpha-30425&powder=echo-40')).toEqual({
    kind: 'records',
    bullet: 'alpha-30425',
    powder: 'echo-40',
  })
  // a copied link keeps its values: the records come without their fills
  expect(read('units=metric-grams&powder=echo-40&vivacity=0.6')).toEqual({ kind: 'values' })
  expect(read('')).toBeUndefined()
  expect(read('tab=trajectory')).toBeUndefined()
  // only ids of the schema's form and the load file's length
  expect(read('bullet=../cartridges/308-win')).toBeUndefined()
  expect(read(`bullet=${'a'.repeat(65)}`)).toBeUndefined()
  expect(read('bullet=Alpha 30425&powder=echo-40')).toEqual({
    kind: 'records',
    powder: 'echo-40',
  })
})

it('links a record to a new workbench load that the workbench reads back', () => {
  expect(workbenchHref('bullet', 'alpha-30425')).toBe('/workbench?bullet=alpha-30425')
  expect(workbenchHref('powder', 'echo-40')).toBe('/workbench?powder=echo-40')
  expect(workbenchHref('cartridge', '308-win')).toBe('/workbench?cartridge=308-win')
  const cartridge = new URL(workbenchHref('cartridge', '308-win'), 'http://x').searchParams
  expect(linkedLoad(cartridge)).toEqual({ kind: 'records', cartridge: '308-win' })
  const back = new URL(workbenchHref('bullet', 'alpha-30425'), 'http://x').searchParams
  expect(linkedLoad(back)).toEqual({ kind: 'records', bullet: 'alpha-30425' })
})

it('names the record ids of a link that the schema refuses, which the load leaves out', () => {
  const query = new URLSearchParams({
    cartridge: '308-win',
    bullet: 'Not An Id',
    powder: 'x'.repeat(65),
  })
  expect(droppedIds(query)).toEqual(['bullet Not An Id', `powder ${'x'.repeat(65)}`])
  expect(linkedLoad(query)).toEqual({ kind: 'records', cartridge: '308-win' })
  expect(droppedIds(new URLSearchParams('bullet=alpha-30425&powder='))).toEqual([])
})

it('carries the records a run reads, so the link gives the same bore resistance without them', () => {
  // a fitted powder record's law with every term, for an invented .308 load
  const law = { stress: { value: 12 }, oversize: 0.4, engraving: 0.6 }
  const { resistance } = recordResistance(
    { interior: { resistance: law } },
    {
      boreDiameter: 0.00762,
      boreArea: 47.51e-6,
      startPressure: 30e6,
      cartridge: { g1: 7.85, z: 7.82 },
      bulletLengthMm: 30.5,
    },
  )
  expect(resistance?.friction).toBeGreaterThan(0)
  expect(resistance?.engraving).toHaveLength(2)
  const values = {
    bullet: { name: 'Demo Bullets 168 gr', length: 0.0305 },
    powder: {
      name: 'Demo Powder Co. DP40',
      bulkDensity: 920,
      boreFriction: resistance?.friction,
      engravingPressure: resistance?.engraving?.[0].pressure,
      engravingLength: resistance?.engraving?.at(-1)?.travel,
    },
  }
  const link = withRecordValues('units=metric-grams&bullet=b&powder=p', values)
  const back = recordValues(new URLSearchParams(link))
  expect(back).toEqual(values)
  const { name: _, bulkDensity: __, ...terms } = back.powder ?? {}
  expect(overrideResistance(undefined, terms)).toEqual(resistance)
  // nothing carried: no values; one engraving term alone is no ramp
  expect(recordValues(new URLSearchParams('units=metric-grams'))).toEqual({})
  expect(
    recordValues(new URLSearchParams('record.engravingPressure=1e6&record.bulkDensity=x')),
  ).toEqual({})
  expect(
    recordValues(new URLSearchParams(`record.bullet=${'a'.repeat(300)}`)).bullet?.name,
  ).toHaveLength(200)
})

it('reads a copied load from the fragment, an older link or a record link from the query', () => {
  expect(linkParams({ search: '', hash: '#units=us&charge=0.0024' }).get('charge')).toBe('0.0024')
  expect(linkParams({ search: '?units=us&charge=0.0025', hash: '' }).get('charge')).toBe('0.0025')
  expect(linkParams({ search: '?cartridge=308-win', hash: '#record=abc' }).get('cartridge')).toBe(
    '308-win',
  )
})
