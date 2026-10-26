'use client'

import {
  ActionIcon,
  Anchor,
  AppShellHeader,
  AppShellNavbar,
  AppShellSection,
  Badge,
  Box,
  Burger,
  Divider,
  Drawer,
  Group,
  NavLink,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { useDisclosure, useHotkeys, useMediaQuery } from '@mantine/hooks'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useId, useRef, useState } from 'react'
import dark from '../assets/ballistics-dark.svg'
import light from '../assets/ballistics-light.svg'
import { alphaNote } from '../lib/alpha.ts'
import { docsUrl } from '../lib/docs-url.ts'
import { repositoryUrl } from '../lib/repository-url.ts'
import { pageCoversRoute, sections } from '../lib/sections.ts'
import { shortcutAriaKeys } from '../lib/shortcuts.ts'
import { DocsLink } from './docs-link.tsx'
import { InstallButton } from './install-button.tsx'
import { NavIcon } from './nav-icons.tsx'
import { ReportIssueButton, ReportIssueDialog } from './report-issue.tsx'
import { RepositoryLink } from './repository-link.tsx'
import { SafetyBarButton } from './safety-dialog.tsx'
import { searchHost, siteSearchEvent } from './search-host.ts'
import { SettingsDialog } from './settings-dialog.ts'
import { openShortcuts, ShortcutsHelp, useShortcuts } from './shortcuts.tsx'
import { ThemeSwitch } from './theme-switch.tsx'
import { useRoute } from './use-route.ts'

// the search loads on its first use, so pages ship without it
const SiteSearch = dynamic(() => import('./site-search.tsx').then((m) => m.SiteSearch), {
  ssr: false,
})

const name = 'OpenReloading Ballistics'

// inlined at build; no link without it
const repository = repositoryUrl(process.env.NEXT_PUBLIC_REPOSITORY_URL)
const docs = docsUrl(process.env.NEXT_PUBLIC_DOCS_URL)

type Section = (typeof sections)[number]

/**
 * The home link: the wordmark of the theme in use, picked by CSS before hydration as in `ThemeSwitch`,
 * with the early-alpha badge laid over its foot, so it takes no room in the bar (globals.css); its
 * tooltip, by pointer and keyboard focus, says that breaking changes are to be expected. `full`: the
 * whole wordmark in the top bar (a page without a visible title), else cut to its mark.
 */
function Brand({ onClick, full }: { onClick?: () => void; full?: boolean | undefined }) {
  const note = useId()
  return (
    <>
      <Tooltip label={alphaNote} position="bottom-start" transitionProps={{ duration: 0 }}>
        <Anchor
          component={Link}
          href="/"
          display="flex"
          {...(onClick && { onClick })}
          className={full ? 'brand brand-full' : 'brand'}
          aria-describedby={note}
        >
          <Image src={light} alt={name} width={100} height={40} className="mantine-dark-hidden" />
          <Image src={dark} alt={name} width={100} height={40} className="mantine-light-hidden" />
          <Badge component="span" size="xs" variant="filled" className="alpha-badge">
            Alpha
          </Badge>
        </Anchor>
      </Tooltip>
      {/* the tooltip renders only while open: screen readers get the note from here */}
      <span id={note} className="visually-hidden">
        {alphaNote}
      </span>
    </>
  )
}

