import { SegmentedControl } from '@mantine/core'
import { angleText, face, type LengthUnit, lengthText } from '@open-reloading/drawing'
import {
  conflictWording,
  type Drawn,
  differenceWording,
  type Figure,
  type FigureModel,
  figureModel,
  type Region,
  recordFigures,
  regions,
  type Side,
  type SpecValue,
  screenEm,
  screenWidth,
  sideName,
  signedLengthText,
  valueParts,
} from '@open-reloading/drawing/cartridge'
import { useTranslation } from '../i18n/language.ts'
import { plainNumber } from '../i18n/number.ts'
import { msg, type Translator } from '../i18n/translate.ts'
import type { drawable } from '../lib/cartridge-sheet.ts'
import { nth } from '../lib/nth.ts'
import { controlSize } from '../lib/theme.ts'
import { type Linked, TechnicalDrawing } from './technical-drawing.tsx'

/** What the drawing reads of a record (`drawable`). */
type Drawable = ReturnType<typeof drawable>

const views = [
  ['cartridge', msg('Cartridge')],
  ['chamber', msg('Chamber')],
  ['combined', msg('Combined')],
] as const

/** The side as a lower case word of a title, and as the start of "not drawn" texts. */
const sideWords = { cartridge: msg('cartridge'), chamber: msg('chamber') } as const
const notDrawn = {
  cartridge: msg('Cartridge not drawn.'),
  chamber: msg('Chamber not drawn.'),
} as const
const bothNotDrawn = {
  cartridge: msg('Cartridge and Combined not drawn: {why}.'),
  chamber: msg('Chamber and Combined not drawn: {why}.'),
} as const

export type View = (typeof views)[number][0]

/**
 * The technical drawing of a CIP record: one figure, a table VII shotshell one per variant of l,
 * all at the scale of the widest. SVG; with `side` one side alone (the record pages),
 * else both sides in one figure, the views Cartridge, Chamber and Combined switched by a
 * segmented control (the cartridge designer, which holds `view`; CSS on the figure's `data-view`);
 * the tables carry the data. The cartridge designer passes its own heading and the figures it laid
 * out already. Length texts in `unit` (the Settings length unit), the geometry in mm.
 */
