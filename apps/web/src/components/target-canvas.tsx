'use client'

import { dispersionEllipse, predictionEllipse } from '@open-reloading/core'
import { type CalibrationReference, fromSi, type TargetSheet, toSi } from '@open-reloading/schema'
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { type LabelScene, placeLabel } from '../lib/label-placement.ts'
import { nth } from '../lib/nth.ts'
import {
  axisEnds,
  coverages,
  ellipsePoints,
  extremePairIndices,
  type Frame,
  screenNudge,
  shotExtentCorners,
  targetToView,
  viewToTarget,
} from '../lib/target-editor.ts'
import { circleThrough, type Point, turnedBox } from '../lib/target-geometry.ts'
import { groupStatisticsOf } from '../lib/target-groups.ts'
import type { ViewBox } from '../lib/target-view.ts'
import { mmLength } from '../lib/workbench.ts'
import { arrows, viewPoint } from './svg-point.ts'
import { useUnits } from './units-settings.tsx'
import { usePinch } from './use-pinch.ts'

export type Tool =
  | 'select'
  | 'shot'
  | 'aim'
  | 'origin'
  | CalibrationReference['kind']
  // hole detection: its region, the backing colour and the example hole (hole-detection.tsx)
  | 'region'
  | 'backing'
  | 'example'
  // ring scoring: points on the rings of a target face (ring-scoring.tsx)
  | 'rings'

/** Points a calibration tool takes before it adds its reference. */
export const toolPoints: Partial<Record<Tool, number>> = {
  line: 2,
  ringCentre: 2,
  ringEdge: 3,
  rectangle: 4,
}

export const overlayNames = {
  spread: msg('Extreme spread'),
  box: msg('Width and height'),
  aim: msg('Point of aim line'),
  ellipses: msg('Prediction ellipses (50 %, 95 %)'),
  dispersion: msg('Dispersion ellipses (50 %, 95 %)'),
  axis: msg('Major axis'),
  excluded: msg('Excluded direction'),
  numbers: msg('Shot numbers'),
  stats: msg('Statistics box'),
  rings: msg('Target rings and scores'),
} as const
export type Overlay = keyof typeof overlayNames

/** Hover text of an overlay switch. */
export const overlayHelp: Partial<Record<Overlay, Message>> = {
  ellipses: msg(
    'Where a further shot lands with the stated coverage (50 %, 95 %), from the shots of the group. Absent below 3 shots.',
  ),
  dispersion: msg(
    'Describes the shots fired: the ellipses holding 50 % and 95 % of a normal spread with their covariance; dashed. Absent below 2 shots.',
  ),
  rings: msg(
    "The rings of the active group's target and each shot's value, when a target is chosen (Group).",
  ),
}

export type Selection = { group: string; index: number }

/** What a pointer drag moves; view points are image px with a photo, mm on a drawn target. */
type Drag =
  | { kind: 'shot'; sel: Selection }
  | { kind: 'aim'; group: string }
  | { kind: 'ref'; ref: number; point: number }
  | { kind: 'pan'; from: Point; box: ViewBox }
  | { kind: 'stats'; dx: number; dy: number }

/** The SVG transform that turns the photo by `turn` (rad, counter-clockwise) about its middle. */
const photoTransform = (photo: { width: number; height: number }, turn = 0) =>
  turn ? `rotate(${fromSi('angle', -turn)} ${photo.width / 2} ${photo.height / 2})` : undefined

const polyline = (pts: Point[]) => pts.map((p) => `${p.x},${p.y}`).join(' ')

/** The points of a reference on the photo, image px. */
export function refPoints(r: CalibrationReference): Point[] {
  if (r.kind === 'line') return [r.a, r.b]
  if (r.kind === 'ringCentre') return [r.centre, r.edge]
  if (r.kind === 'ringEdge') return [...r.points]
  return [...r.corners]
}

function RefShape({ r }: { r: CalibrationReference }) {
  const pts = refPoints(r)
  if (r.kind === 'line') return <line x1={r.a.x} y1={r.a.y} x2={r.b.x} y2={r.b.y} />
  if (r.kind === 'rectangle') return <polygon points={polyline(pts)} />
  let c: { centre: Point; radius: number } | undefined
  try {
    c =
      r.kind === 'ringCentre'
        ? { centre: r.centre, radius: Math.hypot(r.edge.x - r.centre.x, r.edge.y - r.centre.y) }
        : circleThrough(...r.points)
  } catch {
    return null
  }
  return <circle cx={c.centre.x} cy={c.centre.y} r={c.radius} />
}

