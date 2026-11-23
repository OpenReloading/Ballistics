import { ActionIcon, Container, Tooltip } from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { AppFrame } from '@rangefoundry/ui'
import { lazy, type ReactNode, Suspense, useContext, useEffect, useState } from 'react'
import { InstallButton } from '../components/install-button.tsx'
import { NavIcon } from '../components/nav-icons.tsx'
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
import { repositoryUrl } from '../lib/repository-url.ts'
import { pageCoversRoute, sections } from '../lib/sections.ts'
import { shortcutAriaKeys } from '../lib/shortcuts.ts'
import { pageWidth } from '../lib/theme.ts'
import { repositoryAddress } from '../platform/edition.ts'
import Link from '../platform/link.tsx'

// the search loads on its first use, so pages ship without it
const SiteSearch = lazy(() =>
  import('../components/site-search.tsx').then((m) => ({ default: m.SiteSearch })),
)

const repository = repositoryUrl(repositoryAddress)

/** The pages of every section, the current one marked as the sidebar of the Next app marks it. */
function Navigation({ route }: { route: string }) {
  const { t } = useTranslation()
  return sections
    .flatMap((s) => s.pages)
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
    ))
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

/** Search (also Ctrl+K and the home page's field), Settings, Install, Safety, Report an issue, the repository and the theme, as the Next app's header offers them. */
function BarEnd({ route }: { route: string }) {
  const { t } = useTranslation()
  const openSettings = useContext(SettingsDialog)
  const [reporting, setReporting] = useState(false)
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
      <ReportIssueButton url={repository} onOpen={() => setReporting(true)} />
      <RepositoryLink url={repository} />
      <ThemeSwitch />
      {repository && (
        <ReportIssueDialog
          repository={repository}
          opened={reporting}
          onClose={() => setReporting(false)}
        />
      )}
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
  return (
    <>
      <ContentSkipLink />
      <ResultsSkipLink />
      <SafetyDialog />
      <PreReleaseData />
      <AppFrame
        brand={<Brand full={route === '/'} />}
        navigation={<Navigation route={route} />}
        end={<BarEnd route={route} />}
      >
        <Container id="main" tabIndex={-1} size={pageWidth}>
          {children}
        </Container>
      </AppFrame>
    </>
  )
}
