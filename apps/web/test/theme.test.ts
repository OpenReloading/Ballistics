import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { colorSchemeKey, colorSchemeScript, theme } from '../src/lib/theme.ts'

const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function script(stored: string | null | Error, systemDark: boolean) {
  const attrs: Record<string, string> = {}
  const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } }
  const localStorage = {
    getItem: () => {
      if (stored instanceof Error) throw stored
      return stored
    },
  }
  const matchMedia = (q: string) => ({
    matches: systemDark && q === '(prefers-color-scheme: dark)',
  })
  new Function('document', 'localStorage', 'matchMedia', colorSchemeScript)(
    document,
    localStorage,
    matchMedia,
  )
  return attrs
}

const run = (stored: string | null | Error, systemDark: boolean) =>
  script(stored, systemDark)['data-mantine-color-scheme']

describe('colorSchemeScript', () => {
  it('applies a stored choice over the system setting', () => {
    expect(run('dark', false)).toBe('dark')
    expect(run('light', true)).toBe('light')
  })

  it('follows the system setting with nothing or an unknown value stored', () => {
    expect(run(null, true)).toBe('dark')
    expect(run(null, false)).toBe('light')
    expect(run('auto', true)).toBe('dark')
  })

  it('follows the system setting when storage throws', () => {
    expect(run(new DOMException('blocked', 'SecurityError'), true)).toBe('dark')
  })
})

describe('theme', () => {
  it('keeps the storage key `theme`, so a stored choice survives', () => {
    expect(colorSchemeKey).toBe('theme')
  })

  it('sets Inter for text and respects reduced motion', () => {
    expect(theme.fontFamily).toMatch(/^var\(--font-ui\)/)
    expect(theme.respectReducedMotion).toBe(true)
  })
})

describe('globals.css', () => {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8')
  const block = (prefix: string) => {
    const start = css.indexOf(`${prefix} {\n`)
    expect(start, prefix).toBeGreaterThanOrEqual(0)
    const body = css.slice(css.indexOf('{', start + prefix.length) + 1, css.indexOf('}', start))
    return new Map(
      body
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d !== '')
        .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]),
    )
  }
  const light = block(':root')
  const dark = block('@media screen {\n  :root[data-mantine-color-scheme="dark"]')

  it('holds a dark value for every literal light token, on screen only', () => {
    const literal = [...light].filter(([, v]) => !v.startsWith('var(')).map(([k]) => k)
    expect(light.get('color-scheme')).toBe('light')
    expect(dark.get('color-scheme')).toBe('dark')
    expect([...dark.keys()].sort(byCode)).toEqual(literal.sort(byCode))
  })

  it('points the Mantine colours at the shared tokens in both schemes', () => {
    expect(light.get('--mantine-color-body')).toBe('var(--bg)')
    expect(light.get('--mantine-color-text')).toBe('var(--fg)')
    expect(light.get('--mantine-color-anchor')).toBe('var(--link)')
    expect([...dark.keys()].filter((k) => k.startsWith('--mantine-'))).toEqual([])
  })
})