/** The extent to fit: the photo, or every point drawn with a margin. */
function extentOf(
  sheet: TargetSheet,
  frame: Frame | undefined,
  photo: { width: number; height: number } | undefined,
): ViewBox {
  if (photo) return turnedBox(photo.width, photo.height, sheet.photoRotation ?? 0)
  const pts: Point[] = []
  if (frame)
    for (const g of sheet.groups) {
      for (const s of g.shots) pts.push(targetToView(frame, s))
      if (g.aim) pts.push(targetToView(frame, g.aim))
    }
  for (const r of sheet.references) pts.push(...refPoints(r))
  // a drawn target: at least 200 mm around the origin
  if (!sheet.photo) pts.push({ x: -100, y: -100 }, { x: 100, y: 100 })
  if (!pts.length) return { x: 0, y: 0, w: 1000, h: 1000 }
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const m = 0.1 * Math.max(x1 - x0, y1 - y0, 1)
  return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m }
}

type ShotHandlers = {
  onNudge?: ((sel: Selection, dx: number, dy: number) => void) | undefined
  onDelete?: ((sel: Selection) => void) | undefined
  onToggle?: ((sel: Selection) => void) | undefined
}

/** The arrows, Home and End move the focus along the shots of the group (one tab stop per group). */
function focusAlong(
  e: KeyboardEvent<SVGElement>,
  sel: Selection,
  d: readonly [number, number] | undefined,
) {
  e.preventDefault()
  const shots =
    e.currentTarget.parentElement?.parentElement?.querySelectorAll<SVGElement>('.shot-hit')
  const last = (shots?.length ?? 1) - 1
  const step = d && d[0] + d[1] > 0 ? 1 : -1
  const to = e.key === 'Home' ? 0 : e.key === 'End' ? last : sel.index + step
  shots?.[Math.max(0, Math.min(last, to))]?.focus()
}

/** The keys of a shot's mark: Alt+arrows nudge, arrows and Home and End move the focus, Delete removes, E or Space toggles. */
function shotKey(
  e: KeyboardEvent<SVGElement>,
  sel: Selection,
  s: Point,
  frame: Frame | undefined,
  h: ShotHandlers,
) {
  const d = arrows[e.key]
  if (d && e.altKey && frame) {
    // also keeps Alt+Left from going back in the history
    e.preventDefault()
    // along the screen, whatever the rotation of the target axes
    const n = screenNudge(frame, s, ...d, e.shiftKey ? 1e-3 : 1e-4)
    h.onNudge?.(sel, n.x - s.x, n.y - s.y)
    return
  }
  // the browser's own shortcuts (Ctrl+E, Ctrl+Home, Alt+Backspace) stay the browser's
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (d || e.key === 'Home' || e.key === 'End') return focusAlong(e, sel, d)
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    h.onDelete?.(sel)
  } else if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
    e.preventDefault()
    h.onToggle?.(sel)
  }
}

/** The calibration references on the photo: their shapes with a handle per point, and the clicks so far. */
function RefsLayer({
  references,
  pending,
  k,
  onHandle,
}: {
  references: CalibrationReference[]
  pending: Point[]
  k: number
  onHandle: (e: PointerEvent<SVGElement>, ref: number, point: number) => void
}) {
  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: an SVG group is not focusable; it only draws
    <g className="refs" aria-hidden="true">
      {references.map((r, ri) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: references keep their order
        <g key={ri}>
          <RefShape r={r} />
          {refPoints(r).map((p, pi) => (
            <circle
              // biome-ignore lint/suspicious/noArrayIndexKey: points keep their order
              key={pi}
              className="handle"
              cx={p.x}
              cy={p.y}
              r={5 * k}
              onPointerDown={(e) => onHandle(e, ri, pi)}
            />
          ))}
        </g>
      ))}
      {pending.map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: clicks keep their order
        <circle key={i} className="handle pending" cx={p.x} cy={p.y} r={5 * k} />
      ))}
      {pending.length > 1 && <polyline className="pending" points={polyline(pending)} />}
    </g>
  )
}

/** The x and y axes of the calibrated sheet, drawn from the origin. */
function AxesMark({ v, k, fontSize }: { v: (q: Point) => Point; k: number; fontSize: number }) {
  const o = v({ x: 0, y: 0 })
  const len = 40 * k
  const ux = v({ x: toSi('length', 1), y: 0 })
  const uy = v({ x: 0, y: toSi('length', 1) })
  const dir = (u: Point) => {
    const d = Math.hypot(u.x - o.x, u.y - o.y) || 1
    return { x: o.x + ((u.x - o.x) / d) * len, y: o.y + ((u.y - o.y) / d) * len }
  }
  const [ex, ey] = [dir(ux), dir(uy)]
  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: an SVG group is not focusable; it only draws
    <g className="axes" aria-hidden="true">
      <line x1={o.x} y1={o.y} x2={ex.x} y2={ex.y} />
      <line x1={o.x} y1={o.y} x2={ey.x} y2={ey.y} />
      <text x={ex.x} y={ex.y} fontSize={fontSize}>
        x
      </text>
      <text x={ey.x} y={ey.y} fontSize={fontSize}>
        y
      </text>
    </g>
  )
}

