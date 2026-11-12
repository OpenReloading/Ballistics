import { Container, mantineHtmlProps } from '@mantine/core'
import { colors } from '@open-reloading/design-tokens'
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { uiFont } from '../../../web/src/app/fonts/ui.ts'
import { OfflineLayer } from '../../../web/src/components/offline-layer.tsx'
import { PageShell } from '../../../web/src/components/page-shell.tsx'
import { PreReleaseData } from '../../../web/src/components/pre-release-data.tsx'
import { Providers } from '../../../web/src/components/providers.tsx'
import { ContentSkipLink, ResultsSkipLink } from '../../../web/src/components/results-skip-link.tsx'
import { SafetyDialog } from '../../../web/src/components/safety-dialog.tsx'
import { colorSchemeScript, pageWidth } from '../../../web/src/lib/theme.ts'
import styles from '../styles.css?url'

// app/layout.tsx on the router: its metadata as head tags, its tree as shell and root component
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'OpenReloading Ballistics' },
      {
        name: 'description',
        content: 'A ballistics database with interior and exterior ballistics simulations.',
      },
      { name: 'theme-color', media: '(prefers-color-scheme: light)', content: colors.light.page },
      { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: colors.dark.page },
    ],
    links: [{ rel: 'stylesheet', href: styles }],
  }),
  shellComponent: Document,
  component: Root,
})

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps} className={uiFont.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: colorSchemeScript }} />
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
  return (
    <Providers>
      <ContentSkipLink />
      <ResultsSkipLink />
      <SafetyDialog />
      <PreReleaseData />
      <OfflineLayer />
      <PageShell>
        <div className="page-top">
          <Container component="main" id="main" tabIndex={-1} size={pageWidth}>
            <Outlet />
          </Container>
        </div>
      </PageShell>
    </Providers>
  )
}
