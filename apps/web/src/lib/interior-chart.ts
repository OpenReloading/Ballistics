/** The workbench interior chart: curves, events, limit lines and the ECharts option. */

import { plainNumber } from '../i18n/number.ts'
import type { Translator } from '../i18n/translate.ts'
import type { InteriorResponse } from './api-types.ts'
import { nth } from './nth.ts'
import { type PlaybackResult, type PlaybackSample, sampler } from './playback.ts'
import { type UnitSystem, withUnit } from './units.ts'
import { pressureLimit } from './workbench.ts'

/** x axis of the interior chart: bullet travel or time since ignition. */
export type ChartX = 'travel' | 'time'
export type ChartQuantity = 'pressure' | 'velocity' | 'energy'
type Point = PlaybackResult['points'][number]

/** Value of sample `s` on x axis `x` in the units of `system`: travel in the length unit, or time since ignition in ms. */
export function chartX(s: PlaybackSample, x: ChartX, system: UnitSystem) {
  return x === 'time' ? s.time * 1e3 : system.length.fromSi(s.travel)
}

/** Breech pressure, velocity or kinetic energy `0.5 m v^2` (bullet mass in kg) in display units. */
export function chartY(s: PlaybackSample, q: ChartQuantity, mass: number, system: UnitSystem) {
  if (q === 'pressure') return system.pressure.fromSi(s.breechPressure)
  if (q === 'velocity') return system.velocity.fromSi(s.velocity)
  return system.energy.fromSi(0.5 * mass * s.velocity ** 2)
}

/** A curve of the points in display units; the last point is the muzzle. */
export function chartSeries(
  points: readonly Point[],
  x: ChartX,
  q: ChartQuantity,
  mass: number,
  system: UnitSystem,
) {
  return {
    x: points.map((p) => chartX(p, x, system)),
    y: points.map((p) => chartY(p, q, mass, system)),
  }
}

type ChartEvent = {
  key: 'tenPercent' | 'z1' | 'peak' | 'burnt' | 'burnout' | 'muzzle'
  label: string
  time: number
}

/** Fraction of the charge burnt that the "95 %" line marks. */
const burntFractionLine = 0.95

/** Time the burnt fraction first reaches `f`, linear between points; undefined when never. */
function burntTime(points: readonly Point[], f: number) {
  const i = points.findIndex((p) => p.burntFraction >= f)
  if (i < 0) return
  if (i === 0) return nth(points, 0).time
  const [a, b] = [nth(points, i - 1), nth(points, i)]
  return a.time + ((f - a.burntFraction) / (b.burntFraction - a.burntFraction)) * (b.time - a.time)
}

/**
 * 10 % pressure time (none when 0), the burn form's z1 (with the run's `z1` below 1), peak breech
 * pressure, 95 % burnt, burnout in the barrel and muzzle exit. z1 and 95 % only where the bullet
 * is in the barrel: from the shot start up to, not including, the muzzle exit (a line at the muzzle
 * would lie on the muzzle line).
 */
export function chartEvents(
  r: PlaybackResult,
  z1: number | undefined,
  t: Translator['t'],
): ChartEvent[] {
  const events: ChartEvent[] = []
  if (r.tenPercentPressureTime > 0)
    events.push({ key: 'tenPercent', label: '10 %', time: r.tenPercentPressureTime })
  const inBarrel = (key: 'z1' | 'burnt', label: string, f: number) => {
    const time = burntTime(r.points, f)
    if (time !== undefined && time >= r.shotStartTime && time < r.muzzleTime)
      events.push({ key, label, time })
  }
  if (z1 !== undefined && z1 < 1) inBarrel('z1', 'z1', z1)
  events.push({ key: 'peak', label: t('peak'), time: r.maxPressureTime })
  inBarrel('burnt', '95 %', burntFractionLine)
  if (r.burnout) events.push({ key: 'burnout', label: t('burnout'), time: r.burnout.time })
  events.push({ key: 'muzzle', label: t('muzzle'), time: r.muzzleTime })
  return events.sort((a, b) => a.time - b.time)
}

/** Rows of event labels above the plot; the plot's top margin (`plotTop`) holds one, beside the axis units. */
const labelRowCount = 1
/** Kept first when labels collide: the dropped ones stay in the tooltip and the data table. */
const labelPriority: readonly ChartEvent['key'][] = [
  'muzzle',
  'peak',
  'burnout',
  'burnt',
  'z1',
  'tenPercent',
]
/** Width of a label as a fraction of the x axis: per character, plus a gap (about 7 px a character at 400 px). */
const labelWidth = (label: string) => 0.018 * label.length + 0.01