/** A page link: in the sidebar (`rail`) an icon button whose tooltip, by pointer and keyboard, gives the label that stays its name; in the phone drawer a Mantine `NavLink` with its icon and label. */
function PageLink({
  href,
  label,
  route,
  rail,
  onOpen,
  onNavigate,
  hint,
}: {
  /** The page, or the icon's name for a button (`settings`, `search`). */
  href: string
  label: string
  route: string
  rail: boolean
  /** A button opening a dialog over the page (Settings, Search) instead of a link to `href`. */
  onOpen?: (() => void) | undefined
  /** Called when the link is followed (the drawer closes). */
  onNavigate?: (() => void) | undefined
  /** The key in the rail's tooltip (Ctrl K). */
  hint?: string | undefined
}) {
  const current = !onOpen && pageCoversRoute(href, route)
  const icon = <NavIcon name={href} />
  // the same look either way: a link to `href`, or a button opening the dialog
  const root = (props: object) =>
    onOpen ? (
      <button type="button" {...props} onClick={onOpen} aria-haspopup="dialog" />
    ) : (
      <Link {...props} href={href} {...(onNavigate && { onClick: onNavigate })} />
    )
  if (!rail)
    return (
      <NavLink
        renderRoot={root}
        label={label}
        leftSection={icon}
        active={current}
        aria-current={current ? 'page' : undefined}
      />
    )
  return (
    <Tooltip
      label={hint ? `${label} (${hint})` : label}
      position="right"
      transitionProps={{ duration: 0 }}
    >
      <ActionIcon
        renderRoot={root}
        size="xl"
        variant={current ? 'light' : 'subtle'}
        {...(!current && { color: 'gray' })}
        aria-label={label}
        aria-current={current ? 'page' : undefined}
        aria-keyshortcuts={hint && shortcutAriaKeys('search')}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  )
}

