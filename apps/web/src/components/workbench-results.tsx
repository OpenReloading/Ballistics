'use client'

import { Button, Menu, Tabs, Textarea } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { CaretDown } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { vivacityUnit } from '../lib/burn-rate.ts'
import { toCsv } from '../lib/csv.ts'
import { controlSize } from '../lib/theme.ts'
import { resultTabsFit } from '../lib/workbench.ts'
import { BarrelLength } from './barrel-length.tsx'
import { LadderTarget } from './ladder-target.tsx'
import { LazyInteriorChart } from './lazy-chart.tsx'
import { LotPanel } from './lot-rows.tsx'
import { NavIcon } from './nav-icons.tsx'
import { PowderCompare } from './powder-compare.tsx'
import { chartCopy } from './print-report.tsx'
import { ErrorNote, Loading } from './states.tsx'
import { TrajectoryForm } from './trajectory-form.tsx'
import { useInputEcho, useResult } from './workbench-context.ts'
import { FigureTab } from './workbench-figure.tsx'
import { Checklist, shortFrame } from './workbench-inputs.tsx'
import {
  type Outcome,
  resultLine,
  type ShownStep,
  singleCharge,
  stripFigureOf,
  warningsLine,
} from './workbench-outcome.ts'
import {
  BurnRate,
  ErrorView,
  LadderStrip,
  LadderTable,
  Readouts,
  WarningsBlock,
} from './workbench-readouts.tsx'

export const Measurements = dynamic(
  () => import('./measurements.tsx').then((m) => m.Measurements),
  {
    ssr: false,
    loading: () => <Loading what="the measurements" inline />,
  },
)

const GroupsTab = dynamic(() => import('./groups-tab.tsx').then((m) => m.GroupsTab), {
  ssr: false,
  loading: () => <Loading what="the shot groups" inline />,
})

/** The result tabs; Cartridge only in a low desktop window (`shortFrame`), where the figure leaves the inputs. */
export const resultTabs = [
  ['results', 'Chart'],
  ['cartridge', 'Cartridge'],
  ['ladder', 'Ladder table'],
  ['trajectory', 'Trajectory'],
  ['measurements', 'Measurements'],
  ['groups', 'Groups'],
  ['notes', 'Notes'],
  ['barrel', 'Barrel length'],
  ['powders', 'Powders'],
] as const
export type ResultTab = (typeof resultTabs)[number][0]

const notRun = (what: string) => (
  <p className="prompt empty-state">Run the simulation to see {what}.</p>
)
const later = (text: string) => <p className="prompt empty-state">{text}</p>
const heading = (v: ResultTab) => (
  <h2 className="print-only">{resultTabs.find(([k]) => k === v)?.[1]}</h2>
)

/**
 * The chosen powder's burn rate: beside the readouts, and in the inputs' second column of a low
 * desktop window (`shortFrame`), where its chart is taller.
 */
export function BurnFigure() {
  const { burn, powder, powderLabel, runMarks } = useResult()
  const short = useMediaQuery(shortFrame, false) ?? false
  return (
    burn && (
      <section aria-labelledby="burn-rate-title" className="burn-figure">
        <h3
          id="burn-rate-title"
          title={`Dynamic vivacity of ${powderLabel ?? 'the typed model parameters'}`}
        >
          Burn rate, {vivacityUnit}
          <span className="visually-hidden"> of {powderLabel ?? 'the typed model parameters'}</span>
        </h3>
        <BurnRate p={burn} powderId={powder?.id} marks={runMarks} height={short ? 150 : 104} />
      </section>
    )
  )
}

/** The steps as the Measurements tab maps strings to them; undefined before a run. */
export const measuredSteps = (
  steps: ShownStep[],
  ok: Extract<Outcome, { kind: 'ok' }> | undefined,
) =>
  // a seating ladder has one charge: the strings map to the shown step alone
  ok
    ? (singleCharge(ok) ? steps.filter((s) => s.n - 1 === ok.selected) : steps).map((s) => ({
        n: s.n,
        label: s.label,
        charge: s.charge,
        muzzleVelocity: s.body?.result.muzzleVelocity,
      }))
    : undefined

/** The ladder bar; before a run it shows the charge field's value. */
export function ShownStrip({ name }: { name?: string } = {}) {
  const { ok, steps, stale, oneFlag, stepValue, select } = useResult()
  const { chargeText } = useInputEcho()
  return useMemo(
    () => (
      <LadderStrip
        ok={ok}
        steps={steps}
        stale={stale}
        chargeText={chargeText}
        oneFlag={oneFlag}
        value={stepValue}
        select={select}
        name={name}
      />
    ),
    [ok, steps, stale, chargeText, oneFlag, stepValue, select, name],
  )
}

