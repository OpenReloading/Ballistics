import { MantineProvider } from '@mantine/core'
import type { Load } from '@open-reloading/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { LoadLots, LotField } from '../src/components/load-notes.tsx'
import type { UseWorkbenchStateResult } from '../src/components/use-workbench-load.ts'
import { LoadContext } from '../src/components/workbench-context.ts'
import { type Lots, lotsFrom } from '../src/lib/load-notes.ts'

const render = (lots: Lots) =>
  renderToStaticMarkup(
    <MantineProvider>
      <LoadContext
        // the fields read the lots and nothing else of the workbench
        value={{ loadNotes: { lots, setLots: () => {} } } as unknown as UseWorkbenchStateResult}
      >
        <LotField lot="powder" bare />
        <LotField lot="primer" short />
        <LotField lot="case" short />
        <LoadLots />
      </LoadContext>
    </MantineProvider>,
  )

const count = (html: string, part: string) => html.split(part).length - 1

it('shows each lot beside its choice and on the Notes tab from the one value of the load', () => {
  const lots = { powder: 'P1', primer: 'R1', case: 'C1' }
  const html = render(lots)
  for (const [name, value] of [
    ['Powder lot', 'P1'],
    ['Primer lot', 'R1'],
    ['Case lot', 'C1'],
  ]) {
    expect(count(html, `aria-label="${name}"`)).toBe(2)
    expect(count(html, `value="${value}"`)).toBe(2)
  }
  // beside the choice the short label or Lot in the field, the full name on the Notes tab
  expect(count(html, '>Lot<')).toBe(3)
  expect(count(html, '>Primer lot<')).toBe(1)
})

it('fills both places from a saved load', () => {
  const load = { powderLot: 'P2', primer: { lot: 'R2' }, case: { lot: 'C2' } } as Load
  const html = render(lotsFrom(load))
  for (const value of ['P2', 'R2', 'C2']) expect(count(html, `value="${value}"`)).toBe(2)
})
