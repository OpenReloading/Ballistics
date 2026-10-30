import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { LimitsView } from '../src/components/workbench-readouts.tsx'
import type { InteriorResponse } from '../src/lib/api-types.ts'

const body = {
  limits: [
    {
      cartridge: '308-win',
      revised: '2008-09-23',
      symbol: 'Pmax',
      method: null,
      pressure: 415e6,
      compared: false,
      reason: 'noValue',
    },
  ],
} as InteriorResponse

it('labels every limit cell with its column header, for the phone card layout', () => {
  const html = renderToStaticMarkup(
    <MantineProvider>
      <LimitsView body={body} />
    </MantineProvider>,
  )
  const headers = [...html.matchAll(/<th scope="col" role="columnheader">([^<]*)<\/th>/g)].map(
    (m) => m[1],
  )
  const labels = [...html.matchAll(/<td data-label="([^"]*)"/g)].map((m) => m[1])
  expect(headers).toHaveLength(7)
  expect(labels).toEqual(headers)
  expect(html).toMatch(/<td data-label="Value" class="num" role="cell">4150 bar \(\d+ psi\)<\/td>/)
})

const resolved = {
  ...body,
  resolved: {
    cartridge: {
      id: '308-win',
      name: '.308 Win.',
      provenance: { kind: 'published', sources: [{ title: 'Tables of Dimensions' }] },
    },
  },
} as InteriorResponse

const render = (printed: boolean) =>
  renderToStaticMarkup(
    <MantineProvider>
      <LimitsView body={resolved} printed={printed} />
    </MantineProvider>,
  )

it("links the cartridge record's sources on screen, in one short line", () => {
  const html = render(false)
  expect(html).toContain('Source: C.I.P. TDCC')
  expect(html).toContain('href="/cartridges/308-win#record-sources"')
  expect(html).not.toContain('Tables of Dimensions')
  expect(html).not.toContain('<h3')
})

it('names the cartridge record on paper, without a link', () => {
  const html = render(true)
  expect(html).toContain('Pressure limits: C.I.P. TDCC, cartridge record .308 Win.')
  expect(html).not.toContain('record-sources')
})
