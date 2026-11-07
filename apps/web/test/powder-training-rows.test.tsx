import { MantineProvider } from '@mantine/core'
import type { Powder } from '@open-reloading/schema'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { PowderSummary } from '../src/lib/api-types.ts'

vi.mock('next/navigation', () => ({
  usePathname: () => '/powders',
  useRouter: () => ({ push: () => {} }),
}))
// the list sorted by its Training rows column, as `?sort=-rows` sets it after hydration
vi.mock('../src/components/directory-table.tsx', async (original) => ({
  ...(await original<typeof import('../src/components/directory-table.tsx')>()),
  useListState: () => [
    { query: '', sort: { column: 'rows', dir: 'descending' } },
    () => {},
    () => {},
  ],
}))

const { PowderList } = await import('../src/components/powder-list.tsx')
const { PowderFit } = await import('../src/components/powder-fit.tsx')
const { orderPowders } = await import('../src/lib/burn-rate.ts')
const { packPowders } = await import('../src/lib/powder-rows.ts')

const html = (node: ReactNode) => renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)

/** A synthetic catalogue powder with a curve and, when given, the training rows of its fit. */
const summary = (
  id: string,
  trainingRows?: number,
): PowderSummary & { manufacturerName: string } => ({
  id,
  manufacturer: 'example',
  manufacturerName: 'Example',
  name: id,
  interior: {
    vivacity: { value: 0.5, standardUncertainty: 0.01 },
    pressureExponent: 1,
    referencePressure: { value: 0.980665 },
    burnForm: { kind: 'twoStage', a: { value: 0 }, m: 0.5, q: 0.5, z1: 0.8 },
    ...(trainingRows !== undefined && { trainingRows }),
  },
})

it('sorts the powder list by training rows, most first and the powders without a fit last', () => {
  const packed = packPowders(
    orderPowders([summary('few', 5), summary('none'), summary('many', 20)]),
  )
  const ids = [...html(<PowderList packed={packed} />).matchAll(/<tr[^>]*data-id="([^"]+)"/g)].map(
    (m) => m[1],
  )
  expect(ids).toEqual(['many', 'few', 'none'])
})

it('lists the load tables of a fit with their rows on the record page, and nothing without a count', () => {
  const fitted = (note?: string) => ({
    title: note ? 'Table A' : 'Table B',
    kind: 'fitted',
    fields: ['interior'],
    ...(note && { note }),
  })
  const powder = (sources: object[]) =>
    ({
      id: 'p',
      manufacturer: 'example',
      name: 'P',
      interior: summary('p').interior,
      provenance: { kind: 'published', sources },
    }) as unknown as Powder
  const table = html(
    <PowderFit powder={powder([fitted('12 training rows of this table.'), fitted()])} />,
  )
  expect(table).toContain('Model fit')
  expect(
    [...table.matchAll(/<th[^>]*scope="row"[^>]*>([^<]+)<\/th><td[^>]*>([^<]+)</g)].map((m) => [
      m[1],
      m[2],
    ]),
  ).toEqual([
    ['Table A', '12'],
    ['Table B', 'n/a'],
  ])
  expect(renderToStaticMarkup(<PowderFit powder={powder([fitted()])} />)).toBe('')
})
