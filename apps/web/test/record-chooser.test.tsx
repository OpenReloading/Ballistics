import { expect, it } from 'vitest'
import { bulletKind } from '../src/components/bullet-search-dialog.tsx'
import type { ChooserKind, ChooserRow } from '../src/components/record-chooser.tsx'
import { english } from '../src/i18n/translate.ts'
import type { BulletRow } from '../src/lib/bullet-rows.ts'
import { presetUnits } from '../src/lib/units.ts'

const system = presetUnits('metric-grams')
const { t } = english

/** The head of each column and the cells of `row` under it, the name column first. */
const table = <R extends ChooserRow>(kind: ChooserKind<R>, row: R) => [
  [t(kind.texts.column), row.name],
  ...kind.columns.map((c) => [t(c.label), c.cell(row, system, t)]),
]

const ids = <R extends ChooserRow>(kind: ChooserKind<R>, rows: R[], query: string, sort?: string) =>
  kind.search(rows, query, sort ?? kind.sorts[0]?.value ?? '').map((r) => r.id)

// invented bullets: mass in g (168 gr = 10.886 g), diameter in mm
const bullet = (over: Partial<BulletRow> & Pick<BulletRow, 'id' | 'name'>): BulletRow => ({
  manufacturer: 'acme',
  manufacturerName: 'Acme Bullets',
  diameter: 7.823,
  mass: 10.886,
  length: null,
  ballisticCoefficientG1: null,
  ballisticCoefficientG7: 0.25,
  ...over,
})

it('the bullet chooser shows caliber, mass and BC, ranks the bullet search and says when nothing matches', () => {
  const rows = [
    bullet({ id: 'a-175', name: '30 Cal 175 gr Match', mass: 11.34 }),
    bullet({ id: 'a-168', name: '30 Cal 168 gr Match' }),
    bullet({ id: 'own', origin: 'user', name: 'My 168 gr design', ballisticCoefficientG7: null }),
  ]
  expect(table(bulletKind, rows[1] as BulletRow)).toEqual([
    ['Bullet', '30 Cal 168 gr Match'],
    ['Caliber', '.308'],
    ['Mass', '10.89 g'],
    ['BC', '0.250 G7'],
  ])
  // the browser's design first among equal matches, then the catalogue's
  expect(ids(bulletKind, rows, '168')).toEqual(['own', 'a-168'])
  expect(ids(bulletKind, rows, '', 'mass')).toEqual(['a-175', 'a-168', 'own'])
  expect(ids(bulletKind, rows, 'nothing')).toEqual([])
  expect(t(bulletKind.texts.empty)).toBe('No bullet matches')
})
