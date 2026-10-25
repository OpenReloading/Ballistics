'use client'

import { useMemo } from 'react'
import type { BarrelRow } from '../lib/barrel-length.ts'
import { niceTicks } from '../lib/ticks.ts'
import { formatNumber, formatQuantity, type UnitSystem } from '../lib/units.ts'
import { EChart, tickStep, useChartTokens } from './echart.tsx'
import type { BarrelStep } from './use-barrel-study.ts'

const tokens = {
  velocity: '--series-1',
  energy: '--series-3',
  muted: '--muted',
  border: '--border',
  bg: '--bg',
  fg: '--fg',
}

/** The rows with values: the points of a curve. */
const drawn = (rows: BarrelRow[] | undefined) =>
  (rows ?? []).filter((r): r is BarrelRow & { values: NonNullable<BarrelRow['values']> } =>
    Boolean(r.values),
  )

type Theme = Record<keyof typeof tokens, string>
type DrawnRow = ReturnType<typeof drawn>[number]

const valueAxis = (
  theme: Theme,
  name: string,
  values: number[],
  side: 'left' | 'right',
  color: string,
) => {
  const t = niceTicks(Math.min(...values), Math.max(...values))
  return {
    type: 'value' as const,
    position: side,
    min: t[0],
    max: t[t.length - 1],
    interval: tickStep(t),
    name,
    nameLocation: 'middle' as const,
    nameGap: 44,
    nameTextStyle: { color, fontSize: 12 },
    axisLabel: {
      color,
      fontSize: 12,
      formatter: (v: number) => String(Number(v.toPrecision(10))),
    },
    axisLine: { show: true, lineStyle: { color } },
    splitLine: { show: side === 'left', lineStyle: { color: theme.border } },
  }
}

const lineType = (own: boolean, i: number) => {
  if (own) return 'solid' as const
  return i % 2 ? ('dashed' as const) : ('dotted' as const)
}

const currentMark = (theme: Theme, system: UnitSystem, current: DrawnRow) => ({
  silent: true,
  symbol: 'none',
  animation: false,
  data: [
    {
      xAxis: system.barrelLength.fromSi(current.length),
      lineStyle: { color: theme.muted, type: 'dashed' as const, width: 1 },
      label: { formatter: 'current', position: 'end' as const, color: theme.muted },
    },
  ],
})

interface SeriesContext {
  theme: Theme
  system: UnitSystem
  curve: DrawnRow[]
  step: BarrelStep
  index: number
  own: boolean
  ladder: boolean
  current: DrawnRow | undefined
}

const stepSeries = (c: SeriesContext, q: 'velocity' | 'energy', axisIndex: number) => {
  const { theme, system, step, own, ladder } = c
  const { barrelLength: length, velocity, energy } = system
  return {
    type: 'line' as const,
    name: `${ladder ? `Step ${step.label} ` : ''}${q}`,
    yAxisIndex: axisIndex,
    data: c.curve.map((r) => [
      length.fromSi(r.length),
      q === 'velocity' ? velocity.fromSi(r.values.velocity) : energy.fromSi(r.values.energy),
    ]),
    symbol: 'circle',
    symbolSize: own ? 5 : 3,
    silent: !own,
    tooltip: { show: own },
    z: own ? 3 : 2,
    lineStyle: {
      color: theme[q],
      width: own ? 2.5 : 1,
      type: lineType(own, c.index),
      opacity: own ? 1 : 0.6,
    },
    itemStyle: { color: theme[q] },
    emphasis: { disabled: true },
    // a ladder names each step at the end of its velocity line
    endLabel:
      ladder && axisIndex === 0
        ? { show: true, formatter: step.label, color: theme[q], fontSize: 11 }
        : undefined,
    markLine:
      own && axisIndex === 0 && c.current ? currentMark(theme, system, c.current) : undefined,
  }
}

type TooltipParams = { axisValue: number; seriesName: string; value: [number, number] }[]

