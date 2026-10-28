import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { FieldPanel, FieldTable, searchGroups } from '../src/components/field-table.tsx'
import { msg } from '../src/i18n/translate.ts'
import type { FieldGroup } from '../src/lib/record-fields.ts'

// outside a UnitsProvider the table shows the first render's preset, Metric with grains
const html = (groups: FieldGroup[], labelledBy?: string) =>
  renderToStaticMarkup(
    <MantineProvider>
      <FieldTable caption={msg('Data')} labelledBy={labelledBy} groups={groups} />
    </MantineProvider>,
  )

const diameter = { label: msg('Diameter'), value: { quantity: 'length', si: 7.823e-3 } } as const

it('has no header row and one value column in the preset unit, rounded', () => {
  const out = html([{ rows: [diameter, { label: msg('Manufacturer'), text: 'Alpha' }] }])
  expect(out).not.toContain('<thead')
  expect(out).toMatch(/<th[^>]*scope="row"[^>]*>Diameter<\/th><td[^>]*>7\.82 mm<\/td>/)
  expect(out).not.toContain('0.3080')
  expect(out.match(/<td/g)).toHaveLength(2)
})

it('heads each titled group with a row and leaves out empty groups', () => {
  const out = html([
    { title: msg('Dimensions'), rows: [diameter] },
    { title: msg('Computed'), rows: [] },
  ])
  expect(out).toMatch(/<th[^>]*scope="rowgroup"[^>]*>Dimensions<\/th>/)
  expect(out).not.toContain('Computed')
})

it('puts the text as printed and the method behind a button that keeps them as its description', () => {
  const out = html([
    {
      rows: [
        { ...diameter, printed: '.308"' },
        {
          label: msg('Sectional density'),
          value: { quantity: 'sectionalDensity', si: 177.9 },
          method: msg('Computed: m / d².'),
        },
      ],
    },
  ])
  const described = [
    ...out.matchAll(/<button[^>]*aria-describedby="([^"]+)"[^>]*>([^<]*)<\/button>/g),
  ]
  expect(described.map((m) => m[2])).toEqual(['7.82 mm', '0.253 lb/in²'])
  for (const [, id] of described) expect(out).toContain(`id="${id}"`)
  expect(out).toContain('As printed: .308&quot;')
  expect(out).toContain('Computed: m / d².')
  // a value without notes is no tab stop
  expect(html([{ rows: [diameter] }])).not.toContain('<button')
})

it('is named by its caption, or by the heading it is labelled by', () => {
  expect(html([{ rows: [diameter] }])).toContain('<caption')
  const labelled = html([{ rows: [diameter] }], 'record-data')
  expect(labelled).not.toContain('<caption')
  expect(labelled).toContain('aria-labelledby="record-data"')
})

const panel = (groups: FieldGroup[]) =>
  renderToStaticMarkup(
    <MantineProvider>
      <FieldPanel id="data" title={msg('Bullet data')} groups={groups} />
    </MantineProvider>,
  )

it('heads the symbol table Symbol, Quantity, Value, Unit and marks a symbol row for the linked drawing, one tab stop', () => {
  const out = panel([
    {
      title: msg('Size'),
      rows: [
        { ...diameter, symbol: 'd' },
        { label: msg('Mass'), text: '10' },
      ],
    },
    { title: msg('Shape'), rows: [{ label: msg('Nose'), symbol: 'n', value: diameter.value }] },
  ])
  expect(out).toMatch(/Symbol<\/th><th[^>]*>Quantity<\/th><th[^>]*>Value<\/th><th[^>]*>Unit/)
  expect(out).toContain('data-symbol="d"')
  expect(out.match(/<button type="button" class="symbol-stop" tabindex="0"/g)).toHaveLength(1)
  // a group filter for two groups; no search for three rows
  expect(out).toContain('aria-label="Bullet data: group"')
  expect(out).not.toContain('type="search"')
})

it('filters groups that share a filter label together, one segment per label', () => {
  const out = panel([
    { title: msg('Fitted (simulated)'), filter: msg('Fitted'), rows: [diameter] },
    { title: msg('Fixed model inputs'), filter: msg('Fixed inputs'), rows: [diameter] },
    { title: msg('Burn form'), filter: msg('Fixed inputs'), rows: [diameter] },
  ])
  const segments = [...out.matchAll(/type="radio"[^>]* value="([^"]+)"/g)].map((m) => m[1])
  expect(segments).toEqual(['All', 'Fitted', 'Fixed inputs'])
})

it('searches labels and symbols, ignoring case, and drops the groups left empty', () => {
  const groups: FieldGroup[] = [
    { title: msg('Size'), rows: [{ ...diameter, symbol: 'd' }] },
    { title: msg('Shape'), rows: [{ label: msg('Nose length'), symbol: 'n', text: '1' }] },
  ]
  expect(searchGroups(groups, ' NOSE ').map((g) => g.title)).toEqual(['Shape'])
  expect(searchGroups(groups, 'd').flatMap((g) => g.rows.map((r) => r.label))).toEqual(['Diameter'])
  expect(searchGroups(groups, '')).toBe(groups)
})
