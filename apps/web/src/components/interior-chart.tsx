'use client'

import { Button, Group, SegmentedControl } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import type { ECharts } from 'echarts/core'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg, type Translator } from '../i18n/translate.ts'
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
import { nth } from '../lib/nth.ts'
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
  { value: 'all', label: msg('All'), name: msg('breech pressure, velocity and energy') },
  { value: 'pressure', label: msg('Pressure'), name: msg('breech pressure') },
  { value: 'velocity', label: msg('Velocity'), name: msg('bullet velocity') },
  { value: 'energy', label: msg('Energy'), name: msg('bullet energy') },
] as const

const symbols = { pressure: 'p', velocity: 'v', energy: 'E' } as const

/** A quantity's switch: its line key and symbol, the name for screen readers and on hover. */
const quantityLabel = ({ value, label }: (typeof quantities)[number], t: Translator['t']) =>
  value === 'all' ? (
    t(label)
  ) : (
    <span title={t(label)} className="quantity-option">
      <span className="series-key" data-q={value} aria-hidden="true" />
      <span aria-hidden="true">{symbols[value]}</span>
      <span className="visually-hidden">{t(label)}</span>
    </span>
  )

/** What the chart draws, named for a sentence. */
const quantityName = (quantity: ChartShow, t: Translator['t']) =>
  t((quantities.find((d) => d.value === quantity) ?? nth(quantities, 0)).name)

