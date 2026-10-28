import type { Primer } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import { translator } from '../src/i18n/translate.ts'
import type { PrimerSummary } from '../src/lib/api-types.ts'
import { primerMatches, primerRows } from '../src/lib/primer-rows.ts'
import { primerRowGroups, primerStrip } from '../src/lib/record-fields.ts'
import { say } from '../src/lib/wording.ts'
import { defined } from './defined.ts'

const summary: PrimerSummary = {
  id: 'demo-primer-large-rifle',
  manufacturer: 'demo-primers',
  name: 'Large Rifle Demo',
  productNumber: 'DP-LR',
  size: 'large-rifle',
  magnum: false,
  compound: 'lead-free',
}

const names = new Map([['demo-primers', 'Demo Primers']])
const aliases = new Map([['demo-primers', ['Old Demo']]])
const rows = primerRows([summary], names, aliases)

it('puts the manufacturer name on each row, empty while it is unknown', () => {
  expect(defined(rows[0])).toMatchObject({
    manufacturerName: 'Demo Primers',
    manufacturerAliases: ['Old Demo'],
  })
  expect(primerRows([summary], new Map(), new Map())[0]).toMatchObject({ manufacturerName: '' })
})

it('searches manufacturer, its aliases, name, product number, size and compound, every word', () => {
  const row = defined(rows[0])
  for (const q of ['demo primers', 'old demo', 'dp-lr', 'large rifle', 'lead free', 'primers lead'])
    expect(primerMatches(row, q), q).toBe(true)
  expect(primerMatches(row, 'pistol')).toBe(false)
  expect(primerMatches(row, 'dp-lr magnum')).toBe(false)
})

const record: Primer = {
  id: 'demo-primer-large-rifle',
  manufacturer: 'demo-primers',
  name: 'Large Rifle Demo',
  productNumber: 'DP-LR',
  size: 'large-rifle',
  magnum: true,
  cup: { material: 'nickel-plated-brass', thickness: { value: 0.5 } },
  compound: 'lead-styphnate',
  intendedUse: 'General rifle loads.',
  performance: [{ property: 'Drop height', value: '25 mm' }],
  provenance: { kind: 'published', sources: [{ title: 'Test' }] },
}

it('the strip has the manufacturer, size and compound, nothing the record lacks', () => {
  expect(primerStrip(record, 'Demo Primers').map((i) => [i.icon, i.label])).toEqual([
    ['manufacturer', 'Manufacturer'],
    ['form', 'Size'],
    ['material', 'Priming compound'],
  ])
  const { compound, ...bare } = record
  expect(primerStrip(bare).map((i) => i.label)).toEqual(['Size'])
})

it('the properties hold the number, flag, cup, use and published figures', () => {
  const labels = primerRowGroups(record).flatMap((g) =>
    g.rows.map((r) => say(translator().t, r.label)),
  )
  expect(labels).toEqual([
    'Product number',
    'Magnum',
    'Cup material',
    'Cup thickness',
    'Intended use',
    'Drop height',
  ])
  const { productNumber, magnum, cup, intendedUse, performance, ...least } = record
  expect(primerRowGroups(least).flatMap((g) => g.rows)).toEqual([])
})
