import type { Dimension, LengthUnit, Medium } from '@open-reloading/drawing'
import {
  type Drawn,
  type FigureModel,
  figureModel,
  recordFigures,
  screenEm,
} from '@open-reloading/drawing/cartridge'

/** The views of the workbench's cartridge figure: Combined has no dimensions. */
export type FigureView = 'cartridge' | 'chamber' | 'combined'

/**
 * The models of the three views of the workbench's cartridge figure: Combined (`preview`, both
 * outlines without dimensions, once a bullet is seated) and each side's dimensioned record figure,
 * with `seated` the Cartridge side's L6 replaced by the seated COAL and the seated CBTO added.
 * All share the text size of the record figure and one frame, the union of their frames, and the
 * scale bar of the lowest, so the outline keeps its place and scale when a view hides or shows the
 * dimensions. Laid out for `medium`: upright on screen, level (head left) for print. Only the
 * `views` are built, and the shared frame is theirs.
 *
 * Built in two steps by what a slider move changes: the Combined and Chamber models and the text
 * size once, then each call for seated lengths lays out only the Cartridge side and shares the
 * frame again.
 */
export function figureViewBuilder(
  spec: Parameters<typeof recordFigures>[0],
  preview: Drawn | undefined,
  unit: LengthUnit,
  medium: Medium = 'screen',
  views: readonly FigureView[] = ['cartridge', 'chamber', 'combined'],
): (seated?: SeatedLengths) => Partial<Record<FigureView, FigureModel>> {
  const record = recordFigures(spec).find((f) => f.drawn.length)?.drawn
  const shown = record ?? preview
  if (!shown) return () => ({})
  const em = screenEm([shown], unit)
  const lay = (d: Drawn[number]) => figureModel([d], medium, em, 0, [], false, unit)
  const fixed: Partial<Record<FigureView, FigureModel>> = {}
  if (preview && views.includes('combined'))
    fixed.combined = figureModel(preview, medium, em, 0, [], false, unit)
  const sides = (record ?? []).filter((d) => views.includes(d.side))
  for (const d of sides) if (d.side !== 'cartridge') fixed[d.side] = lay(d)
  const cartridge = sides.find((d) => d.side === 'cartridge')
  // the order of the models: Combined, then the sides as the record has them
  const order = [...(fixed.combined ? (['combined'] as const) : []), ...sides.map((d) => d.side)]
  return (seated) =>
    sharedFrame(
      order.flatMap((view): [FigureView, FigureModel][] => {
        const model =
          view === 'cartridge' && cartridge
            ? lay(seated ? seatedSide(cartridge, seated, unit) : cartridge)
            : fixed[view]
        return model ? [[view, model]] : []
      }),
    )
}

/** The models with the union of their frames and the scale bar of the lowest. */
function sharedFrame(
  models: [FigureView, FigureModel][],
): Partial<Record<FigureView, FigureModel>> {
  const all = models.map(([, m]) => m)
  if (all.length === 0) return {}
  const left = Math.min(...all.map((m) => m.frame[0]))
  const top = Math.min(...all.map((m) => m.frame[1]))
  const right = Math.max(...all.map((m) => m.frame[0] + m.frame[2]))
  const bottom = Math.max(...all.map((m) => m.frame[1] + m.frame[3]))
  const frame: FigureModel['frame'] = [left, top, right - left, bottom - top]
  const { scale } = all.find((m) => m.frame[1] + m.frame[3] === bottom) as FigureModel
  return Object.fromEntries(models.map(([view, m]) => [view, { ...m, frame, scale }]))
}

/** COAL and CBTO of the seated bullet, mm; CBTO only with the bullet's base-to-ogive. */
type SeatedLengths = { coal: number; cbto?: number | undefined }

/**
 * The cartridge side as the workbench's Cartridge view draws it: the record figure with the seated
 * COAL in place of L6 and the seated CBTO added, from the head.
 */
function seatedSide(d: Drawn[number], seated: SeatedLengths, unit: LengthUnit): Drawn[number] {
  // a mm label to 0.01 mm, the record values' precision (an inch label has its own decimals); the
  // line keeps the exact length
  const mm = (v: number) => (unit === 'mm' ? Math.round(v * 100) / 100 : v)
  const length = (symbol: string, v: number): Dimension => ({
    kind: 'length',
    symbol,
    value: mm(v),
    from: 0,
    to: v,
  })
  const { annotation } = d.p
  const coal = length('COAL', seated.coal)
  const hasL6 = annotation.dimensions.some((x) => x.symbol === 'L6')
  const dimensions = [
    ...annotation.dimensions.map((x) => (x.symbol === 'L6' ? coal : x)),
    ...(hasL6 ? [] : [coal]),
    ...(seated.cbto === undefined ? [] : [length('CBTO', seated.cbto)]),
  ]
  return { ...d, p: { ...d.p, annotation: { ...annotation, dimensions } } }
}
