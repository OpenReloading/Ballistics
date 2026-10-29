import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { RecordActions } from '../src/components/record-actions.tsx'
import { Toolbar } from '../src/components/workspace.tsx'

const clipboard = vi.hoisted(() => ({ copied: false, error: null as Error | null }))

vi.mock('@mantine/hooks', async (original) => ({
  ...(await original<typeof import('@mantine/hooks')>()),
  useClipboard: () => ({ ...clipboard, copy: () => {}, reset: () => {} }),
}))

beforeEach(() => {
  clipboard.copied = false
  clipboard.error = null
})

const render = (node: ReactNode) => renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)
const status = (html: string) =>
  html.match(/<span role="status" class="visually-hidden">([^<]*)<\/span>/)?.[1]

it('the record page status is empty until a copy, then says the result', () => {
  expect(status(render(<RecordActions />))).toBe('')
  clipboard.copied = true
  expect(status(render(<RecordActions />))).toBe('Link copied')
  clipboard.copied = false
  clipboard.error = new Error('denied')
  expect(status(render(<RecordActions />))).toBe('Copy failed')
})

it('the workbench status says the result of a copy', () => {
  const link = (copied: boolean, error: Error | null) => ({ copied, error, copy: () => {} })
  expect(status(render(<Toolbar link={link(false, null)} />))).toBe('')
  expect(status(render(<Toolbar link={link(true, null)} />))).toBe('Link copied')
  expect(status(render(<Toolbar link={link(false, new Error('denied'))} />))).toBe('Copy failed')
})
