'use client'

import type { I18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import {
  type CSSVariablesResolver,
  createTheme,
  defaultVariantColorsResolver,
  MantineProvider,
  type MantineProviderProps,
  type VariantColorsResolver,
} from '@mantine/core'
import { cssVariables, theme } from '@open-reloading/design-tokens'
import type { ReactElement } from 'react'

/** Filled controls of the accent take its text color per scheme, which the tokens set (Mantine's own is white). */
const variantColorResolver: VariantColorsResolver = (input) => {
  const colors = defaultVariantColorsResolver(input)
  const accent = (input.color ?? input.theme.primaryColor) === input.theme.primaryColor
  if (input.variant !== 'filled' || !accent) return colors
  return {
    ...colors,
    color: 'var(--mantine-primary-color-contrast)',
    hoverColor: 'var(--mantine-primary-color-contrast)',
  }
}

const uiTheme = createTheme({ ...theme, variantColorResolver })
const resolver: CSSVariablesResolver = () => cssVariables

/** The generated theme, the scheme colors it cannot set and `i18n` holding `uiMessages` beside the app's own; only the color scheme besides, as Mantine's theme, class and variable props would undo ui.css or the tokens; load `@open-reloading/ui/ui.css` with it. */
export function UiProvider({
  i18n,
  ...props
}: { i18n: I18n } & Pick<
  MantineProviderProps,
  'children' | 'defaultColorScheme' | 'forceColorScheme' | 'colorSchemeManager'
>): ReactElement {
  return (
    <I18nProvider i18n={i18n}>
      <MantineProvider {...props} theme={uiTheme} cssVariablesResolver={resolver} />
    </I18nProvider>
  )
}
