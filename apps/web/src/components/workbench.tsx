'use client'

import { Button, Menu } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { spotlight } from '@mantine/spotlight'
import { bulletWindow } from '@open-reloading/core'
import { toSi, type UserRecord } from '@open-reloading/schema'
import { MagnifyingGlass, Play, Printer } from '@phosphor-icons/react'
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber, localizeNumber, plainNumber } from '../i18n/number.ts'
import { msg, type Translator } from '../i18n/translate.ts'
import type { InteriorResponse } from '../lib/api-types.ts'
import { summaryFitSource } from '../lib/bullet-fit.ts'
import { classifyPowder, typedBurn } from '../lib/burn-rate.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { localDay } from '../lib/dates.ts'
import { loadExample } from '../lib/example-data.ts'
import { siValues, specText } from '../lib/field-spec.ts'
import { activeClick } from '../lib/firearm.ts'
import { interiorFields } from '../lib/interior-input.ts'
import { shortName } from '../lib/load-tabs.ts'
import { sampler } from '../lib/playback.ts'
import { powderDesignNote } from '../lib/powder-designer.ts'
import { loadFitMark } from '../lib/powder-record.ts'
import { printedField, printedValue } from '../lib/print-format.ts'
import type { PrintChoice } from '../lib/print-sections.ts'
import { inputsQuery, withRecordValues, withTab } from '../lib/query.ts'
import { seatingLengthName } from '../lib/seating-ladder.ts'
import { shortcutAriaKeys, shortcutLabel, shortcuts } from '../lib/shortcuts.ts'
import { userBulletRows, userRecordId } from '../lib/sources.ts'
import { formatQuantity, mmLength, shownLength, type UnitSystem, withUnit } from '../lib/units.ts'
import { BarrelTable } from './barrel-length.tsx'
import type { ChargeTargetDialog } from './charge-target-dialog.tsx'
import { FileMenu } from './file-menu.tsx'
import { focusBack } from './focus-back.ts'
import { preloadInteriorChart } from './lazy-chart.tsx'
import { LoadSheets, printSheets } from './load-sheets.tsx'
import { LoadTabs } from './load-tabs.tsx'
import { LotChartBlock, preloadLotChart } from './lot-rows.tsx'
import { PageBar } from './page-bar.tsx'
import { PrintReport } from './print-report.tsx'
import { PrintSectionItems, usePrintChoice } from './print-sections.tsx'
import { useReportOptions } from './report-host.ts'
import { SavedLoads, useExportReminder } from './saved-loads.tsx'
import type { ScanLabelDialog } from './scan-label-dialog.tsx'
import { useShortcuts } from './shortcuts.tsx'
import { TourButton } from './tour-button.tsx'
import { useBarrelStudy } from './use-barrel-study.ts'
import { useLoadTabs } from './use-load-tabs.ts'
import { useLotRows } from './use-lot-rows.ts'
import { useManufacturerNames } from './use-manufacturer-names.ts'
import { useWorkbenchState } from './use-workbench-load.ts'
import { InputEcho, LoadContext, ResultContext, type ResultState } from './workbench-context.ts'
import {
  emptyStep,
  InputCards,
  modelFields,
  powderMoreFields,
  StartCard,
} from './workbench-inputs.tsx'
import {
  type Outcome,
  type ShownStep,
  selectedLabel,
  shownSteps,
  singleCharge,
  stepFlag,
  volumeNoteText,
  warningLines,
} from './workbench-outcome.ts'
import { RangeView } from './workbench-range.tsx'
import { LadderTable, LimitsView, ladderName, Readouts } from './workbench-readouts.tsx'
import { ResultsArea } from './workbench-results.tsx'
import { WorkbenchSearch } from './workbench-search.tsx'
import { Toolbar, useCopyLink, Workspace } from './workspace.tsx'

/** Imported by the unit tests from here. */

/** The model parameters the typed burn law reads. */
const burnKeys = ['vivacity', 'exponent', 'referencePressure', 'formA', 'formM', 'formQ', 'formZ1']

type OkOutcome = Extract<Outcome, { kind: 'ok' }>
type Load = ReturnType<typeof useWorkbenchState>
type PrintRows = [string, string | undefined][]

type Translate = Translator['t']

/** COAL or CBTO of the run; the one the bullet was seated by is "set", the other "derived". */
function seatingRow(
  k: 'overallLength' | 'baseToOgive',
  ok: OkOutcome | undefined,
  system: UnitSystem,
  t: Translate,
): [string, string | undefined] {
  const name = seatingLengthName[k]
  const runSeated = ok?.printed.seated
  // a seating ladder's shown step has its own length of the one it seats by; the other is not derived
  const stepSeating = ok?.ladder.kind === 'seating' ? ok.steps[ok.selected]?.seating : undefined
  if (stepSeating)
    return [
      name,
      k === (ok?.ladder.seatingBy ?? 'overallLength')
        ? t('{value}, set', { value: printedValue('length', system, stepSeating.value) })
        : undefined,
    ]
  const v = runSeated?.[k]
  // a seated bullet without a base-to-ogive prints why CBTO is missing
  if (v === undefined)
    return [name, runSeated?.mode ? t('needs the bullet base-to-ogive') : undefined]
  const value = printedValue('length', system, v)
  if (!runSeated?.mode) return [name, value]
  return [
    name,
    runSeated.mode === k ? t('{value}, set', { value }) : t('{value}, derived', { value }),
  ]
}

/** COAL and CBTO of the run. */
const seatingRowsOf = (ok: OkOutcome | undefined, system: UnitSystem, t: Translate) =>
  (['overallLength', 'baseToOgive'] as const).map((k) => seatingRow(k, ok, system, t))

