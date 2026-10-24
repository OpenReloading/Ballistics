'use client'

import { Button, Menu } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { spotlight } from '@mantine/spotlight'
import { bulletWindow } from '@openreloading/core'
import type { UserRecord } from '@openreloading/schema'
import { MagnifyingGlass, Play, Printer } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { InteriorResponse } from '../lib/api-types.ts'
import { summaryFitSource } from '../lib/bullet-fit.ts'
import { classifyPowder, typedBurn } from '../lib/burn-rate.ts'
import { localDay } from '../lib/dates.ts'
import { loadExample } from '../lib/example-data.ts'
import { activeClick } from '../lib/firearm.ts'
import { interiorFields } from '../lib/interior-input.ts'
import { shortName } from '../lib/load-tabs.ts'
import { sampler } from '../lib/playback.ts'
import { inputsQuery, withRecordValues, withTab } from '../lib/query.ts'
import { ladderTitle, seatingLengthName } from '../lib/seating-ladder.ts'
import { shortcutAriaKeys, shortcutLabel, shortcuts } from '../lib/shortcuts.ts'
import { startIntentEvent, takeStartIntent } from '../lib/start-intent.ts'
import { formatNumber, formatQuantity, withUnit } from '../lib/units.ts'
import { mmLength, shownLength } from '../lib/workbench.ts'
import { BarrelTable } from './barrel-length.tsx'
import { ChargeTargetDialog } from './charge-target-dialog.tsx'
import { FileMenu } from './file-menu.tsx'
import { preloadInteriorChart } from './lazy-chart.tsx'
import { LoadSheets, printSheets } from './load-sheets.tsx'
import { LoadTabs } from './load-tabs.tsx'
import { LotChartBlock, preloadLotChart } from './lot-rows.tsx'
import { PageBar } from './page-bar.tsx'
import { PrintReport } from './print-report.tsx'
import { useReportOptions } from './report-host.ts'
import { SavedLoads, useExportReminder } from './saved-loads.tsx'
import { useShortcuts } from './shortcuts.tsx'
import { useBarrelStudy } from './use-barrel-study.ts'
import { useLoadTabs } from './use-load-tabs.ts'
import { useLotRows } from './use-lot-rows.ts'
import { useManufacturerNames } from './use-manufacturer-names.ts'
import { useWorkbenchState } from './use-workbench-load.ts'
import { InputEcho, LoadContext, ResultContext, type ResultState } from './workbench-context.ts'
import { InputCards, modelFields, powderMoreFields, StartCard } from './workbench-inputs.tsx'
import {
  type ShownStep,
  selectedLabel,
  shownSteps,
  singleCharge,
  stepFlag,
  warningLines,
} from './workbench-outcome.ts'
import { RangeView } from './workbench-range.tsx'
import { LadderTable, LimitsView, Readouts } from './workbench-readouts.tsx'
import { ResultsArea } from './workbench-results.tsx'
import { WorkbenchSearch } from './workbench-search.tsx'
import { Toolbar, useCopyLink, Workspace } from './workspace.tsx'

/** Imported by the unit tests from here. */

/** The model parameters the typed burn law reads. */
const burnKeys = ['vivacity', 'exponent', 'referencePressure', 'formA', 'formM', 'formQ', 'formZ1']

/**
 * The load workbench: panels Cartridge, Bullet, Powder and Firearm
 * with the Run bar on the left; notice, warnings, readouts, the ladder strip and the result tabs in
 * the centre, the tabs after Results in an aside from 88em. The state lives in `useWorkbenchState`;
 * the cards read it through `LoadContext`, the result side through `ResultContext`.
 */
