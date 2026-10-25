import { describe, expect, it } from 'vitest'
import { figureModel, screenEm } from '../src/cartridge/figure.ts'
import { type Figure, flagged, recordFigures } from '../src/cartridge/figures.ts'
import * as face from '../src/core/face.ts'
import { defined } from './defined.ts'
import { sheet, sheets } from './sheets.ts'

const record = sheet

describe('figures', () => {
  it('draws 308 Win. as one figure with both sides', () => {
    const list = recordFigures(record('cip-308-win-2008-09-23'))
    expect(list.map((f) => [f.id, f.drawn.map((d) => d.side)])).toEqual([
      ['cip-308-win-2008-09-23-drawing', ['cartridge', 'chamber']],
    ])
  })

  it('names each Cal. 12 figure by the index of its variant', () => {
    const list = recordFigures(record('cip-12-2018-10-17'))
    expect(list.map((f) => f.id)).toEqual(
      Array.from({ length: 9 }, (_, k) => `cip-12-2018-10-17-drawing-${k}`),
    )
    expect(defined(list[5]).variant).toBe('12/70')
  })

  it('draws the 22 Long Shot chamber only and names the closed front first', () => {
    const figure = defined(recordFigures(record('cip-22-long-shot-2000-06-07'))[0])
    expect(figure.drawn.map((d) => d.side)).toEqual(['chamber'])
    expect(defined(figure.notes[0]).code).toBe('closedFront')
    expect(defined(figure.notes[0]).text).toMatch(/closed or crimped/)
  })

  it('gives a record without dimensions no drawn figure', () => {
    const values = [{ symbol: 'Pmax', quantity: 'pressure', value: 4150 }]
    expect(
      recordFigures({ id: 'x', standard: 'CIP', values }).filter((f) => f.drawn.length),
    ).toEqual([])
  })

  it('flags each side drawn alone with the numbers of the caption (32-40 Win.)', () => {
    const figure = defined(recordFigures(record('cip-32-40-win-2002-05-15'))[0])
    expect(figure.notes.map((n) => n.flagNumber)).toEqual([1, 2, 3, 4])
    expect(figure.drawn.map(({ side }) => [side, flagsAlone(figure, side)])).toEqual([
      ['cartridge', ['1']],
      ['chamber', ['2', '3', '4']],
    ])
  })

  it('numbers each side drawn alone as the caption does, every record', () => {
    const wrong = sheets
      .flatMap((r) => recordFigures(r))
      .flatMap((figure) => {
        const caption = figure.notes.flatMap((n) => (n.flagNumber ? [n.flagNumber] : []))
        const alone = figure.drawn.flatMap((d) => flagged([d]).map((f) => f.n))
        const whole = flagged(figure.drawn).map((f) => f.n)
        const one = caption.map((_, k) => k + 1).join()
        return [caption, alone, whole].every((n) => n.join() === one)
          ? []
          : [`${figure.id}: caption ${caption}, alone ${alone}, whole ${whole}`]
      })
    expect(wrong).toEqual([])
  })

  it('draws 9 C.F. Mori as one table VII figure without a variant', () => {
    const list = recordFigures(record('cip-9-c-f-mori-2006-09-19'))
    expect(list.map((f) => [f.id, f.variant, f.drawn.length])).toEqual([
      ['cip-9-c-f-mori-2006-09-19-drawing', undefined, 2],
    ])
  })
})

/** The flag texts of one side laid out alone, on screen and in print, as the record page draws it. */
function flagsAlone(figure: Figure, side: string) {
  const drawn = figure.drawn.filter((d) => d.side === side)
  const flags = (em: number) =>
    (figureModel(drawn, 'screen', em).layers[side as 'cartridge']?.labels ?? [])
      .filter((l) => l.owner.startsWith('flag '))
      .map((l) => l.text)
      .sort((a, b) => Number(a) - Number(b))
  const screen = flags(screenEm([figure.drawn]))
  expect(flags(face.printEm)).toEqual(screen)
  return screen
}