/**
 * The row of each event label (0 on top; none for a label that fits in no row, whose line stays).
 * Labels are placed by priority, each in the lowest row where it overlaps no label placed before;
 * a label is centred on its line, the muzzle label ends at it. `x` in axis units, `range` the axis span.
 */
export function eventLabelRows(
  events: readonly { key: ChartEvent['key']; label: string; x: number }[],
  range: number,
): Map<ChartEvent['key'], number> {
  const rows = new Map<ChartEvent['key'], number>()
  const taken: [number, number][][] = Array.from({ length: labelRowCount }, () => [])
  const byPriority = [...events].sort(
    (a, b) => labelPriority.indexOf(a.key) - labelPriority.indexOf(b.key),
  )
  for (const e of byPriority) {
    const w = labelWidth(e.label) * range
    const from = e.key === 'muzzle' ? e.x - w : e.x - w / 2
    const row = taken.findIndex((spans) => spans.every(([a, b]) => b <= from || from + w <= a))
    if (row < 0) continue
    nth(taken, row).push([from, from + w])
    rows.set(e.key, row)
  }
  return rows
}

/**
 * The sample at display x: on the time axis at that time, on the travel axis at the time the bullet
 * reaches that travel (at travel 0 the shot start, the last point there).
 */
export function sampleAtX(points: readonly Point[], x: ChartX, value: number, system: UnitSystem) {
  const at = sampler(points)
  if (x === 'time') return at(value / 1e3)
  const travel = system.length.toSi(value)
  const lo = firstIndexBeyondTravel(points, travel)
  if (lo === 0) return at(nth(points, 0).time)
  if (lo === points.length) return at(nth(points, lo - 1).time)
  const [a, b] = [nth(points, lo - 1), nth(points, lo)]
  return at(a.time + ((travel - a.travel) / (b.travel - a.travel)) * (b.time - a.time))
}

/** Index of the first point beyond `travel` (m); travel does not decrease. */
export function firstIndexBeyondTravel(points: readonly { travel: number }[], travel: number) {
  let [lo, hi] = [0, points.length]
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (nth(points, mid).travel > travel) hi = mid
    else lo = mid + 1
  }
  return lo
}

/** `n` samples evenly spaced in time from the first point to the muzzle, for the data table. */
export function chartRows(points: readonly Point[], n = 20): PlaybackSample[] {
  const at = sampler(points)
  const [t0, t1] = [nth(points, 0).time, nth(points, points.length - 1).time]
  return Array.from({ length: n }, (_, k) => at(t0 + ((t1 - t0) * k) / (n - 1)))
}

type Limit = NonNullable<InteriorResponse['limits']>[number]

/** Percentages of the limit that the reference lines mark. */
const referenceLines = [85, 75] as const

/**
 * Lines at the compared limit with a pressure (`pressureLimit`), as "Percent of maximum" uses, and at the
 * `referenceLines` percentages of it, in display units; undefined without such a limit. Never "safe".
 */
export function limitLines(limits: Limit[] | undefined, system: UnitSystem, t: Translator['t']) {
  const l = pressureLimit(limits)
  if (l?.pressure === undefined) return
  const name = `CIP ${l.symbol}`
  const value = withUnit('pressure', system, l.pressure)
  const max = system.pressure.fromSi(l.pressure)
  return [
    { y: max, label: `${name} ${value}` },
    ...referenceLines.map((m) => ({
      y: (max * m) / 100,
      label: t('{percent} % of {name}', { percent: m, name }),
    })),
  ]
}

/** What the chart draws: every quantity on its own axis, or one alone. */
export type ChartShow = ChartQuantity | 'all'

/** The quantities `show` draws, in axis order: pressure on the left, velocity and energy on the right. */
export function shownQuantities(show: ChartShow): ChartQuantity[] {
  return show === 'all' ? ['pressure', 'velocity', 'energy'] : [show]
}

/**
 * Room above and below the plot in the chart box, px: the row of event labels and axis units, the
 * tick row with the x unit at its end. A 12 px text box is 14 px high plus its 8 px offset from
 * the axis, so 20 px cut it.
 */
const plotTop = 24
const plotBottom = 24

/**
 * The plot's left and right edges in the chart box, px, for `shown` quantities (one source for the
 * grid and the playback strip). The left edge is the pressure axis labels' 56 px. The right edge
 * leaves the 72 px of Play and the speed at the playback row's right end (`globals.css`
 * `.play-controls`) when one axis shows, else the labels of the further axes.
 */