/** Volume and travel the run took from the seated bullet, which are approximate. */
function approximateNote(ok: OkOutcome | undefined, t: Translate) {
  if (!ok || ok.printed.fromSeating.length === 0) return
  const [first, second] = ok.printed.fromSeating
  if (second)
    return t(
      'Usable case volume and bullet travel from the seated bullet: derived from approximate bullet and case geometry.',
    )
  return first === 'volume'
    ? t(
        'Usable case volume from the seated bullet: derived from approximate bullet and case geometry.',
      )
    : t('Bullet travel from the seated bullet: derived from approximate bullet and case geometry.')
}

/** A field as the print shows it: its label and its value with the unit; none while empty. */
function printRow(load: Load, key: string, t: Translate): [string, string | undefined] {
  const spec = interiorFields.find((f) => f.key === key)
  return [
    spec ? specText(t, spec.label) : key,
    spec && printedField(spec.quantity, load.system, load.fields[key]),
  ]
}

function cartridgePrintRows(
  load: Load,
  ok: OkOutcome | undefined,
  seatingRows: PrintRows,
  t: Translate,
) {
  const { system, cartridge, cartridgeDesign, pmax, siLength, specs } = load
  const { measuredFor, measured, typedSpecFields } = load
  const depth = ok?.printed.seated?.depth
  return [
    [
      t('Cartridge'),
      cartridge?.name ??
        (cartridgeDesign && t('{name} (user design)', { name: cartridgeDesign.name })),
    ],
    [
      typedSpecFields.pmax?.si ? t('Pmax, typed') : t('CIP Pmax'),
      pmax === undefined ? undefined : withUnit('pressure', system, toSi('pressure', pmax)),
    ],
    [
      typedSpecFields.caseLength?.si ? t('Case length L3, typed') : t('Case length, CIP L3'),
      siLength(specs.caseLength),
    ],
    printRow(load, 'volume', t),
    printRow(load, 'boreDiameter', t),
    printRow(load, 'boreArea', t),
    [
      t('Case capacity (H₂O), measured'),
      measuredFor === cartridge?.id && measured.measuredWaterCapacity?.si !== undefined
        ? `${localizeNumber(measured.measuredWaterCapacity.text)} ${system.capacity.symbol}`
        : undefined,
    ],
    ...seatingRows,
    [t('Seating depth'), depth === undefined ? undefined : printedValue('length', system, depth)],
  ] as PrintRows
}

function bulletPrintRows(load: Load, t: Translate): PrintRows {
  const { bulletLabel, bulletDesign, bulletValues, bc, system } = load
  const length = (si: number | undefined) =>
    si === undefined ? undefined : printedValue('length', system, si)
  return [
    [t('Bullet'), bulletLabel ?? bulletDesign?.name],
    [t('Diameter'), length(bulletValues.bulletDiameter)],
    [t('Length'), length(bulletValues.bulletLength)],
    [t('Ballistic coefficient'), bc && `${bc.dragModel} ${plainNumber(bc.value)}`],
    printRow(load, 'bulletMass', t),
  ]
}

/** What a ladder's direction is called in the print's sentence about it. */
const directionWords = {
  up: msg('upward'),
  down: msg('downward'),
  around: msg('around the main charge'),
} as const

/** The ladder as the print words it: its kind, steps, direction and step size. */
function ladderPrintText(load: Load, t: Translate) {
  const { ladderSteps, ladderKind, seatAt, direction, seatStep, tempStep, ladder, system } = load
  if (ladderSteps <= 1) return
  const kind = {
    seating: { step: seatStep.seatStep?.text, unit: system.length.symbol },
    temperature: { step: tempStep.tempStep?.text, unit: system.temperatureDifference.symbol },
    charge: { step: ladder.ladderStep?.text, unit: system.charge.symbol },
  }[ladderKind === 'seating' || ladderKind === 'temperature' ? ladderKind : 'charge']
  if (!kind.step) return
  const values = {
    count: ladderSteps,
    direction: t(directionWords[direction]),
    step: localizeNumber(kind.step),
    unit: kind.unit,
  }
  if (ladderKind === 'seating')
    return t('{count} {name} values, {direction}, {step} {unit} apart', {
      ...values,
      name: seatAt ? seatingLengthName[seatAt.lengthKind] : t('seating'),
    })
  if (ladderKind === 'temperature')
    return t('{count} powder temperatures, {direction}, {step} {unit} apart', values)
  return t('{count} charges, {direction}, {step} {unit} apart', values)
}

function powderPrintRows(
  load: Load,
  runTemperature: string | undefined,
  { t, tn }: Pick<Translator, 't' | 'tn'>,
): PrintRows {
  const { powderDesign, origin, fields, system } = load
  const mark = loadFitMark(powderDesign, origin, siValues(fields), system, (day) => day, { t, tn })
  const name = load.powderLabel ?? ''
  return [
    [
      t('Powder'),
      powderDesign
        ? mark
          ? t('{name} (user design), {mark}', { name, mark })
          : t('{name} (user design)', { name })
        : load.powderLabel,
    ],
    printRow(load, 'charge', t),
    [t('Powder temperature'), runTemperature],
    [t('Ladder'), ladderPrintText(load, t)],
    ...modelFields.map((k) => printRow(load, k, t)),
    ...powderMoreFields.map((k) => printRow(load, k, t)),
  ]
}

function gunPrintRows(load: Load, ok: OkOutcome | undefined, t: Translate): PrintRows {
  const { system, gunWeightUsed } = load
  const barrel = ok?.printed.seated?.barrel
  return [
    [t('Firearm'), ok?.printed.firearm],
    [
      t('Barrel length'),
      barrel === undefined ? undefined : withUnit('barrelLength', system, barrel),
    ],
    printRow(load, 'travel', t),
    printRow(load, 'twist', t),
    [
      t('Gun weight'),
      gunWeightUsed.si === undefined
        ? undefined
        : `${localizeNumber(gunWeightUsed.text)} ${system.firearmMass.symbol}`,
    ],
  ]
}

