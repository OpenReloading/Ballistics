import { readdirSync } from 'node:fs'
import { MantineProvider } from '@mantine/core'
import type { TargetMapping } from '@open-reloading/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { TargetFaceDrawing } from '../src/components/target-face-drawing.tsx'
import { TargetFaceList } from '../src/components/target-face-list.tsx'
import { translator } from '../src/i18n/translate.ts'
import { facetOptions, facetRows } from '../src/lib/facets.ts'
import {
  faceEventRows,
  faceFacets,
  targetFaceGroups,
  targetFaceMatches,
  targetFaceRow,
  targetFaceStrip,
  userFaceRows,
} from '../src/lib/target-faces.ts'
import { say } from '../src/lib/wording.ts'
import { defined, missing } from './defined.ts'
import { faceById, faces } from './face-render.ts'
import { readRecord } from './read-record.ts'

// the list renders its tab bar, which reads the route and the router
vi.mock('next/navigation', () => ({
  usePathname: () => '/targets',
  useRouter: () => ({ push: () => {} }),
}))

const mappings = readdirSync(
  new URL('../../../packages/data/records/target-mappings/', import.meta.url),
)
  .sort()
  .map((f) => readRecord<TargetMapping>(`target-mappings/${f}`))
const rows = faces.map((f) => targetFaceRow(f, mappings))
const precision = faceById('issf-25m-precision-50m-pistol')

it('lists every face with its distances, outer diameter, rings and the disciplines mapped to it', () => {
  const row = targetFaceRow(precision, mappings)
  expect(row).toMatchObject({ organization: 'ISSF', outer: 500, rings: 10 })
  expect(row.distances).toEqual([20, 25, 50, 100, 300])
  const mapped = new Set(mappings.filter((m) => m.face === precision.id).map((m) => m.discipline))
  expect(mapped).toContain('dsb-25m-pistole-revolver')
  expect(row.disciplines).toBe(mapped.size)
  expect(rows.every((r) => r.rings >= 2 && (r.outer ?? 0) > 0)).toBe(true)
})

it('filters by federation, discipline, event distance and ring count, each count over the others', () => {
  const facets = faceFacets(new Map([['dsb-25m-pistole-revolver', 'DSB 25 m Pistole/Revolver']]))
  const ids = (selected: Record<string, string[]>) =>
    facetRows(rows, facets, selected).map((r) => r.id)
  expect(ids({ org: ['ISSF'], rings: ['10'] })).toContain(precision.id)
  expect(ids({ discipline: ['dsb-25m-pistole-revolver'] })).toContain(precision.id)
  expect(ids({ dist: ['25 m'] })).toContain(precision.id)
  expect(ids({ dist: ['25 m'], org: ['no-such'] })).toEqual([])
  const options = facetOptions(rows, rows, facets, { org: ['ISSF'] })
  const dist = defined(options.get('dist'))
  expect(dist.find((o) => o.value === '25 m')).toMatchObject({ text: '25 m' })
  // the federation's own count ignores its choice; the distances count within ISSF
  const issf = rows.filter((r) => r.organization === 'ISSF')
  expect(defined(options.get('org')).find((o) => o.value === 'ISSF')?.count).toBe(issf.length)
  expect(dist.find((o) => o.value === '25 m')?.count).toBe(
    issf.filter((r) => r.distances.includes(25)).length,
  )
})

it('searches names, federations and event names', () => {
  const ids = (query: string) => rows.filter((r) => targetFaceMatches(r, query)).map((r) => r.id)
  // a federation's name also matches the faces whose events name its disciplines
  expect(ids('DSB')).toEqual(
    expect.arrayContaining(faces.filter((f) => f.organization === 'DSB').map((f) => f.id)),
  )
  expect(ids('Pistole/Revolver')).toEqual([precision.id, 'issf-25m-rapid-fire-pistol'])
  expect(ids('')).toHaveLength(faces.length)
})

it('renders the list: one row per face linking its page, the outer diameter in the preset unit', () => {
  const out = renderToStaticMarkup(
    <MantineProvider>
      <TargetFaceList items={rows} disciplines={[]} />
    </MantineProvider>,
  )
  expect(out).toContain(`${faces.length} targets`)
  expect(out).toContain(`href="/targets/${precision.id}"`)
  expect(out).toContain('500.00')
})