function AimMark({
  at: a,
  k,
  onPointerDown,
}: {
  at: Point
  k: number
  onPointerDown: (e: PointerEvent<SVGElement>) => void
}) {
  const r = 9 * k
  return (
    <g className="aim-mark" onPointerDown={onPointerDown}>
      <circle cx={a.x} cy={a.y} r={r} />
      <path d={`M${a.x - 1.6 * r} ${a.y}h${3.2 * r}M${a.x} ${a.y - 1.6 * r}v${3.2 * r}`} />
    </g>
  )
}

/** The magnifier above and left of the pointer, so a finger does not cover it; `children` is the drawing again. */
function Loupe({
  at: loupe,
  k,
  id,
  children,
}: {
  at: Point
  k: number
  id: string
  children: ReactNode
}) {
  const r = 60 * k
  const at = { x: loupe.x - 1.4 * r, y: loupe.y - 1.4 * r }
  const z = 4
  return (
    <>
      <clipPath id={`${id}-loupe`}>
        <circle cx={at.x} cy={at.y} r={r} />
      </clipPath>
      <g clipPath={`url(#${id}-loupe)`}>
        <rect x={at.x - r} y={at.y - r} width={2 * r} height={2 * r} className="loupe-bg" />
        {/* drawn again, not a <use>: rules like .target-canvas .shot-mark miss a use's shadow tree */}
        <g transform={`translate(${at.x} ${at.y}) scale(${z}) translate(${-loupe.x} ${-loupe.y})`}>
          {children}
        </g>
      </g>
      <circle cx={at.x} cy={at.y} r={r} className="loupe-halo" />
      <circle cx={at.x} cy={at.y} r={r} className="loupe-ring" />
      <path
        className="loupe-cross"
        d={`M${at.x - r} ${at.y}h${2 * r}M${at.x} ${at.y - r}v${2 * r}`}
      />
    </>
  )
}

type OverlayContext = {
  sheet: TargetSheet
  overlays: Record<Overlay, boolean>
  active: string | undefined
  box: ViewBox
  k: number
  fontSize: number
  v: (q: Point) => Point
  shotR: (q: Point) => number
  id: string
  t: Translator['t']
}

type Ellipse = { kind: 'prediction' | 'dispersion'; p: number; pts: Point[] }

/** The corner points of the ellipse's extremes, to choose a label anchor from. */
const extremes = (pts: Point[]) => {
  const first = nth(pts, 0)
  return [
    pts.reduce((a, b) => (b.y < a.y ? b : a), first),
    pts.reduce((a, b) => (b.x > a.x ? b : a), first),
    pts.reduce((a, b) => (b.y > a.y ? b : a), first),
    pts.reduce((a, b) => (b.x < a.x ? b : a), first),
  ]
}

/** The drawn ellipses of a group: prediction and dispersion, at each coverage, in view units. */
function ellipsesOf(
  s: ReturnType<typeof groupStatisticsOf>,
  on: (o: Overlay) => boolean,
  v: (q: Point) => Point,
): Ellipse[] {
  const kinds = [
    on('ellipses') && { kind: 'prediction' as const, at: predictionEllipse },
    on('dispersion') && { kind: 'dispersion' as const, at: dispersionEllipse },
  ].filter((x) => x !== false)
  return kinds.flatMap(({ kind, at }) =>
    coverages.flatMap((p) => {
      const pts = ellipsePoints(s, at(s, p))
      return pts ? [{ kind, p, pts: pts.map(v) }] : []
    }),
  )
}

/** Labels keep clear of every shot, shot number and label placed before them. */
function labelScene(c: OverlayContext): LabelScene {
  const { sheet, overlays, box, k, fontSize, v, shotR } = c
  return {
    circles: sheet.groups.flatMap((g) => g.shots.map((s) => ({ ...v(s), r: shotR(s) }))),
    segments: [],
    boxes: overlays.numbers
      ? sheet.groups.flatMap((g) =>
          g.shots.map((s, i) => {
            const [p, r] = [v(s), shotR(s)]
            const w = 0.6 * fontSize * String(i + 1).length
            return { x: p.x + r + 2 * k, y: p.y - r - fontSize, w, h: fontSize }
          }),
        )
      : [],
    view: box,
    fontSize,
    gap: 3 * k,
  }
}