/** The inputs of the print, in groups of rows. */
function printGroupsOf(
  load: Load,
  ok: OkOutcome | undefined,
  seatingRows: PrintRows,
  runTemperature: string | undefined,
  { t, tn }: Pick<Translator, 't' | 'tn'>,
): [string, PrintRows][] {
  return [
    [t('Cartridge'), cartridgePrintRows(load, ok, seatingRows, t)],
    [t('Bullet'), bulletPrintRows(load, t)],
    [t('Powder and charge'), powderPrintRows(load, runTemperature, { t, tn })],
    [t('Gun and barrel'), gunPrintRows(load, ok, t)],
  ]
}

type ReportProps = {
  ok: OkOutcome
  chartSlot: Load['chartSlot']
  steps: ShownStep[]
  ladderTable: ReactNode
  lot: ReturnType<typeof useLotRows>
  barrel: ReturnType<typeof useBarrelStudy>
  barrelError: string | undefined
  notes: string
  system: UnitSystem
  loadTitle: string
  stale: boolean
  fromDesign: string | undefined
  approximate: string | undefined
  printGroups: [string, PrintRows][]
  stepValue: (s: ShownStep) => string
  warnings: ReturnType<typeof warningLines> | undefined
  /** The sections the reader chose to print (the chart: `usePrintChoice`'s print rule). */
  sections: PrintChoice
  t: Translate
}

/** What follows the report's readouts: the ladder, the barrel length study, the limits and the notes. */
function ReportAfter({
  ok,
  steps,
  ladderTable,
  lot,
  barrel,
  barrelError,
  notes,
  system,
  sections,
  t,
}: ReportProps) {
  const study =
    barrel.base === undefined ? (
      <p>{t('Needs a seated bullet in the cartridge figure.')}</p>
    ) : barrelError ? (
      <p>{t('Not computed: {reason}', { reason: barrelError })}</p>
    ) : (
      <BarrelTable study={barrel} system={system} />
    )
  return (
    <>
      {steps.length > 1 && sections.ladder && (
        <>
          <h2>{ladderName(ok, t)}</h2>
          {ladderTable}
          {lot.message && (
            <p>{t('Lot rows failed: {message}', { message: translateMessage(lot.message, t) })}</p>
          )}
          <LotChartBlock lot={lot} system={system} note={false} />
        </>
      )}
      {sections.barrel && (
        <>
          <h2>{t('Barrel length')}</h2>
          {study}
        </>
      )}
      {sections.limits && <LimitsView body={ok.body} printed />}
      {notes && sections.notes && (
        <>
          <h2>{t('Notes')}</h2>
          <p>{notes}</p>
        </>
      )}
    </>
  )
}

/** The print's result title of the main step: its charge, or the seating or temperature a ladder of those varies. */
const mainResultTitle = (ok: OkOutcome, value: string, t: Translate) =>
  singleCharge(ok)
    ? t('Result, {value}', { value: t('{label} main', { label: value }) })
    : t('Result, main charge: {value}', { value })

