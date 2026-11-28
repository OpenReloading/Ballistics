import { I18nProvider } from '@lingui/react'
import { MantineProvider } from '@mantine/core'
import type { Powder } from '@rangefoundry/schema'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { linguiOf } from '../src/i18n/lingui.ts'
import type { PowderSummary } from '../src/lib/api-types.ts'

const record: { current: Powder | undefined } = { current: undefined }

vi.mock('@/platform/navigation.ts', () => ({
  usePathname: () => '/powders',
  useRouter: () => ({ push: () => {} }),
}))
vi.mock('../src/components/use-record.ts', () => ({
  useRecord: () => ({ state: { status: 'ok', data: record.current }, retry: () => {} }),
  useRead: () => ({
    state: {
      status: 'ok',
      data: {
        names: new Map([['example', 'Example']]),
        placed: undefined,
        cartridgeNames: new Map(),
      },
    },
    retry: () => {},
  }),
}))

const { PowderRecordPage } = await import('../src/components/powder-record-page.tsx')
const { PowderList } = await import('../src/components/powder-list.tsx')
const { orderPowders } = await import('../src/lib/burn-rate.ts')
const { packPowders } = await import('../src/lib/powder-rows.ts')

const html = (node: ReactNode) =>
  renderToStaticMarkup(
    <MantineProvider>
      <I18nProvider i18n={linguiOf('en')}>{node}</I18nProvider>
    </MantineProvider>,
  )

const notice = 'Simulation, not load data'

/** An interior model whose pressure exponent is not 1: the record has one, the page draws no curve from it. */
const interior: NonNullable<Powder['interior']> = {
  model: 'm3',
  fitted: ['vivacity'],
  vivacity: { value: 0.5, standardUncertainty: 0.01 },
  energy: { value: 3950000 },
  gamma: 1.215,
  covolume: { value: 0.00097 },
  density: { value: 1.6 },
  pressureExponent: 0.9,
  referencePressure: { value: 0.980665 },
  ignitionPressure: { value: 50 },
  propellantTemperature: { value: 21 },
  burnForm: { kind: 'twoStage', a: { value: 0.05 }, m: 0.5, q: 0.5, z1: 0.8 },
}

const recordPage = (p: Powder) => {
  record.current = p
  return html(<PowderRecordPage id={p.id} name={p.name} />)
}

it('shows the simulation notice on a powder record with an interior model, also one without a curve, and none without a model', () => {
  expect(recordPage({ id: 'p', manufacturer: 'example', name: 'P', interior })).toContain(notice)
  expect(recordPage({ id: 'p', manufacturer: 'example', name: 'P' })).not.toContain(notice)
})

const row = (id: string, fitted: boolean): PowderSummary & { manufacturerName: string } => ({
  id,
  manufacturer: 'example',
  manufacturerName: 'Example',
  name: id,
  ...(fitted && {
    interior: {
      vivacity: { value: 0.5, standardUncertainty: 0.01 },
      pressureExponent: 1,
      referencePressure: { value: 0.980665 },
      burnForm: { kind: 'twoStage', a: { value: 0 }, m: 0.5, q: 0.5, z1: 0.8 },
    },
  }),
})

const list = (rows: ReturnType<typeof row>[]) =>
  html(<PowderList packed={packPowders(orderPowders(rows))} />)

it('shows the simulation notice on the powder list when a row has a mean vivacity, none when no row has one', () => {
  expect(list([row('fitted', true), row('plain', false)])).toContain(notice)
  expect(list([row('plain', false)])).not.toContain(notice)
})
