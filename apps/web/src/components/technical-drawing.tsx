import {
  type Arc,
  type Arrowhead,
  arrowheadCorners,
  face,
  type Label,
  type Layout,
  type LineSegment,
  type PartPoint,
  svgPath,
} from '@open-reloading/drawing'
import type { BulletModel } from '@open-reloading/drawing/bullet'
import type { FigureModel, Side } from '@open-reloading/drawing/cartridge'
import { fromSi, toSi } from '@open-reloading/schema'
import type { CSSProperties, ReactNode } from 'react'
import { drawingFont } from '../app/fonts/drawing.ts'
import { Decimal } from './decimal.tsx'

const n = (x: number) => Number(x.toFixed(2))
/** Drawing units per mm: on screen one unit is one CSS px at full size. */
const unit = face.pxPerMm

const segPath = (segs: LineSegment[]) => segs.map((s) => svgPath([s.a, s.b])).join('')

const tipPath = (tips: Arrowhead[]) => tips.map((t) => svgPath(arrowheadCorners(t), true)).join('')

const arcPath = ({ c, r, from, to }: Arc) => {
  const p0: PartPoint = [c[0] + r * Math.cos(from), c[1] + r * Math.sin(from)]
  const p1: PartPoint = [c[0] + r * Math.cos(to), c[1] + r * Math.sin(to)]
  const large = Math.abs(to - from) > Math.PI ? 1 : 0
  return `M${n(p0[0])} ${n(p0[1])}A${n(r)} ${n(r)} 0 ${large} ${to > from ? 1 : 0} ${n(p1[0])} ${n(p1[1])}`
}

/** The text's rotation in the part frame so it reads left to right or bottom to top on the medium. */
function rotation({ dir: [ux, uy] }: Label, turn: number) {
  const t = toSi('angle', turn)
  let a = fromSi(
    'angle',
    Math.atan2(ux * Math.sin(t) + uy * Math.cos(t), ux * Math.cos(t) - uy * Math.sin(t)),
  )
  if (a >= 90 - 1e-9) a -= 180
  if (a < -90 - 1e-9) a += 180
  return n(a - turn)
}

/** A label's text; a flag in its ring. */
function Text({
  l,
  turn,
  em,
  symbol,
}: {
  l: Label
  turn: number
  em: number
  symbol?: string | undefined
}) {
  const text = (
    <text
      data-symbol={symbol}
      x={n(l.c[0])}
      y={n(l.c[1] + 0.25 * em)}
      transform={`rotate(${rotation(l, turn)} ${n(l.c[0])} ${n(l.c[1])})`}
    >
      <Decimal text={l.text} />
    </text>
  )
  if (!l.ring) return text
  return (
    <g className="flag">
      <circle className="flag-ring" cx={n(l.c[0])} cy={n(l.c[1])} r={n(l.w / 2)} />
      {text}
    </g>
  )
}

/**
 * The symbol a dimension stands for (`data-symbol`): a table maps it, else the owner itself,
 * but not the note flags, detail letters, the axis, the outline and lengths the record does not give.
 */
export type Linked = true | Record<string, string>
const symbolOf = (linked: Linked | undefined, owner: string) =>
  linked === undefined
    ? undefined
    : linked === true
      ? /^(flag|detail) |−|^(axis|outline)$/.test(owner)
        ? undefined
        : owner
      : linked[owner]

/**
 * Each linked dimension's lines and arrowheads once more, hidden until the page marks it (CSS
 * `.is-hi`): the drawn paths stay one per kind, so the figure renders as before.
 */
function Marks({ layout, linked }: { layout: Layout; linked: Linked }) {
  const owners = [...new Set(layout.labels.map((l) => l.owner))].flatMap((owner) => {
    const symbol = symbolOf(linked, owner)
    return symbol ? [{ owner, symbol }] : []
  })
  return owners.map(({ owner, symbol }) => (
    <g key={owner} className="hi" data-symbol={symbol}>
      <path
        className="hi-line"
        d={
          segPath(layout.segs.filter((x) => x.owner === owner)) +
          layout.arcs
            .filter((x) => x.owner === owner)
            .map(arcPath)
            .join('')
        }
      />
      <path className="hi-tips" d={tipPath(layout.arrowheads.filter((x) => x.owner === owner))} />
    </g>
  ))
}

function Dimensions({
  side,
  layout,
  turn,
  em,
  linked,
}: {
  side: Side | 'combined' | 'bullet'
  layout: Layout
  turn: number
  em: number
  linked?: Linked | undefined
}) {
  const rules = layout.segs.filter((s) => s.kind === 'rule')
  const thin = layout.segs.filter((s) => s.kind === 'thin')
  return (
    <g className={`dims dims-${side}`} fontSize={n(em)}>
      <path className="thin" d={segPath(thin)} />
      {rules.length + layout.arcs.length > 0 && (
        <path className="rule" d={segPath(rules) + layout.arcs.map(arcPath).join('')} />
      )}
      <path className="tips" d={tipPath(layout.arrowheads)} />
      {layout.labels.map((l) => (
        <Text key={l.owner} l={l} turn={turn} em={em} symbol={symbolOf(linked, l.owner)} />
      ))}
      {linked && <Marks layout={layout} linked={linked} />}
    </g>
  )
}

