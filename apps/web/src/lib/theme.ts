import { createTheme } from '@mantine/core'
import { storageName } from './edition.ts'

/** `localStorage` key of the viewer's choice, `light` or `dark`; absent, the system setting applies. */
export const colorSchemeKey = storageName('theme')

/** Mantine's `ColorSchemeScript` skips the system setting when storage throws, so dark systems would flash light. */
export const colorSchemeScript = `var t;try{t=localStorage.getItem('${colorSchemeKey}')}catch(e){}document.documentElement.setAttribute('data-mantine-color-scheme',t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')`

/** `bar` 36 px (top bar, page bars, toolbars), `row` 30 px (card heads, table rows, filters, side panels, notes); checkboxes, radios and switches 16 px, close buttons 24 px (WCAG 2.2 target size). */
export const controlSize = {
  bar: { button: 'sm', icon: 'input-sm', toggle: 'sm', input: 'sm' },
  row: { button: 'xs', icon: 'input-xs', toggle: 'xs', input: 'xs' },
} as const

/** Width of the page container of header, main and footer: the page type's token in globals.css. */
export const pageWidth = 'var(--page-width)'

// Colors stay CSS custom properties (the palette in tokens.css of @open-reloading/design-tokens, the rest in globals.css), shared with the drawing; Mantine reads them there.
export const theme = createTheme({
  fontFamily: 'var(--font-ui), system-ui, sans-serif',
  primaryColor: 'blue',
  // white text on filled buttons needs shade 8 for 4.5:1 (shade 6 gives about 3.5:1)
  primaryShade: 8,
  // A dense desktop tool: 15 px body, small controls, square corners; a circle only where it is the shape (globals.css).
  defaultRadius: 0,
  radius: { xs: '0', sm: '0', md: '0', lg: '0', xl: '0' },
  // the only font sizes; globals.css reads them as --mantine-font-size-*
  fontSizes: {
    xs: '0.75rem',
    sm: '0.8125rem',
    md: '0.9375rem',
    lg: '1.0625rem',
    xl: '1.25rem',
  },
  // headings in main (globals.css), read as --mantine-h1-font-size to h3
  headings: {
    fontFamily: 'var(--font-ui), system-ui, sans-serif',
    sizes: {
      h1: { fontSize: '1.5rem', fontWeight: '650', lineHeight: '1.25' },
      h2: { fontSize: '1.125rem', fontWeight: '600', lineHeight: '1.3' },
      h3: { fontSize: '1rem', fontWeight: '600' },
    },
  },
  // xs and sm tighter; md and up as Mantine's, so page containers and their drawings keep their size
  spacing: {
    xs: '0.5rem',
    sm: '0.625rem',
  },
  breakpoints: {
    xs: '36em',
    sm: '48em',
    md: '62em',
    lg: '75em',
    xl: '88em',
  },
  respectReducedMotion: true,
  // no 1 px press offset on Button and ActionIcon: in the sidebar's scroll box it showed a scrollbar
  activeClassName: '',
  components: {
    // React `Activity` sets `display: none` with !important, which print CSS cannot override.
    Tabs: { defaultProps: { keepMountedMode: 'display-none' } },
    Accordion: { defaultProps: { keepMountedMode: 'display-none' } },
    Button: { defaultProps: { size: controlSize.bar.button } },
    ActionIcon: { defaultProps: { size: controlSize.bar.icon } },
    TextInput: { defaultProps: { size: controlSize.bar.input } },
    NumberInput: { defaultProps: { size: controlSize.bar.input } },
    NativeSelect: { defaultProps: { size: controlSize.bar.input } },
    Select: { defaultProps: { size: controlSize.bar.input } },
    Textarea: { defaultProps: { size: controlSize.bar.input } },
    SegmentedControl: { defaultProps: { size: controlSize.bar.toggle } },
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
    // the cell padding of the element default in globals.css
    Table: { defaultProps: { verticalSpacing: '0.25rem', horizontalSpacing: '0.5rem' } },
  },
})

/** The theme with the number inputs writing the decimal mark `mark` (they read both marks). */
export const themeFor = (mark: '.' | ','): typeof theme => ({
  ...theme,
  components: {
    ...theme.components,
    NumberInput: { defaultProps: { size: controlSize.bar.input, decimalSeparator: mark } },
  },
})

/** Tooltip events: hover, keyboard focus and touch, so help reaches every input. */
export const tipEvents = { hover: true, focus: true, touch: true }
