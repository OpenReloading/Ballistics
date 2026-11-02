import { describe, expect, it } from 'vitest'
import {
  allSections,
  omittedSections,
  parsePrintChoice,
  printSections,
} from '../src/lib/print-sections.ts'

describe('the report sections of the Print menu', () => {
  it('print every section by default, as the report did before the choice', () => {
    expect(parsePrintChoice(null)).toEqual(allSections)
    expect(Object.values(allSections).every(Boolean)).toBe(true)
    expect(printSections.map((s) => s.key)).toEqual([
      'inputs',
      'chart',
      'ladder',
      'barrel',
      'limits',
      'notes',
    ])
  })

  it('read the stored choice, a section it does not name as off printing', () => {
    const choice = parsePrintChoice(JSON.stringify({ chart: false, notes: false, other: false }))
    expect(choice).toEqual({ ...allSections, chart: false, notes: false })
    expect(omittedSections(choice)).toBe('chart notes')
    expect(omittedSections(allSections)).toBe('')
  })

  it('print everything for text that is not a stored choice', () => {
    for (const text of ['', 'not json', '[1]', 'null', '7'])
      expect(parsePrintChoice(text)).toEqual(allSections)
  })
})
