import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { describe, expect, it } from 'vitest'
import { args, bar, fittedCaption, inLanguage, presets } from './visual-check.mts'

describe('visual check arguments', () => {
  it('takes page paths and presets together, each page once', () => {
    expect(args(['/', '--preset', 'calculators', '/workbench'])).toEqual(['/', '/workbench'])
    expect(args(['--preset=calculators', '--preset', 'drawing'])).toEqual([
      ...presets.calculators,
      ...presets.drawing,
    ])
  })

  it('rejects an unknown preset and names the known ones', () => {
    expect(() => args(['--preset', 'nope'])).toThrow(/unknown preset nope.*drawing, calculators/)
    expect(() => args(['--preset', 'toString'])).toThrow(/unknown preset toString/)
  })

  it('rejects an unknown option, a path without a leading slash and no pages', () => {
    expect(() => args(['--width', '390'])).toThrow(/width/)
    expect(() => args(['trajectory'])).toThrow(/trajectory/)
    expect(() => args([])).toThrow(/no pages/)
  })
})

describe('page bar texts in the language shown', () => {
  it('takes the catalogue text and leaves a text it lacks in English', () => {
    expect(inLanguage('Open', { Open: 'Öffnen' })).toBe('Öffnen')
    expect(inLanguage('Example load', { Open: 'Öffnen' })).toBe('Example load')
    expect(inLanguage('Open', { Open: { one: 'a', other: 'b' } })).toBe('Open')
  })
})

describe('workbench page bar in the language shown', () => {
  const german = { Open: 'Öffnen', 'Page actions': 'Seitenaktionen' }

  it('translates the Page actions toggle and keeps the button names of the workbench', async () => {
    const names: unknown[] = []
    const found = {
      locator: () => found,
      count: async () => 0,
      getByRole: (_role: string, options: unknown) => names.push(options),
    }
    const page = {
      getByRole: (_role: string, options: unknown) => {
        names.push(options)
        return found
      },
      locator: () => found,
    }
    await bar(page as unknown as Page, 'Open', german)
    expect(names).toEqual([{ name: 'Seitenaktionen' }, { name: 'Open', exact: true }])
  })

  it('waits for the powder chart by a caption the German catalogue translates', () => {
    const de = JSON.parse(
      readFileSync(new URL('../../web/src/i18n/de.json', import.meta.url), 'utf8'),
    )
    expect(inLanguage(fittedCaption, de)).not.toBe(fittedCaption)
  })
})