/** The chart's accessible name, also its locator in the e2e tests. */
function chartTitle(v: Pick<ChartView, 'x' | 'quantity'>, t: Translator['t']) {
  return t('Simulated {quantity} against {axis}', {
    quantity: quantityName(v.quantity, t),
    axis: v.x === 'time' ? t('time') : t('bullet travel'),
  })
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
  steps: {
    n: number
    label?: string | undefined
    value?: string | undefined
    result: PlaybackResult
  }[]
  /** Index into `steps`. */
  selected: number
  /** Bullet mass, kg. */
  mass: number
  limits: Limits
  system: UnitSystem
  view: ChartView
  onView: (v: ChartView) => void
  /** After each draw, also in a hidden tab: the workbench copies the chart for its report. */
  onRender?: ((chart: ECharts) => void) | undefined
  /** What the barrel strip above the chart draws, from the run's seating. */
  strip?: StripFigure | undefined
  /** A new key starts the playback afresh at ignition: a new run or step. */
  playKey?: string
  /** The run's burn form z1 (the two-stage form), for its event line. */
  z1?: number | undefined
}) {
  const { x, quantity } = view
  const { t, language } = useTranslation()
  const theme = useChartTokens(themeTokens)
  const reduce = useReducedMotion(false, { getInitialValueInEffect: false })
  const [dataOpen, setDataOpen] = useState(false)
  const step = nth(steps, selected)
  const r = step.result
  const ladder = steps.length > 1
  const shown = shownQuantities(quantity)
  const withPressure = shown.includes('pressure')
  const lines = withPressure ? limitLines(limits, system, t) : undefined
  const events = chartEvents(r, z1, t)
  const at = sampler(r.points)
  const values = (s: ReturnType<typeof at>): [string, string][] => [
    [t('Time'), msText(s.time)],
    [t('Travel'), shownLength('travel', system, s.travel)],
    [t('Breech pressure'), withUnit('pressure', system, s.breechPressure)],
    [t('Velocity'), withUnit('velocity', system, s.velocity)],
    [t('Energy'), withUnit('energy', system, 0.5 * mass * s.velocity ** 2)],
    [t('Burnt'), percentText(s.burntFraction)],
  ]
  const stepName = ladder
    ? (step.value ?? t('Step {step}', { step: step.label ?? step.n }))
    : t('Nominal load')
  const readout = (s: ReturnType<typeof at>) =>
    t('{step}: {values}', {
      step: stepName,
      values: values(s)
        .map(([k, v]) => `${k} ${v}`)
        .join(', '),
    })
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const [railHost, setRailHost] = useState<HTMLDivElement | null>(null)
  const muzzleTravel = nth(r.points, r.points.length - 1).travel
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
    language,
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
      t,
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
  const named = quantityName(quantity, t)
  const chart = useRef<ECharts | null>(null)
  const redraw = useRef<() => void>(undefined)
  const firstShown = shown[0] ?? 'pressure'
  const split = powderSplit(r, at)
  const energy = energySplit(r.energy)
  const energyUnit = system.energy.symbol
  const key = t('peak {pressure}, muzzle {velocity}', {
    pressure: withUnit('pressure', system, r.peakBreechPressure),
    velocity: withUnit('velocity', system, r.muzzleVelocity),
  })
  const marked = events.map((e) => e.label).join(', ')
  const description = [
    ladder
      ? t('{count} ladder steps of {quantity}; {step} solid, the others dashed. {step} {key}.', {
          count: steps.length,
          quantity: named,
          step: stepName,
          key,
        })
      : t('Nominal load, {quantity}; {key}.', { quantity: named, key }),
    lines
      ? t('Lines mark {events}, and {limits}.', {
          events: marked,
          limits: lines.map((l) => l.label).join(', '),
        })
      : t('Lines mark {events}.', { events: marked }),
    ladder ? t('The Ladder table gives the values.') : t('The readouts give the values.'),
  ].join(' ')
  return (
    <div className="interior-chart">
      <Group gap="xs" className="chart-controls">
        <SegmentedControl
          size={controlSize.row.toggle}
          aria-label={t('Chart quantity')}
          data={quantities.map((q) => ({ value: q.value, label: quantityLabel(q, t) }))}
          value={quantity}
          onChange={(v) => onView({ ...view, quantity: v as ChartShow })}
        />
        <SegmentedControl
          size={controlSize.row.toggle}
          aria-label={t('Chart x axis')}
          data={[
            { value: 'travel', label: t('Travel') },
            { value: 'time', label: t('Time') },
          ]}
          value={x}
          onChange={(v) => onView({ ...view, x: v as ChartX })}
        />
        <Button
          size={controlSize.row.button}
          px={8}
          variant="default"
          ml="auto"
          aria-label={t('Chart data')}
          title={t("The chart's values as a table")}
          onClick={() => setDataOpen(true)}
        >
          {t('Data')}
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
            title={chartTitle(view, t)}
            description={description}
            focus={focus}
            readout={(i) => readout(at(nth(r.points, Math.min(i, r.points.length - 1)).time))}
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
        <p className="note">{t('No compared pressure limit for this result: no limit lines.')}</p>
      )}
      <AppModal
        opened={dataOpen}
        onClose={() => setDataOpen(false)}
        title={t('Chart data')}
        size="auto"
      >
        <PanelTable
          label={t('Chart data')}
          className="limits"
          caption={t('{step} at 20 evenly spaced times from ignition to muzzle exit (simulation)', {
            step: stepName,
          })}
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
          label={t('Events')}
          className="limits"
          caption={t('Events of the shot (simulation)')}
          columns={[t('Event'), ...values(at(0)).map(([k]) => k)]}
        >
          {playbackEvents(r, t).map((e) => (
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
        <h3>{t('Powder at the muzzle')}</h3>
        <ul>
          <li>
            {t('Burnt before the bullet moves: {share}', { share: percentText(split.before) })}
          </li>
          <li>
            {t('Burnt while the bullet travels: {share}', { share: percentText(split.travel) })}
          </li>
          <li>{t('Unburnt at the muzzle: {share}', { share: percentText(split.unburnt) })}</li>
        </ul>
        <PanelTable
          label={t('Energy at the muzzle')}
          className="limits"
          caption={t(
            'Energy at the muzzle: where the {energy} {unit} released by the burnt powder went, shares rounded to 0.1 %',
            { energy: formatQuantity('energy', system, energy.total), unit: energyUnit },
          )}
          columns={[t('Term'), t('Energy ({unit})', { unit: energyUnit }), t('Share')]}
        >
          {energy.shown.map((term) => (
            <tr key={term.key}>
              <td>{t(term.label)}</td>
              <td className="num">{formatQuantity('energy', system, term.value)}</td>
              <td className="num">{percentText(term.share)}</td>
            </tr>
          ))}
        </PanelTable>
        {energy.zero.length > 0 && (
          <p className="note">
            {t('Not modelled with these inputs: {terms}.', {
              terms: energy.zero.map((term) => t(term.lower)).join(', '),
            })}
          </p>
        )}
      </AppModal>
    </div>
  )
}
