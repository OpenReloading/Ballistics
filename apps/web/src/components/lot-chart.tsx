'use client'

import { useMemo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber, plainNumber } from '../i18n/number.ts'
import type { Translator } from '../i18n/translate.ts'
import { type BarrelTimes, barrelTimeBand, lotChartDescription, lotLabel } from '../lib/lot-rows.ts'
import { niceTicks } from '../lib/ticks.ts'
import type { UnitSystem } from '../lib/units.ts'
import { EChart, tickStep, useChartTokens } from './echart.tsx'

const tokens = {
  line: '--series-1',
  muted: '--muted',
  border: '--border',
  bg: '--bg',
  fg: '--fg',
}

const ms = (s: number | undefined) => (s === undefined ? null : s * 1e3)
const msText = (s: number | undefined, t: Translator['t']) =>
  s === undefined ? t('not computed') : `${formatNumber(s * 1e3, 3)} ms`

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
  target?: number | undefined
  system: UnitSystem
  height?: number | undefined
}) {
  const { t } = useTranslation()
  const theme = useChartTokens(tokens)
  const { charge } = system
  const option = useMemo(() => {
    if (!theme) return
    const bands = times.map(barrelTimeBand)
    const all = [
      ...bands.flatMap((b) => b ?? []),
      ...times.flatMap((row) => (row.nominal === undefined ? [] : [row.nominal])),
      ...(target === undefined ? [] : [target]),
    ].map((s) => s * 1e3)
    if (all.length === 0) return
    const xs = times.map((row) => charge.fromSi(row.charge))
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
    const at = (v: (b: [number, number] | undefined, row: BarrelTimes) => number | null) =>
      times.map((row, i) => [xs[i], v(bands[i], row)])
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
          const index = params[0]?.dataIndex
          const row = index === undefined ? undefined : times[index]
          if (!row) return ''
          return [
            `${formatNumber(charge.fromSi(row.charge), charge.decimals)} ${charge.symbol}`,
            t('{change} burn rate: {time}', {
              change: lotLabel('low', fraction),
              time: msText(row.low, t),
            }),
            t('Nominal: {time}', { time: msText(row.nominal, t) }),
            t('{change} burn rate: {time}', {
              change: lotLabel('high', fraction),
              time: msText(row.high, t),
            }),
          ].join('<br>')
        },
      },
      xAxis: {
        type: 'value' as const,
        min: xt[0],
        max: xt[xt.length - 1],
        interval: tickStep(xt),
        ...axis(t('Charge, {unit}', { unit: charge.symbol }), 26),
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
        interval: tickStep(yt),
        ...axis(t('Barrel time, ms'), 44),
        axisLabel: {
          color: theme.muted,
          fontSize: 12,
          formatter: (v: number) => plainNumber(Number(v.toPrecision(10))),
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
                        formatter: t('Target {time}', { time: msText(target, t) }),
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
  }, [theme, times, fraction, target, charge, t])
  if (!option) return <div className="chart lot-chart" style={{ height }} />
  return (
    <div className="chart lot-chart">
      <EChart
        option={option}
        height={height}
        title={t('Simulated barrel time against charge')}
        description={lotChartDescription(fraction, target !== undefined, t)}
        focus={2}
        readout={(i) => {
          const row = times[Math.min(i, times.length - 1)]
          if (!row) return ''
          return t('{charge}: {low} {lowTime}, nominal {nominalTime}, {high} {highTime}', {
            charge: `${formatNumber(charge.fromSi(row.charge), charge.decimals)} ${charge.symbol}`,
            low: lotLabel('low', fraction),
            lowTime: msText(row.low, t),
            nominalTime: msText(row.nominal, t),
            high: lotLabel('high', fraction),
            highTime: msText(row.high, t),
          })
        }}
      />
    </div>
  )
}