export const plotEdges = (shown: number): readonly [number, number] => [56, shown > 1 ? 100 : 72]

/** Colours of the chart, read from the page's tokens so light and dark match the app. */
export type ChartTheme = Record<
  | ChartQuantity
  | `${ChartQuantity}Text`
  | 'foreground'
  | 'muted'
  | 'border'
  | 'grid'
  | 'warning'
  | 'background',
  string
>

type Step = { n: number; label?: string | undefined; result: PlaybackResult }

const axisNames: Record<ChartQuantity, string> = {
  pressure: 'Breech pressure',
  velocity: 'Velocity',
  energy: 'Energy',
}
/** The marker at each selected curve's end, as in the readouts' and the toolbar's keys, so colour is never the only key. */
const curveMarkers: Record<ChartQuantity, 'circle' | 'rect' | 'diamond'> = {
  pressure: 'circle',
  velocity: 'rect',
  energy: 'diamond',
}

type LimitLine = { y: number; label: string }
/** Plain numbers as elsewhere in the app: no grouping, no float noise. */
const plain = (v: number) => plainNumber(Number(v.toPrecision(10)))
const axisLine = (color: string) => ({ show: true, lineStyle: { color } })

/** Mark line data of the events of the selected step: dashed, the label in its row. */
function eventMarkLines(
  events: ChartEvent[],
  eventX: (e: ChartEvent) => number,
  rowOf: Map<ChartEvent['key'], number>,
  theme: ChartTheme,
) {
  return events.map((e) => ({
    name: e.key,
    xAxis: eventX(e),
    lineStyle: { color: theme.muted, type: 'dashed' as const, width: 1 },
    label: {
      formatter: rowOf.has(e.key) ? e.label : '',
      position: 'end' as const,
      distance: 5,
      // the muzzle line is the right edge: its label reads to the left of it
      align: e.key === 'muzzle' ? ('right' as const) : ('center' as const),
      color: theme.muted,
    },
  }))
}

/** Mark line data of the limit (first, dashed, its label at the plot's left end) and reference lines (dotted, labels at the right end, the lower of two below its line). */
function limitMarkLines(pressureLines: LimitLine[], theme: ChartTheme) {
  // of two reference lines the lower one's label goes below it: in a short plot the lines lie close
  const low =
    pressureLines.length > 2 ? Math.min(...pressureLines.slice(1).map((l) => l.y)) : Number.NaN
  const margin = (l: LimitLine) => (l.y === low ? 'insideEndBottom' : 'insideEndTop')
  return pressureLines.map((l, k) => ({
    name: `limit ${k}`,
    yAxis: l.y,
    lineStyle: {
      color: k === 0 ? theme.warning : theme.muted,
      type: k === 0 ? ('dashed' as const) : ('dotted' as const),
      width: k === 0 ? 2 : 1,
    },
    label: {
      formatter: l.label,
      // at opposite ends, so the limit's label never meets a margin label close below it
      position: k === 0 ? ('insideStartTop' as const) : margin(l),
      color: k === 0 ? theme.warning : theme.muted,
      fontWeight: k === 0 ? 600 : 400,
    },
  }))
}

/** The dot on the peak (index `peak`, none below 0) of the selected pressure curve `c`, and the curve's end marker. */
const curveMarks = (
  name: string,
  q: ChartQuantity,
  c: { x: number[]; y: number[] },
  peak: number,
  theme: ChartTheme,
) => ({
  silent: true,
  symbol: 'circle',
  symbolSize: 5,
  itemStyle: { color: theme[q], borderColor: theme.background, borderWidth: 1 },
  animation: false,
  data: [
    ...(peak >= 0 ? [{ name: `${name} peak`, coord: [c.x[peak], c.y[peak]] }] : []),
    {
      name: `${name} end`,
      coord: [c.x.at(-1), c.y.at(-1)],
      symbol: curveMarkers[q],
      symbolSize: 8,
    },
  ].map((d) => ({ ...d, label: { show: false } })),
})

/** The selected step's curves: solid, on top, with the hover dot. */
const selectedLook = { symbol: 'circle', z: 3, width: 2.5, type: 'solid' as const, opacity: 1 }
/** The other steps' curves: dashed and faint, without a hover dot. */
const otherLook = { symbol: 'none', z: 2, width: 1, type: 'dashed' as const, opacity: 0.6 }

