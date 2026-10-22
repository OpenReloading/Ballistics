import { describe, expect, it } from 'vitest'
import { type Outcome, stripFigureOf } from '../src/components/workbench-outcome.ts'

const figure = { values: [], bullet: [], base: 60 }
const run = (kind: 'charge' | 'seating', barrel?: number) =>
  ({
    ladder: { kind },
    load: { barrel: { length: 0.5 } },
    printed: { seated: { figure, barrel } },
  }) as unknown as Extract<Outcome, { kind: 'ok' }>

describe('stripFigureOf', () => {
  it('keeps the seated base for a charge ladder', () => {
    expect(stripFigureOf(run('charge', 0.56))).toBe(figure)
  })

  it('puts the base of a seating step at the barrel less its travel, mm', () => {
    expect(stripFigureOf(run('seating', 0.56))?.base).toBeCloseTo(60)
    const other = run('seating', 0.56)
    other.load.barrel.length = 0.4
    expect(stripFigureOf(other)?.base).toBeCloseTo(160)
  })

  it('keeps the seated base without the barrel length', () => {
    expect(stripFigureOf(run('seating'))).toBe(figure)
  })
})
