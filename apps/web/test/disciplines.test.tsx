import { MantineProvider } from '@mantine/core'
import { readRecords } from '@open-reloading/data'
import { toSi } from '@open-reloading/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { DisciplineList, FederationList } from '../src/components/discipline-list.tsx'
import { emptyDirectory, readDirectory, writeDirectory } from '../src/lib/directory.ts'
import {
  type DisciplineRecord,
  disciplineDistance,
  disciplineFacetKeys,
  disciplineFacets,
  disciplineGroups,
  disciplineMatches,
  disciplineRow,
  disciplineRuleBook,
  disciplineStrip,
  type FederationRecord,
  federationRow,
  federationScope,
  hostText,
  ruleRows,
} from '../src/lib/disciplines.ts'
import { facetRows } from '../src/lib/facets.ts'
import { defined } from './defined.ts'

// the list renders its tab bar, which reads the route and the router
const route = vi.hoisted(() => ({ path: '/disciplines' }))
vi.mock('next/navigation', () => ({
  usePathname: () => route.path,
  useRouter: () => ({ push: () => {} }),
}))

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
    unit: 'm',
    classes: [
      { id: 'pistol-9mm', name: '9 mm pistol' },
      { id: 'revolver-357-38', name: '.357 and .38 revolver' },
      { id: 'revolver-44', name: '.44 revolver' },
      { id: 'pistol-45', name: '.45 ACP pistol' },
    ],
    // the 150 s stage on the precision face, the 20 s stage on the rapid fire face
    faceIds: expect.arrayContaining(['issf-25m-precision-50m-pistol']),
  })
})

const facets = disciplineFacets(rows, new Map())
const shownBy = (selected: Record<string, string[]>) =>
  facetRows(rows, facets, selected).map((r) => r.id)

it('shows the distance in the unit of the rule book and filters by either unit of a record that states both', () => {
  const both = { distance: 25, unit: 'm/yd' as const }
  expect(disciplineDistance(both)).toBe('25 m / 25 yd')
  expect(disciplineDistance({ distance: 25, unit: 'm' })).toBe('25 m')
  expect(disciplineDistance({ distance: 45.72, unit: 'yd' })).toBe('50 yd')
  const metric = toSi('length', 12700)
  expect(disciplineDistance({ distance: metric, unit: 'm' })).toBe('12.7 m')
  const metricRow = { ...defined(rows[0]), distance: metric, unit: 'm' as const }
  const distFacet = defined(disciplineFacets([metricRow], new Map()).find((f) => f.key === 'dist'))
  expect(distFacet.values(metricRow)).toEqual(['12.7m'])
  const fine = { ...metricRow, distance: toSi('length', 12345) }
  expect(disciplineDistance(fine)).toBe('12.345 m')
  expect(distFacet.values(fine)).toEqual(['12.345m'])
  const bothIds = records.filter((d) => d.distance.unit === 'm/yd').map((d) => d.id)
  expect(bothIds.length).toBeGreaterThan(0)
  const bdmp25 = rows.filter((r) => r.unit === 'm/yd' && r.distance === 25).map((r) => r.id)
  expect(shownBy({ dist: ['25yd'] })).toEqual(bdmp25)
  expect(shownBy({ dist: ['25m'] })).toEqual(expect.arrayContaining(bdmp25))
  expect(
    disciplineStrip(defined(records.find((d) => d.id === bothIds[0])), 'BDMP')[1]?.row,
  ).toMatchObject({
    text: expect.stringMatching(/^\d+ m \/ \d+ yd$/),
  })
})

it('scopes by federation, searches the rest and keeps the federation in the URL', () => {
  const ids = (over: object) =>
    rows.filter((r) => disciplineMatches(r, { ...emptyDirectory, ...over })).map((r) => r.id)
  expect(ids({})).toHaveLength(records.length)
  const dsb = records.filter((d) => d.federation === 'dsb').map((d) => d.id)
  expect(shownBy({ org: ['DSB'] })).toEqual(dsb)
  expect(ids({ query: '.44 revolver' })).toContain(pistol.id)
  expect(ids({ query: '2.53' })).toEqual([pistol.id])
  const state = { ...emptyDirectory, facets: { org: ['DSB'] } }
  const url = writeDirectory(state, '')
  expect(url).toBe('?org=DSB')
  expect(readDirectory(url, disciplineFacetKeys)).toMatchObject(state)
})

it('renders the discipline list: one row per discipline linking its page, no federation button', () => {
  const out = renderToStaticMarkup(
    <MantineProvider>
      <DisciplineList items={rows} faces={[]} />
    </MantineProvider>,
  )
  expect(out).toContain(`${records.length} disciplines`)
  expect(out).toContain(`href="/disciplines/${pistol.id}"`)
  expect(out).not.toContain('href="/federations"')
  // under the Database tab bar, the Disciplines tab selected
  expect(out).toMatch(/role="tablist"[^>]*aria-label="Database"/)
  expect(out).toMatch(/aria-selected="true"[^>]*>(?:<[^>]+>)*Disciplines/)
})

