import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { headerUnit, headerWords, readNumber, readTable } from '../src/tables.ts'

// the expressions the scans replace, as the reference for their results
const wordsReference = (header: string) =>
  header
    .replace(/[([{].*?[)\]}]/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
const unitReference = (header: string) =>
  (
    /[([{]\s*([^)\]}]+?)\s*[)\]}]/.exec(header)?.[1] ?? /[_/ ]([a-z]{1,6})$/i.exec(header)?.[1]
  )?.toLowerCase()

describe('header scans', () => {
  it('match the bracket expressions on any header', () => {
    const header = fc.string({
      unit: fc.constantFrom('(', ')', '[', ']', '{', '}', ' ', '\t', '\n', 'a', 'B', '_', '/', '1'),
      maxLength: 24,
    })
    fc.assert(
      fc.property(header, (h) => {
        expect(headerWords(h)).toEqual(wordsReference(h))
        expect(headerUnit(h)).toEqual(unitReference(h))
      }),
      { seed: 20261028, numRuns: 2000 },
    )
  })

  it('reads the words and unit of a bracketed header', () => {
    expect(headerWords('Geschw. [m/s] (Mündung)')).toEqual(['geschw'])
    expect(headerUnit('Velocity ( FPS )')).toBe('fps')
    expect(headerUnit('mass_gr')).toBe('gr')
  })

  it('finishes quickly on a long hostile header', () => {
    const hostile = [`${'('.repeat(50000)}a`, `(${' '.repeat(50000)}a`, `{${' '.repeat(50000)}`]
    const start = performance.now()
    for (const h of hostile) {
      headerWords(h)
      headerUnit(h)
    }
    expect(performance.now() - start).toBeLessThan(200)
  })
})

describe('readNumber', () => {
  it('rejects a long cell that is no number in linear time', () => {
    const start = performance.now()
    expect(readNumber(`${'1'.repeat(50_000)}x`, '.')).toBeUndefined()
    expect(performance.now() - start).toBeLessThan(500)
  })
})

describe('readTable', () => {
  it('reads a quoted cell after a space', () => {
    for (const d of [',', ';']) {
      const text = [
        `Name${d} Weight${d} Maker`,
        `Bullet A${d} "6${d}5"${d} "Maker${d} Inc"`,
        `Bullet B${d} 9.1${d} Maker`,
      ].join('\n')
      expect(readTable(text)).toEqual({
        table: {
          header: ['Name', 'Weight', 'Maker'],
          hasHeader: true,
          rows: [
            ['Bullet A', `6${d}5`, `Maker${d} Inc`],
            ['Bullet B', '9.1', 'Maker'],
          ],
        },
      })
    }
  })

  it('keeps a quote after cell text as text, also in a long cell', () => {
    expect(readTable('a,b\nx "y",2\n')).toEqual({
      table: { header: ['a', 'b'], hasHeader: true, rows: [['x "y"', '2']] },
    })
    const cell = `${' '.repeat(100_000)}x${'"'.repeat(100_000)}`
    const read = readTable(`a,b\n1,2\n${cell},2\n`)
    expect('table' in read && read.table.rows[1]?.[0]).toBe(cell.trim())
  })

  it('removes a leading byte order mark', () => {
    const table = { header: ['name', 'mass'], hasHeader: true, rows: [['a', '1']] }
    expect(readTable('\uFEFF[{"name":"a","mass":1}]')).toEqual({ table })
    expect(readTable('\uFEFFname,mass\na,1\n')).toEqual({ table })
  })
})