function Axis({ at }: { at?: [number, number] | undefined }) {
  return (
    at && (
      <path
        className="axis"
        d={`M${n(at[0])} 0H${n(at[1])}`}
        strokeDasharray={face.axisDash.join(' ')}
      />
    )
  )
}

/** The screen width at which a figure's text renders 11 px (whole px: layout rounds down). */
const readableWidth = ({ em, frame: [, , w] }: FigureModel | BulletModel) =>
  `${Math.ceil((w * face.minTextPx) / em)}px`

/** The screen width a figure fits: the window height less the page's rows above (`--drawing-chrome`, 7rem unless a page sets it), but no smaller than 11 px text. */
function fitWidth(model: FigureModel | BulletModel, tallest = model.frame[3]) {
  return `max(calc((100svh - var(--drawing-chrome, 7rem)) * ${(model.frame[2] / tallest).toFixed(4)}), ${readableWidth(model)})`
}

/**
 * The box both figures fit, as the drawing's minimum size: the wider of the two widths on screen
 * (each fitted and capped by its column, `100cqw`), at the taller of the two aspects, so the box is
 * the same in either length unit.
 */
function reserved(
  own: { model: FigureModel | BulletModel; tallest?: number | undefined },
  other: { model: FigureModel; tallest: number },
) {
  const both = [own, other]
  const width = `max(${both.map(({ model, tallest }) => `min(${n(model.frame[2] * unit)}px, ${fitWidth(model, tallest)}, 100cqw)`).join(', ')})`
  const aspect = Math.max(...both.map(({ model: { frame } }) => frame[3] / frame[2]))
  return { minWidth: width, minHeight: `calc(${width} * ${aspect.toFixed(4)})` }
}

/** The outlines each drawn once, for the filled, stroked and clipped uses. */
function DrawingDefs({ id, model }: { id: string; model: FigureModel | BulletModel }) {
  const cartridge = 'cartridge' in model ? model.cartridge : undefined
  const chamber = 'chamber' in model ? model.chamber : undefined
  const bullet = 'bullet' in model ? model.bullet : undefined
  return (
    <defs>
      {cartridge && (
        <>
          <path id={`${id}-c`} d={cartridge.section} />
          <clipPath id={`${id}-cartridge`}>
            <use href={`#${id}-c`} />
          </clipPath>
        </>
      )}
      {bullet && (
        <>
          <path id={`${id}-b`} d={bullet.section} />
          <clipPath id={`${id}-bullet`}>
            <use href={`#${id}-b`} />
          </clipPath>
        </>
      )}
      {chamber && (
        <>
          <path id={`${id}-s`} d={chamber.steel} />
          <path id={`${id}-v`} d={chamber.cavity} />
          <clipPath id={`${id}-steel`}>
            <use href={`#${id}-s`} />
          </clipPath>
          <clipPath id={`${id}-cavity`}>
            <use href={`#${id}-v`} />
          </clipPath>
        </>
      )}
    </defs>
  )
}

/** The parts of the figure: the chamber, the cartridge or the bullet section. */
function DrawingParts({ id, model }: { id: string; model: FigureModel | BulletModel }) {
  const cartridge = 'cartridge' in model ? model.cartridge : undefined
  const chamber = 'chamber' in model ? model.chamber : undefined
  const bullet = 'bullet' in model ? model.bullet : undefined
  const axis: Partial<Record<Side | 'bullet', [number, number]>> = model.axis
  const clip = (name: string) => `url(#${id}-${name})`
  return (
    <>
      {chamber && (
        <g className="part part-chamber">
          <use className="steel" href={`#${id}-s`} />
          <use className="gap" href={`#${id}-v`} />
          <path className="edge" d={chamber.edges} clipPath={clip('cavity')} />
          {/* drawn twice as wide and cut to the steel: the inner edge is the chamber size */}
          <path className="outline" d={chamber.outline} clipPath={clip('steel')} />
          <path className="thin" d={chamber.breaks} />
          {chamber.face && <path className="head-face" d={chamber.face} />}
          <Axis at={axis.chamber} />
        </g>
      )}
      {cartridge && (
        <g className="part part-cartridge">
          <use className="section" href={`#${id}-c`} />
          <path className="edge" d={cartridge.edges} clipPath={clip('cartridge')} />
          <use className="outline" href={`#${id}-c`} clipPath={clip('cartridge')} />
          <Axis at={axis.cartridge} />
        </g>
      )}
      {bullet && (
        <g className="part part-bullet">
          <use className="section" href={`#${id}-b`} />
          <path className="edge" d={bullet.edges} clipPath={clip('bullet')} />
          {/* drawn twice as wide and cut to the section; assumed parts dashed */}
          <path className="outline" d={bullet.outline} clipPath={clip('bullet')} />
          <path className="outline approx" d={bullet.approximate} clipPath={clip('bullet')} />
          <Axis at={axis.bullet} />
        </g>
      )}
      {/* Combined: the chamber outline again, over the filled cartridge section */}
      {chamber && cartridge && (
        <path className="outline part-chamber-over" d={chamber.outline} clipPath={clip('steel')} />
      )}
    </>
  )
}

