'use client'

import { useLingui } from '@lingui/react'
import { AppShell, Burger, Drawer, Group } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { type MouseEvent, type ReactElement, type ReactNode, useEffect } from 'react'

export interface AppFrameProps {
  /** The product's name or mark, as a link home. */
  brand: ReactNode
  /** The main navigation's links: a rail from 75em, a drawer the menu button opens below it. */
  navigation: ReactNode
  /** Actions at the end of the top bar, such as settings. */
  end?: ReactNode
  /** The account menu of a surface with accounts; the offline apps leave it out. */
  account?: ReactNode
  /** The page, with its page bar first. */
  children: ReactNode
}

/** The frame of every app: the top bar, the main navigation and the page. */
export function AppFrame({
  brand,
  navigation,
  end,
  account,
  children,
}: AppFrameProps): ReactElement {
  const { i18n } = useLingui()
  const labels = {
    menu: i18n._({ id: 'ui.frame.menu', message: 'Navigation' }),
    navigation: i18n._({ id: 'ui.frame.navigation', message: 'Main' }),
    close: i18n._({ id: 'ui.frame.close', message: 'Close navigation' }),
  }
  const [opened, { toggle, close }] = useDisclosure(false)
  // the drawer is only hidden from 75em: left open there, its focus trap and scroll lock would stay
  const wide = useMediaQuery('(min-width: 75em)')
  useEffect(() => {
    if (wide) close()
  }, [wide, close])
  // a followed link in the drawer (the brand's too) closes it, also when a router changes the page without a reload
  const closeOnLink = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('a')) close()
  }
  return (
    <AppShell
      header={{ height: { base: 52, lg: 56 } }}
      navbar={{ width: '4.5rem', breakpoint: 'lg', collapsed: { mobile: true } }}
      padding="md"
    >
      <AppShell.Header px="md">
        <Group h="100%" wrap="nowrap" gap="sm">
          <Burger
            hiddenFrom="lg"
            size="sm"
            className="ui-frame-button"
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
      {/* hidden below 75em, where the drawer holds the links: one navigation in the tree at any width */}
      <AppShell.Navbar component="nav" aria-label={labels.navigation} p="xs" visibleFrom="lg">
        {navigation}
      </AppShell.Navbar>
      {/* Mantine's drawer traps the focus, closes on Escape and gives the focus back to the menu button */}
      <Drawer.Root opened={opened} onClose={close} size="xs" hiddenFrom="lg">
        <Drawer.Overlay />
        <Drawer.Content aria-label={labels.navigation} onClick={closeOnLink}>
          {/* a div: a second <header> outside the top bar would be another banner landmark */}
          <Drawer.Header component="div">
            {brand}
            <Drawer.CloseButton
              className="ui-frame-button"
              aria-label={labels.close}
              data-autofocus
            />
          </Drawer.Header>
          <Drawer.Body component="nav" aria-label={labels.navigation}>
            {navigation}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