const tooltipFormatter = (system: UnitSystem) => (params: TooltipParams) => {
  const { barrelLength: length, velocity, energy } = system
  const [first] = params
  if (!first) return ''
  const line = (p: TooltipParams[number]) => {
    const unit = p.seriesName.endsWith('velocity') ? velocity : energy
    return `${p.seriesName.replace(/^Step \S+ /, '')} ${formatNumber(p.value[1], unit.decimals)} ${unit.symbol}`
  }
  return `${formatNumber(first.axisValue, length.decimals)} ${length.symbol}<br>${params.map(line).join('<br>')}`
}

function chartOption(theme: Theme, steps: BarrelStep[], selected: number, system: UnitSystem) {
  const { barrelLength: length, velocity, energy } = system
  const ladder = steps.length > 1
  const curves = steps.map((step) => ({ step, curve: drawn(step.rows) }))
  const all = curves.flatMap((c) => c.curve)
  if (all.length === 0) return
  const xs = all.map((r) => length.fromSi(r.length))
  const current = all.find((r) => r.current)
  const lines = curves.flatMap(({ step, curve }, index) => {
    const c = {
      theme,
      system,
      curve,
      step,
      index,
      own: index === selected,
      ladder,
      current,
    }
    return (['velocity', 'energy'] as const).map((q, axisIndex) => stepSeries(c, q, axisIndex))
  })
  const xt = niceTicks(Math.min(...xs), Math.max(...xs))
  return {
    animation: false,
    grid: {
      left: 8,
      right: 8,
      top: 22,
      bottom: 8,
      outerBoundsMode: 'same',
      outerBoundsContain: 'all',
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      borderRadius: 0,
      backgroundColor: theme.bg,
      borderColor: theme.border,
      textStyle: { color: theme.fg },
      formatter: tooltipFormatter(system),
    },
    xAxis: {
      type: 'value' as const,
      min: xt[0],
      max: xt[xt.length - 1],
      interval: tickStep(xt),
      name: `Barrel length, ${length.symbol}`,
      nameLocation: 'middle' as const,
      nameGap: 26,
      nameTextStyle: { color: theme.muted, fontSize: 12 },
      axisLabel: {
        color: theme.muted,
        fontSize: 12,
        formatter: (v: number) => formatNumber(v, length.decimals),
      },
      axisLine: { show: true, lineStyle: { color: theme.muted } },
      splitLine: { show: false },
    },
    yAxis: [
      valueAxis(
        theme,
        `Muzzle velocity, ${velocity.symbol}`,
        all.map((r) => velocity.fromSi(r.values.velocity)),
        'left',
        theme.velocity,
      ),
      valueAxis(
        theme,
        `Muzzle energy, ${energy.symbol}`,
        all.map((r) => energy.fromSi(r.values.energy)),
        'right',
        theme.energy,
      ),
    ],
    series: lines,
  }
}

/**
 * Muzzle velocity and energy against barrel length: a
 * line per ladder step and quantity, the selected step solid and the others dashed or dotted, each
 * named at its end, the workbench barrel marked. Velocity on the left axis, energy on the right.
 */
export function BarrelChart({
  steps,
  selected,
  system,
  height = 300,
}: {
  steps: BarrelStep[]
  selected: number
  system: UnitSystem
  height?: number
}) {
  const theme = useChartTokens(tokens)
  const { barrelLength: length, velocity, energy } = system
  const ladder = steps.length > 1
  const option = useMemo(
    () => theme && chartOption(theme, steps, selected, system),
    [theme, steps, selected, system],
  )
  const rows = drawn(steps[selected]?.rows)
  // the box stays while nothing is drawn (a longer run on its way): the chart area does not jump
  if (!option) return <div className="chart barrel-chart" style={{ height }} />
  return (
    <div className="chart barrel-chart">
      <EChart
        option={option}
        height={height}
        title="Simulated muzzle velocity and energy against barrel length"
        description={`${ladder ? `${steps.length} ladder steps, step ${steps[selected]?.label} solid, the others dashed or dotted and named at their end. ` : ''}The table gives the values.`}
        focus={selected * 2}
        readout={(i) => {
          const r = rows[Math.min(i, rows.length - 1)]
          if (!r) return ''
          return `${formatQuantity('barrelLength', system, r.length)} ${length.symbol}: ${formatQuantity('velocity', system, r.values.velocity)} ${velocity.symbol}, ${formatQuantity('energy', system, r.values.energy)} ${energy.symbol}`
        }}
      />
    </div>
  )
}
