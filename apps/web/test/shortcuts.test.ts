import { describe, expect, it } from 'vitest'
import {
  isSingleKey,
  parseSingleKeys,
  type ShortcutId,
  shortcutAriaKeys,
  shortcutLabel,
  shortcutMatches,
  shortcuts,
} from '../src/lib/shortcuts.ts'

const ids = Object.keys(shortcuts) as ShortcutId[]
/** Every combination a key string stands for: `mod` is Ctrl or Cmd. */
const expand = (k: string) =>
  k.includes('mod+') ? [k.replace('mod+', 'ctrl+'), k.replace('mod+', 'meta+')] : [k]
const combos = (id: ShortcutId) => shortcuts[id].keys.flatMap(expand).map((k) => k.toLowerCase())

const key = (key: string, mods: Partial<KeyboardEvent> = {}) =>
  ({
    key,
    code: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...mods,
  }) as KeyboardEvent

describe('shortcuts', () => {
  it('binds no key the browser, its devtools or macOS keep', () => {
    const reserved = [
      ...['n', 't', 'w', 'tab', 'l', 'r', 'shift+c', 'shift+i', 'shift+j'].map((k) => `ctrl+${k}`),
      ...['n', 't', 'w', 'l', 'r', 'y', 'q', 'h', 'm'].map((k) => `meta+${k}`),
      'f5',
    ]
    for (const id of ids)
      for (const c of combos(id)) expect(reserved, `${id}: ${c}`).not.toContain(c)
  })

  it('gives every combination one action', () => {
    const all = ids.flatMap(combos)
    expect(new Set(all).size).toBe(all.length)
  })

  it('fires a single key only outside text fields', () => {
    for (const id of ids)
      if (shortcuts[id].keys.some((k) => !k.includes('+'))) expect(shortcuts[id].fields).toBeFalsy()
  })

  it('names the single-key shortcuts Settings can turn off, and reads the stored choice', () => {
    expect(ids.filter(isSingleKey)).toEqual(['help', 'focusSearch'])
    expect(parseSingleKeys(null)).toBe(true)
    expect(parseSingleKeys('off')).toBe(false)
    expect(parseSingleKeys('anything else')).toBe(true)
  })

  it('shows Ctrl and names Cmd to screen readers', () => {
    expect(shortcutLabel('save')).toBe('Ctrl+S')
    expect(shortcutAriaKeys('save')).toBe('Control+S Meta+S')
    expect(shortcutLabel('redo')).toBe('Ctrl+Shift+Z or Ctrl+Y')
    expect(shortcutAriaKeys('redo')).toBe('Control+Shift+Z Meta+Shift+Z Control+Y')
    expect(shortcutLabel('help')).toBe('?')
    expect(shortcutAriaKeys('focusSearch')).toBe('/')
  })

  it('matches Ctrl or Cmd, the shift state exactly, and characters on any layout', () => {
    expect(shortcutMatches('save', key('s', { ctrlKey: true }))).toBe(true)
    expect(shortcutMatches('save', key('s', { metaKey: true }))).toBe(true)
    expect(shortcutMatches('save', key('S', { ctrlKey: true, shiftKey: true }))).toBe(false)
    expect(shortcutMatches('saveAs', key('S', { ctrlKey: true, shiftKey: true }))).toBe(true)
    expect(shortcutMatches('undo', key('Z', { metaKey: true, shiftKey: true }))).toBe(false)
    expect(shortcutMatches('redo', key('Z', { metaKey: true, shiftKey: true }))).toBe(true)
    expect(shortcutMatches('redo', key('y', { ctrlKey: true }))).toBe(true)
    // Cmd+Y opens the history on macOS
    expect(shortcutMatches('redo', key('y', { metaKey: true }))).toBe(false)
    // AltGr is Ctrl+Alt on Windows
    expect(shortcutMatches('save', key('s', { ctrlKey: true, altKey: true }))).toBe(false)
    // "/" is Shift+7 and "?" Shift+ß on a German layout
    expect(shortcutMatches('focusSearch', key('/', { shiftKey: true }))).toBe(true)
    expect(shortcutMatches('help', key('?', { shiftKey: true }))).toBe(true)
    expect(shortcutMatches('help', key('?', { ctrlKey: true, shiftKey: true }))).toBe(false)
  })
})