export function CartridgeDrawing({
  spec,
  heading,
  list = recordFigures(spec),
  side,
  variant,
  caption,
  view,
  onView,
  unit = 'mm',
}: {
  spec: Drawable
  /** Replaces "Outline, <standard> <name>" in the title. */
  heading?: string | undefined
  list?: Figure[] | undefined
  /**
   * One side only: the record page draws cartridge and chamber in sections of their own, and
   * `combined` both outlines with the region differences, screen only.
   */
  side?: Side | 'combined' | undefined
  /** With `side`: the figure of this shotshell variant only, at the scale of all. */
  variant?: string | undefined
  /** A sentence that starts the caption of the designer's figure. */
  caption?: string | undefined
  /** The view picked in the designer; shown while it draws, else Combined, else the drawn side. */
  view?: View | undefined
  onView?: ((view: View) => void) | undefined
  unit?: LengthUnit | undefined
}) {
  const all = list.filter((f) => f.drawn.length)
  if (side === undefined) {
    if (all.length === 0) return <Undrawn list={list} />
    // the designer: both sides in one figure, Combined with the region differences
    const em = screenEm(
      all.map((f) => f.drawn),
      unit,
    )
    const across = Math.max(...all.map((f) => screenWidth(f.drawn, em, unit)))
    const laid = all.map((f) => {
      const differences = f.drawn.length === 2 ? regions(spec.values) : []
      return {
        figure: f,
        differences,
        model: figureModel(f.drawn, 'screen', em, across, differences, false, unit),
        print: figureModel(f.drawn, 'print', face.printEm, 0, differences, false, unit),
      }
    })
    const tallest = Math.max(...laid.map((l) => l.model.frame[3]))
    return laid.map((l) => (
      <Outline
        key={l.figure.id}
        spec={spec}
        heading={heading}
        caption={caption}
        tallest={tallest}
        scale={1}
        view={view}
        onView={onView}
        unit={unit}
        {...l}
      />
    ))
  }
  if (side === 'combined') return <Combined spec={spec} list={list} variant={variant} unit={unit} />
  // each side its own figure, at the scale both sides share
  const split = all.flatMap((f) =>
    f.drawn.map((d) => ({
      ...f,
      id: f.drawn.length > 1 ? `${f.id}-${d.side}` : f.id,
      drawn: [d],
      side: d.side,
      // the other side's "not drawn" note stands in that side's panel
      notes: f.notes.filter((n) => n.code !== 'missing'),
      group: f.id,
      // upright on paper too: the screen layout at the print text size
      print: sideModel(d, face.printEm, 0, unit),
    })),
  )
  const shown = split.filter(
    (f) => f.side === side && (variant === undefined || f.variant === variant),
  )
  if (shown.length === 0) return <Undrawn list={list} side={side} />
  const units = ['mm', 'in'] as const
  const ems = units.map((u) =>
    screenEm(
      all.map((f) => f.drawn),
      u,
    ),
  )
  // one frame width and one height in both length units: the scale stays when the unit changes
  // (a switch, or the Settings unit read after hydration)
  const across = Math.max(
    ...units.flatMap((u, i) => all.map((f) => screenWidth(f.drawn, nth(ems, i), u))),
  )
  const model = (f: { drawn: Drawn }, u: LengthUnit) =>
    sideModel(nth(f.drawn, 0), nth(ems, units.indexOf(u)), across, u)
  // the figures of a record fit the window at one scale, the tallest's, the sides not shown here too
  const tallest = Math.max(...units.flatMap((u) => split.map((f) => model(f, u).frame[3])))
  const layout = (u: LengthUnit) => ({ models: shown.map((f) => model(f, u)), tallest })
  const { models } = layout(unit)
  // the record page's other length unit: its drawing's room is kept
  const other = layout(unit === 'mm' ? 'in' : 'mm')
  const scale = printScale(split)
  return shown.map((figure, k) => (
    <Outline
      key={figure.id}
      spec={spec}
      heading={heading}
      figure={figure}
      model={nth(models, k)}
      tallest={tallest}
      reserve={{ model: nth(other.models, k), tallest: other.tallest }}
      print={figure.print}
      scale={scale}
      unit={unit}
      linked
    />
  ))
}

/** The screen models of one drawn side, by layout: a record page lays out every side for each panel and length unit. */
const sideModels = new WeakMap<Drawn[number], Map<string, FigureModel>>()

function sideModel(d: Drawn[number], em: number, across: number, unit: LengthUnit) {
  const byLayout = sideModels.get(d) ?? new Map<string, FigureModel>()
  sideModels.set(d, byLayout)
  const key = `${em} ${across} ${unit}`
  const model = byLayout.get(key) ?? figureModel([d], 'screen', em, across, [], false, unit)
  byLayout.set(key, model)
  return model
}

/**
 * The record page's Combined view: both outlines and the region differences of a figure
 * whose two sides draw, at the scale of the side figures (their em and width); on screen only, as
 * print gives each side upright. Each region callout carries the symbols it compares.
 */
function Combined({
  spec,
  list,
  variant,
  unit,
}: {
  spec: Drawable
  list: Figure[]
  variant?: string | undefined
  unit: LengthUnit
}) {
  const all = list.filter((f) => f.drawn.length)
  const both = all.filter(
    (f) => f.drawn.length === 2 && (variant === undefined || f.variant === variant),
  )
  if (both.length === 0) return null
  const em = screenEm(
    all.map((f) => f.drawn),
    unit,
  )
  const across = Math.max(...all.map((f) => screenWidth(f.drawn, em, unit)))
  const differences = regions(spec.values)
  const models = both.map((f) =>
    figureModel(f.drawn, 'screen', em, across, differences, false, unit),
  )
  const sides = all.flatMap((f) =>
    f.drawn.map((d) => figureModel([d], 'screen', em, across, [], false, unit).frame[3]),
  )
  const tallest = Math.max(...sides, ...models.map((m) => m.frame[3]))
  const linked: Linked = Object.fromEntries(
    differences.map((r) => [r.name, r.values.map((v) => v.symbol).join(' ')]),
  )
  return both.map((f, k) => (
    <Outline
      key={f.id}
      spec={spec}
      figure={{ ...f, id: `${f.id}-combined` }}
      model={nth(models, k)}
      tallest={tallest}
      unit={unit}
      differences={differences}
      linked={linked}
    />
  ))
}

