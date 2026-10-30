'use client'

import { Button, Menu, Tabs, Textarea } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { CaretDown } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { memo, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { canonicalNumberText } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { vivacityUnit } from '../lib/burn-rate.ts'
import { toCsv } from '../lib/csv.ts'
import { controlSize } from '../lib/theme.ts'
import type { UnitSystem } from '../lib/units.ts'
import { resultTabsFit } from '../lib/workbench.ts'
import { BarrelLength } from './barrel-length.tsx'
import { LadderTarget } from './ladder-target.tsx'
import { LazyInteriorChart } from './lazy-chart.tsx'
import { LoadLots, SessionNotes } from './load-notes.tsx'
import { LotPanel } from './lot-rows.tsx'
import { NavIcon } from './nav-icons.tsx'
import { chartCopy } from './print-report.tsx'
import { ResultNotes } from './result-notes.tsx'
import { ErrorNote, Loading } from './states.tsx'
import { useInputEcho, useResult } from './workbench-context.ts'
import { FigureTab } from './workbench-figure.tsx'
import { Checklist, shortFrame } from './workbench-inputs.tsx'
import {
  type Outcome,
  resultLine,
  type ShownStep,
  singleCharge,
  stripFigureOf,
} from './workbench-outcome.ts'
import { BurnRate, ErrorView, LadderStrip, LadderTable, Readouts } from './workbench-readouts.tsx'

export const Measurements = dynamic(
  () => import('./measurements.tsx').then((m) => m.Measurements),
  {
    ssr: false,
    loading: () => <Loading what="the measurements" inline />,
  },
)

const PowderCompare = dynamic(() => import('./powder-compare.tsx').then((m) => m.PowderCompare), {
  ssr: false,
  loading: () => <Loading what="the powder comparison" inline />,
})

const TrajectoryForm = dynamic(
  () => import('./trajectory-form.tsx').then((m) => m.TrajectoryForm),
  {
    ssr: false,
    loading: () => <Loading what="the trajectory" inline />,
  },
)

const GroupsTab = dynamic(() => import('./groups-tab.tsx').then((m) => m.GroupsTab), {
  ssr: false,
  loading: () => <Loading what="the shot groups" inline />,
})

/** The result tabs; Cartridge only in a low desktop window (`shortFrame`), where the figure leaves the inputs. */
export const resultTabs = [
  ['results', msg('Chart')],
  ['cartridge', msg('Cartridge')],
  ['ladder', msg('Ladder table')],
  ['trajectory', msg('Trajectory')],
  ['measurements', msg('Measurements')],
  ['groups', msg('Groups')],
  ['notes', msg('Notes')],
  ['barrel', msg('Barrel length')],
  ['powders', msg('Powders')],
] as const
export type ResultTab = (typeof resultTabs)[number][0]

const notRun = (text: Message, t: Translator['t']) => (
  <p className="prompt empty-state">{t(text)}</p>
)
const heading = (v: ResultTab, t: Translator['t']) => {
  const label = resultTabs.find(([k]) => k === v)?.[1]
  return <h2 className="print-only">{label && t(label)}</h2>
}

/**
 * The chosen powder's burn rate: beside the readouts, and in the inputs' second column of a low
 * desktop window (`shortFrame`), where its chart is taller.
 */
export function BurnFigure() {
  const { t } = useTranslation()
  const { burn, powder, powderLabel, runMarks } = useResult()
  const short = useMediaQuery(shortFrame, false) ?? false
  return (
    burn && (
      <section aria-labelledby="burn-rate-title" className="burn-figure">
        <h3
          id="burn-rate-title"
          title={
            powderLabel
              ? t('Dynamic vivacity of {label}', { label: powderLabel })
              : t('Dynamic vivacity of the typed model parameters')
          }
        >
          {t('Burn rate, {unit}', { unit: vivacityUnit })}
          <span className="visually-hidden">
            {' '}
            {powderLabel
              ? t('of {label}', { label: powderLabel })
              : t('of the typed model parameters')}
          </span>
        </h3>
        <BurnRate p={burn} powderId={powder?.id} marks={runMarks} height={short ? 140 : 104} />
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
export function ShownStrip({ name }: { name?: string | undefined } = {}) {
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

type ChecklistItems = ReturnType<typeof useResult>['todo']

type ShownTabs = (typeof resultTabs)[number][]

/** The tab row; from 62em the tabs that do not fit go into the More menu, which stays in the row. */
function ResultTabBar({
  shownTabs,
  fit,
  framed,
  tab,
  choose,
  listRef,
}: {
  shownTabs: ShownTabs
  fit: number
  framed: boolean | undefined
  tab: ResultTab
  choose: (v: ResultTab) => void
  listRef: RefObject<HTMLDivElement | null>
}) {
  const { t } = useTranslation()
  const moved = shownTabs.slice(fit)
  return (
    <div className="result-tabbar">
      <Tabs.List ref={listRef} className="result-tablist">
        {shownTabs.map(([v, label], i) => (
          // before the first run only the tab with content: the figure of a low window
          <Tabs.Tab
            key={v}
            value={v}
            data-before-run={v === 'cartridge' || undefined}
            data-moved={i >= fit || undefined}
          >
            {t(label)}
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
              {t('More')}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {moved.map(([v, label]) => (
              <Menu.Item key={v} onClick={() => choose(v)} aria-current={v === tab || undefined}>
                {t(label)}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  )
}

/** Copies the ladder table as shown, for a spreadsheet. */
function CopyCsvButton({
  csvCopied,
  setCsvCopied,
}: {
  csvCopied: boolean | 'failed'
  setCsvCopied: (copied: boolean | 'failed') => void
}) {
  const { t } = useTranslation()
  return (
    <Button
      size={controlSize.row.button}
      variant="default"
      className="copy-csv"
      onClick={(e) => {
        const table = e.currentTarget.parentElement?.querySelector('table')
        if (!table) return
        // a file or a spreadsheet gets the point, whatever the language shown
        const csv = toCsv(
          [...table.querySelectorAll('tr')].map((r) =>
            [...r.cells].map((c) => canonicalNumberText(c.textContent?.trim() ?? '')),
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
      {csvCopied === 'failed' ? t('Copy failed') : csvCopied ? t('Copied') : t('Copy as CSV')}
    </Button>
  )
}

/** One line: the load and the notice. */
function RunLine({
  ok,
  identity,
  status,
  echoed,
}: {
  ok: Extract<Outcome, { kind: 'ok' }> | undefined
  identity: string[] | undefined
  status: string
  echoed: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="run-line">
      {ok && identity && (
        // one line where the column is narrow: the whole line on hover
        <p className="load-identity" title={identity.join(' · ')}>
          <strong>{identity[0]}</strong>
          {identity.slice(1).map((part) => (
            <span key={part}> · {part}</span>
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
      <span className="notice-text screen-only">
        <NavIcon name="safety" size={14} />
        {t('Simulation, not load data')}
      </span>
    </div>
  )
}

/** Which tabs show and how many fit their row; the rest go into the More menu from 62em. */
function useTabFit(tab: ResultTab, setTab: (tab: ResultTab) => void, hasOutcome: boolean) {
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
        const tab = shownTabs[i]
        if (tab && t.offsetWidth) widths.current.set(tab[0], t.offsetWidth)
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
  return { framed, short, list, shownTabs, fit }
}

/** The results list with the chosen powder's burn rate beside it; an error in their place. */
function ResultsHead({
  outcome,
  ok,
  system,
  stale,
  todo,
  next,
  short,
}: {
  outcome: Outcome | undefined
  ok: Extract<Outcome, { kind: 'ok' }> | undefined
  system: UnitSystem
  stale: boolean
  todo: ChecklistItems
  next: number
  short: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="results-head">
      {outcome?.kind === 'error' ? (
        <div className="results-error">
          <ErrorNote title={t('The simulation did not run.')}>
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
  )
}

/** The ladder table tab's content: the table with its CSV copy, lot rows and target. */
function LadderBody() {
  const { t } = useTranslation()
  const { ok, steps, stepValue, velocity, csvCopied, setCsvCopied, lot, system } = useResult()
  return (
    <>
      {/* one step: its row would repeat the readouts */}
      {!ok ? (
        notRun(msg('Run the simulation to see the ladder table.'), t)
      ) : steps.length > 1 ? (
        <>
          <CopyCsvButton csvCopied={csvCopied} setCsvCopied={setCsvCopied} />
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
        <p className="prompt empty-state">
          {t('Set Ladder steps in the Powder card for a table of steps.')}
        </p>
      )}
    </>
  )
}

/** The panels of the result tabs. */
function ResultPanels({ short }: { short: boolean }) {
  const { t } = useTranslation()
  const {
    ok,
    stale,
    steps,
    opened,
    notes,
    setNotes,
    chronoSessions,
    setChronoSessions,
    barrel,
    system,
  } = useResult()
  return (
    <>
      <Tabs.Panel value="results" className="results-panel" data-stale={stale || undefined}>
        {heading('results', t)}
        {ok ? (
          // from 62em the chart's height is the room the column leaves (globals.css)
          <div className="plain-chart">
            <ResultChart />
          </div>
        ) : (
          notRun(msg('Run the simulation to see the breech pressure curve.'), t)
        )}
      </Tabs.Panel>
      {short && (
        <Tabs.Panel value="cartridge" data-before-run>
          <FigureTab />
        </Tabs.Panel>
      )}
      <Tabs.Panel value="ladder" data-stale={stale || undefined}>
        {heading('ladder', t)}
        <LadderBody />
      </Tabs.Panel>
      <Tabs.Panel value="measurements" data-stale={stale || undefined}>
        {heading('measurements', t)}
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
        {heading('groups', t)}
        {opened('groups') && <GroupsPanel />}
      </Tabs.Panel>
      <Tabs.Panel value="trajectory">
        {heading('trajectory', t)}
        {opened('trajectory') && <TrajectoryPanel />}
      </Tabs.Panel>
      <Tabs.Panel value="barrel" data-stale={stale || undefined}>
        {heading('barrel', t)}
        {!ok
          ? notRun(msg('Run the simulation to see the barrel length study.'), t)
          : opened('barrel') && <BarrelLength study={barrel} system={system} />}
      </Tabs.Panel>
      <Tabs.Panel value="powders" data-stale={stale || undefined}>
        {/* not in the report: no print heading either */}
        {!ok
          ? notRun(msg('Run the simulation to see the powder comparison.'), t)
          : opened('powders') && <PowderCompare system={system} />}
      </Tabs.Panel>
      <Tabs.Panel value="notes">
        {heading('notes', t)}
        <LoadLots />
        <SessionNotes />
        <Textarea
          label={t('Notes')}
          description={t('Saved with the load file (File, Save). Not in copied links.')}
          autosize
          minRows={4}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />
      </Tabs.Panel>
    </>
  )
}

/**
 * The results area: the load line, the notice, an error, the readouts or the checklist with the
 * burn rate, the warnings, the ladder strip and the result tabs. It reads the result context only,
 * so a keystroke in the inputs does not render it again.
 */
export const ResultsArea = memo(function ResultsArea() {
  const { ok, outcome, identity, stale, system, todo, tab, setTab, setSeen, status, pending } =
    useResult()
  const { t } = useTranslation()
  const next = todo.findIndex((s) => !s.done)
  const echoed =
    ok !== undefined &&
    (status.startsWith(t('Simulation done. ')) || status === resultLine(ok, system, t))
  const choose = (v: ResultTab) => {
    setTab(v)
    setSeen((s) => (s.has(v) ? s : new Set([...s, v])))
  }
  const { framed, short, list, shownTabs, fit } = useTabFit(tab, setTab, outcome !== undefined)
  const tabList = (
    <ResultTabBar
      shownTabs={shownTabs}
      fit={fit}
      framed={framed}
      tab={tab}
      choose={choose}
      listRef={list}
    />
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
              {t('Result')}
            </h2>
          )}
          {/* one line: the load and the notice; the run's time and the stale mark are in the page
              bar's status, and the status, which the readouts repeat, is for screen readers */}
          <RunLine ok={ok} identity={identity} status={status} echoed={echoed} />
          {/* the results list with the chosen powder's burn rate beside it; an error in their place */}
          <ResultsHead
            outcome={outcome}
            ok={ok}
            system={system}
            stale={stale}
            todo={todo}
            next={next}
            short={short}
          />
          {ok && <ResultNotes ok={ok} />}
          {/* the ladder bar sits directly above the tabs and drives every tab */}
          <ShownStrip />
          {tabList}
          <ResultPanels short={short} />
        </div>
      </Tabs>
    </section>
  )
})
