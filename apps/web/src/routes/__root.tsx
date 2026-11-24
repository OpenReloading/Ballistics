import { localStorageColorSchemeManager, mantineHtmlProps } from '@mantine/core'
import { colors } from '@rangefoundry/design-tokens'
import { UiProvider } from '@rangefoundry/ui'
import uiCss from '@rangefoundry/ui/ui.css?url'
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { LucideProvider } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'
import { ConfirmHost } from '../components/confirm.tsx'
import { SettingsDialogProvider } from '../components/providers.tsx'
import { UnitsProvider } from '../components/units-settings.tsx'
import { startLanguage, useTranslation } from '../i18n/language.ts'
import { linguiOf } from '../i18n/lingui.ts'
import { decimalMark } from '../i18n/number.ts'
import { colorSchemeKey, colorSchemeScript, iconDefaults } from '../lib/theme.ts'
import interRegular from '../platform/fonts/Inter-Regular.woff2?url'
import interSemiBold from '../platform/fonts/Inter-SemiBold.woff2?url'
import { uiFont } from '../platform/fonts/ui.ts'
import appCss from '../styles.css?url'
import { AppError } from './-error.tsx'
import { Shell } from './-shell.tsx'
import { socialImage } from './-social-image.ts'

const colorSchemeManager = localStorageColorSchemeManager({ key: colorSchemeKey })

// Vite's base with its trailing slash: / or /Ballistics/next/
const base = import.meta.env.BASE_URL

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
      // the window bar of the installed app follows the system theme (--page of the tokens)
      { name: 'theme-color', media: '(prefers-color-scheme: light)', content: colors.light.page },
      { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: colors.dark.page },
      ...socialImage,
    ],
    links: [
      // ui's own rules before the app's: the app's styles bring Mantine's in cascade layers, the tokens and the font
      { rel: 'stylesheet', href: uiCss },
      { rel: 'stylesheet', href: appCss },
      // the UI faces load before the first paint, as next/font preloads them: a swap after it shifts the text
      ...[interRegular, interSemiBold].map((href) => ({
        rel: 'preload',
        href,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous' as const,
      })),
      { rel: 'manifest', href: `${base}manifest.webmanifest` },
      { rel: 'icon', href: `${base}icon.png`, type: 'image/png', sizes: '512x512' },
      {
        rel: 'apple-touch-icon',
        href: `${base}apple-icon.png`,
        type: 'image/png',
        sizes: '180x180',
      },
    ],
  }),
  shellComponent: Document,
  component: Root,
  errorComponent: AppError,
})

// the providers sit in the shell, so the error page that replaces Root still has them
function Document({ children }: { children: ReactNode }) {
  // the stored language applies after mounting: the prerender and hydration are English
  useEffect(startLanguage, [])
  // one language for the views' own messages and the Lingui ones; number inputs write its decimal mark
  const { language } = useTranslation()
  return (
    <html lang="en" {...mantineHtmlProps} className={uiFont.variable}>
      {/* oxlint-disable-next-line nextjs/no-head-element -- TanStack Start's shell writes the document's own head */}
      <head>
        {/* oxlint-disable-next-line react/no-danger -- constant script, no user input */}
        <script dangerouslySetInnerHTML={{ __html: colorSchemeScript }} />
        <HeadContent />
      </head>
      <body>
        <UiProvider
          i18n={linguiOf(language)}
          decimalMark={decimalMark(language)}
          defaultColorScheme="auto"
          colorSchemeManager={colorSchemeManager}
        >
          <LucideProvider {...iconDefaults}>
            <UnitsProvider>
              {/* first: its Escape listener is added before the page's dialogs add theirs */}
              <ConfirmHost />
              <SettingsDialogProvider>{children}</SettingsDialogProvider>
            </UnitsProvider>
          </LucideProvider>
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
  return (
    <Shell>
      <Outlet />
    </Shell>
  )
}