type CurveSeriesInput = {
  steps: Step[]
  selected: number
  mass: number
  xAxis: ChartX
  quantities: ChartQuantity[]
  system: UnitSystem
  theme: ChartTheme
  eventMarks: ReturnType<typeof eventMarkLines>
  limitMarks: ReturnType<typeof limitMarkLines>
}

/**
 * One line per step and shown quantity: the selected step solid, on top and with its text key,
 * the others dashed; the event and limit lines on the selected step's first shown curve.
 */
function curveSeries(o: CurveSeriesInput) {
  return o.quantities.flatMap((q, axis) =>
    o.steps.map((s, i) => stepCurve(o, { q, axis, s, own: i === o.selected })),
  )
}

/** The line of step `s` for quantity `q` on y axis `axis`; `own`: the selected step. */
function stepCurve(
  o: CurveSeriesInput,
  { q, axis, s, own }: { q: ChartQuantity; axis: number; s: Step; own: boolean },
) {
  const { steps, mass, xAxis, system, theme } = o
  const c = chartSeries(s.result.points, xAxis, q, mass, system)
  // with a ladder the selected pressure curve marks its peak with a dot, without a label: the
  // highlight and the ladder strip name the step
  const peak = own && steps.length > 1 && q === 'pressure' ? c.y.indexOf(Math.max(...c.y)) : -1
  const look = own ? selectedLook : otherLook
  return {
    type: 'line' as const,
    name: `Step ${s.label ?? s.n} ${axisNames[q].toLowerCase()}`,
    yAxisIndex: axis,
    data: c.x.map((v, k) => [v, c.y[k]]),
    markPoint: own ? curveMarks(`Step ${s.label ?? s.n}`, q, c, peak, theme) : undefined,
    showSymbol: false,
    symbol: look.symbol,
    silent: !own,
    z: look.z,
    // the selected energy curve dashed, so colour is not the only key between velocity and energy
    lineStyle: {
      color: theme[q],
      width: own && q !== 'pressure' ? 2 : look.width,
      type: own && q === 'energy' ? [7, 4] : look.type,
      opacity: look.opacity,
    },
    itemStyle: { color: theme[q] },
    emphasis: { disabled: true },
    // event and limit lines once, on the selected step's first shown curve
    markLine:
      own && axis === 0
        ? {
            silent: true,
            symbol: 'none',
            animation: false,
            data: [...o.eventMarks, ...(q === 'pressure' ? o.limitMarks : [])],
          }
        : undefined,
  }
}

/** The x axis from `xMin` to `axisEnd`, named by `xAxis`. */
function xAxisOption(
  xAxis: ChartX,
  [xMin, axisEnd]: [number, number],
  system: UnitSystem,
  theme: ChartTheme,
) {
  return {
    type: 'value' as const,
    min: xMin,
    // the axis ends at the data: the last muzzle of the steps, plus the room above
    max: axisEnd,
    // the unit at the tick row's right end, where the last tick label is left out
    name: xAxis === 'time' ? 'ms' : system.length.symbol,
    nameLocation: 'end' as const,
    nameGap: 0,
    nameTextStyle: {
      align: 'right' as const,
      verticalAlign: 'top' as const,
      padding: [8, 0, 0, 0],
    },
    axisLine: axisLine(theme.border),
    // the muted ink: a label takes the axis line's colour (the border) unless one is given
    axisLabel: { formatter: plain, showMaxLabel: false, color: theme.muted },
    splitLine: { lineStyle: { color: theme.grid } },
  }
}

/** Steps an axis interval may take, times a power of ten. */
const stepMantissas = [1, 1.5, 2, 2.5, 5, 10]

/** The smallest step of `stepMantissas` at or above `raw`. */
function niceStep(raw: number) {
  const e = 10 ** Math.floor(Math.log10(raw))
  return (stepMantissas.find((m) => m * e >= raw * (1 - 1e-9)) ?? 10) * e
}

/**
 * Axes from 0 for the data maxima `maxima`, all with one count of intervals (4 to 6), so one grid
 * line is a tick of every axis: the count whose emptiest axis leaves the least room above its data.
 */
export function alignedAxes(maxima: readonly number[]) {
  let best: { waste: number; axes: { max: number; interval: number }[] } | undefined
  for (let n = 4; n <= 6; n++) {
    const axes = maxima.map((m) => {
      const interval = niceStep(Math.max(m, Number.MIN_VALUE) / n)
      return { max: Number((n * interval).toPrecision(12)), interval }
    })
    const waste = Math.max(...axes.map((a, i) => 1 - nth(maxima, i) / a.max))
    if (!best || waste < best.waste - 1e-9) best = { waste, axes }
  }
  return best?.axes ?? []
}