type GroupOverlayParts = {
  g: TargetSheet['groups'][number]
  c: Point | undefined
  ex: Point | undefined
  ends: ReturnType<typeof axisEnds>
  pair: ReturnType<typeof extremePairIndices>
  box4: ReturnType<typeof shotExtentCorners>
  ellipses: Ellipse[]
  on: (o: Overlay) => boolean
  v: (q: Point) => Point
  k: number
  id: string
}

/** The lines and shapes of one group's overlays. */
function OverlayShapes(p: GroupOverlayParts) {
  const { g, c, ex, ends, pair, box4, on, v, k } = p
  return (
    <>
      {on('box') && box4 && <polygon className="ov-box" points={polyline(box4.map(v))} />}
      {p.ellipses.map((e) => (
        <polygon
          key={`${e.kind} ${e.p}`}
          className={`ov-ellipse ov-${e.kind}`}
          points={polyline(e.pts)}
        />
      ))}
      {on('axis') && ends && (
        <line
          className="ov-axis"
          x1={v(ends[0]).x}
          y1={v(ends[0]).y}
          x2={v(ends[1]).x}
          y2={v(ends[1]).y}
        />
      )}
      {on('spread') && pair && (
        <line
          className="ov-spread"
          x1={v(nth(g.shots, pair[0])).x}
          y1={v(nth(g.shots, pair[0])).y}
          x2={v(nth(g.shots, pair[1])).x}
          y2={v(nth(g.shots, pair[1])).y}
        />
      )}
      {on('aim') && g.aim && c && (
        <line className="ov-aim" x1={c.x} y1={c.y} x2={v(g.aim).x} y2={v(g.aim).y} />
      )}
      {ex && c && (
        <line
          className="ov-excluded"
          x1={c.x}
          y1={c.y}
          x2={ex.x}
          y2={ex.y}
          markerEnd={`url(#${p.id}-arrow)`}
        />
      )}
      {c && (
        <path
          className="ov-centre"
          d={`M${c.x - 4 * k} ${c.y}h${8 * k}M${c.x} ${c.y - 4 * k}v${8 * k}`}
        />
      )}
    </>
  )
}

/** The overlays of every group; each group's lines are in the scene before any label is placed. */
function groupOverlays(ctx: OverlayContext): ReactNode {
  const { sheet, fontSize } = ctx
  const scene = labelScene(ctx)
  const label = (text: string, anchors: Point[], from: Point, key: string) => {
    const b = placeLabel(scene, text, anchors, from)
    return (
      <text key={key} x={b.x} y={b.y + fontSize} fontSize={fontSize}>
        {text}
      </text>
    )
  }
  return sheet.groups.map((g) => overlayOf(g, scene, ctx, label))
}

type Labeller = (text: string, anchors: Point[], from: Point, key: string) => ReactNode

/** The end of the excluded-direction arrow, view units. */
function excludedEnd(
  s: ReturnType<typeof groupStatisticsOf>,
  c: Point | undefined,
  on: (o: Overlay) => boolean,
  v: (q: Point) => Point,
) {
  if (!on('excluded') || !s.excludedOffset || !s.centre || !c) return
  return v({ x: s.centre.x + s.excludedOffset.x, y: s.centre.y + s.excludedOffset.y })
}

/** Every line of a group is in the scene before a label is placed, so no label lands on one. */
function addSegments(
  scene: LabelScene,
  o: Pick<GroupOverlayParts, 'ellipses' | 'ends' | 'c' | 'ex' | 'on' | 'v'>,
) {
  const { ellipses, ends, c, ex, on, v } = o
  for (const e of ellipses)
    for (const [i, p] of e.pts.entries())
      scene.segments.push([p, nth(e.pts, (i + 1) % e.pts.length)])
  if (on('axis') && ends) scene.segments.push([v(ends[0]), v(ends[1])])
  if (ex && c) scene.segments.push([c, ex])
}

/** Labels tied to one point first; an ellipse label has four to choose from. */
function overlayLabels(p: GroupOverlayParts, label: Labeller, t: Translator['t']) {
  const { c, ex, ends, on, v } = p
  return (
    <>
      {ex && c && label(t('excluded shots'), [ex], c, 'excluded label')}
      {on('axis') && ends && c && label(t('major axis'), [v(ends[1]), v(ends[0])], c, 'axis label')}
      {c &&
        p.ellipses.map((e) =>
          label(
            e.kind === 'dispersion'
              ? t('{percent} % fired', { percent: Math.round(e.p * 100) })
              : t('{percent} %', { percent: Math.round(e.p * 100) }),
            extremes(e.pts),
            c,
            `${e.kind} ${e.p} label`,
          ),
        )}
    </>
  )
}

