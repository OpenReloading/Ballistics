import { useLingui } from '@lingui/react'
import { ColorSchemeScript, localStorageColorSchemeManager, mantineHtmlProps } from '@mantine/core'
import { AppFrame, NavItem, UiProvider } from '@open-reloading/ui'
import uiCss from '@open-reloading/ui/ui.css?url'
import {
  createLink,
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { FlaskConical, House } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'
import { storageName } from '../edition.ts'
import { useStoredLanguage } from '../i18n.ts'
import { registerWorker } from '../sw-register.ts'

const schemeKey = storageName('mantine-color-scheme-value')
const colorSchemeManager = localStorageColorSchemeManager({ key: schemeKey })
const RouterNavItem = createLink(NavItem)

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Ballistics' },
    ],
    links: [{ rel: 'stylesheet', href: uiCss }],
  }),
  shellComponent: Document,
  component: Root,
})

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" localStorageKey={schemeKey} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function Root() {
  const i18n = useStoredLanguage()
  useEffect(() => {
    document.documentElement.dataset.hydrated = '1'
    registerWorker()
  }, [])
  return (
    <UiProvider i18n={i18n} defaultColorScheme="auto" colorSchemeManager={colorSchemeManager}>
      <AppFrame brand={<Link to="/">Ballistics</Link>} navigation={<Navigation />}>
        <Outlet />
      </AppFrame>
    </UiProvider>
  )
}

function Navigation() {
  const { i18n } = useLingui()
  return (
    <>
      <RouterNavItem to="/" icon={House} label={i18n._({ id: 'nav.home', message: 'Home' })} />
      <RouterNavItem
        to="/workbench/"
        icon={FlaskConical}
        label={i18n._({ id: 'nav.workbench', message: 'Workbench' })}
      />
    </>
  )
}
