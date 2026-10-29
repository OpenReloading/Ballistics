import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import {
  maxReportChars,
  type Report,
  reportArea,
  reportAreas,
  reportFieldLabels,
  reportFields,
  reportRecord,
  reportSent,
  reportTemplate,
  reportTitle,
  reportTypes,
  reportUrl,
  sheetSettings,
  shotPositions,
} from '../src/lib/report-issue.ts'
import { defined } from './defined.ts'

const repo = 'https://github.com/OpenReloading/Ballistics'
const report: Report = {
  area: 'Workbench',
  type: 'Bug',
  what: '',
  context: {
    path: '/workbench',
    title: 'Workbench | OpenReloading',
    version: '0.0.1',
    userAgent: 'Test browser',
    window: '1280 x 800',
    colourScheme: 'dark',
    units: 'Metric (SI)',
  },
  blocks: [],
}
const params = (url: string) => new URL(url).searchParams

it('maps every route group to its area, designers before their lists', () => {
  const cases: [string, string][] = [
    ['/workbench', 'Workbench'],
    ['/groups', 'Shot groups'],
    ['/session', 'Session summary'],
    ['/cartridges', 'Cartridges'],
    ['/cartridges/308-win', 'Cartridges'],
    ['/cartridges/designer', 'Cartridge designer'],
    ['/bullets/designer', 'Bullet designer'],
    ['/bullets/compare', 'Bullets'],
    ['/bullets/x', 'Bullets'],
    ['/powders/burn-rates', 'Powders'],
    ['/cases/demo-case-308-brass', 'Brass'],
    ['/primers/demo-primer-large-rifle', 'Primers'],
    ['/targets/issf-25m-precision-50m-pistol', 'Targets'],
    ['/disciplines/dsb-25m-pistole-revolver', 'Disciplines'],
    ['/federations/dsb', 'Federations'],
    ['/firearms', 'Firearms'],
    ['/my-cases', 'Brass'],
    ['/', 'Other'],
    ['/offline', 'Other'],
    ['/workbenchx', 'Other'],
  ]
  for (const [route, area] of cases) expect(reportArea(route), route).toBe(area)
})

it('names the record of a record page only', () => {
  expect(reportRecord('/targets/issf-25m-precision-50m-pistol')).toEqual({
    kind: 'target',
    id: 'issf-25m-precision-50m-pistol',
  })
  expect(reportRecord('/cartridges/a%20b')).toEqual({ kind: 'cartridge', id: 'a b' })
  expect(reportRecord('/cartridges/a%zz')).toEqual({ kind: 'cartridge', id: 'a%zz' })
  for (const r of ['/cartridges', '/cartridges/designer', '/bullets/compare', '/workbench'])
    expect(reportRecord(r)).toBeUndefined()
})

it('titles a report by area and type, then the first line of the text or the page title', () => {
  expect(reportTitle(report)).toBe('Report: Workbench: Bug: Workbench | OpenReloading')
  expect(reportTitle({ ...report, type: 'Idea', what: ' Chart axis\nmore' })).toBe(
    'Report: Workbench: Idea: Chart axis',
  )
})

it('writes the context always and a block only when ticked', () => {
  const fields = reportFields(report)
  expect(fields.what).toBe('')
  expect(fields.data).toBe('')
  for (const line of [
    '- Type: Bug',
    '- Area: Workbench',
    '- Page: /workbench (Workbench | OpenReloading)',
    '- Version: 0.0.1',
    '- Browser: Test browser',
    '- Window: 1280 x 800',
    '- Colour scheme: dark',
    '- Units: Metric (SI)',
  ])
    expect(fields.context).toContain(line)
  expect(fields.context).not.toContain('Record:')
  const withRecord = reportFields({
    ...report,
    what: ' A chart \n',
    context: { ...report.context, record: { kind: 'cartridge', id: '308-win', name: '308 Win.' } },
    blocks: [
      { heading: 'Current load', text: 'https://x/workbench#a=1' },
      { heading: 'Sheet settings', text: 'Groups: 1' },
    ],
  })
  expect(withRecord.what).toBe('A chart')
  expect(withRecord.context).toContain('- Record: cartridge `308-win`, 308 Win.')
  expect(withRecord.data).toBe(
    '#### Current load\n\nhttps://x/workbench#a=1\n\n#### Sheet settings\n\nGroups: 1',
  )
})

it('fills the issue form by field id, without labels', () => {
  const what = 'Präzision & #1 = 50%?'
  expect(reportUrl(`${repo}///`, report).startsWith(`${repo}/issues/new?`)).toBe(true)
  const url = reportUrl(`${repo}/`, { ...report, type: 'Wrong data', area: 'Shot groups', what })
  expect(url.startsWith(`${repo}/issues/new?template=${reportTemplate}&title=`)).toBe(true)
  expect(url).not.toContain(' ')
  const p = params(url)
  expect(p.get('title')).toBe(`Report: Shot groups: Wrong data: ${what}`)
  expect(p.get('report-type')).toBe('Wrong data')
  expect(p.get('area')).toBe('Shot groups')
  expect(p.get('what')).toBe(what)
  expect(p.get('context')).toContain('- Area: Shot groups')
  expect(p.get('data')).toBe('')
  expect(p.has('body')).toBe(false)
  expect(p.has('labels')).toBe(false)
  expect(reportSent(url)).toMatch(
    /^### What happened\n\nPräzision & #1 = 50%\?\n\n### Context\n\n- Type/,
  )
  expect(reportSent(url)).not.toContain('### Data')
})