/** A section's links under its label; in the sidebar's rail the label is left to screen readers. */
function SectionLinks({
  section,
  route,
  rail,
  onNavigate,
}: {
  section: Section
  route: string
  rail: boolean
  onNavigate?: (() => void) | undefined
}) {
  // the sidebar stays in the document beside the drawer: ids of their own
  const id = useId()
  return (
    <div>
      <Text
        id={id}
        size="xs"
        fw={500}
        c="dimmed"
        mb={4}
        className={rail ? 'visually-hidden' : undefined}
      >
        {section.title}
      </Text>
      <Stack
        component="ul"
        aria-labelledby={id}
        gap={2}
        m={0}
        p={0}
        align={rail ? 'center' : 'stretch'}
        style={{ listStyle: 'none' }}
      >
        {section.pages.map((p) => (
          <li key={p.href}>
            <PageLink
              href={p.href}
              label={p.label}
              route={route}
              rail={rail}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </Stack>
    </div>
  )
}

/**
 * The site header: the top bar across the window at every
 * width, the banner, with the wordmark at the left, the page bar from 75em (page-bar.tsx) and the
 * Install, Safety and theme buttons at the right, and the burger that opens the drawer below 75em;
 * from 75em under it the icon rail (as Mantine UI's NavbarMinimal) with Search, the two
 * groups' links and Settings, and below 75em the drawer with the labelled links. Settings and Search open as dialogs over
 * the page, so the page and its inputs stay; Ctrl+K opens Search on every page.
 */
export function SiteHeader() {
  const route = useRoute()
  const [opened, { toggle, close }] = useDisclosure(false)
  // the drawer is only hidden by CSS from 75em: left open, its scroll lock and focus trap would stay
  const wide = useMediaQuery('(min-width: 75em)')
  useEffect(() => {
    if (wide) close()
  }, [wide, close])
  const openSettings = useContext(SettingsDialog)
  const [reporting, setReporting] = useState(false)
  // each request opens the site search; the workbench opens its own (`searchHost`)
  const [searches, setSearches] = useState(0)
  const openSearch = () => {
    if (searchHost.page) return searchHost.page()
    // the page is still hydrating after the header: its own search opens once it has mounted
    if (route === '/workbench') searchHost.wanted = true
    else setSearches((n) => n + 1)
  }
  // the page's own search field (home)
  useEffect(() => {
    window.addEventListener(siteSearchEvent, openSearch)
    return () => window.removeEventListener(siteSearchEvent, openSearch)
  })
  // also from a field, as the workbench's; there its own search takes the keys
  useHotkeys([['mod+K', () => searchHost.page || openSearch()]], [])
  // Ctrl+K is bound above, also inside a dialog
  useShortcuts({ search: null, help: openShortcuts })
  // from the drawer a dialog opens once the drawer has closed and given focus back to its button
  const afterDrawer = useRef<(() => void) | undefined>(undefined)
  const fromDrawer = (then: () => void) => () => {
    afterDrawer.current = then
    close()
  }
  return (
    <>
      <AppShellHeader px="md">
        <Group h="100%" wrap="nowrap">
          {/* the box is the size plus spacing xs: 28 gives the bar's 36 px */}
          <Burger
            hiddenFrom="lg"
            size={28}
            opened={opened}
            onClick={toggle}
            aria-label="Navigation"
            aria-expanded={opened}
          />
          <Brand full={route === '/'} />
          {/* from 75em the page bar sits between the wordmark and these (globals.css) */}
          <div className="top-end">
            {/* a slot kept while nothing is offered, so an offer moves nothing; from 75em Install is
                at the sidebar's foot, which leaves the page bar its width */}
            <Box hiddenFrom="lg" className="install-slot">
              <InstallButton position="bottom" />
            </Box>
            <Box hiddenFrom="lg">
              <SafetyBarButton iconOnly />
            </Box>
            <ReportIssueButton url={repository} onOpen={() => setReporting(true)} />
            <RepositoryLink url={repository} />
            <ThemeSwitch />
          </div>
        </Group>
      </AppShellHeader>
      <AppShellNavbar component="div" visibleFrom="lg" p="sm" className="sidebar">
        {/* hidden below 75em, so one navigation "Main" is in the tree at any width. The links scroll in
            a window shorter than they are; the foot (Install, Settings) is outside that box, so it
            stays in view and nothing pressed at the box's edge makes it scroll (globals.css) */}
        <AppShellSection grow component="nav" aria-label="Main" className="rail">
          <Stack gap="xs" className="rail-links">
            <Stack gap={0} align="center">
              <PageLink
                href="search"
                label="Search"
                route={route}
                rail
                onOpen={openSearch}
                hint="Ctrl K"
              />
            </Stack>
            {sections.map((s) => (
              <SectionLinks key={s.title} section={s} route={route} rail />
            ))}
          </Stack>
          <Stack gap="xs" align="center" pt="sm" className="rail-foot">
            <Divider w="100%" />
            {/* a kept slot, so an offer moves nothing */}
            <div className="install-slot">
              <InstallButton position="right" />
            </div>
            <PageLink
              href="settings"
              label="Settings"
              route={route}
              rail
              onOpen={() => openSettings()}
            />
            <DocsLink url={docs} />
          </Stack>
        </AppShellSection>
      </AppShellNavbar>
      <Drawer.Root
        opened={opened}
        onClose={close}
        size="xs"
        hiddenFrom="lg"
        onExitTransitionEnd={() => {
          afterDrawer.current?.()
          afterDrawer.current = undefined
        }}
      >
        <Drawer.Overlay />
        {/* named by its own label: the wordmark's alpha badge and note would join a title's name */}
        <Drawer.Content aria-label="Navigation">
          {/* a div: a second <header> outside the page header would be another banner landmark */}
          <Drawer.Header component="div">
            <Brand onClick={close} />
            {/* focus starts here: on the wordmark it would open the alpha tooltip over the links */}
            <Drawer.CloseButton aria-label="Close navigation" data-autofocus />
          </Drawer.Header>
          <Drawer.Body>
            {/* the sidebar's list with the current page marked, rows 44 px high */}
            <Stack component="nav" aria-label="Main" gap="md" className="drawer-nav">
              <PageLink
                href="search"
                label="Search"
                route={route}
                rail={false}
                onOpen={fromDrawer(openSearch)}
              />
              {sections.map((s) => (
                <SectionLinks
                  key={s.title}
                  section={s}
                  route={route}
                  rail={false}
                  onNavigate={close}
                />
              ))}
              <Divider />
              <PageLink
                href="settings"
                label="Settings"
                route={route}
                rail={false}
                onOpen={fromDrawer(() => openSettings())}
              />
              <ReportIssueButton
                url={repository}
                drawer
                onOpen={fromDrawer(() => setReporting(true))}
              />
              <DocsLink url={docs} drawer />
              <RepositoryLink url={repository} drawer />
            </Stack>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
      {repository && (
        <ReportIssueDialog
          repository={repository}
          opened={reporting}
          onClose={() => setReporting(false)}
        />
      )}
      {searches > 0 && <SiteSearch request={searches} />}
      <ShortcutsHelp />
    </>
  )
}
