import './layers.css'
import '@mantine/core/styles/baseline.layer.css'
import '@mantine/core/styles/default-css-variables.layer.css'
import '@mantine/core/styles/global.layer.css'
import '@mantine/core/styles/UnstyledButton.layer.css'
import '@mantine/core/styles/Paper.layer.css'
import '@mantine/core/styles/CloseButton.layer.css'
import '@mantine/core/styles/Popover.layer.css'
import '@mantine/core/styles/Tooltip.layer.css'
import '@mantine/core/styles/Group.layer.css'
import '@mantine/core/styles/Flex.layer.css'
import '@mantine/core/styles/Overlay.layer.css'
import '@mantine/core/styles/ModalBase.layer.css'
import '@mantine/core/styles/Modal.layer.css'
import '@mantine/core/styles/ScrollArea.layer.css'
import '@mantine/core/styles/ActionIcon.layer.css'
import '@mantine/core/styles/Text.layer.css'
import '@mantine/core/styles/Title.layer.css'
import '@mantine/core/styles/Divider.layer.css'
import '@mantine/core/styles/Anchor.layer.css'
import '@mantine/core/styles/Burger.layer.css'
import '@mantine/core/styles/Container.layer.css'
import '@mantine/core/styles/AppShell.layer.css'
import '@mantine/core/styles/NavLink.layer.css'
import '@mantine/core/styles/Stack.layer.css'
import '@mantine/core/styles/Drawer.layer.css'
import '@mantine/core/styles/Badge.layer.css'
import '@mantine/core/styles/FloatingIndicator.layer.css'
import '@mantine/core/styles/SegmentedControl.layer.css'
import '@mantine/core/styles/Input.layer.css'
import '@mantine/core/styles/Combobox.layer.css'
import '@mantine/core/styles/Pill.layer.css'
import '@mantine/core/styles/PillsInput.layer.css'
import '@mantine/core/styles/Button.layer.css'
import '@mantine/core/styles/Loader.layer.css'
import '@mantine/core/styles/Table.layer.css'
import '@mantine/core/styles/EmptyState.layer.css'
import '@mantine/core/styles/Skeleton.layer.css'
import '@mantine/core/styles/Alert.layer.css'
import '@mantine/core/styles/Notification.layer.css'
import '@mantine/core/styles/Affix.layer.css'
import '@mantine/core/styles/Code.layer.css'
import '@mantine/core/styles/Kbd.layer.css'
import '@mantine/core/styles/Accordion.layer.css'
import '@mantine/core/styles/Tabs.layer.css'
import '@mantine/core/styles/NumberInput.layer.css'
import '@mantine/core/styles/Menu.layer.css'
import '@mantine/core/styles/Card.layer.css'
import '@mantine/core/styles/SimpleGrid.layer.css'
import '@mantine/core/styles/InlineInput.layer.css'
import '@mantine/core/styles/Checkbox.layer.css'
import '@mantine/core/styles/CheckboxIndicator.layer.css'
import '@mantine/core/styles/Switch.layer.css'
import '@mantine/core/styles/Radio.layer.css'
import '@mantine/core/styles/RadioIndicator.layer.css'
import '@mantine/core/styles/RadioCard.layer.css'
import '@mantine/core/styles/ColorSwatch.layer.css'
import '@mantine/core/styles/Indicator.layer.css'
import '@mantine/core/styles/Slider.layer.css'
import '@mantine/spotlight/styles.layer.css'
import './globals.css'
import { Container, mantineHtmlProps } from '@mantine/core'
import type { Metadata, Viewport } from 'next'
import { OfflineLayer } from '../components/offline-layer.tsx'
import { PageShell } from '../components/page-shell.tsx'
import { Providers } from '../components/providers.tsx'
import { ResultsSkipLink } from '../components/results-skip-link.tsx'
import { SafetyDialog } from '../components/safety-dialog.tsx'
import { basePath } from '../lib/edition.ts'
import { colorSchemeScript, pageWidth } from '../lib/theme.ts'
import { uiFont } from './fonts/ui.ts'

export const metadata: Metadata = {
  title: { default: 'OpenReloading Ballistics', template: '%s · OpenReloading Ballistics' },
  description: 'A ballistics database with interior and exterior ballistics simulations.',
  // the social image needs an absolute URL: only the Pages edition knows its origin (`PAGES_URL`)
  ...(process.env.PAGES_URL && {
    metadataBase: new URL(`${process.env.PAGES_URL}${basePath}/`),
    openGraph: {
      images: {
        url: 'opengraph-image.png',
        width: 1280,
        height: 640,
        alt: 'OpenReloading Ballistics',
      },
    },
  }),
}

/** The window bar of the installed app follows the system theme (--bg of globals.css). */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#161616' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // the head script sets data-mantine-color-scheme before React hydrates
    <html lang="en" {...mantineHtmlProps} className={uiFont.variable}>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: constant script, no user input */}
        <script dangerouslySetInnerHTML={{ __html: colorSchemeScript }} />
      </head>
      <body>
        <Providers>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <ResultsSkipLink />
          <SafetyDialog />
          <OfflineLayer />
          {/* Mantine AppShell for the header and sidebar; the workbench makes .page-top a full-height column (globals.css) */}
          <PageShell>
            <div className="page-top">
              <Container component="main" id="main" tabIndex={-1} size={pageWidth}>
                {children}
              </Container>
            </div>
          </PageShell>
        </Providers>
      </body>
    </html>
  )
}