/**
 * Why nothing is drawn: for one side its own note (missing values, closed front), else every note.
 */
function Undrawn({ list, side }: { list: Figure[]; side?: Side | undefined }) {
  const { t } = useTranslation()
  const notes = list
    .flatMap((f) => f.notes)
    .filter(
      (n) =>
        side === undefined ||
        n.code === 'closedFront' ||
        (n.code === 'missing' && n.text.startsWith(`${sideName[side]} not drawn`)),
    )
  const lead =
    side === undefined
      ? t('No drawing for this record.')
      : notes.some((n) => n.code === 'missing')
        ? ''
        : t(notDrawn[side])
  return (
    <p>
      {lead}
      {[...new Set(notes.map((n) => n.text))].map((n, k) => `${k || lead ? ' ' : ''}${n}`)}
    </p>
  )
}

/** The printed sheet's drawing column (A4, globals.css): its width, and the height the two drawings of a variant share, mm. */
const printColumn = { width: 72, height: 160 }
/** Life size, else the largest of these reductions that fits. */
const reductions = [1, 0.8, 2 / 3, 0.5, 0.4, 1 / 3, 0.25]

/**
 * One print scale for every drawing of a record: cartridge and chamber of a variant stacked in the
 * drawing column of the sheet.
 */
function printScale(split: { group: string; print: FigureModel }[]) {
  const heights = new Map<string, number>()
  for (const f of split) heights.set(f.group, (heights.get(f.group) ?? 0) + f.print.frame[3])
  const fit = Math.min(
    printColumn.width / Math.max(...split.map((f) => f.print.frame[2])),
    printColumn.height / Math.max(...heights.values()),
  )
  return reductions.find((r) => r <= fit + 1e-9) ?? reductions[reductions.length - 1]
}

/** The print scale sentence: life size, else a reduction such as 1:1.25 (80 % of life size). */
const scaleSentence = (k: number, t: Translator['t']) =>
  k === 1
    ? t('Printed at 100 % scale, the drawing is life size (1:1).')
    : t('Printed at 100 % scale, the drawing is at 1:{ratio} ({percent} % of life size).', {
        ratio: plainNumber(Number((1 / k).toFixed(2))),
        percent: Math.round(k * 100),
      })

/**
 * A value in the description: symbol, value with its unit, then tolerance, limit or "derived";
 * lengths and their tolerances in `unit`, an angle in degrees.
 */
function described(
  d: { symbol: string; value: number; derived?: true; stored?: SpecValue },
  unit: LengthUnit,
  t: Translator['t'],
  angle = false,
) {
  const [symbol, value = '', ...rest] = d.stored
    ? valueParts(d.stored)
    : [d.symbol, String(d.value)]
  const length = (text: string) =>
    angle || unit === 'mm' ? text : text.replace(/\d+(\.\d+)?/g, (x) => lengthText(Number(x), unit))
  const shown = angle ? angleText(Number(value)) : `${length(value)} ${unit}`
  const extra = [...rest.map(length), ...(d.derived ? [t('derived')] : [])]
  return `${symbol} ${shown}${extra.length ? ` (${extra.join(' ')})` : ''}`
}

/** The region values in words: "head R1 0.02 mm; ...", the conflicts apart. */
function regionWords(list: Region[], unit: LengthUnit, t: Translator['t']) {
  const all = list.flatMap(({ name, values }) => values.map((v) => ({ name, ...v })))
  const words = (want: (x: number) => boolean) =>
    list
      .flatMap(({ name, values }) => {
        const own = values.filter((v) => want(v.value))
        return own.length
          ? [
              `${name} ${own.map((v) => `${v.symbol} ${signedLengthText(v.value, unit)} ${unit}`).join(', ')}`,
            ]
          : []
      })
      .join('; ')
  const conflicts = all.some((v) => v.value < 0)
  const own = t('{difference} (chamber minimum minus cartridge maximum): {values}', {
    difference: differenceWording,
    values: words((x) => x >= 0) || t('none'),
  })
  return `${own}${conflicts ? `; ${conflictWording}: ${words((x) => x < 0)}` : ''}`
}

