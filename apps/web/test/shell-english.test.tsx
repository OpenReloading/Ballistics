import { I18nProvider } from '@lingui/react'
import { AppShell, MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { ContinueStrip } from '../src/components/continue-strip.tsx'
import { ReportIssueButton, ReportIssueDialog } from '../src/components/report-issue.tsx'
import { ContentSkipLink, ResultsSkipLink } from '../src/components/results-skip-link.tsx'
import { SafetyBarButton } from '../src/components/safety-dialog.tsx'
import { useShellActions } from '../src/components/shell-actions.ts'
import { SiteHeader } from '../src/components/site-header.tsx'
import { ThemeSwitch } from '../src/components/theme-switch.tsx'
import { linguiOf } from '../src/i18n/lingui.ts'
import { AppError } from '../src/routes/-error.tsx'

// no router is mounted: the shell renders at `route.path`, the home route unless a test sets another
const route = vi.hoisted(() => ({ path: '/' }))
vi.mock('@/platform/navigation.ts', () => ({
  usePathname: () => route.path,
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}))

/** `node`'s markup in English and the ids it showed without their English. */
function english(node: ReactNode) {
  const missing: string[] = []
  const stop = linguiOf('en').on('missing', ({ id }) => missing.push(id))
  const html = renderToStaticMarkup(
    <I18nProvider i18n={linguiOf('en')}>
      {/* a dialog renders in place: the server render has no portal */}
      <MantineProvider
        theme={{ components: { ModalRoot: { defaultProps: { withinPortal: false } } } }}
      >
        {node}
      </MantineProvider>
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

it('the skip links, theme switch, Safety buttons, report button and continue strip have their English without a page', () => {
  route.path = '/workbench'
  const { html, missing } = english(
    <>
      <ContentSkipLink />
      <ResultsSkipLink />
      <ThemeSwitch />
      <SafetyBarButton />
      <SafetyBarButton iconOnly />
      <ReportIssueButton url="https://example.org/repo" onOpen={() => {}} />
      <ContinueStrip />
    </>,
  )
  route.path = '/'
  expect(missing).toEqual([])
  for (const text of [
    '>Skip to content<',
    '>Skip to results<',
    'aria-label="Dark theme"',
    '>Safety<',
    'aria-label="Safety notice"',
    'aria-label="Report an issue"',
    'aria-label="Continue"',
  ])
    expect(html).toContain(text)
})

it('the Report an issue dialog has its English without a page', () => {
  const { html, missing } = english(
    <ReportIssueDialog repository="https://example.org/repo" opened onClose={() => {}} />,
  )
  expect(missing).toEqual([])
  for (const text of [
    'Report an issue',
    '>Cancel<',
    '>Open on GitHub<',
    'Area',
    '>Type<',
    'What happened?',
    'Wrong data',
    'Sent with the report',
    'Public on GitHub. No photos, files or other records of this browser.',
  ])
    expect(html).toContain(text)
})