/** The workbench's print view: the load, its inputs, the result, the warnings and what follows. */
function Report(props: ReportProps) {
  const { ok, chartSlot, steps, loadTitle, stale, fromDesign, approximate, printGroups } = props
  const { stepValue, warnings, system, sections, t } = props
  const shownStep = steps.find((s) => s.n - 1 === ok.selected) ?? steps[0]
  return (
    <PrintReport chartSlot={chartSlot} after={<ReportAfter {...props} />}>
      <h1>{loadTitle}</h1>
      <p className="report-sub">
        {`${t('Printed {date}', { date: localDay(new Date()) })}.`}
        {stale && ` ${t('Inputs changed since this result.')}`}
        {fromDesign && ` ${fromDesign}`}
        {approximate && ` ${approximate}`}
      </p>
      <div className="report-inputs" hidden={!sections.inputs}>
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
        {steps.length > 1 && shownStep
          ? selectedLabel(ok) === '0'
            ? mainResultTitle(ok, stepValue(shownStep), t)
            : t('Result, step {step}: {value}', {
                step: selectedLabel(ok),
                value: stepValue(shownStep),
              })
          : t('Result')}
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
}

/** The components of a load sheet: what the run was made of, as shown; empty ones left out. */
function sheetComponents(
  ok: OkOutcome,
  system: UnitSystem,
  seatingRows: PrintRows,
  runTemperature: string | undefined,
  charge: (kg: number) => string,
  t: Translate,
) {
  const mass = withUnit('mass', system, ok.load.bullet.mass)
  return (
    [
      [t('Cartridge'), ok.identity.cartridge],
      [
        t('Bullet'),
        ok.identity.bullet
          ? t('{name}, {mass}', { name: ok.identity.bullet, mass })
          : t('no record, {mass} typed', { mass }),
      ],
      [t('Powder'), ok.identity.powder],
      ...seatingRows,
      // a seating or temperature ladder's charge is one for all steps; the other values are those of the shown step
      ...(singleCharge(ok) ? [[t('Charge'), charge(ok.load.charge)]] : []),
      [t('Usable case volume'), withUnit('capacity', system, ok.load.chamber.volume)],
      [t('Bullet travel'), shownLength('travel', system, ok.load.barrel.length)],
      [t('Firearm'), ok.printed.firearm],
      [t('Powder temperature'), runTemperature],
    ] as PrintRows
  ).filter((r): r is [string, string] => Boolean(r[1]))
}

/** What the ladder varies besides the charge, for the load sheet's value column. */
const sheetBy = (ok: OkOutcome) =>
  ok.ladder.kind === 'seating'
    ? (ok.ladder.seatingBy ?? 'overallLength')
    : ok.ladder.kind === 'temperature'
      ? 'temperature'
      : undefined

/** One load sheet row per ladder step. */
function sheetSteps(
  steps: ShownStep[],
  system: UnitSystem,
  stepValue: (s: ShownStep) => string,
  velocity: (r: InteriorResponse['result']) => string,
) {
  return steps.map((s) => ({
    n: s.n,
    label: s.label,
    charge: stepValue(s),
    pressure:
      s.at &&
      `${withUnit('pressure', system, s.at.body.pressureRange.nominalPressure)} (${withUnit('pressure', system, s.at.body.pressureRange.lowPressure)} to ${withUnit('pressure', system, s.at.body.pressureRange.highPressure)})`,
    ofMax: s.d?.ofMax && `${formatNumber(s.d.ofMax.percent, 0)} %`,
    velocity: s.at && velocity(s.at.body.result),
    energy: s.at && withUnit('energy', system, s.at.body.result.muzzleEnergy),
    flag: s.flag,
  }))
}

/** The fields of a link: a ladder's step is the one of its kind. */
function linkFields(load: Load) {
  const { fields, ladderSteps, ladderKind, seatStep, tempStep, ladder } = load
  if (ladderSteps <= 1) return fields
  if (ladderKind === 'seating') return { ...fields, ladderStep: seatStep.seatStep ?? emptyStep }
  if (ladderKind === 'temperature') return { ...fields, ladderStep: tempStep.tempStep ?? emptyStep }
  return { ...fields, ...ladder }
}

/** The query of Copy link: the inputs, and the Trajectory tab's while it is open. */
function workbenchLinkQuery(load: Load) {
  const { choice, ladderSteps, ladderKind, direction, cartridge, recordLink, firearm } = load
  const { measuredWaterCapacity, seating, tab, trajectory, gunWeightUsed } = load
  const { typedBulletFields, typedSpecFields } = load
  const query = inputsQuery(
    choice.preset,
    { ...linkFields(load), ...typedBulletFields, ...typedSpecFields, firearmMass: gunWeightUsed },
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

/** The chart code once the cards show and the page is idle, so a result never waits for it and the start card loads none of it. */
function useIdlePreload(fresh: boolean) {
  useEffect(() => {
    if (fresh) return
    if (typeof requestIdleCallback === 'undefined') {
      const timer = setTimeout(preloadInteriorChart, 1000)
      return () => clearTimeout(timer)
    }
    const idle = requestIdleCallback(preloadInteriorChart, { timeout: 2000 })
    return () => cancelIdleCallback(idle)
  }, [fresh])
}

/** What a ladder step varies, as the strip and the table show it: its seating, its temperature, else its charge. */
function stepValueOf(s: ShownStep, system: UnitSystem) {
  if (s.seating) return withUnit('length', system, s.seating.value)
  if (s.temperature !== undefined) return withUnit('temperature', system, s.temperature)
  return withUnit('charge', system, s.charge)
}

/** The load of the shown result: cartridge, bullet, mass, powder with charge. */
function identityOf(
  ok: OkOutcome,
  bulletLabel: string | undefined,
  system: UnitSystem,
  charge: (kg: number) => string,
  t: Translator['t'],
) {
  return [
    ok.identity.cartridge ?? t('No cartridge'),
    // a run sent before the record arrived names the record chosen since
    ok.identity.bullet ?? bulletLabel ?? t('no bullet record'),
    withUnit('mass', system, ok.load.bullet.mass),
    t('{name} {amount}', {
      name: ok.identity.powder ?? t('powder parameters typed'),
      amount: charge(ok.load.charge),
    }),
  ]
}

/** Where the shown run starts, peaks and leaves the barrel on the burnt-fraction axis. */
function runMarksOf(ok: OkOutcome | undefined, t: Translator['t']) {
  const r = ok?.body.result
  if (!r) return
  const at = sampler(r.points)
  return [
    { z: at(r.shotStartTime).burntFraction, label: t('start') },
    { z: at(r.maxPressureTime).burntFraction, label: t('peak') },
    r.burnout ? { z: 1, label: t('burnout') } : { z: r.muzzleBurntFraction, label: t('muzzle') },
  ]
}

type PrintAsked = { key?: string | undefined; lot?: string | undefined; edits: number }

/**
 * Prints once the longer runs have answered.
 */
function usePrintWhenReady({
  printAsked,
  setPrintAsked,
  barrel,
  lot,
  edits,
  setPrinting,
}: {
  printAsked: PrintAsked | undefined
  setPrintAsked: (asked: PrintAsked | undefined) => void
  barrel: ReturnType<typeof useBarrelStudy>
  lot: ReturnType<typeof useLotRows>
  edits: number
  setPrinting: (printing: boolean) => void
}) {
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
  }, [
    printAsked,
    barrel.key,
    barrel.pending,
    lot.key,
    lot.pending,
    edits,
    setPrinting,
    setPrintAsked,
  ])
}

/** The result's state for a bar: not run, stale or its time; the phone bar words it shorter. */
function resultStatus(
  ok: OkOutcome | undefined,
  stale: boolean,
  phone: boolean,
  t: Translator['t'],
) {
  if (!ok) return t('Not run')
  if (stale)
    return phone ? t('Inputs changed, result is old') : t('Inputs changed since this result')
  return phone ? t('Result {time}', { time: ok.at }) : t('Result of {time}', { time: ok.at })
}

/** The page bar's short result state; the sentence of `resultStatus` is its tooltip. */
function resultBrief(ok: OkOutcome | undefined, stale: boolean, t: Translator['t']) {
  if (!ok) return t('Not run')
  return stale ? t('Inputs changed') : t('Run {time}', { time: ok.at })
}

/** Ctrl+Enter, or Enter in a field of the inputs, from any control of the bar and the workspace runs. */
function frameKeyDown(inputs: Load['inputs'], run: Load['run']) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.defaultPrevented) return
    const inField = e.target instanceof HTMLInputElement && inputs.current?.contains(e.target)
    if (e.ctrlKey || e.metaKey || inField) {
      e.preventDefault()
      run()
    }
  }
}

