import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { LadderFlatSpots } from '../src/components/ladder-flat-spots.tsx'
import { chargeRows, seriesFlatSpots } from '../src/lib/measurements.ts'
import { kilogramsPerGrain, metersPerFoot, presetUnits, type UnitSystem } from '../src/lib/units.ts'
import { defined } from './defined.ts'

const string = (grains: number, velocities: number[]) => ({
  charge: grains * kilogramsPerGrain,
  shots: velocities.map((value) => ({ velocity: { value } })),
})
const flat = chargeRows(
  [
    string(40, [700, 710, 705, 695, 700]),
    string(41, [702, 712, 707, 697, 702]),
    string(42, [704, 714, 709, 699, 704]),
    string(43, [760, 770, 765, 755, 760]),
  ],
  [],
)
const steep = chargeRows(
  [string(40, [700, 701, 700]), string(41, [750, 751, 750]), string(42, [800, 801, 800])],
  [],
)
const single = chargeRows([string(40, [700, 710, 705])], [])

const render = (series: { id: string; name: string; rows: typeof flat }[], system: UnitSystem) =>
  renderToStaticMarkup(
    <MantineProvider>
      <LadderFlatSpots series={series} system={system} />
    </MantineProvider>,
  )
const cells = (html: string, label: string) =>
  [...html.matchAll(new RegExp(`data-label="${label}"[^>]*>([^<]*)<`, 'g'))].map((m) => m[1])

it('shows nothing while no series has two charges with two shots', () => {
  expect(render([], presetUnits('metric-grains'))).not.toContain('<h3>')
  const one = render([{ id: 's', name: 'One', rows: single }], presetUnits('metric-grains'))
  expect(one).not.toContain('<h3>')
})

it('names the flat spot and the strings, with the level of the band and the statement it is no load', () => {
  const html = render(
    [
      { id: 'a', name: 'Lot A', rows: flat },
      { id: 'b', name: 'Lot B', rows: steep },
      { id: 'c', name: 'Lot C', rows: single },
    ],
    presetUnits('metric-grains'),
  )
  expect(html).toContain('Lot A: flat from 40.0 gr to 42.0 gr (strings of 5, 5, 5 shots).')
  expect(html).toContain('Lot B: no flat spot between these strings.')
  expect(html).not.toContain('Lot C')
  expect(html).toMatch(/a \d+ % band that includes zero/)
  expect(html).toContain('not a safety statement and not a charge to load')
  expect(cells(html, 'Flat')).toEqual(['yes', 'yes', 'no', 'no', 'no'])
})

it('writes the slope in the velocity and charge units of the Settings', () => {
  const segment = defined(seriesFlatSpots(steep)?.segments[0])
  // m/s per kg to m/s per grain, and to ft/s per grain
  const perGrain = segment.slope * kilogramsPerGrain
  const slope = (system: UnitSystem) =>
    cells(render([{ id: 'b', name: 'B', rows: steep }], system), 'Slope')[0]
  expect(slope(presetUnits('metric-grains'))).toBe(perGrain.toFixed(1))
  expect(slope(presetUnits('us'))).toBe((perGrain / metersPerFoot).toFixed(1))
  expect(render([{ id: 'b', name: 'B', rows: steep }], presetUnits('us'))).toContain(
    '(ft/s per gr)',
  )
})
