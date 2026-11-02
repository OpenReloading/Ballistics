import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { RecordView, RecordViewWith } from '../src/components/record-view.tsx'
import type { RecordState } from '../src/components/use-record.ts'

const states = vi.hoisted(() => ({
  record: { status: 'loading' } as RecordState<unknown>,
  extras: { status: 'loading' } as RecordState<unknown>,
  load: undefined as ((signal: AbortSignal) => Promise<unknown>) | undefined,
}))
vi.mock('../src/components/use-record.ts', () => ({
  useRecord: () => ({ state: states.record, retry: () => {} }),
  useRead: (load: (signal: AbortSignal) => Promise<unknown>) => {
    states.load = load
    return { state: states.extras, retry: () => {} }
  },
}))

beforeEach(() => {
  states.record = { status: 'loading' }
  states.extras = { status: 'loading' }
  states.load = undefined
})

const render = (node: ReactNode) => renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)
const ref = { kind: 'bullets', id: 'b1', name: 'Example 168', what: 'Bullet' } as const
const page = () =>
  render(<RecordView<{ id: string }> {...ref}>{(r) => <p>record {r.id}</p>}</RecordView>)

it('shows the name and the loading rows while the record is read, with a notice for no script', () => {
  const html = page()
  expect(html).toContain('Example 168')
  expect(html).toContain('Loading bullet…')
  expect(html).toContain('this page needs JavaScript')
  expect(html).not.toContain('noindex')
})

it('shows a failed read with Retry under the name', () => {
  states.record = { status: 'error' }
  const html = page()
  expect(html).toContain('Example 168')
  expect(html).toContain('Bullet data is unavailable right now.')
  expect(html).toContain('Retry')
})

it('answers a missing record with the not-found page, kept out of search engines', () => {
  states.record = { status: 'notFound' }
  const html = page()
  expect(html).toContain('<meta name="robots" content="noindex"/>')
  expect(html).toContain('Page not found')
  expect(html).not.toContain('Example 168')
})

it('with extras keeps the loading state until both are read, and reads them for the record', async () => {
  states.record = { status: 'ok', data: { id: 'b1' } }
  const extras = vi.fn((r: { id: string }) => Promise.resolve(`names of ${r.id}`))
  const withExtras = () =>
    render(
      <RecordViewWith<{ id: string }, string> {...ref} extras={extras}>
        {(r, x) => (
          <p>
            {r.id} with {x}
          </p>
        )}
      </RecordViewWith>,
    )
  expect(withExtras()).toContain('Loading bullet…')
  await expect(states.load?.(new AbortController().signal)).resolves.toBe('names of b1')
  states.extras = { status: 'error' }
  expect(withExtras()).toContain('Bullet data is unavailable right now.')
  states.extras = { status: 'ok', data: 'makers' }
  expect(withExtras()).toContain('b1 with makers')
})