it('gives the strip, then the scoring values and the ring diameters outer to inner with the inner ten', () => {
  const { t } = translator()
  expect(targetFaceStrip(precision, t).map((i) => i.label)).toEqual([
    'Federation',
    'Distance',
    'Outer diameter',
    'Black area',
    'Rings',
  ])
  const [face = missing(), rings = missing()] = targetFaceGroups(precision, t)
  expect(face.rows.find((r) => say(t, r.label) === 'Numerals printed')?.text).toBe('Yes')
  expect(face.rows.find((r) => say(t, r.label) === 'Tenth-ring values')?.text).toBe('Yes')
  const unstated = {
    ...precision,
    decimal: undefined,
    numerals: undefined,
    innerTen: { diameter: { value: 25 } },
  }
  const stated = ['Inner ten rule', 'Tenth-ring values', 'Numerals printed']
  expect(
    defined(targetFaceGroups(unstated, t)[0])
      .rows.filter((r) => stated.includes(say(t, r.label)))
      .map((r) => r.text),
  ).toEqual(['Not stated', 'Not stated', 'Not stated'])
  expect(rings.rows.map((r) => say(t, r.label))).toEqual([
    ...precision.rings.map((r) => `Ring ${r.value}`),
    'Inner ten',
  ])
  expect(defined(rings.rows[0]).value).toEqual({ quantity: 'length', si: 0.5 })
})

it('gives one row per face event: its discipline where a mapping names it, else the event', () => {
  const rows = faceEventRows(
    precision,
    mappings.filter((m) => m.face === precision.id),
    [
      {
        id: 'dsb-25m-pistole-revolver',
        federation: 'dsb',
        name: '25 m Pistole/Revolver',
        number: '2.53/2.59/2.55/2.58',
        distanceMm: 25000,
      },
    ],
    [{ id: 'dsb', name: 'Deutscher Schützenbund', abbreviation: 'DSB' }],
  )
  expect(rows).toHaveLength(precision.events.length)
  expect(rows.find((r) => r.discipline === '25 m Pistole/Revolver')).toEqual({
    id: 'dsb-25m-pistole-revolver-issf-25m-precision-50m-pistol',
    disciplineId: 'dsb-25m-pistole-revolver',
    federation: 'DSB',
    number: '2.53/2.59/2.55/2.58',
    discipline: '25 m Pistole/Revolver',
    stage: '150 Sek. Serie',
    distance: { raw: '25 m', metres: 25 },
    shotCount: 20,
    scoring: 'touch',
    section: '0.20 Scheibe Nr. 4',
  })
  // an event no listed discipline maps keeps its name, its organization and its gauge
  expect(rows.find((r) => r.discipline === '50m Pistol')).toMatchObject({
    federation: 'ISSF',
    distance: { raw: '50m' },
    gauge: 5.6,
  })
  // an event without its section takes the page the mapping cites
  expect(rows.find((r) => r.id === 'issf-50m-pistol-issf-25m-precision-50m-pistol')?.section).toBe(
    'Rule 3.3.1, p. 39 (PDF p. 39), rule 6.3.4.5, p. 199 (PDF p. 199)',
  )
  expect(rows.find((r) => r.discipline === 'BDMP PFG 1 Perkussions-Freigewehr 1')?.scoring).toBe(
    'centre',
  )
})

it('keeps an event without a mapping and one row per mapping of an event mapped twice', () => {
  const [a = missing(), b = missing()] = precision.events
  const twice = [
    { id: 'x', discipline: 'x', event: a.id },
    { id: 'y', discipline: 'y', event: a.id },
  ]
  const rows = faceEventRows({ organization: 'ISSF', events: [a, b] }, twice, [], [])
  expect(rows.map((r) => [r.id, r.discipline])).toEqual([
    [b.id, b.name],
    ['x', a.name],
    ['y', a.name],
  ])
})

