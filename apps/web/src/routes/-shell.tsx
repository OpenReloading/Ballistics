import { Box, Container, Text } from '@mantine/core'
import { useHotkeys, useMediaQuery } from '@mantine/hooks'
import { AppFrame } from '@rangefoundry/ui'
import { Library } from 'lucide-react'
import {
  lazy,
  type ReactNode,
  Suspense,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useBarEnd } from '../components/bar-end.ts'
import { InstallButton } from '../components/install-button.tsx'
import { NavIcon } from '../components/nav-icons.tsx'
import { frameRoutes } from '../components/page-shell.tsx'
import { PreReleaseData } from '../components/pre-release-data.tsx'
import { ReportIssueButton, ReportIssueDialog } from '../components/report-issue.tsx'
import { RepositoryLink } from '../components/repository-link.tsx'
import { ContentSkipLink, ResultsSkipLink } from '../components/results-skip-link.tsx'
import { SafetyBarButton, SafetyDialog } from '../components/safety-dialog.tsx'
import { openSiteSearch, searchHost, siteSearchEvent } from '../components/search-host.ts'
import { SettingsDialog } from '../components/settings-dialog.ts'
import { openShortcuts, ShortcutsHelp, useShortcuts } from '../components/shortcuts.tsx'
import { Brand } from '../components/site-header.tsx'
import { ThemeSwitch } from '../components/theme-switch.tsx'
import { useRoute } from '../components/use-route.ts'
import { useTranslation } from '../i18n/language.ts'
import { docsUrl } from '../lib/docs-url.ts'
import { repositoryUrl } from '../lib/repository-url.ts'
import { isToolRoute, pageCoversRoute, sections } from '../lib/sections.ts'
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

/** Search or Settings in the navigation, in the page links' look (the icon over its label in the sidebar): from the drawer the dialog opens once the drawer has closed. */
function DialogRow({
  icon,
  label,
  ariaKeys,
  open,
  afterDrawer,
}: {
  icon: string
  label: string
  ariaKeys?: string
  open: () => void
  afterDrawer: (open: () => void) => void
}) {
  // the frame's breakpoint: from 75em the row is in the sidebar, below it in the drawer
  const wide = useMediaQuery('(width >= 75em)')
  return (
    <button
      type="button"
      className="ui-nav-item"
      aria-haspopup="dialog"
      aria-keyshortcuts={ariaKeys}
      onClick={() => (wide ? open() : afterDrawer(open))}
    >
      <NavIcon name={icon} />
      <span>{label}</span>
    </button>
  )
}

/** Search, the pages of every section in a list named by the section with the current one marked, Install from 75em, Settings and the docs, as the sidebar of the Next app has them; in the drawer below 75em also Report an issue and the repository, which the top bar shows from 75em. */
function Navigation({
  route,
  afterDrawer,
  onReport,
}: {
  route: string
  /** Opens a dialog once the drawer has closed. */
  afterDrawer: (open: () => void) => void
  onReport: () => void
}) {
  const { t } = useTranslation()
  const openSettings = useContext(SettingsDialog)
  const id = useId()
  return (
    <>
      <DialogRow
        icon="search"
        label={t('Search')}
        ariaKeys={shortcutAriaKeys('search')}
        open={openSiteSearch}
        afterDrawer={afterDrawer}
      />
      {sections.map((section, i) => (
        <div key={section.title}>
          <Text
            id={`${id}-${i}`}
            size="xs"
            fw={500}
            c="dimmed"
            mt="xs"
            mb={4}
            className="nav-section-title"
          >
            {t(section.title)}
          </Text>
          <ul aria-labelledby={`${id}-${i}`} className="nav-section">
            {section.pages.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  className="ui-nav-item"
                  aria-current={pageCoversRoute(p.href, route) ? 'page' : undefined}
                >
                  <NavIcon name={p.icon} />
                  <span>{t(p.label)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <Box visibleFrom="lg" className="install-slot">
        <InstallButton position="right" />
      </Box>
      <DialogRow
        icon="settings"
        label={t('Settings')}
        open={() => openSettings()}
        afterDrawer={afterDrawer}
      />
      <Box hiddenFrom="lg">
        <ReportIssueButton url={repository} drawer onOpen={() => afterDrawer(onReport)} />
      </Box>
      {docs && (
        <a href={docs} className="ui-nav-item">
          <Library size={20} aria-hidden="true" focusable="false" />
          <span>{t('Documentation')}</span>
        </a>
      )}
      <Box hiddenFrom="lg">
        <RepositoryLink url={repository} drawer />
      </Box>
    </>
  )
}

/** Install, Safety, Report an issue, the repository and the theme, as the Next app's header offers them, and the search that Search, Ctrl+K and the home page's field open. */
function BarEnd({ route, onReport }: { route: string; onReport: () => void }) {
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
  // from 75em the page bar sits in the top bar before these (globals.css), so in its end slot they follow its actions in the keyboard order as on screen
  const wide = useMediaQuery('(width >= 75em)')
  const shownEnd = useBarEnd()
  const barEnd = wide ? shownEnd : null
  const topEnd = (
    <div className="top-end">
      {/* a slot kept while nothing is offered, so an offer moves nothing; from 75em Install is at the sidebar's foot and Safety in the page bar */}
      <Box hiddenFrom="lg" className="install-slot">
        <InstallButton position="bottom" />
      </Box>
      <Box hiddenFrom="lg">
        <SafetyBarButton iconOnly />
      </Box>
      <ReportIssueButton url={repository} onOpen={onReport} />
      <RepositoryLink url={repository} />
      <ThemeSwitch />
    </div>
  )
  return (
    <>
      {barEnd ? createPortal(topEnd, barEnd) : topEnd}
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
              afterDrawer={(open) => {
                afterDrawer.current = open
              }}
              onReport={report}
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