/** What the File menu could not load, as its note. */
function fileNote(unresolved: string[], dropped: string[], t: Translator['t']) {
  return (
    [
      unresolved.length &&
        t('Not loaded, kept in the file: {list}.', { list: unresolved.join(', ') }),
      dropped.length && t('Not a record id, left out: {list}.', { list: dropped.join(', ') }),
    ]
      .filter(Boolean)
      .join(' ') || undefined
  )
}

/** The page bar's Print menu: the report and the load sheets. */
function PrintMenu({ ok, printReport }: { ok: OkOutcome | undefined; printReport: () => void }) {
  const { t } = useTranslation()
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <Button
          variant="default"
          className="bar-icon"
          title={t('Print')}
          leftSection={<Printer size={18} aria-hidden="true" />}
        >
          {t('Print')}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item disabled={!ok} onClick={printReport}>
          {t('Workbench report (also {keys})', { keys: shortcutLabel('print') })}
        </Menu.Item>
        <Menu.Item disabled={!ok} onClick={() => printSheets(false)}>
          {t('Load sheet: one page')}
        </Menu.Item>
        <Menu.Item disabled={!ok} onClick={() => printSheets(true)}>
          {t('Load sheet and a page per charge')}
        </Menu.Item>
        <PrintSectionItems />
      </Menu.Dropdown>
    </Menu>
  )
}

/** The phone bar of the workspace: the result's state and the readouts that change with a run, then Run. */
function PhoneBar({
  ok,
  stale,
  system,
  pending,
  run,
  show,
}: {
  ok: OkOutcome | undefined
  stale: boolean
  system: UnitSystem
  pending: boolean
  run: Load['run']
  show: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {/* the result's state, then the readouts that change with a run */}
      <span className="bar-state">
        <span className="bar-result" data-stale={stale || undefined}>
          {resultStatus(ok, stale, true, t)}
        </span>
        {ok && (
          <span className="bar-values">
            {`${formatQuantity('pressure', system, ok.body.pressureRange.nominalPressure)} ${system.pressure.symbol}, ${withUnit('velocity', system, ok.body.result.muzzleVelocity)}`}
          </span>
        )}
      </span>
      <Button
        className="bar-run-phone"
        aria-label={t('Run simulation')}
        loading={pending}
        loaderProps={{ type: 'dots' }}
        leftSection={<Play size={14} weight="fill" aria-hidden="true" />}
        onClick={() => {
          if (run()) show()
        }}
      >
        {t('Run')}
      </Button>
    </>
  )
}

type CommandArgs = {
  t: Translator['t']
  run: Load['run']
  fileMenu: Load['fileMenu']
  ok: boolean
  printReport: () => void
  phone: boolean
  workspace: Load['workspace']
  openTarget: () => void
  openList: () => void
  openScan: () => void
  link: ReturnType<typeof useCopyLink>
  asNewLoad: Load['asNewLoad']
  fillExample: Load['fillExample']
  reset: Load['reset']
}

/** The page bar's actions as search commands, with the shortcuts that exist. */
function searchCommands(a: CommandArgs) {
  const { t } = a
  return [
    { label: t('Run simulation'), run: () => a.run(), keys: shortcutLabel('run') },
    {
      label: t(shortcuts.save.action),
      run: () => a.fileMenu.current?.save(),
      keys: shortcutLabel('save'),
    },
    {
      label: t(shortcuts.open.action),
      run: () => a.fileMenu.current?.openFile(),
      keys: shortcutLabel('open'),
    },
    ...(a.ok
      ? [{ label: t(shortcuts.print.action), run: a.printReport, keys: shortcutLabel('print') }]
      : []),
    // the Range tab exists below 48em only
    ...(a.phone ? [{ label: t('Range tab'), run: () => a.workspace.current?.showRange() }] : []),
    { label: t('Charge for a target'), run: a.openTarget },
    { label: t('Saved loads'), run: a.openList },
    { label: t('Scan box label'), run: a.openScan },
    { label: t('Copy link'), run: a.link.copy },
    { label: t('Example load'), run: a.asNewLoad(a.fillExample) },
    { label: t('Reset load'), run: a.asNewLoad(a.reset) },
  ]
}

/** A bullet chosen in the search: a design of this browser or a record. */
function chooseSearchedBullet(
  id: string,
  pickDesign: Load['pickDesign'],
  pickBullet: Load['pickBullet'],
) {
  const design = userRecordId(id)
  if (design) pickDesign(design)
  else void pickBullet(id)
}

/** The search's Bullets group heading: all diameters, or the ones the cartridge takes. */
function bulletsLabelOf(
  bulletFit: Load['bulletFit'],
  system: UnitSystem,
  cartridgeName: string | undefined,
  t: Translator['t'],
) {
  if (bulletFit === undefined) return t('Bullets, all diameters')
  return t('Bullets over {above}, up to {upTo} (CIP of {name})', {
    above: mmLength(system, bulletWindow(bulletFit).above),
    upTo: mmLength(system, bulletFit.g1),
    name: cartridgeName ?? '',
  })
}

/**
 * The barrel length study and the lot rows, each requested once its tab was opened or a print asked
 * for it, and the print request that waits for both.
 */
