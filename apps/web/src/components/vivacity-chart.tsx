'use client'

import { useMemo } from 'react'
import {
  chartBurntFractions,
  curveAt,
  dashes,
  type FittedPowder,
  vivacityUnit,
} from '../lib/burn-rate.ts'
import { niceTicks, tickDecimals } from '../lib/ticks.ts'
import { formatNumber } from '../lib/units.ts'
import { EChart, useChartTokens } from './echart.tsx'

const vivacityTokens: Record<string, string> = {
  muted: '--muted',
  border: '--border',
  bg: '--bg',
  fg: '--fg',
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((k) => [k, `--series-${k}`])),
}

/** One powder of the chart and its colour slot (0 to 5, `--series-<slot + 1>` in globals.css). */
interface Series {
  powder: FittedPowder
  slot: number
}

/** One array for every chart without marks, so its option is not rebuilt on each render. */
const noMarks: Mark[] = []

type Tokens = Record<string, string>
type Mark = { z: number; label: string }

/** The interval as a band: an invisible lower line, the width stacked on it. */
function bandSeries(series: Series[], tokens: Tokens) {
  return series.flatMap(({ powder: p, slot }) => [
    {
      type: 'line',
      name: 'Interval low',
      stack: 'band',
      symbol: 'none',
      lineStyle: { opacity: 0 },
      tooltip: { show: false },
      data: chartBurntFractions.map((z) => [z, curveAt(p, z).low ?? curveAt(p, z).value]),
    },
    {
      type: 'line',
      name: 'Interval',
      stack: 'band',
      symbol: 'none',
      lineStyle: { opacity: 0 },
      areaStyle: { color: tokens[slot + 1], opacity: 0.2 },
      tooltip: { show: false },
      data: chartBurntFractions.map((z) => {
        const v = curveAt(p, z)
        return [z, (v.high ?? v.value) - (v.low ?? v.value)]
      }),
    },
  ])
}

/** The run's events as vertical lines on the burnt-fraction axis. */
function marksSeries(marks: Mark[], tokens: Tokens, small: boolean) {
  if (marks.length === 0) return []
  return [
    {
      type: 'line',
      name: 'This run',
      data: [],
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: tokens.muted, type: 'dashed' },
        label: {
          color: tokens.muted,
          fontSize: small ? 12 : 11,
          formatter: (d: { name: string }) => d.name,
        },
        data: marks.map((m) => ({ xAxis: m.z, name: m.label })),
      },
    },
  ]
}

/** The ECharts option: one line per powder, with one powder its interval as a band. */
function vivacityOption(
  tokens: Tokens,
  series: Series[],
  height: number | undefined,
  marks: Mark[],
) {
  const band = series.length === 1
  const top = Math.max(
    ...series.flatMap(({ powder: p }) =>
      chartBurntFractions.map((z) => curveAt(p, z).high ?? curveAt(p, z).value),
    ),
  )
  const yt = niceTicks(0, top)
  const dy = tickDecimals(yt)
  // the workbench's small figure: 12 px text, half the ticks, the unit in its card title
  const small = height !== undefined && height < 200
  const axisText = { color: tokens.muted, fontSize: 12 }
  return {
    animation: false,
    // the bottom keeps room for the x axis name below its labels (containLabel counts labels only)
    grid: {
      left: 4,
      right: 12,
      top: small ? 16 : 28,
      bottom: small ? 18 : 24,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      // kept inside the chart: `.chart` clips overflow, a tooltip past its edge was cut and left text over the note
      confine: true,
      borderRadius: 0,
      valueFormatter: (v: number) => formatNumber(v, 3),
      backgroundColor: tokens.bg,
      borderColor: tokens.border,
      textStyle: { color: tokens.fg },
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: 1,
      interval: small ? 0.5 : 0.2,
      name: 'Burnt fraction z',
      nameLocation: 'middle',
      nameGap: small ? 20 : 26,
      nameTextStyle: axisText,
      axisLabel: { ...axisText, formatter: (v: number) => formatNumber(v, 1) },
      axisLine: { lineStyle: { color: tokens.muted } },
      splitLine: { lineStyle: { color: tokens.border } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: yt[yt.length - 1],
      interval: yt.length > 1 ? (yt[1] - yt[0]) * (small && yt.length > 4 ? 2 : 1) : undefined,
      name: small ? '' : `Dynamic vivacity, ${vivacityUnit}`,
      nameLocation: 'end',
      nameTextStyle: { ...axisText, align: 'left' },
      axisLabel: { ...axisText, formatter: (v: number) => formatNumber(v, dy) },
      axisLine: { show: true, lineStyle: { color: tokens.muted } },
      splitLine: { lineStyle: { color: tokens.border } },
    },
    series: [
      ...(band ? bandSeries(series, tokens) : []),
      ...series.map(({ powder: p, slot }) => ({
        type: 'line',
        name: p.label,
        symbol: 'none',
        lineStyle: { color: tokens[slot + 1], width: 2, type: dashArray(dashes[slot]) },
        itemStyle: { color: tokens[slot + 1] },
        data: chartBurntFractions.map((z) => [z, curveAt(p, z).value]),
      })),
      ...marksSeries(marks, tokens, small),
    ],
  }
}

/**
 * Dynamic vivacity over burnt fraction (`apps/docs/docs/models/interior-burn-forms.md`, Dynamic
 * vivacity): one line per powder;
 * with one powder its interval as a band. `title` and `description` are the text alternative; the
 * data table next to the chart carries the values. Drawn with ECharts (`EChart`), the axis texts
 * kept inside the box, so a small chart beside the workbench readouts is not clipped.
 */
export function VivacityChart({
  series,
  title,
  description,
  height,
  marks = noMarks,
}: {
  series: Series[]
  title: string
  description: string
  /** Px; without it the box's CSS height. */
  height?: number
  /** Burnt fractions of a run to mark, as shot start, peak pressure and muzzle (workbench). */
  marks?: Mark[]
}) {
  const tokens = useChartTokens(vivacityTokens)
  const option = useMemo(
    () => (tokens ? vivacityOption(tokens, series, height, marks) : {}),
    [series, tokens, height, marks],
  )
  return (
    <div className="chart vivacity-chart">
      <EChart option={option} height={height} title={title} description={description} />
    </div>
  )
}

/** An SVG dash pattern as ECharts' line type. */
const dashArray = (d: string) => (d === '' ? 'solid' : d.split(' ').map(Number))