/** The interior chart of the shown run; its report copy is taken after each draw. */
const ResultChart = memo(function ResultChart() {
  const { ok, steps, system, stepValue, chartView, setChartView, showChart } = useResult()
  const valid = useMemo(
    () =>
      steps.flatMap((s) =>
        s.body ? [{ n: s.n, label: s.label, value: stepValue(s), result: s.body.result }] : [],
      ),
    [steps, stepValue],
  )
  const strip = useMemo(() => ok && stripFigureOf(ok), [ok])
  if (!ok) return null
  const { burn } = ok.load.propellant
  const z1 = burn.kind === 'vivacity' && burn.form.kind === 'twoStage' ? burn.form.z1 : undefined
  return (
    <LazyInteriorChart
      steps={valid}
      selected={Math.max(
        0,
        valid.findIndex((s) => s.n - 1 === ok.selected),
      )}
      mass={ok.load.bullet.mass}
      limits={ok.body.limits}
      system={system}
      view={chartView}
      onView={setChartView}
      onRender={(c) => {
        const svg = c.getDom().querySelector('svg')
        if (svg) showChart(chartCopy(svg))
      }}
      strip={strip}
      playKey={`${ok.id} ${ok.selected}`}
      z1={z1}
    />
  )
})

/** The Groups tab: the sheets of the saved load, with its ladder and simulated velocities. */
function GroupsPanel() {
  const { ok, identity, steps, velocity, fileId, storedTick, bulletDiameter, optic } = useResult()
  const { groupsLadder } = useInputEcho()
  // a seating ladder has one charge: the sheets see the shown step alone, as a run without a ladder
  const single = singleCharge(ok)
  const step = single ? undefined : ok?.selected
  const velocitySteps = single ? steps.filter((s) => s.n - 1 === ok?.selected) : steps
  return useMemo(
    () => (
      <GroupsTab
        // the File menu's id: set by Save and Open, which re-render the page
        load={fileId}
        stored={storedTick}
        ladder={groupsLadder}
        step={step}
        bulletDiameter={bulletDiameter}
        optic={optic}
        // the print sheet's load line and simulated velocity per ladder step
        summary={
          identity && {
            load: identity.join(', '),
            velocities: velocitySteps.map((s) => s.at && velocity(s.at.body.result)),
          }
        }
      />
    ),
    [
      fileId,
      storedTick,
      groupsLadder,
      step,
      bulletDiameter,
      optic,
      identity,
      velocitySteps,
      velocity,
    ],
  )
}

/** The Trajectory tab, from the load's muzzle velocity, bullet, twist and sight. */
function TrajectoryPanel() {
  const { trajectory } = useResult()
  const { trajectoryLoad } = useInputEcho()
  return useMemo(
    () => <TrajectoryForm ref={trajectory} load={trajectoryLoad} />,
    [trajectory, trajectoryLoad],
  )
}

/**
 * The results area: the load line, the notice, an error, the readouts or the checklist with the
 * burn rate, the warnings, the ladder strip and the result tabs. It reads the result context only,
 * so a keystroke in the inputs does not render it again.
 */