/** One description of every view of a figure. */
function description(drawn: Drawn, list: Region[], unit: LengthUnit, t: Translator['t']) {
  const sides = drawn.map(({ side, p }) => {
    const { dimensions, angles, radii } = p.annotation
    const values = [
      ...dimensions.map((d) =>
        d.kind === 'diameter'
          ? t('diameter {value}', { value: described(d, unit, t) })
          : described(d, unit, t),
      ),
      ...(p.derivedE === undefined
        ? []
        : [
            t('e {value} (derived, not dimensioned)', {
              value: `${lengthText(p.derivedE, unit)} ${unit}`,
            }),
          ]),
      ...angles.map((a) => described(a, unit, t, true)),
      ...radii.map((r) => described(r, unit, t)),
    ].join(', ')
    return side === 'chamber'
      ? t('Chamber view: the chamber in a marked {width} steel band; {values}.', {
          width: `${lengthText(face.steelBandWidth, unit)} ${unit}`,
          values,
        })
      : t('Cartridge view: {values}.', { values })
  })
  const combined =
    drawn.length !== 2
      ? []
      : list.length
        ? [
            t('Combined view: both outlines and the gap between them, no dimensions; {regions}.', {
              regions: regionWords(list, unit, t),
            }),
          ]
        : [t('Combined view: both outlines and the gap between them, no dimensions.')]
  return [t('Technical drawing, full section about the axis.'), ...sides, ...combined].join(' ')
}

/** Why the views without their side are disabled: the closed front, or the side's missing values. */
function disabledReason(drawn: Drawn, notes: Figure['notes'], t: Translator['t']) {
  const missing = (['cartridge', 'chamber'] as const).find((s) => !drawn.some((d) => d.side === s))
  if (!missing) return
  const why = notes.some((n) => n.code === 'closedFront')
    ? t('closed front (see the caption)')
    : (notes.find((n) => n.code === 'missing' && n.text.startsWith(sideName[missing]))?.text ?? '')
        .replace(/^\w+ not drawn: /, '')
        .replace(/\.$/, '')
  return { missing, text: t(bothNotDrawn[missing], { why }) }
}

/** Which views are enabled and shown, and the sides the print draws. */
function viewState(
  drawn: Drawn,
  notes: Figure['notes'],
  view: View | undefined,
  t: Translator['t'],
) {
  const reason = disabledReason(drawn, notes, t)
  const drawnSide = reason?.missing === 'cartridge' ? 'chamber' : 'cartridge'
  const enabled = (v: string) => !reason || v === drawnSide
  // Combined by default once both sides draw; a view picked stays while it draws
  const fallback = reason ? drawnSide : 'combined'
  const shown = view && enabled(view) ? view : fallback
  const printSides: Side[] = reason ? [drawnSide] : ['cartridge', 'chamber']
  return { reason, enabled, shown, printSides }
}

type Reason = ReturnType<typeof disabledReason>

function ViewSwitch({
  id,
  shown,
  reason,
  enabled,
  onView,
}: {
  id: string
  shown: string
  reason: Reason
  enabled: (v: string) => boolean
  onView?: ((view: View) => void) | undefined
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="drawing-controls">
        {/* named with the figure title: a table VII record has one switch per variant */}
        <span id={`${id}-legend`} className="visually-hidden">
          {t('View')}
        </span>
        <SegmentedControl
          size={controlSize.row.toggle}
          aria-labelledby={`${id}-legend ${id}-title`}
          aria-describedby={reason ? `${id}-reason` : undefined}
          name={`${id}-view`}
          value={shown}
          onChange={(v) => onView?.(v as View)}
          data={views.map(([value, label]) => ({
            value,
            label: t(label),
            disabled: !enabled(value),
          }))}
        />
      </div>
      {reason && (
        <p id={`${id}-reason`} className="views-reason">
          {reason.text}
        </p>
      )}
    </>
  )
}

/**
 * The print drawing shares the screen drawing's description; print ignores the view and gives each
 * drawn side dimensioned (`sides`, none for a figure without a switch).
 */
function PrintFigures({
  id,
  title,
  print,
  scale,
  sides,
}: {
  id: string
  title: string
  print: FigureModel
  scale?: number | undefined
  sides?: Side[] | undefined
}) {
  const { t } = useTranslation()
  if (!sides)
    return (
      <TechnicalDrawing
        id={`${id}-print`}
        title={title}
        describedBy={`${id}-desc`}
        model={print}
        printScale={scale}
      />
    )
  return sides.map((side) => (
    <div key={side} data-print-view={side}>
      <TechnicalDrawing
        id={side === 'cartridge' ? `${id}-print` : `${id}-print-${side}`}
        title={t('{title}, {side}', { title, side: t(sideWords[side]) })}
        describedBy={`${id}-desc`}
        model={print}
        printScale={scale}
      />
    </div>
  ))
}