/** One y axis per shown quantity on `axes`: pressure left, the others right. */
function yAxisOptions(
  quantities: ChartQuantity[],
  axes: { max: number; interval: number }[],
  system: UnitSystem,
  theme: ChartTheme,
) {
  const unit = { pressure: system.pressure, velocity: system.velocity, energy: system.energy }
  // the unit above each axis in its colour, ending at the left axis and starting at a right one,
  // so it stays clear of the event labels over the plot
  return quantities.map((q, i) => ({
    type: 'value' as const,
    name: unit[q].symbol,
    nameTextStyle: {
      color: theme[`${q}Text`],
      align: i === 0 ? ('right' as const) : ('left' as const),
      // 8 px off the axis line: a peak label close to the left edge centres on its line
      padding: i === 0 ? [0, 8, 0, 0] : [0, 0, 0, 4],
    },
    nameLocation: 'end' as const,
    nameGap: 8,
    position: i === 0 ? ('left' as const) : ('right' as const),
    offset: i === 2 ? 48 : 0,
    min: 0,
    max: nth(axes, i).max,
    interval: nth(axes, i).interval,
    axisLine: axisLine(theme.border),
    axisLabel: { color: theme[`${q}Text`], formatter: plain },
    splitLine: { show: i === 0, lineStyle: { color: theme.grid } },
  }))
}

/**
 * The ECharts option of the interior chart: one line per step and shown quantity, the
 * selected step solid and on top, the others dashed; event lines of the selected step; limit and
 * reference lines when pressure is shown; the x axis from the first point to the last muzzle. Only
 * data: tooltips and sizes are the component's.
 */
export function interiorOption({
  steps,
  selected,
  mass,
  x,
  show,
  lines,
  system,
  theme,
  animate,
  z1,
  t,
}: {
  steps: Step[]
  selected: number
  mass: number
  x: ChartX
  show: ChartShow
  lines: LimitLine[] | undefined
  system: UnitSystem
  theme: ChartTheme
  animate: boolean
  /** The run's burn form z1, for its event line. */
  z1?: number | undefined
  t: Translator['t']
}) {
  const shown = shownQuantities(show)
  const r = nth(steps, selected).result
  const at = sampler(r.points)
  const xs = steps.flatMap((s) => s.result.points.map((p) => chartX(p, x, system)))
  const events = chartEvents(r, z1, t)
  // reduce, not a spread: a ladder of long runs passes the engine's argument limit
  const xMax = xs.reduce((a, v) => Math.max(a, v), -Infinity)
  const xMin = xs.reduce((a, v) => Math.min(a, v), Infinity)
  // the axis ends 0.5 % past the last muzzle: ECharts drops a mark line on the plot's very edge,
  // so the muzzle line keeps its true place only with this room (the data still ends the axis)
  const axisEnd = xMax + (xMax - xMin) * 5e-3
  const eventX = (e: ChartEvent) => {
    const v = chartX(at(e.time), x, system)
    return Number.isFinite(v) ? Math.min(xMax, v) : xMax
  }
  // no label at the 10 % line: at the plot's left edge it met the pressure axis unit
  const rowOf = eventLabelRows(
    events
      .filter((e) => e.key !== 'tenPercent')
      .map((e) => ({ key: e.key, label: e.label, x: eventX(e) })),
    xMax - xMin,
  )
  // the pressure axis reaches the limit line
  const limitTop = lines?.length ? Math.max(...lines.map((l) => l.y)) : 0
  const maxima = shown.map((q) =>
    steps.reduce(
      (a, s) => s.result.points.reduce((b, p) => Math.max(b, chartY(p, q, mass, system)), a),
      q === 'pressure' ? limitTop : 0,
    ),
  )
  const curves = curveSeries({
    steps,
    selected,
    mass,
    xAxis: x,
    quantities: shown,
    system,
    theme,
    eventMarks: eventMarkLines(events, eventX, rowOf, theme),
    limitMarks: limitMarkLines(lines ?? [], theme),
  })
  const [left, right] = plotEdges(shown.length)
  return {
    aria: { enabled: false },
    animation: animate,
    animationDuration: 500,
    animationDurationUpdate: 300,
    textStyle: { color: theme.muted, fontFamily: 'inherit' },
    // room above the plot for the row of event labels
    grid: { left, right, top: plotTop, bottom: plotBottom },
    xAxis: xAxisOption(x, [xMin, axisEnd], system, theme),
    yAxis: yAxisOptions(shown, alignedAxes(maxima), system, theme),
    series: curves,
  }
}
