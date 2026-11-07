'use client'

import {
  type CSSVariablesResolver,
  createTheme,
  defaultVariantColorsResolver,
  MantineProvider,
  type MantineProviderProps,
  mergeThemeOverrides,
  type VariantColorsResolver,
} from '@mantine/core'
import { cssVariables, theme } from '@open-reloading/design-tokens'
import { type ReactElement, useMemo } from 'react'

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

/**
 * Mantine on the design tokens: the generated theme and the scheme colors it cannot set; a `theme` adds to it (an
 * app's component defaults). Load `@open-reloading/ui/ui.css` with it.
 */
export function UiProvider({
  theme: added,
  ...props
}: Omit<MantineProviderProps, 'cssVariablesResolver'>): ReactElement {
  const merged = useMemo(() => (added ? mergeThemeOverrides(uiTheme, added) : uiTheme), [added])
  return <MantineProvider {...props} theme={merged} cssVariablesResolver={resolver} />
}
