import { getHotkeyHandler } from '@mantine/hooks'
import { type Message, msg } from '../i18n/translate.ts'

type Shortcut = { action: Message; keys: readonly string[]; fields?: boolean }

/**
 * The app's keyboard shortcuts: handlers, hints, the search's
 * command keys and the help dialog all read this table. A key is a `@mantine/hooks` hotkey (`mod`
 * is Ctrl or Cmd on every platform) or one character, which fires outside text fields only and on any
 * layout (so its shift state is not checked). `fields`: also fires while typing in a field.
 */
const table = {
  search: { action: msg('Search'), keys: ['mod+K'], fields: true },
  help: { action: msg('Keyboard shortcuts'), keys: ['?'] },
  focusSearch: { action: msg('Search the list'), keys: ['/'] },
  run: { action: msg('Run simulation'), keys: ['mod+Enter'], fields: true },
  save: { action: msg('Save'), keys: ['mod+S'], fields: true },
  saveAs: { action: msg('Save as'), keys: ['mod+shift+S'], fields: true },
  open: { action: msg('Open file'), keys: ['mod+O'], fields: true },
  // Cmd+Y opens the history on macOS: Ctrl only
  undo: { action: msg('Undo'), keys: ['mod+Z'] },
  redo: { action: msg('Redo'), keys: ['mod+shift+Z', 'ctrl+Y'] },
  print: { action: msg('Print'), keys: ['mod+P'], fields: true },
} satisfies Record<string, Shortcut>

export type ShortcutId = keyof typeof table
export const shortcuts: Record<ShortcutId, Shortcut> = table

const keysOf = (id: ShortcutId) => shortcuts[id].keys

/** `localStorage` key of the choice to turn the single-key shortcuts off (`off`); absent, they are on. */
export const singleKeysKey = 'single-key-shortcuts'

/** Whether a stored choice leaves the single-key shortcuts on: anything but `off`. */
export const parseSingleKeys = (text: string | null) => text !== 'off'

/** Whether `id` is bound to one character alone, which Settings can turn off. */
export const isSingleKey = (id: ShortcutId) => keysOf(id).every((k) => k.length === 1)
const parts = (k: string) => k.split('+')
const cap = (p: string) => p.charAt(0).toUpperCase() + p.slice(1)

/** The keys as shown in hints: `Ctrl+Shift+Z or Ctrl+Y` (shown as Ctrl on every platform, Cmd works too). */
export const shortcutLabel = (id: ShortcutId) =>
  keysOf(id)
    .map((k) =>
      parts(k)
        .map((p) => (p === 'mod' ? 'Ctrl' : cap(p)))
        .join('+'),
    )
    .join(' or ')

/** The `aria-keyshortcuts` value: each `mod` key as Control and as Meta. */
export const shortcutAriaKeys = (id: ShortcutId) =>
  keysOf(id)
    .flatMap((k) => {
      const named = parts(k)
        .map((p) => (p === 'ctrl' ? 'Control' : cap(p)))
        .join('+')
      return k.includes('mod+')
        ? [named.replace('Mod', 'Control'), named.replace('Mod', 'Meta')]
        : [named]
    })
    .join(' ')

/** Mantine's own matcher, which it does not export alone. */
const hits = (k: string, e: KeyboardEvent) => {
  let hit = false
  getHotkeyHandler([[k, () => (hit = true), { preventDefault: false }]])(e)
  return hit
}

/**
 * True when key event `e` is one of the keys of `id`. A single-character key matches only without
 * Ctrl, Meta or Alt.
 */
export const shortcutMatches = (id: ShortcutId, e: KeyboardEvent) =>
  keysOf(id).some((k) =>
    k.length === 1 ? e.key === k && !e.ctrlKey && !e.metaKey && !e.altKey : hits(k, e),
  )
