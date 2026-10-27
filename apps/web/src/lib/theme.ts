import { createTheme } from '@mantine/core'
import { storageName } from './edition.ts'

/** `localStorage` key of the viewer's choice, `light` or `dark`; absent, the system setting applies. */
export const colorSchemeKey = storageName('theme')

/**
 * Inline `<head>` script: sets `data-mantine-color-scheme` to the stored choice, else the system setting, before the first paint.
 * Mantine's `ColorSchemeScript` skips the system setting when storage throws, so dark systems would see light first.
 */
export const colorSchemeScript = `var t;try{t=localStorage.getItem('${colorSchemeKey}')}catch(e){}document.documentElement.setAttribute('data-mantine-color-scheme',t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')`

/**
 * The control size scale, Mantine sizes only: `bar` for the top bar, the page bars and the
 * toolbars (36 px; the theme's defaults below), `row` for dense rows: card heads, table rows,
 * filters, side panels and notes (30 px). Text buttons take `button`, icon buttons (square at the
 * same height) `icon`, segmented toggles `toggle`, inputs `input`. Below them the dense property
 * grids' fields (24 px, `--field-height` in globals.css) and above them 44 px touch targets.
 * Checkboxes, radios and switches are 16 px, close buttons 24 px (WCAG 2.2 target size), everywhere.
 */
export const controlSize = {
  bar: { button: 'sm', icon: 'input-sm', toggle: 'sm', input: 'sm' },
  row: { button: 'xs', icon: 'input-xs', toggle: 'xs', input: 'xs' },
} as const

/** Width of the page container of header, main and footer: the page type's token in globals.css. */
export const pageWidth = 'var(--page-width)'

// Colours stay CSS custom properties in globals.css, shared with the drawing; Mantine reads them there.
export const theme = createTheme({
  fontFamily: 'var(--font-ui), system-ui, sans-serif',
  primaryColor: 'blue',
  // white text on filled buttons needs shade 8 for 4.5:1 (shade 6 gives about 3.5:1)
  primaryShade: 8,
  // a dense desktop tool: 15 px body, tighter small spacing, small controls and tables
  // square corners: every radius step 0; a circle only where it is the shape (globals.css)
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
  // xs and sm tighter; md and up as Mantine's, so page containers and the drawings in them keep
  // their size (the drawing baseline holds). Mantine's components read these; the steps of
  // globals.css are 0.25, 0.5, 0.75, 1 and 1.5rem
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
    // inactive panels keep an inline `display: none` that print CSS can override; the default
    // React `Activity` mode sets it with !important
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
    // hover help also on keyboard focus; a tooltip that holds help a touch user needs sets `touch`
    Tooltip: {
      defaultProps: { withArrow: true, events: { hover: true, focus: true, touch: false } },
    },
    // the cell padding of the element default in globals.css
    Table: { defaultProps: { verticalSpacing: '0.25rem', horizontalSpacing: '0.5rem' } },
  },
})

/** Tooltip events: hover, keyboard focus and touch, so help reaches every input. */
export const tipEvents = { hover: true, focus: true, touch: true }
