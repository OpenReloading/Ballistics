'use client'

import { Button, Group, SegmentedControl } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import type { ECharts } from 'echarts/core'
import { useMemo, useRef, useState } from 'react'
import { type StripFigure, stripModel } from '../lib/barrel-strip.ts'
import {
  type ChartShow,
  type ChartTheme,
  type ChartX,
  chartEvents,
  chartRows,
  chartX,
  chartY,
  interiorOption,
  limitLines,
  plotEdges,
  sampleAtX,
  shownQuantities,
} from '../lib/interior-chart.ts'
import {
  energySplit,
  type PlaybackResult,
  playbackEvents,
  powderSplit,
  sampler,
} from '../lib/playback.ts'
import { controlSize } from '../lib/theme.ts'
import { formatQuantity, msText, percentText, type UnitSystem, withUnit } from '../lib/units.ts'
import { shownLength } from '../lib/workbench.ts'
import { AppModal } from './app-modal.tsx'
import { ChartPlayback } from './chart-playback.tsx'
import { EChart, useChartTokens } from './echart.tsx'
import { PanelTable } from './scroll-region.tsx'

type Limits = Parameters<typeof limitLines>[0]

/** What the chart shows; the workbench holds it, so it survives a tab switch and a new run. */
export type ChartView = { x: ChartX; quantity: ChartShow }

const quantities = [
  { value: 'all', label: 'All', name: 'breech pressure, velocity and energy' },
  { value: 'pressure', label: 'Pressure', name: 'breech pressure' },
  { value: 'velocity', label: 'Velocity', name: 'bullet velocity' },
  { value: 'energy', label: 'Energy', name: 'bullet energy' },
] as const

const symbols = { pressure: 'p', velocity: 'v', energy: 'E' } as const

/** A quantity's switch: its line key and symbol, the name for screen readers and on hover. */
const quantityLabel = ({ value, label }: (typeof quantities)[number]) =>
  value === 'all' ? (
    label
  ) : (
    <span title={label} className="quantity-option">
      <span className="series-key" data-q={value} aria-hidden="true" />
      <span aria-hidden="true">{symbols[value]}</span>
      <span className="visually-hidden">{label}</span>
    </span>
  )

/** The chart's accessible name, also its locator in the e2e tests. */
function chartTitle(v: Pick<ChartView, 'x' | 'quantity'>) {
  const q = quantities.find((d) => d.value === v.quantity)?.name
  return `Simulated ${q} against ${v.x === 'time' ? 'time' : 'bullet travel'}`
}

/** The chart colours from the page's tokens (`globals.css`). */
const themeTokens: Record<keyof ChartTheme, string> = {
  pressure: '--series-2',
  pressureText: '--series-2-text',
  velocityText: '--series-1-text',
  energyText: '--series-3-text',
  grid: '--grid',
  velocity: '--series-1',
  energy: '--series-3',
  foreground: '--fg',
  muted: '--muted',
  border: '--border',
  warning: '--warn-fg',
  background: '--bg',
}

/**
 * The workbench interior chart: breech pressure,
 * velocity and energy on their own axes against travel or time, or one of them alone; one curve
 * per step with `selected` solid, event lines of the selected step, limit lines with pressure, a
 * tooltip with every value of the selected step (also by keyboard) and a collapsed data table.
 */
