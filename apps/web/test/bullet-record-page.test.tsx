import { MantineProvider } from '@mantine/core'
import type { Bullet } from '@rangefoundry/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { BulletRecordPage } from '../src/components/bullet-record-page.tsx'

const basic: Bullet = {
  id: 'test-bullet-basic',
  manufacturer: 'test-maker',
  productNumber: '30175',
  name: 'Test 175 gr HPBT',
  diameter: { value: 7.823 },
  mass: { value: 11.34 },
}

// the page draws the bullet in the self-hosted drawing font
vi.mock('next/font/local', () => ({ default: () => ({ variable: 'drawing-font', className: '' }) }))

vi.mock('../src/components/use-record.ts', () => ({
  useRecord: () => ({ state: { status: 'ok', data: basic }, retry: () => {} }),
  useRead: () => ({
    state: { status: 'ok', data: new Map([['test-maker', 'Test Maker']]) },
    retry: () => {},
  }),
}))

it('shows a bullet record without provenance with no sources section', () => {
  const html = renderToStaticMarkup(
    <MantineProvider>
      <BulletRecordPage id={basic.id} name={basic.name} fits={[]} />
    </MantineProvider>,
  )
  expect(html).toContain('Test Maker Test 175 gr HPBT')
  expect(html).toContain('id="record-data"')
  expect(html).not.toContain('id="record-sources"')
})
