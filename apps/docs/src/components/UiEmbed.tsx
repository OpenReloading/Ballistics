import { useColorMode } from '@docusaurus/theme-common'
import { setupI18n } from '@lingui/core'
import { UiProvider, uiMessages } from '@rangefoundry/ui'
import { type ReactNode, useLayoutEffect } from 'react'
// Mantine's styles in their cascade layer, so the site's own unlayered rules keep the page around an embed; src/css/custom.css loads the tokens
import '@mantine/core/styles.layer.css'
import '@rangefoundry/ui/ui.css'

const i18n = setupI18n({ locale: 'en', messages: uiMessages })

/** Components of `@rangefoundry/ui` and Mantine in the interface base's provider, rendered into the page's HTML at build time and shown in the site's color mode. */
export default function UiEmbed({ children }: { children: ReactNode }): ReactNode {
  const { colorMode } = useColorMode()
  // forceColorScheme writes the scheme to <html> and keeps it there; a layout cleanup runs before the next page's embed writes its own
  useLayoutEffect(
    () => () => document.documentElement.removeAttribute('data-mantine-color-scheme'),
    [],
  )
  return (
    <div className="ui-embed">
      <UiProvider i18n={i18n} forceColorScheme={colorMode}>
        {children}
      </UiProvider>
    </div>
  )
}