export function InteriorChart({
  steps,
  selected,
  mass,
  limits,
  system,
  view,
  onView,
  onRender,
  strip,
  playKey,
  z1,
}: {
  /** Valid steps in ladder order, one without a ladder. `label`: the step as the page names it, relative to the main charge; `value`: its charge or seating as shown. */
  steps: { n: number; label?: string; value?: string; result: PlaybackResult }[]
  /** Index into `steps`. */
  selected: number
  /** Bullet mass, kg. */
  mass: number
  limits: Limits
  system: UnitSystem
  view: ChartView
  onView: (v: ChartView) => void
  /** After each draw, also in a hidden tab: the workbench copies the chart for its report. */
  onRender?: (chart: ECharts) => void
  /** What the barrel strip above the chart draws, from the run's seating. */
  strip?: StripFigure
  /** A new key starts the playback afresh at ignition: a new run or step. */
  playKey?: string
  /** The run's burn form z1 (the two-stage form), for its event line. */
  z1?: number
}) {
  const { x, quantity } = view
  const theme = useChartTokens(themeTokens)
  const reduce = useReducedMotion(false, { getInitialValueInEffect: false })
  const [dataOpen, setDataOpen] = useState(false)
  const r = steps[selected].result
  const ladder = steps.length > 1
  const shown = shownQuantities(quantity)
  const withPressure = shown.includes('pressure')
  const lines = withPressure ? limitLines(limits, system) : undefined
  const events = chartEvents(r, z1)
  const at = sampler(r.points)
  const values = (s: ReturnType<typeof at>) => [
    ['Time', msText(s.time)],
    ['Travel', shownLength('travel', system, s.travel)],
    ['Breech pressure', withUnit('pressure', system, s.breechPressure)],
    ['Velocity', withUnit('velocity', system, s.velocity)],
    ['Energy', withUnit('energy', system, 0.5 * mass * s.velocity ** 2)],
    ['Burnt', percentText(s.burntFraction)],
  ]
  const stepName = ladder
    ? (steps[selected].value ?? `Step ${steps[selected].label ?? steps[selected].n}`)
    : 'Nominal load'
  const readout = (s: ReturnType<typeof at>) =>
    `${stepName}: ${values(s)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const [railHost, setRailHost] = useState<HTMLDivElement | null>(null)
  const muzzleTravel = r.points[r.points.length - 1].travel
  const stripDrawn = useMemo(() => strip && stripModel(strip, muzzleTravel), [strip, muzzleTravel])
  // what the chart draws; a new option only when this changes, so typing elsewhere never redraws it
  const signature = [
    steps.map((s) => `${s.n}:${s.result.muzzleTime}`).join(),
    selected,
    x,
    quantity,
    system.pressure.symbol,
    system.velocity.symbol,
    system.energy.symbol,
    system.length.symbol,
    theme && Object.values(theme).join(),
    reduce,
    z1,
    stepName,
    mass,
    JSON.stringify(lines),
  ].join('|')
  // biome-ignore lint/correctness/useExhaustiveDependencies: the signature names every input drawn
  const option = useMemo(() => {
    if (!theme) return
    const base = interiorOption({
      steps,
      selected,
      mass,
      x,
      show: quantity,
      lines,
      system,
      theme,
      animate: !reduce,
      z1,
    })
    const cell = (k: string, v: string) => `<dt>${k}</dt><dd>${v}</dd>`
    return {
      ...base,
      tooltip: {
        trigger: 'axis',
        confine: true,
        borderRadius: 0,
        className: 'chart-tooltip',
        backgroundColor: theme.background,
        borderColor: theme.border,
        textStyle: { color: theme.foreground },
        axisPointer: { type: 'line', lineStyle: { color: theme.muted } },
        formatter: (params: { axisValue: number }[]) => {
          const s = sampleAtX(r.points, x, params[0]?.axisValue ?? 0, system)
          return `${ladder ? `<strong>${stepName}</strong>` : ''}<dl>${values(s)
            .map(([k, v]) => cell(k, v))
            .join('')}</dl>`
        },
      },
    }
  }, [signature])
  // the selected step's first curve, which the keyboard walks
  const focus = shown.length === 0 ? 0 : selected
  const named = quantities.find((d) => d.value === quantity)?.name
  const chart = useRef<ECharts | null>(null)
  const redraw = useRef<() => void>(undefined)
  const firstShown = shown[0] ?? 'pressure'
  const split = powderSplit(r, at)
  const energy = energySplit(r.energy)
  const energyUnit = system.energy.symbol
  const key = `peak ${withUnit('pressure', system, r.peakBreechPressure)}, muzzle ${withUnit('velocity', system, r.muzzleVelocity)}`
  return (
    <div className="interior-chart">
      <Group gap="xs" className="chart-controls">
        <SegmentedControl
          size={controlSize.row.toggle}
          aria-label="Chart quantity"
          data={quantities.map((q) => ({ value: q.value, label: quantityLabel(q) }))}
          value={quantity}
          onChange={(v) => onView({ ...view, quantity: v as ChartShow })}
        />
        <SegmentedControl
          size={controlSize.row.toggle}
          aria-label="Chart x axis"
          data={[
            { value: 'travel', label: 'Travel' },
            { value: 'time', label: 'Time' },
          ]}
          value={x}
          onChange={(v) => onView({ ...view, x: v as ChartX })}
        />
        <Button
          size={controlSize.row.button}
          px={8}
          variant="default"
          ml="auto"
          aria-label="Chart data"
          title="The chart's values as a table"
          onClick={() => setDataOpen(true)}
        >
          Data
        </Button>
      </Group>
      <ChartPlayback
        key={playKey}
        r={r}
        strip={stripDrawn}
        system={system}
        x={(s) => chartX(s, x, system)}
        y={(s) => chartY(s, firstShown, mass, system)}
        chart={chart}
        stage={stage}
        rail={railHost}
        // the grid of interiorOption
        plot={plotEdges(shown.length)}
        travelX={x === 'travel' ? (m) => system.length.fromSi(m) : undefined}
        redraw={redraw}
      />
      <div className="chart-stage" ref={setStage}>
        {option && (
          <EChart
            option={option}
            title={chartTitle(view)}
            description={`${
              ladder
                ? `${steps.length} ladder steps of ${named}; ${stepName} solid, the others dashed. ${stepName}`
                : `Nominal load, ${named};`
            } ${key}. Lines mark ${events.map((e) => e.label).join(', ')}${
              lines ? `, and ${lines.map((l) => l.label).join(', ')}` : ''
            }. ${ladder ? 'The Ladder table gives the values.' : 'The readouts give the values.'}`}
            focus={focus}
            readout={(i) => readout(at(r.points[Math.min(i, r.points.length - 1)].time))}
            onRender={(c) => {
              chart.current = c
              redraw.current?.()
              onRender?.(c)
            }}
          />
        )}
        <div className="chart-rail" ref={setRailHost} />
      </div>
      {withPressure && !lines && (
        <p className="note">No compared pressure limit for this result: no limit lines.</p>
      )}
      <AppModal opened={dataOpen} onClose={() => setDataOpen(false)} title="Chart data" size="auto">
        <PanelTable
          label="Chart data"
          className="limits"
          caption={
            <>{stepName} at 20 evenly spaced times from ignition to muzzle exit (simulation)</>
          }
          columns={values(at(0)).map(([k]) => k)}
        >
          {chartRows(r.points).map((s) => (
            <tr key={s.time}>
              {values(s).map(([k, text]) => (
                <td key={k} className="num">
                  {text}
                </td>
              ))}
            </tr>
          ))}
        </PanelTable>
        <PanelTable
          label="Events"
          className="limits"
          caption="Events of the shot (simulation)"
          columns={['Event', ...values(at(0)).map(([k]) => k)]}
        >
          {playbackEvents(r).map((e) => (
            <tr key={e.key}>
              <td>{e.label}</td>
              {values(at(e.time)).map(([k, text]) => (
                <td key={k} className="num">
                  {text}
                </td>
              ))}
            </tr>
          ))}
        </PanelTable>
        <h3>Powder at the muzzle</h3>
        <ul>
          <li>Burnt before the bullet moves: {percentText(split.before)}</li>
          <li>Burnt while the bullet travels: {percentText(split.travel)}</li>
          <li>Unburnt at the muzzle: {percentText(split.unburnt)}</li>
        </ul>
        <PanelTable
          label="Energy at the muzzle"
          className="limits"
          caption={
            <>
              Energy at the muzzle: where the {formatQuantity('energy', system, energy.total)}{' '}
              {energyUnit} released by the burnt powder went, shares rounded to 0.1 %
            </>
          }
          columns={['Term', `Energy (${energyUnit})`, 'Share']}
        >
          {energy.shown.map((t) => (
            <tr key={t.key}>
              <td>{t.label}</td>
              <td className="num">{formatQuantity('energy', system, t.value)}</td>
              <td className="num">{percentText(t.share)}</td>
            </tr>
          ))}
        </PanelTable>
        {energy.zero.length > 0 && (
          <p className="note">
            Not modelled with these inputs:{' '}
            {energy.zero.map((t) => t.label.toLowerCase()).join(', ')}.
          </p>
        )}
      </AppModal>
    </div>
  )
}
