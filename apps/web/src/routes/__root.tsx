import { useLingui } from '@lingui/react'
import { localStorageColorSchemeManager, mantineHtmlProps } from '@mantine/core'
import { AppFrame, UiProvider } from '@rangefoundry/ui'
import uiCss from '@rangefoundry/ui/ui.css?url'
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router'
import { type ReactNode, useEffect } from 'react'
import { startLanguage } from '../i18n/language.ts'
import { colorSchemeKey, colorSchemeScript } from '../lib/theme.ts'
import { uiFont } from '../platform/fonts/ui.ts'
import appCss from '../styles.css?url'
import { useStoredLanguage } from './-lingui.ts'
import { socialImage } from './-social-image.ts'
import { pageTitles } from './-static-paths.ts'

const colorSchemeManager = localStorageColorSchemeManager({ key: colorSchemeKey })

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'RangeFoundry Workbench' },
      {
        name: 'description',
        content: 'A ballistics database with interior and exterior ballistics simulations.',
      },
      ...socialImage,
    ],
    links: [
      { rel: 'stylesheet', href: uiCss },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: Document,
  component: Root,
})

// the providers sit in the shell, so the error page that replaces Root still has them
function Document({ children }: { children: ReactNode }) {
  const i18n = useStoredLanguage()
  return (
    <html lang="en" {...mantineHtmlProps} className={uiFont.variable}>
      {/* oxlint-disable-next-line nextjs/no-head-element -- TanStack Start's shell writes the document's own head */}
      <head>
        {/* oxlint-disable-next-line react/no-danger -- constant script, no user input */}
        <script dangerouslySetInnerHTML={{ __html: colorSchemeScript }} />
        <HeadContent />
      </head>
      <body>
        <UiProvider i18n={i18n} defaultColorScheme="auto" colorSchemeManager={colorSchemeManager}>
          {children}
        </UiProvider>
        <Scripts />
      </body>
    </html>
  )
}

function Root() {
  // the ready signal of the browser specs, as in the Next app's providers
  useEffect(() => {
    document.documentElement.dataset.hydrated = ''
  }, [])
  // the views' own messages follow this edition's stored language, as the Next app's providers start them
  useEffect(startLanguage, [])
  return (
    <AppFrame brand={<Link to="/">RangeFoundry Workbench</Link>} navigation={<Navigation />}>
      <Outlet />
    </AppFrame>
  )
}

// links with ui's class, as its NavItem takes no label without an icon
function Navigation() {
  const { i18n } = useLingui()
  return (
    <>
      {(['/workbench', '/session', '/groups'] as const).map((page) => (
        <Link key={page} to={`${page}/`} className="ui-nav-item">
          {i18n._(pageTitles[page])}
        </Link>
      ))}
      <Link to="/cartridges/" className="ui-nav-item">
        {i18n._({ id: 'nav.database', message: 'Database' })}
      </Link>
    </>
  )
}
