import { setupI18n } from '@lingui/core'
import type { Primer } from '@rangefoundry/schema'
import { expect, it } from 'vitest'
import { linguiOf } from '../src/i18n/lingui.ts'
import { translator } from '../src/i18n/translate.ts'
import type { PrimerSummary } from '../src/lib/api-types.ts'
import { primerMatches, primerRows } from '../src/lib/primer-rows.ts'
import { primerRowGroups, primerStrip } from '../src/lib/record-fields.ts'
import { say } from '../src/lib/wording.ts'
import { defined } from './defined.ts'

const summary: PrimerSummary = {
  id: 'example-primer-lr',
  manufacturer: 'example-primers',
  name: 'Large Rifle Example',
  productNumber: 'DP-LR',
  size: 'large-rifle',
  magnum: false,
  compound: 'lead-free',
}

const names = new Map([['example-primers', 'Example Primers']])
const aliases = new Map([['example-primers', ['Old Example']]])
const rows = primerRows([summary], names, aliases)

it('puts the manufacturer name on each row, empty while it is unknown', () => {
  expect(defined(rows[0])).toMatchObject({
    manufacturerName: 'Example Primers',
    manufacturerAliases: ['Old Example'],
  })
  expect(primerRows([summary], new Map(), new Map())[0]).toMatchObject({ manufacturerName: '' })
})

it('searches manufacturer, its aliases, name, product number, size and compound, every word', () => {
  const row = defined(rows[0])
  for (const q of [
    'example primers',
    'old example',
    'dp-lr',
    'large rifle',
    'lead free',
    'primers lead',
  ])
    expect(primerMatches(row, q), q).toBe(true)
  expect(primerMatches(row, 'pistol')).toBe(false)
  expect(primerMatches(row, 'dp-lr magnum')).toBe(false)
})

const record: Primer = {
  id: 'example-primer-lr',
  manufacturer: 'example-primers',
  name: 'Large Rifle Example',
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
  expect(primerStrip(record, 'Example Primers').map((i) => [i.icon, i.label])).toEqual([
    ['manufacturer', 'Manufacturer'],
    ['form', 'Size'],
    ['material', 'Priming compound'],
  ])
  const { compound, ...bare } = record
  expect(primerStrip(bare).map((i) => i.label)).toEqual(['Size'])
})

it('the properties hold the number, flag, cup, use and published figures', () => {
  const labels = primerRowGroups(record).flatMap((g) =>
    g.rows.map((r) => say(linguiOf('en'), translator().t, r.label)),
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

it('also finds a primer by its size and compound as the language shown writes them', () => {
  const row = defined(rows[0])
  const german = setupI18n({
    locale: 'de',
    messages: { de: { 'values.largeRifle': 'Büchse, groß', 'values.leadFree': 'Bleifrei' } },
  })
  for (const q of ['büchse groß', 'bleifrei']) expect(primerMatches(row, q, german), q).toBe(true)
  expect(primerMatches(row, 'büchse groß')).toBe(false)
})
