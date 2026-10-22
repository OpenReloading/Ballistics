import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { FieldPanel, FieldTable, searchGroups } from '../src/components/field-table.tsx'
import type { FieldGroup } from '../src/lib/record-fields.ts'

// outside a UnitsProvider the table shows the first render's preset, Metric with grains
const html = (groups: FieldGroup[], labelledBy?: string) =>
  renderToStaticMarkup(
    <MantineProvider>
      <FieldTable caption="Data" labelledBy={labelledBy} groups={groups} />
    </MantineProvider>,
  )

const diameter = { label: 'Diameter', value: { quantity: 'length', si: 7.823e-3 } } as const

it('has no header row and one value column in the preset unit, rounded', () => {
  const out = html([{ rows: [diameter, { label: 'Manufacturer', text: 'Alpha' }] }])
  expect(out).not.toContain('<thead')
  expect(out).toMatch(/<th[^>]*scope="row"[^>]*>Diameter<\/th><td[^>]*>7\.82 mm<\/td>/)
  expect(out).not.toContain('0.3080')
  expect(out.match(/<td/g)).toHaveLength(2)
})

it('heads each titled group with a row and leaves out empty groups', () => {
  const out = html([
    { title: 'Dimensions', rows: [diameter] },
    { title: 'Computed', rows: [] },
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
          label: 'Sectional density',
          value: { quantity: 'sectionalDensity', si: 177.9 },
          method: 'Computed: m / d².',
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
      <FieldPanel id="data" title="Bullet data" groups={groups} />
    </MantineProvider>,
  )

it('heads the symbol table Symbol, Quantity, Value, Unit and marks a symbol row for the linked drawing, one tab stop', () => {
  const out = panel([
    {
      title: 'Size',
      rows: [
        { ...diameter, symbol: 'd' },
        { label: 'Mass', text: '10' },
      ],
    },
    { title: 'Shape', rows: [{ label: 'Nose', symbol: 'n', value: diameter.value }] },
  ])
  expect(out).toMatch(/Symbol<\/th><th[^>]*>Quantity<\/th><th[^>]*>Value<\/th><th[^>]*>Unit/)
  expect(out).toContain('data-symbol="d"')
  expect(out.match(/<span tabindex="0"/g)).toHaveLength(1)
  // a group filter for two groups; no search for three rows
  expect(out).toContain('aria-label="Bullet data: group"')
  expect(out).not.toContain('type="search"')
})

it('filters groups that share a filter label together, one segment per label', () => {
  const out = panel([
    { title: 'Fitted (simulated)', filter: 'Fitted', rows: [diameter] },
    { title: 'Fixed model inputs', filter: 'Fixed inputs', rows: [diameter] },
    { title: 'Burn form', filter: 'Fixed inputs', rows: [diameter] },
  ])
  const segments = [...out.matchAll(/type="radio"[^>]* value="([^"]+)"/g)].map((m) => m[1])
  expect(segments).toEqual(['All', 'Fitted', 'Fixed inputs'])
})

it('searches labels and symbols, ignoring case, and drops the groups left empty', () => {
  const groups: FieldGroup[] = [
    { title: 'Size', rows: [{ ...diameter, symbol: 'd' }] },
    { title: 'Shape', rows: [{ label: 'Nose length', symbol: 'n', text: '1' }] },
  ]
  expect(searchGroups(groups, ' NOSE ').map((g) => g.title)).toEqual(['Shape'])
  expect(searchGroups(groups, 'd').flatMap((g) => g.rows.map((r) => r.label))).toEqual(['Diameter'])
  expect(searchGroups(groups, '')).toBe(groups)
})
