import { face } from '@open-reloading/drawing'
import {
  figureModel,
  recordFigures,
  regions,
  screenEm,
  screenWidth,
} from '@open-reloading/drawing/cartridge'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TechnicalDrawing } from '../src/components/technical-drawing.tsx'

/**
 * The screen and print SVG of every drawn figure of a cartridge spec, by golden file name. The
 * caller passes its `TechnicalDrawing`, imported after it mocked `next/font/local`.
 */
export function figureSvgs(
  Drawing: typeof TechnicalDrawing,
  spec: Parameters<typeof recordFigures>[0],
): [name: string, svg: string][] {
  const shown = recordFigures(spec).filter((f) => f.drawn.length)
  const em = screenEm(shown.map((f) => f.drawn))
  const across = Math.max(...shown.map((f) => screenWidth(f.drawn, em)))
  return shown.flatMap(({ id: figure, drawn }, k) => {
    const list = drawn.length === 2 ? regions(spec.values) : []
    return (['screen', 'print'] as const).map((medium): [string, string] => {
      const model =
        medium === 'screen'
          ? figureModel(drawn, medium, em, across, list)
          : figureModel(drawn, medium, face.printEm, 0, list)
      const svg = renderToStaticMarkup(
        <Drawing id={figure} title={spec.id} desc={spec.id} model={model} />,
      )
      // the first figure keeps the name it had before the variants of table VII were added
      return [
        `${spec.id}${k ? `-${k}` : ''}-${medium}`,
        svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '),
      ]
    })
  })
}
