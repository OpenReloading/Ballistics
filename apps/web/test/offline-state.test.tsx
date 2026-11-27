import { I18nProvider } from '@lingui/react'
import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { NotFoundState, OfflineState } from '../src/components/offline-state.tsx'
import { linguiOf } from '../src/i18n/lingui.ts'

const html = (node: ReactNode) =>
  renderToStaticMarkup(
    <I18nProvider i18n={linguiOf('en')}>
      <MantineProvider>{node}</MantineProvider>
    </I18nProvider>,
  )

// Retry reloading the page is not checked here (no DOM)
it('the offline state has its page h1 and a title below it, Retry and links to the pages kept on the device', () => {
  const page = html(<OfflineState />)
  expect(page).toMatch(/<h1[^>]*>Offline<\/h1>/)
  expect(page).toContain('Not available offline')
  expect(page).toMatch(/<button[^>]*>.*Retry/)
  expect(page).toContain('aria-label="Pages kept on this device"')
  expect(page.match(/href="\/[^"]*"/g)).toEqual([
    'href="/workbench"',
    'href="/session"',
    'href="/groups"',
    'href="/firearms"',
    'href="/cases/editor"',
  ])
})

it('the not-found state has its page h1, offers Search and links every page of the sections', () => {
  const page = html(<NotFoundState />)
  expect(page).toMatch(/<h1[^>]*>Page not found<\/h1>/)
  expect(page).toContain('This page could not be found.')
  expect(page).toMatch(/<button[^>]*>.*Search/)
  expect(page.match(/href="\/[^"]*"/g)).toEqual([
    'href="/workbench"',
    'href="/session"',
    'href="/groups"',
    'href="/cartridges"',
  ])
})
