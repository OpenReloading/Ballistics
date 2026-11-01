import type { Load } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import { type ComponentKind, componentRefs, loadSummary } from '../src/lib/range-entry.ts'
import { presetUnits } from '../src/lib/units.ts'

const metric = presetUnits('metric-grams')
const names: Record<string, string> = {
  'cartridges catalogue:308-win': '308 Win.',
  'bullets user:5b0f1a2e-3c4d-4e5f-8a9b-0c1d2e3f4a5b': 'Demo 168 gr HPBT',
  'powders catalogue:vihtavuori-n140': 'N140',
  'primers catalogue:cci-br2': 'CCI BR2',
}
const nameOf = (kind: ComponentKind, ref: string) => names[`${kind} ${ref}`]
const summary = (load: Partial<Load>, f = nameOf) =>
  loadSummary({ origin: 'user', ...load } as Load, f, metric, english.t)

const full: Partial<Load> = {
  cartridge: 'catalogue:308-win',
  bullet: 'user:5b0f1a2e-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  powder: 'catalogue:vihtavuori-n140',
  charge: { value: 2.9 },
  primer: { record: 'catalogue:cci-br2' },
  seating: { by: 'overallLength', value: { value: 71.12 } },
}

it('names the cartridge and bullet, then the powder with its charge, the primer and the COAL', () => {
  expect(summary(full)).toEqual([
    '308 Win., Demo 168 gr HPBT',
    'N140 2.90 g, CCI BR2, COAL 71.12 mm',
  ])
})

it('leaves out the primer and the COAL the load does not have, and a COAL given as base to ogive', () => {
  const { primer: _, ...noPrimer } = full
  expect(summary({ ...noPrimer, seating: { by: 'baseToOgive', value: { value: 55 } } })).toEqual([
    '308 Win., Demo 168 gr HPBT',
    'N140 2.90 g',
  ])
})

it('leaves out a reference whose name is not known (offline), and an empty line', () => {
  expect(summary(full, () => undefined)).toEqual(['2.90 g, COAL 71.12 mm'])
  expect(summary({}, () => undefined)).toEqual([])
})

it('names a described bullet and powder of a measured load without a record', () => {
  expect(
    summary({
      bullet: { model: 'HPBT Match', bulletMass: { value: 10.89 } },
      powder: { name: 'N140' },
    } as Partial<Load>),
  ).toEqual(['HPBT Match 10.89 g', 'N140'])
})

it('asks for the names of the references only, by the kind of their records', () => {
  expect(componentRefs({ origin: 'user', ...full } as Load)).toEqual([
    ['cartridges', 'catalogue:308-win'],
    ['bullets', 'user:5b0f1a2e-3c4d-4e5f-8a9b-0c1d2e3f4a5b'],
    ['powders', 'catalogue:vihtavuori-n140'],
    ['primers', 'catalogue:cci-br2'],
  ])
  expect(componentRefs({ origin: 'user', powder: { name: 'N140' } } as unknown as Load)).toEqual([])
})
