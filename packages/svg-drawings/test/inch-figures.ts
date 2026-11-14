import { figureModel, screenEm, screenWidth } from '../src/cartridge/figure.ts'
import { recordFigures } from '../src/cartridge/figures.ts'
import * as face from '../src/core/face.ts'
import type { Layout } from '../src/core/types.ts'
import { gapFailures } from './gaps.ts'
import { sheets } from './sheets.ts'

type Shown = ReturnType<typeof recordFigures>[number]

/** Every figure of every record with its text size and width across in inches, built once per test file so the layouts of one figure object are cached. */
export const inchFigures = sheets.flatMap((record) => {
  const shown = recordFigures(record).filter((f) => f.drawn.length)
  if (!shown.length) return []
  const em = screenEm(
    shown.map((f) => f.drawn),
    'in',
  )
  const across = Math.max(...shown.map((f) => screenWidth(f.drawn, em, 'in')))
  return shown.map((f) => ({ record, f, em, across }))
})

// the record page prints each side upright: the screen layout at the print text size
const layoutsDrawn = {
  screen: (f: Shown) =>
    figureModel(f.drawn, 'screen', screenEm([f.drawn], 'in'), 0, [], true, 'in'),
  print: (f: Shown) => figureModel(f.drawn, 'print', face.printEm, 0, [], false, 'in'),
  'page print': (f: Shown) => figureModel(f.drawn, 'screen', face.printEm, 0, [], false, 'in'),
}

/** The gap failures of every inch figure in one medium. */
export function inchGapFailures(medium: keyof typeof layoutsDrawn) {
  const failures: string[] = []
  for (const { f } of inchFigures) {
    const model = layoutsDrawn[medium](f)
    for (const { side } of f.drawn)
      failures.push(
        ...gapFailures(
          model.layers[side] as Layout,
          model.em,
          (x) => `${f.id} ${side} ${medium} in ${x}`,
        ),
      )
  }
  return failures
}
