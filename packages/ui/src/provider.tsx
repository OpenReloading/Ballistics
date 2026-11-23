'use client'

import type { I18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import {
  type CSSVariablesResolver,
  createTheme,
  defaultVariantColorsResolver,
  MantineProvider,
  type MantineProviderProps,
  type MantineThemeComponents,
  type VariantColorsResolver,
} from '@mantine/core'
import { cssVariables, theme } from '@rangefoundry/design-tokens'
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

/** The bar size (ui.css) for buttons, icons and fields; boxes, radios and switches xs (16 px); close buttons 24 px (WCAG 2.2 target size). */
const components = {
  // React `Activity` sets `display: none` with !important, which print CSS cannot override.
  Tabs: { defaultProps: { keepMountedMode: 'display-none' } },
  Accordion: { defaultProps: { keepMountedMode: 'display-none' } },
  Button: { defaultProps: { size: 'sm' } },
  ActionIcon: { defaultProps: { size: 'input-sm' } },
  TextInput: { defaultProps: { size: 'sm' } },
  NativeSelect: { defaultProps: { size: 'sm' } },
  Select: { defaultProps: { size: 'sm' } },
  Textarea: { defaultProps: { size: 'sm' } },
  SegmentedControl: { defaultProps: { size: 'sm' } },
  Checkbox: { defaultProps: { size: 'xs' } },
  Radio: { defaultProps: { size: 'xs' } },
  // their fallback radius is a pill, not a radius step
  Switch: { defaultProps: { size: 'xs', radius: 0 } },
  Badge: { defaultProps: { radius: 0 } },
  Pill: { defaultProps: { radius: 0 } },
  CloseButton: { defaultProps: { size: 24 } },
  // Also on keyboard focus; `interactive` keeps it open under the pointer (WCAG 1.4.13, hoverable).
  Tooltip: {
    defaultProps: {
      withArrow: true,
      interactive: true,
      events: { hover: true, focus: true, touch: false },
    },
  },
  Table: { defaultProps: { verticalSpacing: '0.25rem', horizontalSpacing: '0.5rem' } },
} satisfies MantineThemeComponents

/** The theme whose number inputs write the decimal mark `mark` (they read both marks). */
const themeFor = (mark: '.' | ',') =>
  createTheme({
    ...theme,
    variantColorResolver,
    // no 1 px press offset on Button and ActionIcon: in a scroll box it showed a scrollbar
    activeClassName: '',
    components: {
      ...components,
      NumberInput: { defaultProps: { size: 'sm', decimalSeparator: mark } },
    },
  })

// one theme per mark, so a render keeps the theme's identity
const themes = { '.': themeFor('.'), ',': themeFor(',') }
const resolver: CSSVariablesResolver = () => cssVariables

/** The generated theme with the control sizes as component defaults, the scheme colors it cannot set and `i18n` holding `uiMessages` beside the app's own; `decimalMark` is the mark number inputs write (`.` when absent); only the color scheme besides, as Mantine's theme, class and variable props would undo ui.css or the tokens; load `@rangefoundry/ui/ui.css` with it. */
export function UiProvider({
  i18n,
  decimalMark = '.',
  ...props
}: { i18n: I18n; decimalMark?: '.' | ',' } & Pick<
  MantineProviderProps,
  'children' | 'defaultColorScheme' | 'forceColorScheme' | 'colorSchemeManager'
>): ReactElement {
  return (
    <I18nProvider i18n={i18n}>
      <MantineProvider {...props} theme={themes[decimalMark]} cssVariablesResolver={resolver} />
    </I18nProvider>
  )
}
