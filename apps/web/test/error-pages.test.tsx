import { MantineProvider } from '@mantine/core'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import RootError from '../src/app/error.tsx'
import GlobalError from '../src/app/global-error.tsx'
import { ErrorNote } from '../src/components/states.tsx'
import { english } from '../src/i18n/translate.ts'

// the pages are called as functions below, outside a render, where a hook cannot subscribe
vi.mock('../src/i18n/language.ts', async (original) => {
  const actual = await original<typeof import('../src/i18n/language.ts')>()
  return { ...actual, useTranslation: () => english }
})

const error = Object.assign(new Error('render failed'), { digest: '1' })

/** The element in `node`'s tree whose children read `text`, without rendering components. */
function find(node: ReactNode, text: string): ReactElement<{ onClick?: () => void }> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue
    if (child.props.children === text) return child as ReactElement<{ onClick?: () => void }>
    const found = find(child.props.children, text)
    if (found) return found
  }
}

it('the error page keeps the shell: one h1, one message with the error, Retry calls retry', () => {
  const retry = vi.fn()
  const html = renderToStaticMarkup(
    <MantineProvider>
      <RootError error={error} retry={retry} />
    </MantineProvider>,
  )
  expect(html.match(/<h1/g)).toHaveLength(1)
  expect(html).toContain('role="alert"')
  expect(html).toContain('saved records stay in this browser')
  expect(html).toContain('render failed')
  expect(html).toContain('Retry')
  const note = Children.toArray(RootError({ error, retry }).props.children).find(
    (c): c is ReactElement<{ onRetry: () => void }> => isValidElement(c) && c.type === ErrorNote,
  )
  note?.props.onRetry()
  expect(retry).toHaveBeenCalledOnce()
})

it('the global error page writes its own document with Try again', () => {
  const retry = vi.fn()
  const html = renderToStaticMarkup(<GlobalError error={error} retry={retry} />)
  expect(html).toMatch(/^<html lang="en">/)
  expect(html).toContain('<h1>Something went wrong</h1>')
  expect(html).toContain('saved records stay in this browser')
  expect(html).toContain('<small>render failed</small>')
  find(GlobalError({ error, retry }), 'Try again')?.props.onClick?.()
  expect(retry).toHaveBeenCalledOnce()
})
