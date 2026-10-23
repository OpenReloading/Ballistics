'use client'

import { useMemo } from 'react'
import { type BarrelTimes, barrelTimeBand, lotLabel } from '../lib/lot-rows.ts'
import { niceTicks } from '../lib/ticks.ts'
import { formatNumber, type UnitSystem } from '../lib/units.ts'
import { EChart, useChartTokens } from './echart.tsx'

const tokens = {
  line: '--series-1',
  muted: '--muted',
  border: '--border',
  bg: '--bg',
  fg: '--fg',
}

const ms = (s: number | undefined) => (s === undefined ? null : s * 1e3)
const msText = (s: number | undefined) =>
  s === undefined ? 'not computed' : `${formatNumber(s * 1e3, 3)} ms`

/**
 * Simulated barrel time against charge: the nominal run as a line and, between the shortest and the
 * longest barrel time of each charge's rows, a band for the powder lots `fraction` (a fraction)
 * above and below the burn rate. `target` (s) draws a line.
 */
export function LotChart({
  times,
  fraction,
  target,
  system,
  height = 280,
}: {
  times: BarrelTimes[]
  fraction: number
  target?: number
  system: UnitSystem
  height?: number
}) {
  const theme = useChartTokens(tokens)
  const { charge } = system
  const option = useMemo(() => {
    if (!theme) return
    const bands = times.map(barrelTimeBand)
    const all = [
      ...bands.flatMap((b) => b ?? []),
      ...times.flatMap((t) => (t.nominal === undefined ? [] : [t.nominal])),
      ...(target === undefined ? [] : [target]),
    ].map((s) => s * 1e3)
    if (all.length === 0) return
    const xs = times.map((t) => charge.fromSi(t.charge))
    const [xt, yt] = [
      niceTicks(Math.min(...xs), Math.max(...xs)),
      niceTicks(Math.min(...all), Math.max(...all)),
    ]
    const axis = (name: string, gap: number) => ({
      name,
      nameLocation: 'middle' as const,
      nameGap: gap,
      nameTextStyle: { color: theme.muted, fontSize: 12 },
      axisLabel: { color: theme.muted, fontSize: 12 },
      axisLine: { show: true, lineStyle: { color: theme.muted } },
    })
    const none = { opacity: 0 }
    const at = (v: (b: [number, number] | undefined, t: BarrelTimes) => number | null) =>
      times.map((t, i) => [xs[i], v(bands[i], t)])
    const common = { type: 'line' as const, emphasis: { disabled: true } }
    return {
      animation: false,
      grid: {
        left: 8,
        right: 16,
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
        formatter: (params: { dataIndex: number }[]) => {
          const t = times[params[0]?.dataIndex]
          if (!t) return ''
          return [
            `${formatNumber(charge.fromSi(t.charge), charge.decimals)} ${charge.symbol}`,
            `${lotLabel('low', fraction)} burn rate: ${msText(t.low)}`,
            `Nominal: ${msText(t.nominal)}`,
            `${lotLabel('high', fraction)} burn rate: ${msText(t.high)}`,
          ].join('<br>')
        },
      },
      xAxis: {
        type: 'value' as const,
        min: xt[0],
        max: xt[xt.length - 1],
        interval: xt[1] - xt[0],
        ...axis(`Charge, ${charge.symbol}`, 26),
        axisLabel: {
          color: theme.muted,
          fontSize: 12,
          formatter: (v: number) => formatNumber(v, charge.decimals),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        min: yt[0],
        max: yt[yt.length - 1],
        interval: yt[1] - yt[0],
        ...axis('Barrel time, ms', 44),
        axisLabel: {
          color: theme.muted,
          fontSize: 12,
          formatter: (v: number) => String(Number(v.toPrecision(10))),
        },
        splitLine: { lineStyle: { color: theme.border } },
      },
      series: [
        // the band: an invisible floor at the shortest time and the spread stacked on it
        {
          ...common,
          name: 'Band floor',
          stack: 'lot',
          data: at((b) => (b ? b[0] * 1e3 : null)),
          symbol: 'none',
          silent: true,
          tooltip: { show: false },
          lineStyle: none,
        },
        {
          ...common,
          name: 'Lot band',
          stack: 'lot',
          data: at((b) => (b ? (b[1] - b[0]) * 1e3 : null)),
          symbol: 'none',
          silent: true,
          tooltip: { show: false },
          lineStyle: none,
          areaStyle: { color: theme.line, opacity: 0.22 },
        },
        {
          ...common,
          name: 'Nominal',
          data: at((_, t) => ms(t.nominal)),
          symbol: 'circle',
          symbolSize: 5,
          z: 3,
          lineStyle: { color: theme.line, width: 2 },
          itemStyle: { color: theme.line },
          markLine:
            target === undefined
              ? undefined
              : {
                  silent: true,
                  symbol: 'none',
                  animation: false,
                  data: [
                    {
                      yAxis: target * 1e3,
                      lineStyle: { color: theme.fg, type: 'dashed' as const, width: 1 },
                      label: {
                        formatter: `Target ${msText(target)}`,
                        position: 'insideEndTop' as const,
                        color: theme.fg,
                        fontSize: 12,
                      },
                    },
                  ],
                },
        },
      ],
    }
  }, [theme, times, fraction, target, charge])
  if (!option) return <div className="chart lot-chart" style={{ height }} />
  return (
    <div className="chart lot-chart">
      <EChart
        option={option}
        height={height}
        title="Simulated barrel time against charge"
        description={`The line is the nominal run. The shaded band spans the barrel times of the nominal row and the rows at a burn rate ${lotLabel('high', fraction)} and ${lotLabel('low', fraction)}.${target === undefined ? '' : ' The dashed line is the target barrel time.'} The table gives the values.`}
        focus={2}
        readout={(i) => {
          const t = times[Math.min(i, times.length - 1)]
          return `${formatNumber(charge.fromSi(t.charge), charge.decimals)} ${charge.symbol}: ${lotLabel('low', fraction)} ${msText(t.low)}, nominal ${msText(t.nominal)}, ${lotLabel('high', fraction)} ${msText(t.high)}`
        }}
      />
    </div>
  )
}
