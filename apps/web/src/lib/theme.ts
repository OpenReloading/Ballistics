/** `localStorage` key of the viewer's choice, `light` or `dark`; absent, the system setting applies. */
export const colorSchemeKey = 'theme'

/** Mantine's `ColorSchemeScript` skips the system setting when storage throws, so dark systems would flash light. */
export const colorSchemeScript = `var t;try{t=localStorage.getItem('${colorSchemeKey}')}catch(e){}document.documentElement.setAttribute('data-mantine-color-scheme',t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')`

/** `bar` 36 px (top bar, page bars, toolbars), `row` 30 px (card heads, table rows, filters, side panels, notes); checkboxes, radios and switches 16 px, close buttons 24 px (WCAG 2.2 target size). */
export const controlSize = {
  bar: { button: 'sm', icon: 'input-sm', toggle: 'sm', input: 'sm' },
  row: { button: 'xs', icon: 'input-xs', toggle: 'xs', input: 'xs' },
} as const

/** Icons at their text's size with a 1.5 stroke on Lucide's 24 grid; lucide-react 1.73.0 types the provider's `size` as a number, though its icons take any CSS length. */
export const iconDefaults = { size: '1em' as unknown as number, strokeWidth: 1.5 }

/** Width of the page container of header, main and footer: the page type's token in globals.css. */
export const pageWidth = 'var(--page-width)'

/** Tooltip events: hover, keyboard focus and touch, so help reaches every input. */
export const tipEvents = { hover: true, focus: true, touch: true }
