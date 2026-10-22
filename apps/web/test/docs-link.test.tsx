import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { DocsLink } from '../src/components/docs-link.tsx'
import { docsUrl } from '../src/lib/docs-url.ts'

const render = (url?: string, drawer?: boolean) =>
  renderToStaticMarkup(
    <MantineProvider>
      <DocsLink url={url} drawer={drawer} />
    </MantineProvider>,
  )

it('renders nothing without a URL', () => {
  for (const html of [render(), render(undefined, true)]) expect(html).not.toContain('<a')
})

it('the sidebar link is an icon named Documentation, the drawer row shows the name', () => {
  expect(render('https://example.org/docs/')).toContain('aria-label="Documentation"')
  expect(render('https://example.org/docs/', true)).toContain('>Documentation<')
})

it('docsUrl: the set value, else the Pages edition docs folder, else none', () => {
  expect(docsUrl('https://example.org/docs/', undefined)).toBe('https://example.org/docs/')
  expect(docsUrl('  ', '/Ballistics')).toBe('/Ballistics/docs/')
  expect(docsUrl(undefined, '')).toBe('/docs/')
  expect(docsUrl(undefined, undefined)).toBeUndefined()
})
