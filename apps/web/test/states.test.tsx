import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { Loading } from '../src/components/states.tsx'

const html = (node: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)

it('the inline loading state is the bare line: no status role, no ellipsis, no skeleton', () => {
  // no Mantine component, so no provider is needed
  expect(renderToStaticMarkup(<Loading what="the preview" inline />)).toBe(
    '<p>Loading the preview</p>',
  )
  const full = html(<Loading what="the preview" />)
  expect(full).toContain('role="status"')
  expect(full).toContain('Loading the preview…')
})