it('keeps the link under the limit: leaves out the last ticked block, then cuts the text, and says so', () => {
  const blocks = [
    { heading: 'Sheet settings', text: 'Groups: 1' },
    { heading: 'Current load', text: `https://x/workbench#${'a'.repeat(8000)}` },
  ]
  const url = reportUrl(repo, { ...report, blocks })
  expect(url.length).toBeLessThanOrEqual(maxReportChars)
  const p = params(url)
  expect(p.get('data')).toBe('#### Sheet settings\n\nGroups: 1')
  expect(p.get('context')).toContain(
    'Current load left out: the link would be longer than 7000 characters.',
  )

  const long = reportUrl(repo, { ...report, what: 'ü'.repeat(5000), blocks })
  expect(long.length).toBeLessThanOrEqual(maxReportChars)
  expect(long.length).toBeGreaterThan(maxReportChars - 20)
  const cut = params(long)
  expect(cut.get('what')).toMatch(/^ü+$/)
  expect(cut.get('context')).toContain(
    'The text was cut: the link would be longer than 7000 characters.',
  )
  expect(cut.get('context')).toContain('Sheet settings left out')
  expect(cut.get('context')).toContain('- Units: Metric (SI)')
})

it('matches the issue form: its dropdown options and field ids', () => {
  const form = readFileSync(
    new URL(`../../../.github/ISSUE_TEMPLATE/${reportTemplate}`, import.meta.url),
    'utf8',
  )
  const options = (id: string) =>
    defined(
      form
        .split(/^ {2}- type: /m)
        .find((f) => f.includes(`\n    id: ${id}\n`))
        ?.split('options:\n')[1]
        ?.split('\n    validations:')[0],
    )
      .split('\n')
      .filter(Boolean)
      .map((l) => l.replace(/^ +- /, ''))
  expect(options('report-type')).toEqual([...reportTypes])
  expect(options('area')).toEqual([...reportAreas])
  for (const [id, label] of Object.entries(reportFieldLabels))
    expect(form).toContain(`id: ${id}\n    attributes:\n      label: ${label}\n`)
  expect(form).toMatch(/^labels: \[user-report\]$/m)
})

it('cuts title and text on code points and encodes a lone surrogate without throwing', () => {
  const title = reportTitle({ ...report, what: `${'a'.repeat(98)}\u{1F600}\u{1F600}\u{1F600}` })
  expect(title.endsWith(`${'a'.repeat(98)}\u{1F600}…`)).toBe(true)
  const url = reportUrl(repo, { ...report, what: '\u{1F600}'.repeat(4000) })
  expect(url.length).toBeLessThanOrEqual(maxReportChars)
  expect(params(url).get('what')).not.toContain('\uFFFD')
  expect(params(reportUrl(repo, { ...report, what: 'a\uD83D' })).get('title')).toContain('a\uFFFD')
})

const sheet = {
  groups: [
    {
      id: 'g1',
      name: 'Group 1',
      colour: '#000000',
      distance: 25,
      shots: [
        { x: 0.0012, y: -0.0034, placement: 'placed' as const },
        { x: 0, y: 0.01, excluded: true, placement: 'placed' as const },
      ],
      face: { id: 'issf-25m-precision-50m-pistol', event: 'DSB 25 m Pistole Präzision' },
    },
    { id: 'g2', name: 'Group 2', colour: '#ff0000', distance: 91.44, shots: [] },
  ],
}

it('gives the sheet settings without shot coordinates, the positions only on their own', () => {
  const data = {
    federations: [{ id: 'dsb', name: 'Deutscher Schützenbund', abbreviation: 'DSB' }],
    disciplines: [
      {
        id: 'dsb-25m-pistole',
        federation: 'dsb',
        name: '25 m Pistole',
        number: '2.40',
        distanceMm: 25000,
      },
    ],
    mappings: [
      {
        id: 'm',
        discipline: 'dsb-25m-pistole',
        face: 'issf-25m-precision-50m-pistol',
        event: 'DSB 25 m Pistole Präzision',
      },
    ],
  }
  const settings = sheetSettings(sheet, data)
  expect(settings).toBe(
    [
      'Groups: 2',
      '',
      '- Group 1: 25 m, target `issf-25m-precision-50m-pistol`, event "DSB 25 m Pistole Präzision", discipline 2.40 25 m Pistole (`dsb-25m-pistole`), federation DSB, 2 shots',
      '- Group 2: 91.44 m, no target, 0 shots',
    ].join('\n'),
  )
  expect(sheetSettings(sheet)).not.toContain('discipline')
  expect(shotPositions(sheet)).toBe(
    [
      '```',
      'group\tshot\tx mm\ty mm',
      'Group 1\t1\t1.2\t-3.4',
      'Group 1\t2\t0.0\t10.0\texcluded',
      '```',
    ].join('\n'),
  )
})
