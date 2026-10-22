import { expect, it, vi } from 'vitest'
import { figureModel, screenEm, screenWidth } from '../src/cartridge/figure.ts'
import { recordFigures } from '../src/cartridge/figures.ts'
import * as face from '../src/core/face.ts'
import { sheet } from './sheets.ts'

const annotate = vi.hoisted(() => ({ calls: [] as number[] }))
vi.mock('../src/core/annotate.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/core/annotate.ts')>()
  return {
    ...original,
    annotate: (...args: Parameters<typeof original.annotate>) => {
      annotate.calls.push(args[1])
      return original.annotate(...args)
    },
  }
})

it('lays out a figure once per side, medium and text size', () => {
  const record = sheet('cip-308-win-2008-09-23')
  const [{ drawn }] = recordFigures(record)
  const em = screenEm([drawn])
  const searched = annotate.calls.length
  screenWidth(drawn, em)
  figureModel(drawn, 'screen', em, 0)
  expect(annotate.calls.length).toBe(searched)
  figureModel(drawn, 'print', face.printEm)
  figureModel(drawn, 'print', face.printEm)
  // both sides, once more for print
  expect(annotate.calls.length).toBe(searched + drawn.length)
  expect(annotate.calls.filter((e) => e === em).length).toBe(drawn.length)
})
