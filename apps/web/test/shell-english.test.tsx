import { I18nProvider } from '@lingui/react'
import { AppShell, MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { useShellActions } from '../src/components/shell-actions.ts'
import { SiteHeader } from '../src/components/site-header.tsx'
import { linguiOf } from '../src/i18n/lingui.ts'
import { AppError } from '../src/routes/-error.tsx'

// no router is mounted: the shell renders at the home route
vi.mock('@/platform/navigation.ts', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}))

/** `node`'s markup in English and the ids it showed without their English. */
function english(node: ReactNode) {
  const missing: string[] = []
  const stop = linguiOf('en').on('missing', ({ id }) => missing.push(id))
  const html = renderToStaticMarkup(
    <I18nProvider i18n={linguiOf('en')}>
      <MantineProvider>{node}</MantineProvider>
    </I18nProvider>,
  )
  stop()
  return { html, missing }
}

function Commands() {
  const { pages, commands } = useShellActions()
  return [...pages, ...commands].map((c) => c.label).join('|')
}

it('the Next shell has its English without a page: alpha note, navigation, Search and Settings', () => {
  const { html, missing } = english(
    <AppShell>
      <SiteHeader />
    </AppShell>,
  )
  expect(missing).toEqual([])
  expect(html).toContain('Alpha version: breaking changes are to be expected.')
  expect(html).toContain('aria-label="Main"')
  expect(html).toContain('Search')
  expect(html).toContain('Settings')
})

it('the search commands have their English without a page', () => {
  const { html, missing } = english(<Commands />)
  expect(missing).toEqual([])
  expect(html).toContain('Home|')
  expect(html).toContain('|Theme: dark')
})

it("the Start frame's error page has its English without another page", () => {
  const { html, missing } = english(
    <AppError error={new Error('render failed')} reset={() => {}} info={{ componentStack: '' }} />,
  )
  expect(missing).toEqual([])
  expect(html).toContain('<h1>Something went wrong</h1>')
  expect(html).toContain('RangeFoundry Workbench could not be shown.')
  expect(html).toContain('Try again')
})
