import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { CurveTable } from '../src/components/curve-table.tsx'
import { curveAt, type FittedPowder, isFitted, typedBurn } from '../src/lib/burn-rate.ts'

const typed = typedBurn({
  vivacity: 0.6,
  exponent: 1,
  referencePressure: 98066.5,
  formA: 0,
  formM: 0.5,
  formQ: 0.5,
  formZ1: 0.8,
})
if (!typed || !isFitted(typed)) throw new Error('no curve')
const a: FittedPowder = { ...typed, id: 'a', label: 'Powder A', spread: 0.1 }
const b: FittedPowder = { ...typed, id: 'b', label: 'Powder B' }

const render = (powders: FittedPowder[]) =>
  renderToStaticMarkup(
    <MantineProvider>
      <CurveTable powders={powders} caption="Dynamic vivacity" />
    </MantineProvider>,
  )
const heads = (html: string) =>
  [...html.matchAll(/<th[^>]*scope="col"[^>]*>([^<]*)</g)].map((m) => m[1])
/** The cells of the row of burnt fraction `z`. */
const row = (html: string, z: string) => {
  const tr = html.split('<tr').find((r) => r.includes(`scope="row"`) && r.includes(`>${z}<`))
  return [...(tr ?? '').matchAll(/<td[^>]*>([^<]*)</g)].map((m) => m[1])
}
const two = (x: number) => x.toFixed(2)

it('gives one powder its value, low and high columns at burnt fractions 0 to 1', () => {
  const html = render([a])
  expect(heads(html)).toEqual([
    'Burnt fraction z',
    'Value, 1/(MPa·s)',
    'Low, 1/(MPa·s)',
    'High, 1/(MPa·s)',
  ])
  expect(html.match(/scope="row"/g)).toHaveLength(11)
  const v = curveAt(a, 0.5).value
  expect(row(html, '0.5')).toEqual([two(v), two(v * 0.9), two(v * 1.1)])
})

it('leaves low and high blank for a powder without an uncertainty', () => {
  const v = curveAt(b, 0.3).value
  expect(row(render([b]), '0.3')).toEqual([two(v), '', ''])
})

it('gives several powders one value column each, named by the powder', () => {
  const html = render([a, b])
  expect(heads(html)).toEqual(['Burnt fraction z', 'Powder A, 1/(MPa·s)', 'Powder B, 1/(MPa·s)'])
  const v = two(curveAt(a, 1).value)
  expect(row(html, '1.0')).toEqual([v, v])
})