export const ResultsArea = memo(function ResultsArea() {
  const {
    ok,
    outcome,
    identity,
    stale,
    warnings,
    system,
    todo,
    steps,
    stepValue,
    velocity,
    tab,
    setTab,
    setSeen,
    opened,
    csvCopied,
    setCsvCopied,
    notes,
    setNotes,
    chronoSessions,
    setChronoSessions,
    barrel,
    lot,
    status,
    online,
    pending,
  } = useResult()
  const next = todo.findIndex((s) => !s.done)
  const echoed =
    ok !== undefined &&
    (status.startsWith('Simulation done. ') || status === resultLine(ok, system))
  const choose = (v: ResultTab) => {
    setTab(v)
    setSeen((s) => (s.has(v) ? s : new Set([...s, v])))
  }
  // from 62em the tabs that do not fit their row go into a More menu; narrower, the row
  // scrolls sideways
  const framed = useMediaQuery('screen and (min-width: 62em)')
  // in a low desktop window the burn-rate figure stands in the inputs' second column
  const short = useMediaQuery(shortFrame, false) ?? false
  const list = useRef<HTMLDivElement>(null)
  const shownTabs = useMemo(() => resultTabs.filter(([v]) => short || v !== 'cartridge'), [short])
  // by tab value: the Cartridge tab comes and goes
  const widths = useRef(new Map<ResultTab, number>())
  const [fit, setFit] = useState<number>(resultTabs.length)
  // a window grown out of the low frame has no Cartridge tab
  useEffect(() => {
    if (!short && tab === 'cartridge') setTab('results')
  }, [short, tab, setTab])
  const hasOutcome = outcome !== undefined
  // biome-ignore lint/correctness/useExhaustiveDependencies: the tabs show once there is an outcome
  useEffect(() => {
    const row = list.current
    if (!framed || !row) {
      setFit(shownTabs.length)
      return
    }
    const measure = () => {
      // a tab moved into the menu has no width: it keeps the one it was measured with
      row.querySelectorAll<HTMLElement>('[role="tab"]').forEach((t, i) => {
        if (t.offsetWidth) widths.current.set(shownTabs[i][0], t.offsetWidth)
      })
      setFit(
        resultTabsFit(
          shownTabs.map(([v]) => widths.current.get(v) ?? 0),
          row.clientWidth,
        ),
      )
    }
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [framed, hasOutcome, shownTabs])
  const moved = shownTabs.slice(fit)
  const tabList = (
    <div className="result-tabbar">
      <Tabs.List ref={list} className="result-tablist">
        {shownTabs.map(([v, label], i) => (
          // before the first run only the tab with content: the figure of a low window
          <Tabs.Tab
            key={v}
            value={v}
            data-before-run={v === 'cartridge' || undefined}
            data-moved={i >= fit || undefined}
          >
            {label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {framed && (
        // always in the row, so the tabs keep their room whether it is needed or not
        <Menu position="bottom-end" withInitialFocusPlaceholder={false}>
          <Menu.Target>
            <Button
              variant="subtle"
              size={controlSize.row.button}
              className="tabs-more"
              data-unused={moved.length === 0 || undefined}
              data-active={moved.some(([v]) => v === tab) || undefined}
              aria-hidden={moved.length === 0 || undefined}
              tabIndex={moved.length === 0 ? -1 : undefined}
              rightSection={<CaretDown size={12} aria-hidden="true" />}
            >
              More
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {moved.map(([v, label]) => (
              <Menu.Item key={v} onClick={() => choose(v)} aria-current={v === tab || undefined}>
                {label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  )

  return (
    // one element whether or not a result is shown, so the tabs and the preview keep their state;
    // a region "Result" only with a result
    <section
      aria-labelledby={ok ? 'interior-result' : undefined}
      className="result"
      data-empty={!outcome || undefined}
      data-running={pending || undefined}
    >
      <Tabs
        // before the first run a low window shows the figure, the one panel with content
        value={short && !outcome ? 'cartridge' : tab}
        onChange={(v) => choose((v ?? 'results') as ResultTab)}
        className="result-tabs workbench-results"
      >
        <div className="workbench-centre">
          {ok && (
            <h2 id="interior-result" className="visually-hidden">
              Result
            </h2>
          )}
          {/* one line: the load, the notice and the warnings with their popover in a slot of fixed
              width; the run's time and the stale mark are in the page bar's status, and the status,
              which the readouts repeat, is for screen readers */}
          <div className="run-line">
            {ok && identity && (
              // one line where the column is narrow: the whole line on hover
              <p className="load-identity" title={identity.join(' · ')}>
                <strong>{identity[0]}</strong>
                {identity.slice(1).map((t) => (
                  <span key={t}> · {t}</span>
                ))}
              </p>
            )}
            {/* the result's own line repeats the readouts: for screen readers only; an error shows */}
            <p
              role="status"
              className={echoed ? 'status visually-hidden' : 'status'}
              title={status || undefined}
            >
              {status}
            </p>
            {!online && (
              <span
                id="run-network-hint"
                className="run-hint"
                title="The interior simulation runs on the server"
              >
                Needs the network
              </span>
            )}
            <span className="notice-text screen-only">
              <NavIcon name="safety" size={14} />
              Simulation, not load data
            </span>
            <span className="warnings-slot screen-only">
              {ok && warnings && (
                <WarningsBlock
                  key={ok.id}
                  warnings={warnings}
                  summary={warningsLine(ok, warnings)}
                  announce={ok.announce}
                />
              )}
            </span>
          </div>
          {/* the results list with the chosen powder's burn rate beside it; an error in their place */}
          <div className="results-head">
            {outcome?.kind === 'error' ? (
              <div className="results-error">
                <ErrorNote title="The simulation did not run.">
                  <ErrorView outcome={outcome} />
                </ErrorNote>
              </div>
            ) : ok ? (
              <Readouts ok={ok} system={system} stale={stale} />
            ) : (
              <Checklist todo={todo} next={next} />
            )}
            {!short && <BurnFigure />}
          </div>
          {ok?.cartridgeDesign && (
            <p className="note user-design">
              Case values from the user design {ok.cartridgeDesign}, not a catalogue record.
            </p>
          )}
          {ok?.design && (
            <p className="note user-design">
              Computed with the bullet mass of the user design {ok.design}, not a catalogue record.
            </p>
          )}
          {/* the ladder bar sits directly above the tabs and drives every tab */}
          <ShownStrip />
          {tabList}
          <Tabs.Panel value="results" className="results-panel" data-stale={stale || undefined}>
            {heading('results')}
            {ok ? (
              // from 62em the chart's height is the room the column leaves (globals.css)
              <div className="plain-chart">
                <ResultChart />
              </div>
            ) : (
              notRun('the breech pressure curve')
            )}
          </Tabs.Panel>
          {short && (
            <Tabs.Panel value="cartridge" data-before-run>
              <FigureTab />
            </Tabs.Panel>
          )}
          <Tabs.Panel value="ladder" data-stale={stale || undefined}>
            {heading('ladder')}
            {/* one step: its row would repeat the readouts */}
            {!ok ? (
              notRun('the ladder table')
            ) : steps.length > 1 ? (
              <>
                {/* the table as shown, for a spreadsheet */}
                <Button
                  size={controlSize.row.button}
                  variant="default"
                  className="copy-csv"
                  onClick={(e) => {
                    const table = e.currentTarget.parentElement?.querySelector('table')
                    if (!table) return
                    const csv = toCsv(
                      [...table.querySelectorAll('tr')].map((r) =>
                        [...r.cells].map((c) => c.textContent?.trim() ?? ''),
                      ),
                    )
                    const show = (state: true | 'failed') => {
                      setCsvCopied(state)
                      setTimeout(() => setCsvCopied(false), 2000)
                    }
                    navigator.clipboard.writeText(csv).then(
                      () => show(true),
                      () => show('failed'),
                    )
                  }}
                >
                  {csvCopied === 'failed' ? 'Copy failed' : csvCopied ? 'Copied' : 'Copy as CSV'}
                </Button>
                {lot.applies && <LotPanel lot={lot} system={system} />}
                <LadderTarget labels={steps.map(stepValue)} system={system} />
                <LadderTable
                  ok={ok}
                  steps={steps}
                  system={system}
                  value={stepValue}
                  velocity={velocity}
                  lot={lot.rows}
                />
              </>
            ) : (
              later(
                'One step: the readouts give its values. Set Ladder steps in the Powder card for a table of steps.',
              )
            )}
          </Tabs.Panel>
          <Tabs.Panel value="measurements" data-stale={stale || undefined}>
            {heading('measurements')}
            {opened('measurements') && (
              <Measurements
                steps={measuredSteps(steps, ok)}
                system={system}
                sessions={chronoSessions}
                setSessions={setChronoSessions}
              />
            )}
          </Tabs.Panel>
          <Tabs.Panel value="groups">
            {heading('groups')}
            {opened('groups') && <GroupsPanel />}
          </Tabs.Panel>
          <Tabs.Panel value="trajectory">
            {heading('trajectory')}
            {opened('trajectory') && <TrajectoryPanel />}
          </Tabs.Panel>
          <Tabs.Panel value="barrel" data-stale={stale || undefined}>
            {heading('barrel')}
            {!ok
              ? notRun('the barrel length study')
              : opened('barrel') && <BarrelLength study={barrel} system={system} />}
          </Tabs.Panel>
          <Tabs.Panel value="powders" data-stale={stale || undefined}>
            {/* not in the report: no print heading either */}
            {!ok
              ? notRun('the powder comparison')
              : opened('powders') && <PowderCompare system={system} />}
          </Tabs.Panel>
          <Tabs.Panel value="notes">
            {heading('notes')}
            <Textarea
              label="Notes"
              description="Saved with the load file (File, Save). Not in copied links."
              autosize
              minRows={4}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
          </Tabs.Panel>
        </div>
      </Tabs>
    </section>
  )
})
