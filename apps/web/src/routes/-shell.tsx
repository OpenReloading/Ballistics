import { ActionIcon, Box, Container, Tooltip } from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { AppFrame } from '@rangefoundry/ui'
import { lazy, type ReactNode, Suspense, useContext, useEffect, useRef, useState } from 'react'
import { DocsLink } from '../components/docs-link.tsx'
import { InstallButton } from '../components/install-button.tsx'
import { NavIcon } from '../components/nav-icons.tsx'
import { frameRoutes } from '../components/page-shell.tsx'
import { PreReleaseData } from '../components/pre-release-data.tsx'
import { ReportIssueButton, ReportIssueDialog } from '../components/report-issue.tsx'
import { RepositoryLink } from '../components/repository-link.tsx'
import { ContentSkipLink, ResultsSkipLink } from '../components/results-skip-link.tsx'
import { SafetyBarButton, SafetyDialog } from '../components/safety-dialog.tsx'
import { searchHost, siteSearchEvent } from '../components/search-host.ts'
import { SettingsDialog } from '../components/settings-dialog.ts'
import { openShortcuts, ShortcutsHelp, useShortcuts } from '../components/shortcuts.tsx'
import { Brand } from '../components/site-header.tsx'
import { ThemeSwitch } from '../components/theme-switch.tsx'
import { useRoute } from '../components/use-route.ts'
import { useTranslation } from '../i18n/language.ts'
import { docsUrl } from '../lib/docs-url.ts'
import { repositoryUrl } from '../lib/repository-url.ts'
import { isToolRoute, type PageEntry, pageCoversRoute, sections } from '../lib/sections.ts'
import { shortcutAriaKeys } from '../lib/shortcuts.ts'
import { pageWidth } from '../lib/theme.ts'
import { docsAddress, noDocs, repositoryAddress } from '../platform/edition.ts'
import Link from '../platform/link.tsx'

// the search loads on its first use, so pages ship without it
const SiteSearch = lazy(() =>
  import('../components/site-search.tsx').then((m) => ({ default: m.SiteSearch })),
)

// no link without them
const repository = repositoryUrl(repositoryAddress)
const docs = docsUrl(docsAddress, undefined, noDocs)

/** The pages of every section, the current one marked as the sidebar of the Next app marks it; in the drawer below 75em also Report an issue, the docs and the repository, which the top bar shows from 75em. */
function Navigation({ route, onReport }: { route: string; onReport: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      {sections
        .flatMap((s): readonly PageEntry[] => s.pages)
        .map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="ui-nav-item"
            aria-current={pageCoversRoute(p.href, route) ? 'page' : undefined}
          >
            <NavIcon name={p.icon} />
            <span>{t(p.label)}</span>
          </Link>
        ))}
      <Box hiddenFrom="lg">
        <ReportIssueButton url={repository} drawer onOpen={onReport} />
        <DocsLink url={docs} drawer />
        <RepositoryLink url={repository} drawer />
      </Box>
    </>
  )
}

/** A button of the top bar opening a dialog over the page, named by its tooltip's label. */
function DialogButton({
  icon,
  label,
  hint,
  ariaKeys,
  onOpen,
}: {
  icon: string
  label: string
  /** The keys shown in the tooltip, and `aria-keyshortcuts`. */
  hint?: string
  ariaKeys?: string
  onOpen: () => void
}) {
  return (
    <Tooltip label={hint ? `${label} (${hint})` : label} transitionProps={{ duration: 0 }}>
      <ActionIcon
        variant="subtle"
        color="gray"
        aria-label={label}
        aria-haspopup="dialog"
        aria-keyshortcuts={ariaKeys}
        onClick={onOpen}
      >
        <NavIcon name={icon} />
      </ActionIcon>
    </Tooltip>
  )
}

/** Search (also Ctrl+K and the home page's field), Settings, Install, Safety, Report an issue, the docs, the repository and the theme, as the Next app's header and sidebar offer them. */
function BarEnd({ route, onReport }: { route: string; onReport: () => void }) {
  const { t } = useTranslation()
  const openSettings = useContext(SettingsDialog)
  // each request opens the site search; the workbench opens its own (`searchHost`)
  const [searches, setSearches] = useState(0)
  const openSearch = () => {
    if (searchHost.page) return searchHost.page()
    if (route === '/workbench') searchHost.wanted = true
    else setSearches((n) => n + 1)
  }
  useEffect(() => {
    window.addEventListener(siteSearchEvent, openSearch)
    return () => window.removeEventListener(siteSearchEvent, openSearch)
  })
  useHotkeys([['mod+K', () => searchHost.page || openSearch()]], [])
  useShortcuts({ search: null, help: openShortcuts })
  return (
    <>
      {/* a slot kept while nothing is offered, so an offer moves nothing */}
      <div className="install-slot">
        <InstallButton position="bottom" />
      </div>
      <SafetyBarButton iconOnly />
      <DialogButton
        icon="search"
        label={t('Search')}
        hint="Ctrl K"
        ariaKeys={shortcutAriaKeys('search')}
        onOpen={openSearch}
      />
      <DialogButton icon="settings" label={t('Settings')} onOpen={() => openSettings()} />
      <ReportIssueButton url={repository} onOpen={onReport} />
      <Box visibleFrom="lg">
        <DocsLink url={docs} />
      </Box>
      <RepositoryLink url={repository} />
      <ThemeSwitch />
      {searches > 0 && (
        <Suspense fallback={null}>
          <SiteSearch request={searches} />
        </Suspense>
      )}
      <ShortcutsHelp />
    </>
  )
}

/** `ui`'s frame with the app's wordmark, pages and top bar actions; the page container takes the skip link's `#main`, as `main` is the frame's. */
export function Shell({ children }: { children: ReactNode }) {
  const route = useRoute()
  const [reporting, setReporting] = useState(false)
  const report = () => setReporting(true)
  // from the drawer the dialog opens once the drawer has closed and given focus back to its button
  const afterDrawer = useRef<(() => void) | undefined>(undefined)
  return (
    <>
      <ContentSkipLink />
      <ResultsSkipLink />
      <SafetyDialog />
      <PreReleaseData />
      {/* the Next shell's wrapper, so the app's styles frame a list window-high and keep a document's text measure */}
      <div
        className="page-shell"
        data-width={isToolRoute(route) ? 'tool' : undefined}
        data-frame={frameRoutes.has(route) || undefined}
      >
        <AppFrame
          brand={<Brand full={route === '/'} />}
          navigation={
            <Navigation
              route={route}
              onReport={() => {
                afterDrawer.current = report
              }}
            />
          }
          end={<BarEnd route={route} onReport={report} />}
          onDrawerClosed={() => {
            afterDrawer.current?.()
            afterDrawer.current = undefined
          }}
        >
          <Container id="main" tabIndex={-1} size={pageWidth}>
            {children}
          </Container>
        </AppFrame>
      </div>
      {repository && (
        <ReportIssueDialog
          repository={repository}
          opened={reporting}
          onClose={() => setReporting(false)}
        />
      )}
    </>
  )
}
