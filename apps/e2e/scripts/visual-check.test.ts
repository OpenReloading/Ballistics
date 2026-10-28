import { describe, expect, it } from 'vitest'
import { args, inLanguage, presets } from './visual-check.mts'

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
