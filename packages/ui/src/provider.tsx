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

/**
 * Filled controls of the accent take its text color per scheme. Mantine's `autoContrast` picks one color from the light
 * shade, which leaves white text on the dark scheme's light accent (2.5:1).
 */
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

/** Mantine on the design tokens: the generated theme and the scheme colors it cannot set. Load `@open-reloading/ui/ui.css` with it. */
export function UiProvider(
  props: Omit<MantineProviderProps, 'theme' | 'cssVariablesResolver'>,
): ReactElement {
  return <MantineProvider {...props} theme={uiTheme} cssVariablesResolver={resolver} />
}