it('gives the strip, the number, section, page and caliber classes, and the rule book with its page', () => {
  expect(disciplineStrip(pistol, 'DSB').map((i) => [i.label, i.row.text])).toEqual([
    ['Federation', 'DSB'],
    ['Distance', '25 m'],
  ])
  const rowsOf = defined(disciplineGroups(pistol, classes)[0]).rows
  expect(rowsOf.map((r) => r.label)).toEqual([
    'Number',
    'Section',
    'Page',
    'Caliber classes',
    'Caliber classes from',
  ])
  expect(defined(rowsOf[3]).text).toBe(
    '9 mm pistol, .357 and .38 revolver, .44 revolver, .45 ACP pistol',
  )
  expect(disciplineRuleBook(pistol)).toMatchObject({
    title: 'Sportordnung des Deutschen Schützenbundes, Stand 01.01.2027',
    section: '2.21',
    page: 'Teil 2 Seite 20, PDF p. 156',
  })
})

it('counts per federation its disciplines and renders the list with the tabs and the homepage link', () => {
  const dsb = federationRecords.find((f) => f.id === 'dsb') as FederationRecord
  const scope = federationScope('dsb', summaries, mappings)
  expect(scope.faces).toContain('issf-25m-precision-50m-pistol')
  expect(federationRow(dsb, summaries)).toEqual({
    id: 'dsb',
    name: 'Deutscher Schützenbund e.V.',
    abbreviation: 'DSB',
    country: 'DE',
    disciplines: scope.disciplines.length,
    website: 'https://www.dsb.de/',
  })
  const { website, ...bare } = dsb
  expect(federationRow(bare, summaries)).not.toHaveProperty('website')
  const items = federationRecords.map((f) => federationRow(f, summaries))
  route.path = '/federations'
  expect(items.find((r) => r.id === 'issf')?.country).toBe('International')
  const out = renderToStaticMarkup(
    <MantineProvider>
      <FederationList items={items} />
    </MantineProvider>,
  )
  expect(out).toContain(`${federationRecords.length} federations`)
  expect(out).toContain('All federations')
  expect(out).not.toContain('Federations, ')
  expect(out).toContain('href="/federations/dsb"')
  expect(out).not.toContain('href="/disciplines"')
  expect(out).toMatch(/role="tablist"[^>]*aria-label="Database"/)
  expect(out).toMatch(/aria-selected="true"[^>]*>(?:<[^>]+>)*Federations/)
  // the homepage link: the host as its name, no new window, no referrer
  expect(out).toMatch(
    /<a href="https:\/\/www\.dsb\.de\/"[^>]*rel="noopener noreferrer"[^>]*>dsb\.de<\/a>/,
  )
})

it('names a homepage by its host without www', () => {
  expect(hostText('https://www.issf-sports.org/')).toBe('issf-sports.org')
  expect(hostText('https://example.org/a/b')).toBe('example.org')
})

it('shows the rule facts a record states, converted where the unit differs, and nothing where it states none', () => {
  expect(ruleRows(undefined)).toEqual([])
  expect(disciplineGroups(pistol, classes).filter((g) => g.title === 'Rules')).toHaveLength(
    pistol.rules ? 1 : 0,
  )
  const rows = ruleRows({
    firearm: 'long-gun',
    actions: ['single-shot', 'semi-automatic'],
    positions: ['prone'],
    supports: ['freehand', 'sling'],
    sights: ['aperture'],
    maxMagnification: { value: 4 },
    minTriggerWeight: { value: 1500 },
    maxBarrelLength: { value: 762 },
    ammunition: {
      handloads: false,
      minMuzzleEnergy: { value: 200 },
      bulletTypes: ['hollow-point'],
    },
    sighters: 'unlimited',
    seriesShots: 10,
    timeLimits: [
      { duration: { value: 1800, raw: '30 min' }, covers: 'discipline', includesSighters: true },
      { duration: { value: 90 }, covers: 'series' },
    ],
  })
  const text = (label: string) => rows.filter((r) => r.label === label).map((r) => r.text)
  expect(text('Firearm')).toEqual(['Long gun'])
  expect(text('Actions')).toEqual(['single shot, semi automatic'])
  expect(text('Magnification up to')).toEqual(['4×'])
  expect(text('Handloads')).toEqual(['Not allowed'])
  expect(text('Bullets')).toEqual(['hollow point'])
  expect(text('Sighters')).toEqual(['Any number'])
  expect(text('Time limit')).toEqual([
    '30 min for the discipline, sighters included',
    '90 s per series',
  ])
  expect(rows.find((r) => r.label === 'Trigger weight from')?.value).toEqual({
    quantity: 'mass',
    si: 1.5,
  })
  expect(rows.find((r) => r.label === 'Barrel length up to')?.value?.si).toBeCloseTo(0.762)
})
