'use client'

import type { ECharts } from 'echarts/core'
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'
import { niceTicks, tickDecimals } from '../lib/ticks.ts'
import { formatNumber } from '../lib/units.ts'
import { EChart, useChartTokens } from './echart.tsx'

const lineTokens = { muted: '--muted', border: '--border', link: '--link', bg: '--bg', fg: '--fg' }

/** Smallest and largest value; a loop, as a spread of a long array can overflow the call stack. */
function extent(values: number[]): [number, number] {
  let [lo, hi] = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
  for (const v of values) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return [lo, hi]
}

/** Nice ticks from `min` up to `max`; `integer` keeps the whole numbers, for counts such as shot numbers. */
export function axisTicks(min: number, max: number, integer = false) {
  return niceTicks(min, max).filter((t) => t <= max && (!integer || Number.isInteger(t)))
}

/** The chart's scales and plot area in the overlay's pixels, for marks drawn by `children`. */
interface ChartScale {
  x: (v: number) => number
  y: (v: number) => number
  area: { x: number; y: number; width: number; height: number }
}

const Scale = createContext<ChartScale | undefined>(undefined)

/** The scales of the enclosing `LineChart`, once it has drawn. */
export const useChartScale = () => useContext(Scale)

/**
 * Line chart (ECharts) in display units on linear axes over nice ticks. `title` names the image
 * and `description` states what it shows; the table or readouts next to it carry the data.
 * `children` are SVG drawn over the chart and read its scales with `useChartScale`. `limits` are
 * labelled horizontal lines inside the y range; `include` are further y values the axis includes,
 * as for marks drawn by `children`. `integerX` keeps the x ticks on whole numbers.
 */
export function LineChart({
  x,
  y,
  xLabel,
  yLabel,
  title,
  description,
  zeroLine = false,
  height = 320,
  fill = false,
  limits = [],
  include = [],
  points = false,
  integerX = false,
  children,
}: {
  x: number[]
  y: number[]
  xLabel: string
  yLabel: string
  title: string
  description: string
  zeroLine?: boolean
  /** Rendered height, px. */
  height?: number
  /** The height its box has by CSS, not `height`. */
  fill?: boolean
  limits?: { y: number; label: string }[]
  include?: number[]
  /** A marker on each point of `x` and `y`. */
  points?: boolean
  integerX?: boolean
  children?: ReactNode
}) {
  const tokens = useChartTokens(lineTokens)
  const [scale, setScale] = useState<ChartScale>()
  const [xMin, xMax] = extent(x)
  // the x axis ends at the data, ticks at nice values up to it
  const xt = axisTicks(xMin, xMax, integerX)
  const yt = niceTicks(...extent([y, limits.map((l) => l.y), include].flat()))
  const ok = x.length >= 2 && xt.length >= 2 && yt.length >= 2
  // callers pass new arrays on each render: the option follows their values, so a render that
  // changes nothing drawn does not redraw the chart
  const data = JSON.stringify([x, y, limits, xt, yt])
  // biome-ignore lint/correctness/useExhaustiveDependencies: `data` stands for x, y, limits and the ticks
  const option = useMemo(() => {
    if (!tokens || !ok) return {}
    const [dx, dy] = [tickDecimals(xt), tickDecimals(yt)]
    const text = { color: tokens.muted, fontSize: 12 }
    const axis = (ticks: number[], name: string, d: number, max: number) => ({
      type: 'value',
      min: ticks[0],
      max,
      interval: ticks[1] - ticks[0],
      name,
      nameLocation: 'middle',
      nameTextStyle: text,
      axisLabel: { ...text, formatter: (v: number) => formatNumber(v, d) },
      axisLine: { show: true, onZero: false, lineStyle: { color: tokens.muted } },
      axisTick: { show: true },
      splitLine: { lineStyle: { color: tokens.border } },
    })
    return {
      animation: false,
      // the axis names inside the chart too, not only the tick labels (containLabel)
      grid: {
        left: 8,
        right: 16,
        top: 12,
        bottom: 8,
        outerBoundsMode: 'same',
        outerBoundsContain: 'all',
      },
      tooltip: {
        trigger: 'axis',
        // kept inside the chart: `.chart` clips overflow (as in interior-chart.tsx)
        confine: true,
        borderRadius: 0,
        backgroundColor: tokens.bg,
        borderColor: tokens.border,
        textStyle: { color: tokens.fg },
        valueFormatter: (v: number) => formatNumber(v, dy),
        axisPointer: {
          label: { formatter: ({ value }: { value: number }) => formatNumber(value, dx) },
        },
      },
      xAxis: { ...axis(xt, xLabel, dx, xMax), nameGap: 26 },
      yAxis: { ...axis(yt, yLabel, dy, yt[yt.length - 1]), nameGap: 48 },
      series: [
        {
          type: 'line',
          name: yLabel,
          symbol: points ? 'circle' : 'none',
          lineStyle: { color: tokens.link, width: 2 },
          itemStyle: { color: tokens.link },
          data: x.map((v, i) => [v, y[i]]),
          markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            data: [
              ...(zeroLine && yt[0] < 0
                ? [
                    {
                      yAxis: 0,
                      lineStyle: { color: tokens.muted, type: [6, 4] },
                      label: { show: false },
                    },
                  ]
                : []),
              ...limits.map((l) => ({
                yAxis: l.y,
                lineStyle: { color: tokens.muted, type: [2, 3] },
                label: {
                  formatter: l.label,
                  position: 'insideEndTop',
                  color: tokens.muted,
                  fontSize: 11,
                },
              })),
            ],
          },
        },
      ],
    }
  }, [tokens, ok, data, zeroLine, points, xLabel, yLabel, xMax])
  if (!ok) return null
  /** The scales after a draw; a new state only when the plot area moved, so no draw loop. */
  const measure = (c: ECharts) => {
    // undefined before the grid is laid out and after the chart is disposed
    const at = (point: number[], k: number) => {
      const p = c.isDisposed() ? undefined : c.convertToPixel({ gridIndex: 0 }, point)
      return Array.isArray(p) ? p[k] : Number.NaN
    }
    const X = (v: number) => at([v, yt[0]], 0)
    const Y = (v: number) => at([xt[0], v], 1)
    const [x0, x1, y0, y1] = [X(xt[0]), X(xMax), Y(yt[yt.length - 1]), Y(yt[0])]
    if (![x0, x1, y0, y1].every(Number.isFinite)) return
    const area = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
    setScale((s) =>
      s && JSON.stringify(s.area) === JSON.stringify(area) ? s : { x: X, y: Y, area },
    )
  }
  return (
    <div className="chart line-chart">
      <EChart
        option={option}
        height={fill ? undefined : height}
        title={title}
        description={description}
        onRender={children ? measure : undefined}
      />
      {children && (
        <svg className="chart-overlay" aria-hidden="true" style={{ height }}>
          <Scale.Provider value={scale}>{children}</Scale.Provider>
        </svg>
      )}
    </div>
  )
}