/**
 * One SVG of a figure, server-rendered: the chamber in its steel band (with the gap shown in the
 * Combined view), the cartridge section, or the bullet section with its assumed parts dashed, the
 * axis, one dimension group per side, the region callouts of Combined, the scale bar. On screen a group, the part turned -90 deg inside the SVG
 * at 8 px per mm, capped by the column and fitted to the window height (no smaller than 11 px
 * text); in print an image, unturned and life size, or with `printScale` the turned model at that
 * scale. With `level` a model laid out for print is drawn on screen as it lies, head left. The view
 * inputs of the figure show and hide the groups.
 */
export function TechnicalDrawing({
  id,
  title,
  desc,
  describedBy = `${id}-desc`,
  model,
  tallest,
  printScale,
  linked,
  children,
  reserve,
  level,
  readable = false,
}: {
  id: string
  title: string
  /** The description, or none where `describedBy` names another drawing's. */
  desc?: string
  describedBy?: string
  model: FigureModel | BulletModel
  /** Screen: the height in mm the window fits, the tallest figure of the record (one scale). */
  tallest?: number | undefined
  /** Print the model laid out for the screen (upright) as the image at this scale, 1 life size. */
  printScale?: number | undefined
  /** Screen only: each dimension named by its symbol for the record table's linked hover. */
  linked?: Linked | undefined
  /** Drawn last in the part frame, mm (the seated bullet of the interior preview). */
  children?: ReactNode
  /** Screen: the same figure in the other length unit, whose box the drawing keeps free, so a unit switch moves nothing (its column a size container). */
  reserve?: { model: FigureModel; tallest: number } | undefined
  /** Screen: the model is laid out level (medium print), shown with `data-level`. */
  level?: boolean
  /**
   * Screen: the page sizes the drawing itself (the cartridge designer) and keeps its text 11 px with
   * the width `--readable` and the height to width `--aspect` the drawing states.
   */
  readable?: boolean | undefined
}) {
  const { medium, em, frame, scale } = model
  const layers: Partial<Record<Side | 'combined' | 'bullet', Layout>> = model.layers
  const print = (medium === 'print' && !level) || printScale !== undefined
  const turn = medium === 'print' ? 0 : -90
  const k = printScale ?? 1
  const [x, y, w, h] = frame
  return (
    <svg
      className={`drawing ${drawingFont.variable} ${print ? 'drawing-print print-only' : 'screen-only'}`}
      viewBox={[x, y, w, h].map((v) => n(v * unit)).join(' ')}
      style={
        print
          ? { width: `${n(w * k)}mm`, height: `${n(h * k)}mm` }
          : ({
              '--full': `${n(w * unit)}px`,
              '--fit': fitWidth(model, tallest),
              ...(readable && {
                '--readable': readableWidth(model),
                '--aspect': (h / w).toFixed(4),
              }),
              ...(reserve && reserved({ model, tallest }, reserve)),
            } as CSSProperties)
      }
      role={print ? 'img' : 'group'}
      aria-labelledby={`${id}-title`}
      aria-describedby={describedBy}
      data-level={level || undefined}
    >
      <title id={`${id}-title`}>{title}</title>
      {desc !== undefined && <desc id={`${id}-desc`}>{desc}</desc>}
      {/* each outline once: filled, stroked and clipped through <use> */}
      <DrawingDefs id={id} model={model} />
      <g transform={`scale(${unit})`}>
        <g transform={turn ? `rotate(${turn})` : undefined}>
          <DrawingParts id={id} model={model} />
          {(['cartridge', 'chamber', 'combined', 'bullet'] as const).map((side) => {
            const layout = layers[side]
            return (
              layout && (
                <Dimensions
                  key={side}
                  side={side}
                  layout={layout}
                  turn={turn}
                  em={em}
                  linked={linked}
                />
              )
            )
          })}
          {children}
        </g>
        <g className="scale" fontSize={n(em)}>
          <path
            className="rule"
            d={`M${n(scale.x)} ${n(scale.y - 0.3 * em)}V${n(scale.y)}H${n(scale.x + scale.length)}V${n(scale.y - 0.3 * em)}`}
          />
          <text x={n(scale.x + scale.length + 0.4 * em)} y={n(scale.y)}>
            <Decimal text={scale.label} />
          </text>
          <text x={n(scale.text[0])} y={n(scale.text[1])}>
            {scale.note}
          </text>
        </g>
      </g>
    </svg>
  )
}