function FigureCaption({
  caption,
  differences,
  unit,
  variant,
  notes,
  scale,
}: {
  caption?: string | undefined
  differences?: Region[] | undefined
  unit: LengthUnit
  variant?: string | undefined
  notes: Figure['notes']
  scale?: number | undefined
}) {
  const { t } = useTranslation()
  return (
    <figcaption>
      {caption}
      {differences !== undefined && differences.length > 0 && (
        <span className="caption-combined">
          {' '}
          {unit === 'mm'
            ? t(
                'Combined: per region the nominal minimum difference of published dimensions (chamber minimum minus cartridge maximum, in mm, signed); "conflict" marks a data conflict between published cartridge maximum and chamber minimum (check source).',
              )
            : t(
                'Combined: per region the nominal minimum difference of published dimensions (chamber minimum minus cartridge maximum, in inches, signed); "conflict" marks a data conflict between published cartridge maximum and chamber minimum (check source).',
              )}
        </span>
      )}
      {/* the select names the variant on screen */}
      {variant !== undefined && (
        <span className="print-only">{` ${t('Variant {variant}.', { variant })}`}</span>
      )}
      {notes.some((n) => n.flagNumber) &&
        ` ${t('The numbered circles on the drawing mark these notes.')}`}
      {notes.map((n) => (
        <span key={n.text}>
          {' '}
          {n.flagNumber && <span className="note-flag">{n.flagNumber}</span>}
          {n.flagNumber && ' '}
          {n.text}
        </span>
      ))}
      {scale !== undefined && <span className="print-only">{` ${scaleSentence(scale, t)}`}</span>}
    </figcaption>
  )
}

function Outline({
  spec,
  heading,
  figure: { id, variant, drawn, notes },
  model,
  tallest,
  print,
  scale,
  differences,
  caption,
  view,
  onView,
  unit,
  linked,
  reserve,
}: {
  spec: Drawable
  heading?: string | undefined
  caption?: string | undefined
  unit: LengthUnit
  /** The record page's linked hover: the screen drawing's dimensions named by symbol. */
  linked?: Linked | undefined
  view?: View | undefined
  onView?: ((view: View) => void) | undefined
  figure: Figure
  /** The screen model. */
  model: FigureModel
  tallest: number
  /** The upright print model and the record's print scale; none for the record's Combined view. */
  print?: FigureModel
  scale?: number | undefined
  /** The designer's figure of both sides: the region differences of its Combined view. */
  differences?: Region[] | undefined
  /** The record page: the screen figure in the other length unit, whose room the drawing keeps. */
  reserve?: { model: FigureModel; tallest: number } | undefined
}) {
  const { t } = useTranslation()
  const title = `${heading ?? t('Outline, {name}', { name: `${spec.standard} ${spec.name}` })}${variant === undefined ? '' : ` (${variant})`}`
  const desc = description(drawn, differences ?? [], unit, t)
  // the record's Combined view: no switch of its own and no print drawing
  const combined = print === undefined
  const switchable = differences !== undefined && !combined
  const { reason, enabled, shown, printSides } = viewState(drawn, notes, view, t)
  return (
    <figure
      className="drawing-figure"
      data-view={combined ? 'combined' : switchable ? shown : undefined}
    >
      {switchable && (
        <ViewSwitch id={id} shown={shown} reason={reason} enabled={enabled} onView={onView} />
      )}
      <TechnicalDrawing
        id={id}
        title={combined ? t('{title}, combined', { title }) : title}
        desc={desc}
        model={model}
        tallest={tallest}
        linked={linked}
        reserve={reserve}
      />
      {print && (
        <PrintFigures
          id={id}
          title={title}
          print={print}
          scale={scale}
          sides={switchable ? printSides : undefined}
        />
      )}
      <FigureCaption
        caption={caption}
        differences={differences}
        unit={unit}
        variant={variant}
        notes={notes}
        scale={scale}
      />
    </figure>
  )
}
