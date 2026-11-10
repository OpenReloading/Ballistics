import { readFileSync } from 'node:fs'
import { colors } from '@open-reloading/design-tokens'
import { describe, expect, it } from 'vitest'
import { groupColours } from '../src/lib/target-editor.ts'
import { missing } from './defined.ts'

describe('drawing tokens', () => {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8')
  const block = (prefix: string) => {
    const start = css.indexOf(`${prefix} {\n`)
    const body = css.slice(css.indexOf('{', start + prefix.length) + 1, css.indexOf('}', start))
    return new Map(
      [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(
        ([, k, v = missing()]) => [k, v.trim()] as const,
      ),
    )
  }
  const luminance = (hex: string) => {
    const [r = missing(), g = missing(), b = missing()] = [1, 3, 5].map((k) => {
      const c = Number.parseInt(hex.slice(k, k + 2), 16) / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  // WCAG 2.1 contrast ratio, https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
  const ratio = (a: string, b: string) => {
    const [x = missing(), y = missing()] = [luminance(a), luminance(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  // the palette of tokens.css under the app's own values, as the page cascades them
  const palette = (scheme: keyof typeof colors) =>
    Object.entries(colors[scheme]).map(([k, v]) => [`--${k}`, v as string] as const)
  it('prints the light values of tokens.css for every color its dark block sets', () => {
    const tokens = readFileSync(
      new URL(import.meta.resolve('@open-reloading/design-tokens/tokens.css')),
      'utf8',
    )
    const declarations = (text: string, selector: string, from = 0) => {
      const start = text.indexOf(`${selector} {\n`, from)
      expect(start, selector).toBeGreaterThanOrEqual(0)
      const body = text.slice(start + selector.length + 2, text.indexOf('}', start))
      return new Map(
        [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(
          ([, k, v = missing()]) => [k, v.trim()] as const,
        ),
      )
    }
    const printed = declarations(
      css,
      ':root[data-mantine-color-scheme]',
      css.indexOf('@media print {'),
    )
    const lightTokens = declarations(tokens, ':root')
    const darkTokens = declarations(
      tokens,
      ':root[data-mantine-color-scheme="dark"], :root[data-theme="dark"]',
    )
    for (const name of darkTokens.keys())
      expect(printed.get(name), name).toBe(lightTokens.get(name))
    for (const [name, value] of printed) expect(value, name).toBe(lightTokens.get(name))
  })

  const light = new Map([...palette('light'), ...block(':root')])
  const dark = new Map([
    ...palette('dark'),
    ...block('@media screen {\n  :root[data-mantine-color-scheme="dark"]'),
  ])
  for (const [theme, tokens] of [
    ['light', light],
    ['dark', dark],
  ] as const)
    it(`reaches 3:1 for every line and 4.5:1 for the text against --page in ${theme}`, () => {
      const bg = tokens.get('--page') as string
      for (const line of ['--draw-outline', '--draw-edge', '--draw-rule', '--draw-ext'])
        expect(ratio(tokens.get(line) as string, bg), line).toBeGreaterThanOrEqual(3)
      expect(ratio(tokens.get('--draw-text') as string, bg)).toBeGreaterThanOrEqual(4.5)
      // dimension rules and text in the one accent ink
      expect(tokens.get('--draw-rule')).toBe(tokens.get('--draw-text'))
    })
  for (const [theme, tokens] of [
    ['light', light],
    ['dark', dark],
  ] as const)
    it(`gives every chart series 3:1 against the chart background (--page) in ${theme}`, () => {
      const bg = tokens.get('--page') as string
      for (let k = 1; k <= 6; k++)
        expect(
          ratio(tokens.get(`--series-${k}`) as string, bg),
          `--series-${k}`,
        ).toBeGreaterThanOrEqual(3)
    })
  // Mantine's disabled fills: gray-2 in light, dark-6 in dark
  for (const [theme, tokens, fill] of [
    ['light', light, '#e9ecef'],
    ['dark', dark, '#2e2e2e'],
  ] as const)
    it(`gives disabled text 4.5:1 against the disabled fill in ${theme}`, () => {
      expect(light.get('--mantine-color-disabled-color')).toBe('var(--muted)')
      expect(ratio(tokens.get('--muted') as string, fill)).toBeGreaterThanOrEqual(4.5)
    })
  // Mantine's field fills: white in light, dark-6 in dark
  for (const [theme, tokens, fill] of [
    ['light', light, '#ffffff'],
    ['dark', dark, '#2e2e2e'],
  ] as const)
    it(`gives placeholders 4.5:1 against the field fill in ${theme}`, () => {
      expect(light.get('--mantine-color-placeholder')).toBe('var(--muted)')
      expect(ratio(tokens.get('--muted') as string, fill)).toBeGreaterThanOrEqual(4.5)
    })
  // Message in states.tsx: each variant's text on its own fill
  for (const [theme, tokens] of [
    ['light', light],
    ['dark', dark],
  ] as const)
    it(`gives each message variant 4.5:1 for its text on its fill in ${theme}`, () => {
      for (const variant of ['info', 'warn', 'error'])
        expect(
          ratio(
            tokens.get(`--${variant}-text`) as string,
            tokens.get(`--${variant}-fill`) as string,
          ),
          variant,
        ).toBeGreaterThanOrEqual(4.5)
    })
  // the page and the panels, cards and table heads that sit on --surface
  for (const [theme, tokens] of [
    ['light', light],
    ['dark', new Map([...light, ...dark])],
  ] as const)
    for (const surface of ['--page', '--surface'])
      it(`gives text 4.5:1, the focus ring and the field border 3:1 on ${surface} in ${theme}`, () => {
        const ground = tokens.get(surface) as string
        for (const text of [
          '--ink',
          '--muted',
          '--link',
          '--standard-cip',
          '--error-text',
          '--warn-text',
        ])
          expect(ratio(tokens.get(text) as string, ground), text).toBeGreaterThanOrEqual(4.5)
        for (const edge of ['--accent', '--control-line'])
          expect(ratio(tokens.get(edge) as string, ground), edge).toBeGreaterThanOrEqual(3)
      })
  it('gives shot groups the light chart series colors', () => {
    const series = new Set([1, 2, 3, 4, 5, 6].map((k) => light.get(`--series-${k}`)))
    for (const colour of groupColours) expect(series.has(colour), colour).toBe(true)
  })
})
