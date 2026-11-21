import { MantineProvider } from '@mantine/core'
import type { Load } from '@rangefoundry/schema'
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
        <LotField lot="powder" />
        <LotField lot="primer" />
        <LotField lot="case" />
        <LotField lot="bullet" />
        <LoadLots />
      </LoadContext>
    </MantineProvider>,
  )

const count = (html: string, part: string) => html.split(part).length - 1

it('shows a set lot under its choice and on the Notes tab, and an empty one only on the Notes tab', () => {
  const html = render({ powder: 'P1', primer: '', case: 'C1', bullet: '' })
  expect(count(html, 'aria-label="Powder lot"')).toBe(1)
  expect(count(html, 'value="P1"')).toBe(2)
  expect(count(html, 'value="C1"')).toBe(2)
  expect(count(html, 'aria-label="Add lot for the primer"')).toBe(1)
  expect(count(html, 'aria-label="Add lot for the bullet"')).toBe(1)
  expect(count(html, 'aria-label="Add lot for the powder"')).toBe(0)
  expect(count(html, '>Primer lot<')).toBe(1)
  expect(count(html, '>Bullet lot<')).toBe(1)
})

it('fills both places from a saved load', () => {
  const load = {
    powderLot: 'P2',
    bulletLot: 'B2',
    primer: { lot: 'R2' },
    case: { lot: 'C2' },
  } as Load
  const html = render(lotsFrom(load))
  for (const value of ['P2', 'R2', 'C2', 'B2']) expect(count(html, `value="${value}"`)).toBe(2)
  expect(html).not.toContain('Add lot')
})
