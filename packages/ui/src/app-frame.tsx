'use client'

import { AppShell, Burger, Group } from '@mantine/core'
import { useDisclosure, useWindowEvent } from '@mantine/hooks'
import { type MouseEvent, type ReactElement, type ReactNode, useId } from 'react'

export interface AppFrameProps {
  /** The product's name or mark, as a link home. */
  brand: ReactNode
  /** The main navigation's links: a rail from 75em, a panel the menu button opens below it. */
  navigation: ReactNode
  /** Actions at the end of the top bar, such as settings. */
  end?: ReactNode
  /** The account menu of a surface with accounts; the offline apps leave it out. */
  account?: ReactNode
  /** The accessible names of the menu button and the navigation, in the page's language. */
  labels: { menu: string; navigation: string }
  /** The page, with its page bar first. */
  children: ReactNode
}

/** The frame of every app: the top bar, the main navigation and the page. */
export function AppFrame({
  brand,
  navigation,
  end,
  account,
  labels,
  children,
}: AppFrameProps): ReactElement {
  const [opened, { toggle, close }] = useDisclosure(false)
  const navigationId = useId()
  useWindowEvent('keydown', (event) => {
    if (event.key === 'Escape') close()
  })
  // a followed link closes the panel, also when a router changes the page without a reload
  const closeOnLink = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('a')) close()
  }
  return (
    <AppShell
      header={{ height: { base: 52, lg: 56 } }}
      navbar={{ width: '4.5rem', breakpoint: 'lg', collapsed: { mobile: !opened } }}
      mod={{ 'menu-open': opened }}
    >
      <AppShell.Header px="md">
        <Group h="100%" wrap="nowrap" gap="sm">
          <Burger
            hiddenFrom="lg"
            size="sm"
            opened={opened}
            onClick={toggle}
            aria-label={labels.menu}
            aria-expanded={opened}
            aria-controls={navigationId}
          />
          {brand}
          <Group ml="auto" wrap="nowrap" gap="xs">
            {end}
            {account}
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar
        id={navigationId}
        component="nav"
        aria-label={labels.navigation}
        p="xs"
        onClick={closeOnLink}
      >
        {navigation}
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