function useLongerRuns({
  ok,
  steps,
  system,
  tab,
  edits,
  setPrinting,
}: {
  ok: OkOutcome | undefined
  steps: ShownStep[]
  system: UnitSystem
  tab: Load['tab']
  edits: number
  setPrinting: (printing: boolean) => void
}) {
  // the longer run is requested once the tab was opened or a print asked for it
  const [printAsked, setPrintAsked] = useState<PrintAsked>()
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
  usePrintWhenReady({ printAsked, setPrintAsked, barrel, lot, edits, setPrinting })
  return { barrel, lot, printReport }
}

type PrintViewsProps = {
  load: Load
  ok: OkOutcome | undefined
  stale: boolean
  stepValue: (s: ShownStep) => string
  velocity: (r: InteriorResponse['result']) => string
  charge: (kg: number) => string
  lot: ReturnType<typeof useLotRows>
  barrel: ReturnType<typeof useBarrelStudy>
}

/** The report and the load sheets of the last run: print only, not on screen. */
function PrintViews({
  load,
  ok,
  stale,
  stepValue,
  velocity,
  charge,
  lot,
  barrel,
}: PrintViewsProps) {
  const { system, chartSlot, notes } = load
  const { t, tn } = useTranslation()
  const sections = usePrintChoice()
  const steps = useMemo(() => shownSteps(ok, t), [ok, t])
  const warnings = useMemo(() => ok && warningLines(ok, system, t), [ok, system, t])
  const barrelError = barrel.errors && Object.values(barrel.errors).join(' ')
  /** The report's and the load sheets' title: cartridge, bullet and powder of the run. */
  const loadTitle = ok
    ? [ok.identity.cartridge, ok.identity.bullet, ok.identity.powder].filter(Boolean).join(', ')
    : ''
  const seatingRows = seatingRowsOf(ok, system, t)
  const runTemperature = ok && withUnit('temperature', system, ok.load.propellantTemperature)
  const approximate =
    [approximateNote(ok, t), volumeNoteText(ok, t)].filter(Boolean).join(' ') || undefined
  /** Said on every print and result that took values from a user cartridge design. */
  const fromDesign =
    [
      ok?.cartridgeDesign &&
        t('Case values from the user design {name}, not a catalogue record.', {
          name: ok.cartridgeDesign,
        }),
      ok?.powderDesign && powderDesignNote(ok.powderDesign, t),
    ]
      .filter(Boolean)
      .join(' ') || undefined
  const printGroups = printGroupsOf(load, ok, seatingRows, runTemperature, { t, tn })
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
  /** The workbench's print view: what Ctrl+P prints, no controls. */
  const report = ok && (
    <Report
      ok={ok}
      chartSlot={chartSlot}
      steps={steps}
      ladderTable={ladderTable}
      lot={lot}
      barrel={barrel}
      barrelError={barrelError}
      notes={notes}
      system={system}
      loadTitle={loadTitle}
      stale={stale}
      fromDesign={fromDesign}
      approximate={approximate}
      printGroups={printGroups}
      stepValue={stepValue}
      warnings={warnings}
      sections={sections}
      t={t}
    />
  )
  /** The load sheets of the last run: what the run computed, as shown. */
  const sheets = ok && (
    <LoadSheets
      title={loadTitle}
      components={sheetComponents(ok, system, seatingRows, runTemperature, charge, t)}
      note={[stale && t('Inputs changed since this result.'), fromDesign, approximate]
        .filter(Boolean)
        .join(' ')}
      by={sheetBy(ok)}
      steps={sheetSteps(steps, system, stepValue, velocity)}
    />
  )
  return (
    <>
      {sheets}
      {report}
    </>
  )
}

/**
 * The load workbench: panels Cartridge, Bullet, Powder and Firearm
 * with the Run bar on the left; notice, warnings, readouts, the ladder strip and the result tabs in
 * the centre, the tabs after Results in an aside from 88em. The state lives in `useWorkbenchState`;
 * the cards read it through `LoadContext`, the result side through `ResultContext`.
 */
