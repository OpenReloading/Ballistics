import type { Load } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import { type ComponentKind, componentRefs, loadSummary } from '../src/lib/range-entry.ts'
import { presetUnits } from '../src/lib/units.ts'

const metric = presetUnits('metric-grams')
const names: Record<string, string> = {
  'cartridges catalogue:308-win': '308 Win.',
  'bullets user:5b0f1a2e-3c4d-4e5f-8a9b-0c1d2e3f4a5b': 'Demo 168 gr HPBT',
  'powders catalogue:demo-powder-dp40': 'DP40',
  'primers catalogue:demo-primer-large-rifle': 'Large Rifle Demo',
}
const nameOf = (kind: ComponentKind, ref: string) => names[`${kind} ${ref}`]
const summary = (load: Partial<Load>, f = nameOf) =>
  loadSummary({ origin: 'user', ...load } as Load, f, metric, english.t)

const full: Partial<Load> = {
  cartridge: 'catalogue:308-win',
  bullet: 'user:5b0f1a2e-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  powder: 'catalogue:demo-powder-dp40',
  charge: { value: 2.9 },
  primer: { record: 'catalogue:demo-primer-large-rifle' },
  seating: { by: 'overallLength', value: { value: 71.12 } },
}

it('names the cartridge and bullet, then the powder with its charge, the primer and the COAL', () => {
  expect(summary(full)).toEqual([
    '308 Win., Demo 168 gr HPBT',
    'DP40 2.90 g, Large Rifle Demo, COAL 71.12 mm',
  ])
})

it('leaves out the primer the load does not have, and names a seating by base to ogive CBTO', () => {
  const { primer: _, ...noPrimer } = full
  expect(summary({ ...noPrimer, seating: { by: 'baseToOgive', value: { value: 55 } } })).toEqual([
    '308 Win., Demo 168 gr HPBT',
    'DP40 2.90 g, CBTO 55.00 mm',
  ])
  const { seating: __, ...unseated } = noPrimer
  expect(summary(unseated)).toEqual(['308 Win., Demo 168 gr HPBT', 'DP40 2.90 g'])
})

it('leaves out a reference whose name is not known (offline), and an empty line', () => {
  expect(summary(full, () => undefined)).toEqual(['2.90 g, COAL 71.12 mm'])
  expect(summary({}, () => undefined)).toEqual([])
})

it('names a described bullet and powder of a measured load with their manufacturers where known', () => {
  const described = {
    bullet: {
      manufacturer: 'catalogue:demo-bullets',
      model: 'HPBT Match',
      bulletMass: { value: 10.89 },
    },
    powder: { manufacturer: 'catalogue:demo-powder', name: 'DP40' },
  } as Partial<Load>
  const makers: Record<string, string> = {
    'manufacturers catalogue:demo-powder': 'Demo Powder Co.',
  }
  expect(summary(described, (kind, ref) => makers[`${kind} ${ref}`])).toEqual([
    'HPBT Match 10.89 g',
    'Demo Powder Co. DP40',
  ])
  expect(componentRefs({ origin: 'user', ...described } as Load)).toEqual([
    ['manufacturers', 'catalogue:demo-bullets'],
    ['manufacturers', 'catalogue:demo-powder'],
  ])
})

it('asks for the names of the references only, by the kind of their records', () => {
  expect(componentRefs({ origin: 'user', ...full } as Load)).toEqual([
    ['cartridges', 'catalogue:308-win'],
    ['bullets', 'user:5b0f1a2e-3c4d-4e5f-8a9b-0c1d2e3f4a5b'],
    ['powders', 'catalogue:demo-powder-dp40'],
    ['primers', 'catalogue:demo-primer-large-rifle'],
  ])
  expect(componentRefs({ origin: 'user' } as Load)).toEqual([])
})
