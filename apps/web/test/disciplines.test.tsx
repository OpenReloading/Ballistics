import { MantineProvider } from '@mantine/core'
import { readRecords } from '@openreloading/data'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { DisciplineList, FederationList } from '../src/components/discipline-list.tsx'
import { emptyDirectory, readDirectory, writeDirectory } from '../src/lib/directory.ts'
import {
  type DisciplineRecord,
  disciplineGroups,
  disciplineMatches,
  disciplineRow,
  disciplineRuleBook,
  disciplineStrip,
  type FederationRecord,
  federationRow,
  federationScope,
} from '../src/lib/disciplines.ts'

const { bundle } = readRecords()
const records = bundle.disciplines as unknown as DisciplineRecord[]
const federationRecords = bundle.federations as unknown as FederationRecord[]
const federations = bundle.federations
const mappings = bundle.targetMappings
const classes = bundle.caliberClasses.map((c) => ({ id: c.id, name: c.name }))
const summaries = records.map((d) => ({ ...d, distanceMm: d.distance.value }))
const rows = records.map((d) => disciplineRow(d, federations, mappings, classes))
const pistol = records.find((d) => d.id === 'dsb-25m-pistole-revolver') as DisciplineRecord

it('lists a discipline with its federation, distance in m, category, caliber classes and faces', () => {
  expect(disciplineRow(pistol, federations, mappings, classes)).toEqual({
    id: 'dsb-25m-pistole-revolver',
    name: '25 m Pistole/Revolver',
    number: '2.53/2.59/2.55/2.58',
    federation: 'DSB',
    distance: 25,
    classes: [
      { id: 'pistol-9mm', name: '9 mm pistol' },
      { id: 'revolver-357-38', name: '.357 and .38 revolver' },
      { id: 'revolver-44', name: '.44 revolver' },
      { id: 'pistol-45', name: '.45 ACP pistol' },
    ],
    // the 150 s stage on the precision face, the 20 s stage on the rapid fire face
    faces: 2,
  })
})

it('filters by federation, category, distance and caliber class, and keeps them in the URL', () => {
  const ids = (over: object) =>
    rows.filter((r) => disciplineMatches(r, { ...emptyDirectory, ...over })).map((r) => r.id)
  expect(ids({})).toHaveLength(records.length)
  const dsb = records.filter((d) => d.federation === 'dsb').map((d) => d.id)
  expect(ids({ organization: 'DSB' })).toEqual(dsb)
  expect(ids({ organization: 'DSB', distance: '25', caliberClass: 'revolver-44' })).toContain(
    pistol.id,
  )
  expect(ids({ distance: '50', caliberClass: 'revolver-44' })).not.toContain(pistol.id)
  expect(ids({ category: 'air-rifle' })).toEqual(
    records.filter((d) => d.category === 'air-rifle').map((d) => d.id),
  )
  expect(ids({ query: '.44 revolver' })).toContain(pistol.id)
  expect(ids({ query: '2.53' })).toEqual([pistol.id])
  const state = { ...emptyDirectory, category: 'rifle', distance: '300', caliberClass: 'rifle-6mm' }
  const url = writeDirectory(state, '')
  expect(url).toBe('?cat=rifle&dist=300&class=rifle-6mm')
  expect(readDirectory(url)).toMatchObject(state)
})

it('renders the discipline list: one row per discipline linking its page, the federation link', () => {
  const out = renderToStaticMarkup(
    <MantineProvider>
      <DisciplineList items={rows} />
    </MantineProvider>,
  )
  expect(out).toContain(`${records.length} disciplines`)
  expect(out).toContain(`href="/disciplines/${pistol.id}"`)
  expect(out).toContain('href="/federations"')
})

it('gives the strip, the number, section, page and caliber classes, and the rule book with its page', () => {
  expect(disciplineStrip(pistol, 'DSB').map((i) => [i.label, i.row.text])).toEqual([
    ['Federation', 'DSB'],
    ['Distance', '25'],
  ])
  const rowsOf = disciplineGroups(pistol, classes)[0].rows
  expect(rowsOf.map((r) => r.label)).toEqual([
    'Number',
    'Section',
    'Page',
    'Caliber classes',
    'Caliber classes from',
  ])
  expect(rowsOf[3].text).toBe('9 mm pistol, .357 and .38 revolver, .44 revolver, .45 ACP pistol')
  expect(disciplineRuleBook(pistol)).toMatchObject({
    title: 'Sportordnung des Deutschen Schützenbundes, Stand 01.01.2027',
    section: '2.21',
    page: 'Teil 2 Seite 20, PDF p. 156',
  })
})

it('counts per federation its rule books, disciplines and the faces they use, and renders the list', () => {
  const dsb = federationRecords.find((f) => f.id === 'dsb') as FederationRecord
  const scope = federationScope('dsb', summaries, mappings)
  expect(scope.faces).toContain('issf-25m-precision-50m-pistol')
  expect(federationRow(dsb, summaries, mappings)).toEqual({
    id: 'dsb',
    name: 'Deutscher Schützenbund e.V.',
    abbreviation: 'DSB',
    country: 'DE',
    ruleBooks: 1,
    disciplines: scope.disciplines.length,
    faces: scope.faces.length,
  })
  const items = federationRecords.map((f) => federationRow(f, summaries, mappings))
  expect(items.find((r) => r.id === 'issf')?.country).toBe('International')
  const out = renderToStaticMarkup(
    <MantineProvider>
      <FederationList items={items} />
    </MantineProvider>,
  )
  expect(out).toContain(`${federationRecords.length} federations`)
  expect(out).toContain('href="/federations/dsb"')
})