export function Workbench() {
  const { t } = useTranslation()
  const load = useWorkbenchState()
  const names = useManufacturerNames()
  const tabs = useLoadTabs(load)
  const reminder = useExportReminder()
  const [listOpen, setListOpen] = useState(false)
  const [targetOpen, setTargetOpen] = useState(false)
  const [TargetDialog, setTargetDialog] = useState<typeof ChargeTargetDialog>()
  const [scanOpen, setScanOpen] = useState(false)
  const [ScanDialog, setScanDialog] = useState<typeof ScanLabelDialog>()
  const { changed: countChange } = reminder
  const stored = useCallback(() => {
    load.onStored()
    countChange()
  }, [load.onStored, countChange])
  const {
    asNewLoad,
    bullet,
    bulletValues,
    bulletLabel,
    cartridge,
    changed,
    chartView,
    pickBullet,
    pickCartridge,
    pickDesign,
    pickPowder,
    csvCopied,
    bulletFit,
    describeBullet,
    designs,
    direction,
    fields,
    apiData,
    fileData,
    fileMenu,
    fillExample,
    firearm,
    firearms,
    framed,
    fresh,
    inputs,
    ladder,
    ladderSteps,
    ladderKind,
    notes,
    chronoSessions,
    edits,
    onOpenFile,
    opened,
    outcome,
    storeLoad,
    pending,
    powder,
    powderLabel,
    reset,
    run,
    select,
    setChartView,
    setCsvCopied,
    setNotes,
    setChronoSessions,
    manufacturerRef,
    manufacturerName,
    loadNotes,
    sessionRefCount,
    handOffTune,
    setPrinting,
    setSeen,
    setTab,
    showChart,
    shown,
    status,
    sight,
    storedTick,
    system,
    tab,
    todo,
    trajectory,
    unresolved,
    dropped,
    workspace,
  } = load
  const designRows = useMemo(() => userBulletRows(designs), [designs])

  useIdlePreload(fresh)
  // the cards replace the start card, and with it the button the visitor pressed; a saved load that
  // opens by itself on arrival leaves the focus where it is
  const wasFresh = useRef(fresh)
  const startCardUsed = useRef(false)
  const markStartCardUsed = useCallback(() => {
    startCardUsed.current = true
  }, [])
  useEffect(() => {
    const replaced = wasFresh.current && !fresh
    wasFresh.current = fresh
    if (!replaced) return
    const used = startCardUsed.current
    startCardUsed.current = false
    if (used && document.activeElement === document.body)
      focusBack('.panel[data-next] :is(input, button)', '.panel :is(input, button)')
  }, [fresh])

  const ok = outcome?.kind === 'ok' ? outcome : undefined
  const stale = Boolean(ok && changed)
  const warnings = useMemo(() => ok && warningLines(ok, system, t), [ok, system, t])

  const chargeText = ok
    ? withUnit('charge', system, ok.load.charge)
    : (shown('charge', 'charge') ?? t('no charge'))
  const charge = useCallback((kg: number) => withUnit('charge', system, kg), [system])
  /** What a ladder step varies, as the strip and the table show it: its seating, its temperature, else its charge. */
  const stepValue = useCallback((s: ShownStep) => stepValueOf(s, system), [system])
  /** The load of the shown result: cartridge, bullet, mass, powder with charge. */
  const identity = useMemo(
    () => ok && identityOf(ok, bulletLabel, system, charge, t),
    [ok, bulletLabel, system, charge, t],
  )
  const velocity = useCallback(
    (r: InteriorResponse['result']) => withUnit('velocity', system, r.muzzleVelocity),
    [system],
  )
  const steps = useMemo(() => shownSteps(ok, t), [ok, t])
  const { barrel, lot, printReport } = useLongerRuns({
    ok,
    steps,
    system,
    tab,
    edits,
    setPrinting,
  })
  const oneFlag = ok && stepFlag(ok, t)

  // the result side's values, each the same object while a keystroke leaves it unchanged
  /** The chart's burn law: the powder record's fit, else the typed model parameters. */
  const typedKey = JSON.stringify(burnKeys.map((k) => fields[k]?.si ?? null))
  const burn = useMemo(() => {
    if (powder) return classifyPowder(powder, names)
    const typed = JSON.parse(typedKey) as (number | null)[]
    return typedBurn(Object.fromEntries(burnKeys.map((k, i) => [k, typed[i] ?? undefined])), t)
  }, [powder, names, typedKey, t])
  /** Where the shown run starts, peaks and leaves the barrel on the burnt-fraction axis. */
  const runMarks = useMemo(() => runMarksOf(ok, t), [ok, t])
  const todoKey = JSON.stringify(todo)
  const shownTodo = useMemo(() => JSON.parse(todoKey) as typeof todo, [todoKey])
  const optic = useMemo(
    () =>
      activeClick(
        ([loadExample.firearm, ...firearms] as UserRecord[]).find((r) => r.id === firearm),
      ),
    [firearms, firearm],
  )
  const { bulletDiameter } = bulletValues
  // the File menu's id: set by Save and Open, which re-render the page
  const fileId = fileMenu.current?.id()
  const ownFirearm = firearms.some((f) => f.id === firearm) ? firearm : undefined
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
      chronoSessions,
      setChronoSessions,
      manufacturerRef,
      manufacturerName,
      loadNotes,
      sessionRefCount,
      ownFirearm,
      handOffTune,
      barrel,
      lot,
      chartView,
      setChartView,
      showChart,
      status,
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
      chronoSessions,
      setChronoSessions,
      manufacturerRef,
      manufacturerName,
      loadNotes,
      sessionRefCount,
      ownFirearm,
      handOffTune,
      barrel,
      lot,
      chartView,
      setChartView,
      showChart,
      status,
      pending,
    ],
  )
  const [chargeSi, stepSi, twistSi] = [fields.charge?.si, ladder.ladderStep?.si, fields.twist?.si]
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
      // the tab fetches the record itself: it gets the values typed over it, and the mass
      bulletValues,
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
      bulletValues,
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

  const linkQuery = () => workbenchLinkQuery(load)
  // the page bar's Copy link and the search's command share one copy and its "Link copied"
  const link = useCopyLink(linkQuery)
  useReportOptions([
    {
      label: t('Include my current load'),
      heading: 'Current load',
      text: () => `${window.location.origin}${window.location.pathname}#${linkQuery()}`,
    },
  ])
  // Ctrl+Enter is caught by the frame below, Ctrl+P prints the report once the barrel length study has computed
  useShortcuts({ run: null, print: ok ? printReport : null })
  const phone = useMediaQuery('(max-width: 47.99em)')
  /** What opened Saved loads, which gets the focus back: a selector, none for the menu's item. */
  const listOpener = useRef<string | undefined>(undefined)
  const openList = useCallback(() => setListOpen(true), [])
  // a plain import() on first open: next/dynamic would count the dialog in the route's weight
  const openScan = useCallback(
    () =>
      import('./scan-label-dialog.tsx').then((m) => {
        setScanDialog(() => m.ScanLabelDialog)
        setScanOpen(true)
      }),
    [],
  )
  const openListFromSwitcher = useCallback(() => {
    listOpener.current = '.load-switch'
    setListOpen(true)
  }, [])
  // the Open menu's Examples keep their identity, so the File menu's memo holds; they run the
  // actions of the latest render
  const starts = useRef({ asNewLoad, fillExample, reset })
  starts.current = { asNewLoad, fillExample, reset }
  const examples = useMemo(() => {
    const run = (k: 'fillExample' | 'reset') => () => starts.current.asNewLoad(starts.current[k])()
    return [
      { label: t('Example load'), run: run('fillExample') },
      { label: t('Reset load'), run: run('reset') },
    ]
  }, [t])

  return (
    <LoadContext value={load}>
      <ResultContext value={result}>
        <InputEcho value={echo}>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: catches Ctrl+Enter from any control of the bar and the workspace */}
          <div className="page-frame" role="presentation" onKeyDown={frameKeyDown(inputs, run)}>
            <PageBar
              title={t('Load workbench')}
              compact
              // line 1 the shown result, line 2 the File menu's state (portalled after it)
              status={
                <span
                  className="bar-result"
                  data-stale={stale || undefined}
                  data-full={resultStatus(ok, stale, false, t)}
                >
                  {resultBrief(ok, stale, t)}
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
                    onList={openListFromSwitcher}
                    due={reminder.text !== undefined}
                    name={load.name}
                    generated={tabs.generated}
                    onRename={tabs.rename}
                  />
                  {/* the page's main action beside the loads; below 75em the form's Run bar holds it */}
                  <Button
                    className="bar-run"
                    aria-label={t('Run simulation')}
                    aria-keyshortcuts={shortcutAriaKeys('run')}
                    loading={pending}
                    loaderProps={{ type: 'dots' }}
                    leftSection={<Play size={14} weight="fill" aria-hidden="true" />}
                    title={t('Run simulation ({keys})', { keys: shortcutLabel('run') })}
                    onClick={() => run()}
                  >
                    {t('Run')}
                  </Button>
                </>
              }
              actions={
                <Toolbar
                  link={link}
                  search={
                    <Button
                      variant="default"
                      className="bar-icon"
                      leftSection={<MagnifyingGlass size={18} aria-hidden="true" />}
                      onClick={() => spotlight.open()}
                      aria-keyshortcuts={shortcutAriaKeys('search')}
                      title={
                        framed ? t('Search ({keys})', { keys: shortcutLabel('search') }) : undefined
                      }
                    >
                      {t('Search')}
                    </Button>
                  }
                  file={
                    <FileMenu
                      ref={fileMenu}
                      kind="load"
                      name={load.name}
                      nameKey={load.customName?.trim() ? load.customName : ''}
                      data={fileData}
                      apiData={apiData}
                      store={storeLoad}
                      onOpen={onOpenFile}
                      onStored={stored}
                      onExported={reminder.exported}
                      onUnsaved={tabs.setUnsaved}
                      onList={openList}
                      examples={examples}
                      note={fileNote(unresolved, dropped, t)}
                    />
                  }
                  after={
                    <>
                      <TourButton page="workbench" />
                      <PrintMenu ok={ok} printReport={printReport} />
                      <PrintViews
                        load={load}
                        ok={ok}
                        stale={stale}
                        stepValue={stepValue}
                        velocity={velocity}
                        charge={charge}
                        lot={lot}
                        barrel={barrel}
                      />
                    </>
                  }
                />
              }
            />
            <Workspace
              ref={workspace}
              className="workbench"
              inputsLabel={t('Load')}
              inputs={fresh ? <StartCard onAct={markStartCardUsed} /> : <InputCards />}
              results={<ResultsArea />}
              range={<RangeView />}
              bar={(show) => (
                <PhoneBar
                  ok={ok}
                  stale={stale}
                  system={system}
                  pending={pending}
                  run={run}
                  show={show}
                />
              )}
            />
            <SavedLoads
              opened={listOpen}
              onClose={() => {
                setListOpen(false)
                // the menu item that opened it is gone: the load switcher it came from, else Open,
                // or Page actions
                const opener = listOpener.current
                listOpener.current = undefined
                focusBack(opener, '.file-menu button', '.page-bar .page-bar-toggle')
              }}
              tick={storedTick}
              openIds={tabs.openIds}
              onOpen={tabs.openRecord}
              onDeleted={tabs.deleted}
              onRenamed={tabs.renamed}
              onStored={stored}
              reminder={reminder.text}
              system={system}
              onScan={() => {
                setListOpen(false)
                openScan()
              }}
            />
            {TargetDialog && (
              <TargetDialog opened={targetOpen} onClose={() => setTargetOpen(false)} />
            )}
            {ScanDialog && (
              <ScanDialog
                opened={scanOpen}
                onClose={() => setScanOpen(false)}
                onOpen={tabs.openRecord}
              />
            )}
            <WorkbenchSearch
              onRun={() => run()}
              // the page bar's actions with the shortcuts that exist
              commands={searchCommands({
                t,
                run,
                fileMenu,
                ok: ok !== undefined,
                printReport,
                phone: Boolean(phone),
                workspace,
                // a plain import() on first open: next/dynamic would count the dialog in the route's weight
                openTarget: () =>
                  import('./charge-target-dialog.tsx').then((m) => {
                    setTargetDialog(() => m.ChargeTargetDialog)
                    setTargetOpen(true)
                  }),
                openList,
                openScan,
                link,
                asNewLoad,
                fillExample,
                reset,
              })}
              onCartridge={(c) =>
                pickCartridge({
                  id: c.id,
                  name: c.name,
                  ...summaryFitSource(c),
                })
              }
              onBullet={(b) => chooseSearchedBullet(b.id, pickDesign, pickBullet)}
              onPowder={(p) => pickPowder(p.id)}
              describeBullet={describeBullet}
              designs={designRows}
              bulletFit={bulletFit}
              bulletsLabel={bulletsLabelOf(bulletFit, system, cartridge?.name, t)}
            />
          </div>
        </InputEcho>
      </ResultContext>
    </LoadContext>
  )
}
