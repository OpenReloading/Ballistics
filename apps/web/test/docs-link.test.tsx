import { I18nProvider } from '@lingui/react'
import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { DocsLink } from '../src/components/docs-link.tsx'
import { linguiOf } from '../src/i18n/lingui.ts'
import { docsPage, docsUrl, howCloseGuide } from '../src/lib/docs-url.ts'

/** The link's markup in English; a message without its English fails the test. */
function render(url?: string | undefined, drawer?: boolean) {
  const missing: string[] = []
  const stop = linguiOf('en').on('missing', ({ id }) => missing.push(id))
  const html = renderToStaticMarkup(
    <I18nProvider i18n={linguiOf('en')}>
      <MantineProvider>
        <DocsLink url={url} drawer={drawer} />
      </MantineProvider>
    </I18nProvider>,
  )
  stop()
  expect(missing).toEqual([])
  return html
}

it('renders nothing without a URL', () => {
  for (const html of [render(), render(undefined, true)]) expect(html).not.toContain('<a')
})

it('the sidebar link is an icon named Documentation, the drawer row shows the name', () => {
  expect(render('https://example.org/docs/')).toContain('aria-label="Documentation"')
  expect(render('https://example.org/docs/', true)).toContain('>Documentation<')
})

it('docsUrl: the set value, else the docs folder of the site, else none', () => {
  expect(docsUrl('https://example.org/docs/', '')).toBe('https://example.org/docs/')
  expect(docsUrl('  ', '/Ballistics')).toBe('/Ballistics/docs/')
  expect(docsUrl(undefined, '')).toBe('/docs/')
  expect(docsUrl(undefined, '', '1')).toBeUndefined()
  expect(docsUrl('https://example.org/docs/', '', '1')).toBe('https://example.org/docs/')
})

it('docsPage: the page under the docs site with or without its closing slash, none without a site', () => {
  expect(docsPage('/docs/', 'photo-guide/')).toBe('/docs/photo-guide/')
  expect(docsPage('https://example.org/docs', 'photo-guide/')).toBe(
    'https://example.org/docs/photo-guide/',
  )
  expect(docsPage(undefined, 'photo-guide/')).toBeUndefined()
})

it('the result notes link the page on how close a result is, under the docs site in use', () => {
  expect(howCloseGuide).toBe(
    docsPage(
      docsUrl(process.env.NEXT_PUBLIC_DOCS_URL, undefined, process.env.NEXT_PUBLIC_NO_DOCS),
      'how-close/',
    ),
  )
  expect(docsPage('https://example.org/docs/', 'how-close/')).toBe(
    'https://example.org/docs/how-close/',
  )
  // no docs site: no link
  expect(docsPage(docsUrl(undefined, undefined, '1'), 'how-close/')).toBeUndefined()
})
