import { describe, expect, it } from 'vitest'
import { colorSchemeScript } from '../src/lib/theme.ts'

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
