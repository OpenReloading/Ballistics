'use client'

import { useMemo } from 'react'
import type { BarrelRow } from '../lib/barrel-length.ts'
import { niceTicks } from '../lib/ticks.ts'
import { formatNumber, formatQuantity, type UnitSystem } from '../lib/units.ts'
import { EChart, useChartTokens } from './echart.tsx'
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
  const option = useMemo(() => {
    if (!theme) return
    const curves = steps.map((s) => drawn(s.rows))
    const all = curves.flat()
    if (all.length === 0) return
    const xs = all.map((r) => length.fromSi(r.length))
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
    const axis = (name: string, values: number[], side: 'left' | 'right', color: string) => {
      const t = niceTicks(Math.min(...values), Math.max(...values))
      return {
        type: 'value' as const,
        position: side,
        min: t[0],
        max: t[t.length - 1],
        interval: t[1] - t[0],
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
    const current = all.find((r) => r.current)
    const lines = steps.flatMap((s, i) =>
      (['velocity', 'energy'] as const).map((q, axisIndex) => {
        const own = i === selected
        return {
          type: 'line' as const,
          name: `${ladder ? `Step ${s.label} ` : ''}${q}`,
          yAxisIndex: axisIndex,
          data: curves[i].map((r) => [
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
            type: own ? ('solid' as const) : i % 2 ? ('dashed' as const) : ('dotted' as const),
            opacity: own ? 1 : 0.6,
          },
          itemStyle: { color: theme[q] },
          emphasis: { disabled: true },
          // a ladder names each step at the end of its velocity line
          endLabel:
            ladder && axisIndex === 0
              ? { show: true, formatter: s.label, color: theme[q], fontSize: 11 }
              : undefined,
          markLine:
            own && axisIndex === 0 && current
              ? {
                  silent: true,
                  symbol: 'none',
                  animation: false,
                  data: [
                    {
                      xAxis: length.fromSi(current.length),
                      lineStyle: { color: theme.muted, type: 'dashed' as const, width: 1 },
                      label: { formatter: 'current', position: 'end' as const, color: theme.muted },
                    },
                  ],
                }
              : undefined,
        }
      }),
    )
    const xt = niceTicks(x0, x1)
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
        formatter: (params: { axisValue: number; seriesName: string; value: number[] }[]) => {
          const [first] = params
          if (!first) return ''
          const line = (p: (typeof params)[number]) =>
            `${p.seriesName.replace(/^Step \S+ /, '')} ${formatNumber(p.value[1], p.seriesName.endsWith('velocity') ? velocity.decimals : energy.decimals)} ${p.seriesName.endsWith('velocity') ? velocity.symbol : energy.symbol}`
          return `${formatNumber(first.axisValue, length.decimals)} ${length.symbol}<br>${params.map(line).join('<br>')}`
        },
      },
      xAxis: {
        type: 'value' as const,
        min: xt[0],
        max: xt[xt.length - 1],
        interval: xt[1] - xt[0],
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
        axis(
          `Muzzle velocity, ${velocity.symbol}`,
          all.map((r) => velocity.fromSi(r.values.velocity)),
          'left',
          theme.velocity,
        ),
        axis(
          `Muzzle energy, ${energy.symbol}`,
          all.map((r) => energy.fromSi(r.values.energy)),
          'right',
          theme.energy,
        ),
      ],
      series: lines,
    }
  }, [theme, steps, selected, ladder, length, velocity, energy])
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
          return `${formatQuantity('barrelLength', system, r.length)} ${length.symbol}: ${formatQuantity('velocity', system, r.values.velocity)} ${velocity.symbol}, ${formatQuantity('energy', system, r.values.energy)} ${energy.symbol}`
        }}
      />
    </div>
  )
}