/** One group's overlays: its segments enter the scene, then its labels are placed. */
function overlayOf(
  g: TargetSheet['groups'][number],
  scene: LabelScene,
  ctx: OverlayContext,
  label: Labeller,
) {
  const { overlays, active, k, v, id } = ctx
  const s = groupStatisticsOf(g)
  const c = s.centre && v(s.centre)
  const on = (o: Overlay) => overlays[o]
  const parts: GroupOverlayParts = {
    g,
    c,
    ex: excludedEnd(s, c, on, v),
    ends: axisEnds(s),
    pair: extremePairIndices(g.shots),
    box4: shotExtentCorners(g.shots),
    ellipses: ellipsesOf(s, on, v),
    on,
    v,
    k,
    id,
  }
  addSegments(scene, parts)
  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: an SVG group is not focusable; it only draws
    <g
      key={g.id}
      className="group-overlays"
      style={{ color: g.colour }}
      data-dim={(active !== undefined && g.id !== active) || undefined}
      aria-hidden="true"
    >
      <OverlayShapes {...parts} />
      {overlayLabels(parts, label, ctx.t)}
    </g>
  )
}

/** The tools that take a point by click or by the keyboard marker. */
function isPointTool(tool: Tool) {
  return (
    ['aim', 'origin', 'region', 'backing', 'example', 'rings'].includes(tool) || tool in toolPoints
  )
}

/** The tools that show the magnifier while the pointer is over the sheet. */
function showsLoupe(tool: Tool) {
  return ['shot', 'rings', 'example'].includes(tool) || tool in toolPoints
}

/** Where the magnifier shows: while dragging or with a point tool, at the pointer. */
function loupeAt(dragging: boolean, tool: Tool, hover: Point | undefined) {
  return dragging || showsLoupe(tool) ? hover : undefined
}

/** The photo, or the drawn target without one. */
function Backdrop({
  sheet,
  photo,
  filter,
}: {
  sheet: TargetSheet
  photo: { url: string; width: number; height: number } | undefined
  filter: { contrast: number; darken: number }
}) {
  if (photo)
    return (
      <image
        href={photo.url}
        x={0}
        y={0}
        width={photo.width}
        height={photo.height}
        transform={photoTransform(photo, sheet.photoRotation)}
        style={{
          filter: `contrast(${filter.contrast}) brightness(${1 - filter.darken})`,
        }}
      />
    )
  if (sheet.photo) return null
  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: an SVG group is not focusable; it only draws
    <g className="drawn-target" aria-hidden="true">
      {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((r) => (
        <circle key={r} cx={0} cy={0} r={r} vectorEffect="non-scaling-stroke" />
      ))}
      <line x1={-100} y1={0} x2={100} y2={0} vectorEffect="non-scaling-stroke" />
      <line x1={0} y1={-100} x2={0} y2={100} vectorEffect="non-scaling-stroke" />
    </g>
  )
}

/**
 * The drawing of a target sheet: the photo (or a drawn target), references, points of aim, shots
 * and the switchable overlays, all mapped from target m to the view through `frame`; pointer and
 * keyboard edits are reported to the editor.
 */
