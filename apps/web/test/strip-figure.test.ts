import { describe, expect, it } from 'vitest'
import { cylinderRunOf, type Outcome, stripFigureOf } from '../src/components/workbench-outcome.ts'

const figure = { values: [], bullet: [], base: 60 }
const run = (kind: 'charge' | 'seating', barrel?: number) =>
  ({
    ladder: { kind },
    load: { barrel: { length: 0.5 } },
    printed: { seated: { figure, barrel } },
    steps: [{ charge: 0.003 }],
    selected: 0,
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

  it('adds the seating step’s own cylinder run for a revolver barrel from the forcing cone', () => {
    const revolver = run('seating', 0.095)
    revolver.load.barrel.length = 0.1115
    revolver.printed.seated.cylinder = { gap: 0.0001, exit: 0.01639, run: 0.0404, from: 'L6' }
    revolver.steps = [
      {
        charge: 0.003,
        seating: {
          value: 0.0406,
          volume: 1e-6,
          travel: 0.1115,
          cylinderGap: { gap: 0.0001, exit: 0.0165 },
          cylinderRun: 0.0405,
        },
      },
    ]
    expect(cylinderRunOf(revolver)).toBe(0.0405)
    expect(stripFigureOf(revolver)?.base).toBeCloseTo(24)
  })

  it('keeps the cylinder run of a seating step whose leak a typed leak area replaced', () => {
    const revolver = run('seating', 0.095)
    revolver.load.barrel.length = 0.1115
    revolver.steps = [
      {
        charge: 0.003,
        seating: { value: 0.0406, volume: 1e-6, travel: 0.1115, cylinderRun: 0.0405 },
      },
    ]
    expect(cylinderRunOf(revolver)).toBe(0.0405)
    expect(stripFigureOf(revolver)?.base).toBeCloseTo(24)
  })
})