export function Workbench() {
  const load = useWorkbenchState()
  const names = useManufacturerNames()
  const tabs = useLoadTabs(load)
  const reminder = useExportReminder()
  const [listOpen, setListOpen] = useState(false)
  const [targetOpen, setTargetOpen] = useState(false)
  const { changed: countChange } = reminder
  const stored = useCallback(() => {
    load.onStored()
    countChange()
  }, [load.onStored, countChange])
  const {
    asNewLoad,
    bc,
    bullet,
    bulletDesign,
    bulletLabel,
    cartridge,
    changed,
    chartSlot,
    chartView,
    choice,
    chooseBullet,
    chooseCartridge,
    choosePowder,
    csvCopied,
    bulletFit,
    bulletParams,
    describeBullet,
    direction,
    fields,
    fileData,
    fileMenu,
    fillExample,
    firearm,
    firearms,
    framed,
    fresh,
    gunWeightUsed,
    inputs,
    ladder,
    ladderSteps,
    ladderKind,
    seatStep,
    tempStep,
    seatAt,
    measured,
    measuredFor,
    mmText,
    notes,
    chronoSeries,
    edits,
    onOpenFile,
    online,
    opened,
    outcome,
    measuredWaterCapacity,
    pending,
    pmax,
    powder,
    powderLabel,
    reset,
    run,
    seating,
    select,
    setChartView,
    setCsvCopied,
    setNotes,
    setChronoSeries,
    setPrinting,
    setSeen,
    setTab,
    showChart,
    shown,
    status,
    sight,
    specValue,
    storedTick,
    system,
    tab,
    todo,
    trajectory,
    recordLink,
    unresolved,
    dropped,
    workspace,
  } = load

  // the chart code once the cards show and the page is idle, so a result never waits for it and
  // the start card loads none of it
  useEffect(() => {
    if (fresh) return
    if (typeof requestIdleCallback === 'undefined') {
      const timer = setTimeout(preloadInteriorChart, 1000)
      return () => clearTimeout(timer)
    }
    const idle = requestIdleCallback(preloadInteriorChart, { timeout: 2000 })
    return () => cancelIdleCallback(idle)
  }, [fresh])

  const ok = outcome?.kind === 'ok' ? outcome : undefined
  const stale = Boolean(ok && changed)
  const warnings = useMemo(() => ok && warningLines(ok, system), [ok, system])
  const pressure = system.pressure

  const chargeText = ok
    ? withUnit('charge', system, ok.load.charge)
    : (shown('charge', 'charge') ?? 'no charge')
  const charge = useCallback((kg: number) => withUnit('charge', system, kg), [system])
  const length = useCallback((m: number) => withUnit('length', system, m), [system])
  /** What a ladder step varies, as the strip and the table show it: its seating, its temperature, else its charge. */
  const stepValue = useCallback(
    (s: ShownStep) =>
      s.seating
        ? length(s.seating.value)
        : s.temperature !== undefined
          ? withUnit('temperature', system, s.temperature)
          : charge(s.charge),
    [charge, length, system],
  )
  /** The load of the shown result: cartridge, bullet, mass, powder with charge. */
  const identity = useMemo(
    () =>
      ok && [
        ok.identity.cartridge ?? 'No cartridge',
        // a run sent before the record arrived names the record chosen since
        ok.identity.bullet ?? bulletLabel ?? 'no bullet record',
        withUnit('mass', system, ok.load.bullet.mass),
        `${ok.identity.powder ?? 'powder parameters typed'} ${charge(ok.load.charge)}`,
      ],
    [ok, bulletLabel, system, charge],
  )
  const velocity = useCallback(
    (r: InteriorResponse['result']) => withUnit('velocity', system, r.muzzleVelocity),
    [system],
  )
  const steps = useMemo(() => shownSteps(ok), [ok])
  // the longer run is requested once the tab was opened or a print asked for it
  const [printAsked, setPrintAsked] = useState<{ key?: string; lot?: string; edits: number }>()
  const [barrelWanted, setBarrelWanted] = useState(false)
  if (!barrelWanted && (tab === 'barrel' || printAsked)) setBarrelWanted(true)
  // a seating ladder's study is the shown step's: the longer run has one charge and one seating
  const barrel = useBarrelStudy({
    ok,
    steps: ok && singleCharge(ok) ? steps.filter((s) => s.n - 1 === ok.selected) : steps,
    system,
    enabled: barrelWanted,
  })
  // the lot rows are requested once the Ladder table was opened or a print asked for them
  const [lotWanted, setLotWanted] = useState(false)
  if (!lotWanted && (tab === 'ladder' || printAsked)) {
    setLotWanted(true)
    preloadLotChart()
  }
  const lot = useLotRows({ ok, system, enabled: lotWanted })
  // one request at a time, tied to the longer run it waits for and to the inputs it was asked at
  const printReport = useCallback(
    () => setPrintAsked((asked) => asked ?? { key: barrel.key, lot: lot.key, edits }),
    [barrel.key, lot.key, edits],
  )
  // The report is printed once the longer run has answered, with its values or its reason. A new
  // run, load, range or edit of the inputs drops the request. `print()` is called from a frame, not from this effect:
  // `flushSync` of the `beforeprint` handler does nothing inside a commit, and the print state
  // (every tab, the print-only fields) must be in the document when the browser takes its snapshot.
  useEffect(() => {
    if (!printAsked) return
    if (printAsked.key !== barrel.key || printAsked.lot !== lot.key || printAsked.edits !== edits)
      return setPrintAsked(undefined)
    if (barrel.pending || lot.pending) return
    setPrinting(true)
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        setPrintAsked(undefined)
        print()
        setPrinting(false)
      })
    })
    return () => {
      cancelAnimationFrame(frame)
      setPrinting(false)
    }
  }, [printAsked, barrel.key, barrel.pending, lot.key, lot.pending, edits, setPrinting])
  const barrelError = barrel.errors && Object.values(barrel.errors).join(' ')
  const oneFlag = ok && stepFlag(ok)
  /** The report's and the load sheets' title: cartridge, bullet and powder of the run. */
  const loadTitle = ok
    ? [ok.identity.cartridge, ok.identity.bullet, ok.identity.powder].filter(Boolean).join(', ')
    : ''
  const runSeated = ok?.printed.seated
  // a seating ladder's shown step has its own length of the one it seats by; the other is not derived
  const stepSeating = ok?.ladder.kind === 'seating' ? ok.steps[ok.selected]?.seating : undefined
  /** COAL and CBTO of the run; the one the bullet was seated by is "set", the other "derived". */
  const seatingRows = (['overallLength', 'baseToOgive'] as const).map(
    (k): [string, string | undefined] => {
      const name = seatingLengthName[k]
      if (stepSeating)
        return [
          name,
          k === (ok?.ladder.seatingBy ?? 'overallLength')
            ? `${shownLength('diameter', system, stepSeating.value)}, set`
            : undefined,
        ]
      const v = runSeated?.[k]
      const how = runSeated?.mode && (runSeated.mode === k ? ', set' : ', derived')
      // a seated bullet without a base-to-ogive prints why CBTO is missing
      if (v === undefined)
        return [name, runSeated?.mode ? 'needs the bullet base-to-ogive' : undefined]
      return [name, `${shownLength('diameter', system, v)}${how ?? ''}`]
    },
  )
  const runTemperature = ok && withUnit('temperature', system, ok.load.propellantTemperature)
  /** Volume and travel the run took from the seated bullet, which are approximate. */
  const approximate =
    ok && ok.printed.fromSeating.length > 0
      ? `${ok.printed.fromSeating.map((k) => (k === 'volume' ? 'Usable case volume' : 'Bullet travel')).join(' and ')} from the seated bullet: derived from approximate bullet and case geometry.`
      : undefined
  /** A field as the print shows it: its label and its value with the unit; none while empty. */
  const printRow = (key: string): [string, string | undefined] => {
    const spec = interiorFields.find((f) => f.key === key)
    return [spec?.label ?? key, spec && shown(key, spec.quantity)]
  }
  const printGroups: [string, [string, string | undefined][]][] = [
    [
      'Cartridge',
      [
        ['Cartridge', cartridge?.name],
        ['CIP Pmax', pmax === undefined ? undefined : withUnit('pressure', system, pmax * 1e5)],
        ['Case length, CIP L3', mmText(specValue('cartridge', 'L3'))],
        printRow('volume'),
        printRow('boreDiameter'),
        printRow('boreArea'),
        [
          'Case capacity (H₂O), measured',
          measuredFor === cartridge?.id && measured.measuredWaterCapacity.si !== undefined
            ? `${measured.measuredWaterCapacity.text} ${system.capacity.symbol}`
            : undefined,
        ],
        ...seatingRows,
        [
          'Seating depth',
          runSeated?.depth === undefined
            ? undefined
            : shownLength('diameter', system, runSeated.depth),
        ],
      ],
    ],
    [
      'Bullet',
      [
        ['Bullet', bulletLabel ?? bulletDesign?.name],
        ['Diameter', bullet && mmText(bullet.diameter.value)],
        ['Length', bullet?.length && mmText(bullet.length.value)],
        ['Ballistic coefficient', bc && `${bc.dragModel} ${bc.value}`],
        printRow('bulletMass'),
      ],
    ],
    [
      'Powder and charge',
      [
        ['Powder', powderLabel],
        printRow('charge'),
        ['Powder temperature', runTemperature],
        [
          'Ladder',
          ladderSteps > 1
            ? ladderKind === 'seating'
              ? `${ladderSteps} ${seatAt ? seatingLengthName[seatAt.lengthKind] : 'seating'} values, ${direction}, ${seatStep.seatStep.text} ${system.length.symbol} apart`
              : ladderKind === 'temperature'
                ? `${ladderSteps} powder temperatures, ${direction}, ${tempStep.tempStep.text} ${system.temperatureDifference.symbol} apart`
                : `${ladderSteps} charges, ${direction}, ${ladder.ladderStep.text} ${system.charge.symbol} apart`
            : undefined,
        ],
        ...modelFields.map(printRow),
        ...powderMoreFields.map(printRow),
      ],
    ],
    [
      'Gun and barrel',
      [
        ['Firearm', ok?.printed.firearm],
        [
          'Barrel length',
          runSeated?.barrel === undefined
            ? undefined
            : withUnit('barrelLength', system, runSeated.barrel),
        ],
        printRow('travel'),
        printRow('twist'),
        [
          'Gun weight',
          gunWeightUsed.si === undefined
            ? undefined
            : `${gunWeightUsed.text} ${system.firearmMass.symbol}`,
        ],
      ],
    ],
  ]
  /** The workbench's print view: what Ctrl+P prints, no controls. */
  // a function: the ladder table it shows is defined further down
  const report = () =>
    ok && (
      <PrintReport
        chartSlot={chartSlot}
        after={
          <>
            {steps.length > 1 && (
              <>
                <h2>{ladderTitle(ok.ladder.kind)} ladder</h2>
                {ladderTable}
                {lot.message && <p>Lot rows not computed: {lot.message}</p>}
                <LotChartBlock lot={lot} system={system} note={false} />
              </>
            )}
            <h2>Barrel length</h2>
            {barrel.base === undefined ? (
              <p>Needs a seated bullet in the cartridge figure.</p>
            ) : barrelError ? (
              <p>Not computed: {barrelError}</p>
            ) : (
              <BarrelTable study={barrel} system={system} />
            )}
            <LimitsView body={ok.body} />
            {notes && (
              <>
                <h2>Notes</h2>
                <p>{notes}</p>
              </>
            )}
          </>
        }
      >
        <h1>{loadTitle}</h1>
        <p className="report-sub">
          Printed {localDay(new Date())}.{stale && ' Inputs changed since this result.'}
          {approximate && ` ${approximate}`}
        </p>
        <div className="report-inputs">
          {printGroups.map(([title, rows]) => (
            <table key={title} className="sheet-table">
              <caption>{title}</caption>
              <tbody>
                {rows
                  .filter((r): r is [string, string] => Boolean(r[1]))
                  .map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row">{k}</th>
                      <td>{v}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ))}
        </div>
        <h2>
          Result
          {steps.length > 1 &&
            `, step ${selectedLabel(ok)}: ${stepValue(steps.find((s) => s.n - 1 === ok.selected) ?? steps[0])}`}
        </h2>
        <Readouts ok={ok} system={system} stale={false} printed />
        {warnings && warnings.length > 0 && (
          <ul>
            {warnings.map((w) => (
              <li key={w.text}>{w.text}</li>
            ))}
          </ul>
        )}
      </PrintReport>
    )
  /** The load sheets of the last run: what the run computed, as shown. */
  const sheets = ok && (
    <LoadSheets
      title={loadTitle}
      components={(
        [
          ['Cartridge', ok.identity.cartridge],
          [
            'Bullet',
            `${ok.identity.bullet ?? 'no record'}, ${withUnit('mass', system, ok.load.bullet.mass)}${ok.identity.bullet ? '' : ' typed'}`,
          ],
          ['Powder', ok.identity.powder],
          ...seatingRows,
          // a seating or temperature ladder's charge is one for all steps; the other values are those of the shown step
          ...(singleCharge(ok) ? [['Charge', charge(ok.load.charge)]] : []),
          ['Usable case volume', withUnit('capacity', system, ok.load.chamber.volume)],
          ['Bullet travel', shownLength('travel', system, ok.load.barrel.length)],
          ['Firearm', ok.printed.firearm],
          ['Powder temperature', runTemperature],
        ] as [string, string | undefined][]
      ).filter((r): r is [string, string] => Boolean(r[1]))}
      note={[stale && 'Inputs changed since this result.', approximate].filter(Boolean).join(' ')}
      by={
        ok.ladder.kind === 'seating'
          ? seatingLengthName[ok.ladder.seatingBy ?? 'overallLength']
          : undefined
      }
      steps={steps.map((s) => ({
        n: s.n,
        label: s.label,
        charge: stepValue(s),
        pressure:
          s.at &&
          `${withUnit('pressure', system, s.at.body.pressureRange.nominalPressure)} (${formatQuantity('pressure', system, s.at.body.pressureRange.lowPressure)} to ${withUnit('pressure', system, s.at.body.pressureRange.highPressure)})`,
        ofMax: s.d?.ofMax && `${formatNumber(s.d.ofMax.percent, 0)} %`,
        velocity: s.at && velocity(s.at.body.result),
        energy: s.at && withUnit('energy', system, s.at.body.result.muzzleEnergy),
        flag: s.flag,
      }))}
    />
  )
  const ladderTable = (
    <LadderTable
      ok={ok}
      steps={steps}
      system={system}
      value={stepValue}
      velocity={velocity}
      lot={lot.rows}
    />
  )

  // the result side's values, each the same object while a keystroke leaves it unchanged
  /** The chart's burn law: the powder record's fit, else the typed model parameters. */
  const typedKey = JSON.stringify(burnKeys.map((k) => fields[k]?.si ?? null))
  const burn = useMemo(() => {
    if (powder) return classifyPowder(powder, names)
    const typed = JSON.parse(typedKey) as (number | null)[]
    return typedBurn(Object.fromEntries(burnKeys.map((k, i) => [k, typed[i] ?? undefined])))
  }, [powder, names, typedKey])
  /** Where the shown run starts, peaks and leaves the barrel on the burnt-fraction axis. */
  const runMarks = useMemo(() => {
    const r = ok?.body.result
    if (!r) return
    const at = sampler(r.points)
    return [
      { z: at(r.shotStartTime).burntFraction, label: 'start' },
      { z: at(r.maxPressureTime).burntFraction, label: 'peak' },
      r.burnout ? { z: 1, label: 'burnout' } : { z: r.muzzleBurntFraction, label: 'muzzle' },
    ]
  }, [ok])
  const todoKey = JSON.stringify(todo)
  const shownTodo = useMemo(() => JSON.parse(todoKey) as typeof todo, [todoKey])
  const optic = useMemo(
    () =>
      activeClick(
        ([loadExample.firearm, ...firearms] as UserRecord[]).find((r) => r.id === firearm),
      ),
    [firearms, firearm],
  )
  const bulletDiameter = bullet && bullet.diameter.value / 1000
  // the File menu's id: set by Save and Open, which re-render the page
  const fileId = fileMenu.current?.id()
  const result = useMemo<ResultState>(
    () => ({
      ok,
      outcome,
      identity,
      stale,
      warnings: warnings || undefined,
      system,
      todo: shownTodo,
      burn,
      powder,
      powderLabel,
      runMarks,
      steps,
      oneFlag,
      stepValue,
      velocity,
      select,
      tab,
      setTab,
      setSeen,
      opened,
      csvCopied,
      setCsvCopied,
      fileId,
      storedTick,
      optic,
      bulletDiameter,
      trajectory,
      notes,
      setNotes,
      chronoSeries,
      setChronoSeries,
      barrel,
      lot,
      chartView,
      setChartView,
      showChart,
      status,
      online,
      pending,
    }),
    [
      ok,
      outcome,
      identity,
      stale,
      warnings,
      system,
      shownTodo,
      burn,
      powder,
      powderLabel,
      runMarks,
      steps,
      oneFlag,
      stepValue,
      velocity,
      select,
      tab,
      setTab,
      setSeen,
      opened,
      csvCopied,
      setCsvCopied,
      fileId,
      storedTick,
      optic,
      bulletDiameter,
      trajectory,
      notes,
      setNotes,
      chronoSeries,
      setChronoSeries,
      barrel,
      lot,
      chartView,
      setChartView,
      showChart,
      status,
      online,
      pending,
    ],
  )
  const [chargeSi, stepSi, twistSi] = [fields.charge.si, ladder.ladderStep.si, fields.twist?.si]
  const groupsLadder = useMemo(
    () =>
      ladderKind === 'charge' && ladderSteps > 1 && chargeSi !== undefined && stepSi !== undefined
        ? { charge: chargeSi, step: stepSi, steps: ladderSteps, direction }
        : undefined,
    [ladderKind, ladderSteps, chargeSi, stepSi, direction],
  )
  const [muzzleVelocity, bulletId] = [ok?.body.result.muzzleVelocity, bullet?.id]
  const [sightHeight, zeroRange] = [sight?.sightHeight, sight?.zeroRange]
  const [zeroTemperature, zeroPressure, zeroHumidity, dragFactor, dragFactorSource] = [
    sight?.zeroTemperature,
    sight?.zeroPressure,
    sight?.zeroHumidity,
    sight?.dragFactor,
    sight?.dragFactorSource,
  ]
  const trajectoryLoad = useMemo(
    () => ({
      muzzleVelocity,
      bullet: bulletId,
      twist: twistSi,
      sightHeight,
      zeroRange,
      zeroTemperature,
      zeroPressure,
      zeroHumidity,
      dragFactor,
      dragFactorSource,
    }),
    [
      muzzleVelocity,
      bulletId,
      twistSi,
      sightHeight,
      zeroRange,
      zeroTemperature,
      zeroPressure,
      zeroHumidity,
      dragFactor,
      dragFactorSource,
    ],
  )
  const echo = useMemo(
    () => ({ chargeText, groupsLadder, trajectoryLoad }),
    [chargeText, groupsLadder, trajectoryLoad],
  )

  /** The query of Copy link: the inputs, and the Trajectory tab's while it is open. */
  const linkQuery = () => {
    const query = inputsQuery(
      choice.preset,
      {
        ...(ladderSteps > 1
          ? ladderKind === 'seating'
            ? { ...fields, ladderStep: seatStep.seatStep }
            : ladderKind === 'temperature'
              ? { ...fields, ladderStep: tempStep.tempStep }
              : { ...fields, ...ladder }
          : fields),
        firearmMass: gunWeightUsed,
      },
      {
        cartridge: cartridge?.id,
        bullet: recordLink.bulletId,
        powder: recordLink.powderId,
        ladderSteps: ladderSteps > 1 ? String(ladderSteps) : undefined,
        ladderDirection: ladderSteps > 1 ? direction : undefined,
        ladderKind: ladderSteps > 1 && ladderKind !== 'charge' ? ladderKind : undefined,
        firearm,
        measuredWaterCapacity:
          measuredWaterCapacity === undefined ? undefined : String(measuredWaterCapacity),
        ...(seating && { [seating.by]: String(seating.value) }),
      },
    )
    // the records' values, for a deploy without them
    const full = withRecordValues(query, recordLink.values)
    // the open Trajectory tab travels with its inputs (`/trajectory` answers 404)
    const inputs = tab === 'trajectory' && trajectory.current?.query()
    return inputs ? withTab(full, 'trajectory', inputs) : full
  }
  // the page bar's Copy link and the search's command share one copy and its "Link copied"
  const link = useCopyLink(linkQuery)
  useReportOptions([
    {
      label: 'Include my current load',
      heading: 'Current load',
      text: () => `${window.location.origin}${window.location.pathname}#${linkQuery()}`,
    },
  ])
  // Ctrl+Enter is caught by the frame below, Ctrl+P prints the report once the barrel length study has computed
  useShortcuts({ run: null, print: ok ? printReport : null })
  const phone = useMediaQuery('(max-width: 47.99em)')
  const openList = useCallback(() => setListOpen(true), [])
  // the Open menu's Examples keep their identity, so the File menu's memo holds; they run the
  // actions of the latest render
  const starts = useRef({ asNewLoad, fillExample, reset })
  starts.current = { asNewLoad, fillExample, reset }
  // the first-run step's choice, from this page or the one that opened the workbench
  useEffect(() => {
    const start = () => {
      const intent = takeStartIntent()
      if (intent === 'example') starts.current.asNewLoad(starts.current.fillExample)()
    }
    start()
    window.addEventListener(startIntentEvent, start)
    return () => window.removeEventListener(startIntentEvent, start)
  }, [])
  const examples = useMemo(() => {
    const run = (k: 'fillExample' | 'reset') => () => starts.current.asNewLoad(starts.current[k])()
    return [
      { label: 'Example load', run: run('fillExample') },
      { label: 'Reset load', run: run('reset') },
    ]
  }, [])

  return (
    <LoadContext value={load}>
      <ResultContext value={result}>
        <InputEcho value={echo}>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: catches Ctrl+Enter from any control of the bar and the workspace */}
          <div
            className="page-frame"
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.defaultPrevented) return
              const inField =
                e.target instanceof HTMLInputElement && inputs.current?.contains(e.target)
              if (e.ctrlKey || e.metaKey || inField) {
                e.preventDefault()
                run()
              }
            }}
          >
            <PageBar
              title="Load workbench"
              compact
              // line 1 the shown result, line 2 the File menu's state (portalled after it)
              status={
                <span className="bar-result" data-stale={stale || undefined}>
                  {!ok
                    ? 'Not run'
                    : stale
                      ? 'Inputs changed since this result'
                      : `Result of ${ok.at}`}
                </span>
              }
              after={
                <>
                  <LoadTabs
                    items={tabs.items}
                    label={shortName({
                      custom: load.customName,
                      cartridge: cartridge?.name,
                      powder: powder?.name ?? powderLabel,
                      generated: load.name,
                    })}
                    onSwitch={tabs.switchTo}
                    onClose={tabs.close}
                    onNew={tabs.newTab}
                    onList={openList}
                    due={reminder.text !== undefined}
                    name={load.name}
                    generated={tabs.generated}
                    onRename={tabs.rename}
                  />
                  {/* the page's main action beside the loads; below 75em the form's Run bar holds it */}
                  <Button
                    className="bar-run"
                    aria-label="Run simulation"
                    aria-keyshortcuts={shortcutAriaKeys('run')}
                    aria-describedby={online ? undefined : 'run-network-hint'}
                    loading={pending}
                    loaderProps={{ type: 'dots' }}
                    leftSection={<Play size={14} weight="fill" aria-hidden="true" />}
                    title={`Run simulation (${shortcutLabel('run')})`}
                    onClick={() => run()}
                  >
                    Run
                  </Button>
                </>
              }
              actions={
                <>
                  <Toolbar
                    link={link}
                    search={
                      <Button
                        variant="default"
                        className="bar-icon"
                        leftSection={<MagnifyingGlass size={18} aria-hidden="true" />}
                        onClick={() => spotlight.open()}
                        aria-keyshortcuts={shortcutAriaKeys('search')}
                        title={framed ? `Search (${shortcutLabel('search')})` : undefined}
                      >
                        Search
                      </Button>
                    }
                    file={
                      <FileMenu
                        ref={fileMenu}
                        kind="workbenchState"
                        name={load.name}
                        nameKey={load.customName?.trim() ? load.customName : ''}
                        data={fileData}
                        onOpen={onOpenFile}
                        onStored={stored}
                        onExported={reminder.exported}
                        onUnsaved={tabs.setUnsaved}
                        onList={openList}
                        examples={examples}
                        note={
                          [
                            unresolved.length &&
                              `Not loaded, kept in the file: ${unresolved.join(', ')}.`,
                            dropped.length && `Not a record id, left out: ${dropped.join(', ')}.`,
                          ]
                            .filter(Boolean)
                            .join(' ') || undefined
                        }
                      />
                    }
                    after={
                      <>
                        <Menu position="bottom-end">
                          <Menu.Target>
                            <Button
                              variant="default"
                              className="bar-icon"
                              title="Print"
                              leftSection={<Printer size={18} aria-hidden="true" />}
                            >
                              Print
                            </Button>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item disabled={!ok} onClick={printReport}>
                              Workbench report (also {shortcutLabel('print')})
                            </Menu.Item>
                            <Menu.Item disabled={!ok} onClick={() => printSheets(false)}>
                              Load sheet: one page
                            </Menu.Item>
                            <Menu.Item disabled={!ok} onClick={() => printSheets(true)}>
                              Load sheet and a page per charge
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                        {sheets}
                        {report()}
                      </>
                    }
                  />
                </>
              }
            />
            <Workspace
              ref={workspace}
              className="workbench"
              inputsLabel="Load"
              inputs={fresh ? <StartCard /> : <InputCards />}
              results={<ResultsArea />}
              range={<RangeView />}
              bar={(show) => (
                <>
                  {/* the result's state, then the readouts that change with a run */}
                  <span className="bar-state">
                    <span className="bar-result" data-stale={stale || undefined}>
                      {!ok
                        ? 'Not run'
                        : stale
                          ? 'Inputs changed, result is old'
                          : `Result ${ok.at}`}
                    </span>
                    {ok && (
                      <span className="bar-values">
                        {`${formatQuantity('pressure', system, ok.body.pressureRange.nominalPressure)} ${pressure.symbol}, ${withUnit('velocity', system, ok.body.result.muzzleVelocity)}`}
                      </span>
                    )}
                  </span>
                  <Button
                    className="bar-run-phone"
                    aria-label="Run simulation"
                    aria-describedby={online ? undefined : 'run-network-hint'}
                    loading={pending}
                    loaderProps={{ type: 'dots' }}
                    leftSection={<Play size={14} weight="fill" aria-hidden="true" />}
                    onClick={() => {
                      if (run()) show()
                    }}
                  >
                    Run
                  </Button>
                </>
              )}
            />
            <SavedLoads
              opened={listOpen}
              onClose={() => setListOpen(false)}
              tick={storedTick}
              openIds={tabs.openIds}
              onOpen={tabs.openRecord}
              onDeleted={tabs.deleted}
              onRenamed={tabs.renamed}
              onStored={stored}
              reminder={reminder.text}
            />
            <ChargeTargetDialog opened={targetOpen} onClose={() => setTargetOpen(false)} />
            <WorkbenchSearch
              onRun={() => run()}
              // the page bar's actions with the shortcuts that exist
              commands={[
                { label: 'Run simulation', run: () => run(), keys: shortcutLabel('run') },
                {
                  label: shortcuts.save.action,
                  run: () => fileMenu.current?.save(),
                  keys: shortcutLabel('save'),
                },
                {
                  label: shortcuts.open.action,
                  run: () => fileMenu.current?.openFile(),
                  keys: shortcutLabel('open'),
                },
                ...(ok
                  ? [
                      {
                        label: shortcuts.print.action,
                        run: printReport,
                        keys: shortcutLabel('print'),
                      },
                    ]
                  : []),
                // the Range tab exists below 48em only
                ...(phone
                  ? [{ label: 'Range tab', run: () => workspace.current?.showRange() }]
                  : []),
                { label: 'Charge for a target', run: () => setTargetOpen(true) },
                { label: 'Saved loads', run: openList },
                { label: 'Copy link', run: link.copy },
                { label: 'Example load', run: asNewLoad(fillExample) },
                { label: 'Reset load', run: asNewLoad(reset) },
              ]}
              onCartridge={(c) =>
                chooseCartridge({
                  id: c.id,
                  name: c.name,
                  ...summaryFitSource(c),
                })
              }
              onBullet={(b) => chooseBullet(b.id)}
              onPowder={(p) => choosePowder(p.id)}
              describeBullet={describeBullet}
              bulletParams={bulletParams}
              bulletsLabel={
                bulletFit === undefined
                  ? 'Bullets, all diameters'
                  : `Bullets over ${mmLength(system, bulletWindow(bulletFit).above)}, up to ${mmLength(system, bulletFit.g1)} (CIP of ${cartridge?.name})`
              }
            />
          </div>
        </InputEcho>
      </ResultContext>
    </LoadContext>
  )
}
