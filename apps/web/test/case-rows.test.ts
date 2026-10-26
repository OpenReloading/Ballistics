import type { Case } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import type { CaseSummary } from '../src/lib/api-types.ts'
import { caseMatches, caseRows } from '../src/lib/case-rows.ts'
import { caseRowGroups, caseStrip } from '../src/lib/record-fields.ts'
import { defined } from './defined.ts'

const summary: CaseSummary = {
  id: 'demo-case-308-brass',
  manufacturer: 'demo-cases',
  cartridge: '308-win',
  name: '308 Win. Brass Demo',
  productNumber: 'C308',
  material: 'brass',
  mass: 11.4,
  waterCapacity: 3.6,
}

const names = new Map([['demo-cases', 'Demo Cases']])
const aliases = new Map([['demo-cases', ['Old Demo']]])
const cartridges = new Map([['308-win', '308 Win.']])
const rows = caseRows([summary], names, aliases, cartridges)

it('puts the manufacturer and cartridge names on each row, empty while one is unknown', () => {
  expect(defined(rows[0])).toMatchObject({
    manufacturerName: 'Demo Cases',
    manufacturerAliases: ['Old Demo'],
    cartridgeName: '308 Win.',
  })
  expect(caseRows([summary], new Map(), new Map(), new Map())[0]).toMatchObject({
    manufacturerName: '',
    cartridgeName: '',
  })
})

it('searches manufacturer, its aliases, name, product number and cartridge, every word', () => {
  const row = defined(rows[0])
  for (const q of ['demo cases', 'old demo', 'brass', 'c308', '308 win', 'cases 308'])
    expect(caseMatches(row, q), q).toBe(true)
  expect(caseMatches(row, 'steel')).toBe(false)
  expect(caseMatches(row, 'c308 6.5')).toBe(false)
})

const record: Case = {
  origin: 'catalogue',
  name: '308 Win. Brass Demo',
  manufacturer: 'catalogue:demo-cases',
  cartridge: 'catalogue:308-win',
  productNumber: 'C308',
  headstamp: 'DEMO 308 WIN',
  material: 'nickel-plated-brass',
  primerPocket: { type: 'boxer', size: 'large rifle' },
  flashHole: { value: 2 },
  mass: { value: 11.4 },
  waterCapacity: { value: 3.6 },
  annealed: false,
}

it('the strip has the manufacturer, material, mass and water capacity, nothing the record lacks', () => {
  expect(caseStrip(record, 'Demo Cases').map((i) => [i.icon, i.label])).toEqual([
    ['manufacturer', 'Manufacturer'],
    ['material', 'Material'],
    ['mass', 'Mass'],
    ['capacity', 'Water capacity'],
  ])
  expect(
    caseStrip({ ...record, mass: undefined, waterCapacity: undefined }).map((i) => i.label),
  ).toEqual(['Material'])
  const capacity = defined(caseStrip(record).find((i) => i.icon === 'capacity')).row
  // 3.6 g of water at the density the seating uses
  expect(capacity.value?.quantity).toBe('capacity')
  expect(capacity.value?.si).toBeCloseTo(3.6e-6 / 0.9982, 9)
})

it('the table has the product number, headstamp, primer pocket, flash hole and annealed, as text', () => {
  const [group] = caseRowGroups(record)
  expect(defined(group).rows.map((r) => [r.label, r.text ?? r.value?.si])).toEqual([
    ['Product number', 'C308'],
    ['Headstamp', 'DEMO 308 WIN'],
    ['Primer pocket', 'Boxer, large rifle'],
    ['Flash hole diameter', 0.002],
    ['Annealed', 'No'],
  ])
  expect(
    defined(caseRowGroups({ ...record, headstamp: undefined, annealed: undefined })[0]).rows.map(
      (r) => r.label,
    ),
  ).toEqual(['Product number', 'Primer pocket', 'Flash hole diameter'])
})