export function TargetCanvas({
  sheet,
  frame,
  photo,
  active,
  selected,
  tool,
  pending = [],
  overlays,
  filter,
  marker,
  describe,
  statsBox,
  onSelect,
  onAdd,
  onMove,
  onToggle,
  onDelete,
  onNudge,
  onPoint,
  onRefMove,
  onAimMove,
  layer,
  still,
  view: viewOut,
}: {
  sheet: TargetSheet
  frame: Frame | undefined
  photo?: { url: string; width: number; height: number } | undefined
  active?: string | undefined
  selected?: Selection | undefined
  tool: Tool
  /** Points clicked so far for the calibration tool, image px. */
  pending?: Point[]
  overlays: Record<Overlay, boolean>
  filter: { contrast: number; darken: number }
  /** Diameter of the shot marks, m; a fixed size on screen without it. */
  marker: number | undefined
  /** A shot's accessible name. */
  describe: (sel: Selection) => string
  statsBox?: ReactNode
  onSelect?: (sel: Selection | undefined) => void
  onAdd?: (q: Point) => void
  /** A drag step of a shot; `first` starts an undo step. */
  onMove?: (sel: Selection, q: Point, first: boolean) => void
  onToggle?: ((sel: Selection) => void) | undefined
  onDelete?: ((sel: Selection) => void) | undefined
  onNudge?: ((sel: Selection, dx: number, dy: number) => void) | undefined
  /** A click of the aim, origin or a calibration tool, view point (image px with a photo). */
  onPoint?: (p: Point) => void
  onRefMove?: (ref: number, point: number, p: Point, first: boolean) => void
  onAimMove?: (group: string, q: Point, first: boolean) => void
  /** Drawn over the shots in view units, `k` view units per screen px: the notes. */
  layer?: (k: number) => ReactNode
  /** A fixed view and scale for an export or the print: no input (no handlers), loupe, zoom buttons, references or axes. */
  still?: { box: ViewBox; k: number }
  /** Set to the extent Fit shows on every render, for the exports and the print. */
  view?: { current: { extent: ViewBox } | undefined }
}) {
  // an id usable in url(#...) references
  const { system } = useUnits()
  const { t } = useTranslation()
  const id = `tc${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const svg = useRef<SVGSVGElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | undefined>(undefined)
  const [view, setView] = useState<ViewBox>()
  const [size, setSize] = useState({ w: 1, h: 1 })
  const [hover, setHover] = useState<Point>()
  const [dragging, setDragging] = useState(false)
  const [statsAt, setStatsAt] = useState({ x: 8, y: 8 })

  /** The extent to fit: the photo, or every point drawn with a margin. */
  const extent = useMemo(() => extentOf(sheet, frame, photo), [photo, frame, sheet])
  const extentKey = `${photo?.url ?? sheet.photo ?? 'drawn'} ${sheet.photoRotation ?? 0}`
  // biome-ignore lint/correctness/useExhaustiveDependencies: fit once per photo and turn, not on every edit
  useEffect(() => setView(undefined), [extentKey])
  const box = still?.box ?? view ?? extent
  if (viewOut) viewOut.current = { extent }

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const seen = new ResizeObserver(() =>
      setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 }),
    )
    seen.observe(el)
    return () => seen.disconnect()
  }, [])
  /** View units per screen px (the box is fitted with `meet`). */
  const k = still?.k ?? Math.max(box.w / size.w, box.h / size.h)

  const toPoint = (e: { clientX: number; clientY: number }): Point =>
    viewPoint(svg.current, e.clientX, e.clientY) ?? { x: 0, y: 0 }

  const zoom = (f: number, at?: Point) => {
    const c = at ?? { x: box.x + box.w / 2, y: box.y + box.h / 2 }
    setView({ x: c.x - (c.x - box.x) * f, y: c.y - (c.y - box.y) * f, w: box.w * f, h: box.h * f })
  }

  // wheel zoom needs a non-passive listener to keep the page from scrolling
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = viewPoint(el, e.clientX, e.clientY)
      if (!p) return
      const f = e.deltaY > 0 ? 1.2 : 1 / 1.2
      setView((v) => {
        const b = v ?? extent
        return { x: p.x - (p.x - b.x) * f, y: p.y - (p.y - b.y) * f, w: b.w * f, h: b.h * f }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [extent])

  const shotR = (q: Point) => {
    if (!frame || !marker) return 6 * k
    const c = targetToView(frame, q)
    const e = targetToView(frame, { x: q.x + marker / 2, y: q.y })
    return Math.max(Math.hypot(e.x - c.x, e.y - c.y), 2 * k)
  }

  const start = (e: PointerEvent<SVGElement>, d: Drag) => {
    e.stopPropagation()
    if (e.button !== 0) return
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    drag.current = d
    setDragging(d.kind !== 'pan')
  }

  const first = useRef(false)
  /** A touch of the Shot or a point tool, placed where the finger lifts unless a pinch starts. */
  const tap = useRef<number | undefined>(undefined)
  const place = (p: Point) => {
    if (tool !== 'shot') return onPoint?.(p)
    if (frame) onAdd?.(viewToTarget(frame, p))
  }
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    if (tool === 'select') {
      onSelect?.(undefined)
      svg.current?.setPointerCapture?.(e.pointerId)
      drag.current = { kind: 'pan', from: { x: e.clientX, y: e.clientY }, box }
      return
    }
    if (e.pointerType === 'touch') tap.current = e.pointerId
    else place(toPoint(e))
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const p = toPoint(e)
    setHover(p)
    const d = drag.current
    if (!d) return
    if (d.kind === 'pan') {
      const f = d.box.w / (svg.current?.clientWidth || 1)
      const g = d.box.h / (svg.current?.clientHeight || 1)
      const s = Math.max(f, g)
      setView({
        ...d.box,
        x: d.box.x - (e.clientX - d.from.x) * s,
        y: d.box.y - (e.clientY - d.from.y) * s,
      })
      return
    }
    const isFirst = !first.current
    first.current = true
    if (d.kind === 'ref') return onRefMove?.(d.ref, d.point, p, isFirst)
    if (!frame) return
    if (d.kind === 'shot') onMove?.(d.sel, viewToTarget(frame, p), isFirst)
    else if (d.kind === 'aim') onAimMove?.(d.group, viewToTarget(frame, p), isFirst)
  }

  // the view without a drag: arrow keys on the sheet pan it, a double click on it zooms in there
  const onSheetKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const d = arrows[e.key]
    if (!d || e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return
    e.preventDefault()
    setView({ ...box, x: box.x + d[0] * box.w * 0.1, y: box.y + d[1] * box.h * 0.1 })
  }

  const end = () => {
    drag.current = undefined
    first.current = false
    tap.current = undefined
    setDragging(false)
  }
  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    if (tap.current === e.pointerId) place(toPoint(e))
    end()
  }
  // two fingers zoom and pan; the second one cancels what the first one started
  usePinch(svg, { box, k }, setView, end)

  const onShotKey = (e: KeyboardEvent<SVGElement>, sel: Selection, s: Point) =>
    shotKey(e, sel, s, frame, { onNudge, onDelete, onToggle })

  // the point tools (aim, origin, references) by keyboard: a marker the arrow keys move and Enter sets
  const pointTool = isPointTool(tool)
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 })
  const cursorEl = useRef<SVGCircleElement>(null)
  /** The control that had the focus when a point tool started; it gets it back after. */
  const back = useRef<HTMLElement | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a start or end of a point tool only
  useEffect(() => {
    if (!pointTool) {
      if (document.activeElement === document.body || !document.activeElement) back.current?.focus()
      back.current = null
      return
    }
    setCursor(pending.at(-1) ?? { x: box.x + box.w / 2, y: box.y + box.h / 2 })
    back.current = document.activeElement as HTMLElement | null
    requestAnimationFrame(() => cursorEl.current?.focus())
  }, [pointTool])
  const onCursorKey = (e: KeyboardEvent<SVGElement>) => {
    const d = arrows[e.key]
    if (d) {
      e.preventDefault()
      const step = (e.shiftKey ? 10 : 1) * k
      const p = { x: cursor.x + d[0] * step, y: cursor.y + d[1] * step }
      setCursor(p)
      setHover(p)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onPoint?.(cursor)
    }
  }

  const v = (q: Point) => (frame ? targetToView(frame, q) : q)
  const fontSize = 11 * k
  const loupe = loupeAt(dragging, tool, hover)

  const content = (
    <>
      <Backdrop sheet={sheet} photo={photo} filter={filter} />
      {sheet.groups.map((g) =>
        g.shots.map((s, i) => {
          const p = v(s)
          return (
            <circle
              // biome-ignore lint/suspicious/noArrayIndexKey: shots keep their order
              key={`${g.id} ${i}`}
              cx={p.x}
              cy={p.y}
              r={shotR(s)}
              className="shot-mark"
              style={{ color: g.colour }}
              data-excluded={s.excluded || undefined}
            />
          )
        }),
      )}
    </>
  )

  return (
    <div
      ref={wrap}
      className="target-canvas"
      data-tool={tool}
      aria-hidden={still ? true : undefined}
    >
      <svg
        ref={svg}
        role="application"
        aria-label={t('Target sheet')}
        aria-describedby={`${id}-keys`}
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={end}
        onPointerLeave={() => setHover(undefined)}
        tabIndex={still ? undefined : 0}
        onKeyDown={onSheetKey}
        onDoubleClick={(e) => tool === 'select' && zoom(1 / 1.5, toPoint(e))}
      >
        {content}
        {sheet.photo && !still && (
          <RefsLayer
            references={sheet.references}
            pending={pending}
            k={k}
            onHandle={(e, ref, point) => tool === 'select' && start(e, { kind: 'ref', ref, point })}
          />
        )}
        {frame?.calibration && sheet.targetOrigin && !still && (
          <AxesMark v={v} k={k} fontSize={fontSize} />
        )}
        {frame && groupOverlays({ sheet, overlays, active, box, k, fontSize, v, shotR, id, t })}
        <defs>
          <marker
            id={`${id}-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0L10 5L0 10z" fill="currentColor" />
          </marker>
        </defs>
        {frame &&
          sheet.groups.map((g) => (
            <g
              key={g.id}
              style={{ color: g.colour }}
              data-dim={(active !== undefined && g.id !== active) || undefined}
            >
              {g.aim && (
                <AimMark
                  at={v(g.aim)}
                  k={k}
                  onPointerDown={(e) => tool === 'select' && start(e, { kind: 'aim', group: g.id })}
                />
              )}
              {g.shots.map((s, i) => {
                const p = v(s)
                const sel = { group: g.id, index: i }
                const isSel = selected?.group === g.id && selected.index === i
                // the selected shot of the active group, else its first, is the group's tab stop
                const stop =
                  selected?.group === g.id && selected.index < g.shots.length ? selected.index : 0
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: shots keep their order
                  <g key={i}>
                    {/* biome-ignore lint/a11y/useSemanticElements: an SVG mark has no button element */}
                    <circle
                      role="button"
                      tabIndex={g.id === active && !still && i === stop ? 0 : -1}
                      aria-label={describe(sel)}
                      aria-pressed={isSel}
                      className="shot-hit"
                      data-shot={`${g.id} ${i}`}
                      data-selected={isSel || undefined}
                      data-excluded={s.excluded || undefined}
                      cx={p.x}
                      cy={p.y}
                      r={Math.max(shotR(s), 8 * k)}
                      onFocus={() => onSelect?.(sel)}
                      onKeyDown={(e) => onShotKey(e, sel, s)}
                      onDoubleClick={(e) => {
                        if (tool !== 'select') return
                        e.stopPropagation()
                        onToggle?.(sel)
                      }}
                      onPointerDown={(e) => {
                        // with another tool the click goes on: a shot through the same hole, an aim on it
                        if (tool !== 'select') return
                        onSelect?.(sel)
                        start(e, { kind: 'shot', sel })
                      }}
                    />
                    {s.excluded && (
                      <path
                        className="excluded-cross"
                        d={`M${p.x - 4 * k} ${p.y - 4 * k}l${8 * k} ${8 * k}m0 ${-8 * k}l${-8 * k} ${8 * k}`}
                      />
                    )}
                    {overlays.numbers && (
                      <text x={p.x + shotR(s) + 2 * k} y={p.y - shotR(s)} fontSize={fontSize}>
                        {i + 1}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          ))}
        {layer?.(k)}
        {pointTool && (
          <>
            {/* biome-ignore lint/a11y/useSemanticElements: an SVG mark has no button element */}
            <circle
              ref={cursorEl}
              role="button"
              tabIndex={0}
              aria-label={t('Point to set')}
              aria-describedby={`${id}-keys`}
              className="key-cursor"
              cx={cursor.x}
              cy={cursor.y}
              r={10 * k}
              onKeyDown={onCursorKey}
            />
            <path
              className="key-cursor-cross"
              d={`M${cursor.x - 14 * k} ${cursor.y}h${28 * k}M${cursor.x} ${cursor.y - 14 * k}v${28 * k}`}
            />
          </>
        )}
        {loupe && (
          // biome-ignore lint/a11y/noAriaHiddenOnFocusable: an SVG group is not focusable; it only draws
          <g className="loupe" aria-hidden="true" pointerEvents="none">
            <Loupe at={loupe} k={k} id={id}>
              {content}
            </Loupe>
          </g>
        )}
      </svg>
      <p id={`${id}-keys`} className="visually-hidden">
        {t(
          'Shots of the active group are buttons in one tab stop: arrow keys, Home and End move the focus between them, Alt with the arrow keys moves the focused shot by {step} (with Shift {big}), E or Space excludes or includes it, Delete removes it. With the focus on the sheet itself, the arrow keys pan the view, and a double click zooms in at the pointer. While a point is marked, the arrow keys move the marker by a screen pixel (with Shift 10) and Enter sets it.',
          { step: mmLength(system, 0.1), big: mmLength(system, 1) },
        )}
      </p>
      {overlays.stats && statsBox && !still && (
        <div
          className="stats-box"
          aria-hidden="true"
          style={{ left: statsAt.x, top: statsAt.y }}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            e.currentTarget.setPointerCapture?.(e.pointerId)
            drag.current = { kind: 'stats', dx: e.clientX - r.left, dy: e.clientY - r.top }
          }}
          onPointerMove={(e) => {
            const d = drag.current
            const r = wrap.current?.getBoundingClientRect()
            if (d?.kind === 'stats' && r)
              setStatsAt({ x: e.clientX - r.left - d.dx, y: e.clientY - r.top - d.dy })
          }}
          onPointerUp={end}
        >
          {statsBox}
        </div>
      )}
      {!still && (
        <div className="canvas-zoom">
          <button type="button" aria-label={t('Zoom in')} onClick={() => zoom(1 / 1.5)}>
            +
          </button>
          <button type="button" aria-label={t('Zoom out')} onClick={() => zoom(1.5)}>
            −
          </button>
          <button type="button" aria-label={t('Fit')} onClick={() => setView(undefined)}>
            {t('Fit')}
          </button>
        </div>
      )}
    </div>
  )
}