it('draws the face: the black area, a line per ring and the inner ten, white inside the black', () => {
  const out = renderToStaticMarkup(<TargetFaceDrawing face={precision} />)
  expect(out).toContain('viewBox="-260 -260 520 520"')
  expect(out).toContain('<ellipse rx="100" ry="100" fill="black"')
  const lines = [...out.matchAll(/<ellipse rx="([\d.]+)"[^>]*stroke="(\w+)"/g)]
  expect(lines).toHaveLength(precision.rings.length + 1)
  for (const [, r, colour] of lines) expect(colour).toBe(Number(r) <= 100 ? 'white' : 'black')
})

it('draws recorded zone colours: a white ten inside a black ring, its lines white on the black', () => {
  const out = renderToStaticMarkup(<TargetFaceDrawing face={faceById('vdrbw-bw-nr2')} />)
  expect(out).toContain('<ellipse rx="50" ry="50" fill="white"')
  expect(out).toContain('<ellipse rx="100" ry="100" fill="black"')
  const stroke = (rx: number) =>
    out.match(new RegExp(`<ellipse rx="${rx}"[^>]*stroke="(\\w+)"`))?.[1]
  expect([stroke(150), stroke(100), stroke(50)]).toEqual(['black', 'white', 'white'])
})

it('draws a square ring as a rectangle of its edge and a circle ring as an ellipse', () => {
  const [outer = missing(), inner = missing()] = precision.rings.slice(0, 2)
  const rings = [{ ...outer, shape: 'square' as const }, inner]
  const out = renderToStaticMarkup(<TargetFaceDrawing face={{ ...precision, rings }} />)
  const edge = outer.diameter.value
  expect(out).toContain(`<rect x="${-edge / 2}" y="${-edge / 2}" width="${edge}" height="${edge}"`)
  expect(out).toContain(`<ellipse rx="${inner.diameter.value / 2}"`)
})

it('orders the discipline rows by federation, then the federation code, then distance', () => {
  const [a] = precision.events
  const event = (name: string, metres: number) => ({
    ...a,
    id: name,
    name,
    distance: { value: metres * 1000 },
  })
  const events = [event('e1', 25), event('e2', 50), event('e3', 25), event('e4', 25)]
  const disciplines = [
    { id: 'd1', federation: 'bds', name: 'Hoch', number: '73xx', distanceMm: 25000 },
    { id: 'd2', federation: 'bds', name: 'Tief', number: '4110', distanceMm: 25000 },
    { id: 'd3', federation: 'dsb', name: 'Drei', number: '1.37/1.51', distanceMm: 50000 },
    { id: 'd4', federation: 'dsb', name: 'Zwei', number: '1.9', distanceMm: 25000 },
  ]
  const rows = faceEventRows(
    { organization: 'ISSF', events },
    events.map((e, i) => ({ id: `m${i}`, discipline: `d${i + 1}`, event: e.id })),
    disciplines,
    [
      { id: 'bds', name: 'BDS', abbreviation: 'BDS' },
      { id: 'dsb', name: 'DSB', abbreviation: 'DSB' },
    ],
  )
  expect(rows.map((r) => r.discipline)).toEqual(['Tief', 'Hoch', 'Zwei', 'Drei'])
})

it("lists the browser's face designs as Mine rows, the outer width absent while the first ring has none", () => {
  const saved = '2026-10-26T10:00:00.000Z'
  const [drawn, blank] = userFaceRows([
    {
      kind: 'targetFaceDesign',
      id: 'f1',
      name: 'Club face',
      saved,
      data: {
        rings: [{ value: 1, diameter: 400 }, { value: 2 }],
        events: [
          { name: 'Club 50', distance: 50000 },
          { name: 'Club 25', distance: 25000 },
          { name: 'Again', distance: 50000 },
          { name: '' },
        ],
      },
    },
    { kind: 'targetFaceDesign', id: 'f2', name: 'Draft', saved, data: { rings: [], events: [] } },
  ])
  expect(drawn).toMatchObject({
    id: 'user:f1',
    origin: 'user',
    organization: '',
    distances: [25, 50],
    outer: 400,
    rings: 2,
    disciplines: 0,
  })
  expect(defined(blank).outer).toBeUndefined()
  // no empty Federation option from the designs
  const org = defined(faceFacets(new Map()).find((f) => f.key === 'org'))
  expect(org.values(defined(drawn))).toEqual([])
})
