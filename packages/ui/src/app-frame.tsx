'use client'

import { AppShell, Burger, Group } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { ReactElement, ReactNode } from 'react'

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
  const [opened, { toggle }] = useDisclosure(false)
  return (
    <AppShell
      header={{ height: { base: 52, lg: 56 } }}
      navbar={{ width: '4.5rem', breakpoint: 'lg', collapsed: { mobile: !opened } }}
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
          />
          {brand}
          <Group ml="auto" wrap="nowrap" gap="xs">
            {end}
            {account}
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar component="nav" aria-label={labels.navigation} p="xs">
        {navigation}
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
