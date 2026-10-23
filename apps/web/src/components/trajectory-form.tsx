'use client'

import {
  Accordion,
  ActionIcon,
  Button,
  Menu,
  NativeSelect,
  Radio,
  SegmentedControl,
  Stack,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks'
import {
  type DragModel,
  dragModels,
  minStability,
  type OmittedEffect,
  type Trajectory,
} from '@openreloading/core'
import type { UserRecord } from '@openreloading/schema'
import { Printer } from '@phosphor-icons/react'
import {
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { flushSync } from 'react-dom'
import { fetchRecord } from '../lib/api-fetch.ts'
import type { BulletRecord, BulletSummary } from '../lib/api-types.ts'
import { bulletDrag } from '../lib/bullet.ts'
import { errorText } from '../lib/error-text.ts'
import { loadExample as exampleData } from '../lib/example-data.ts'
import { exampleFields } from '../lib/examples.ts'
import {
  type FieldSpec,
  type Fields,
  fieldError,
  siValues,
  switchFields,
} from '../lib/field-spec.ts'
import { sightOptions } from '../lib/firearm.ts'
import { type ManufacturerNames, productLabel } from '../lib/manufacturers.ts'
import { inputsQuery, linkParams, queryFields, tabQuery } from '../lib/query.ts'
import { controlSize } from '../lib/theme.ts'
import {
  manualBulletFields,
  manualProjectile,
  shotFields,
  type TrajectoryResult,
  trajectoryResult,
} from '../lib/trajectory-input.ts'
import {
  formatNumber,
  formatQuantity,
  roundedFieldText,
  type UnitSystem,
  withUnit,
} from '../lib/units.ts'
import { storedRecords } from '../lib/user-store.ts'
import { HitProbability } from './hit-probability.tsx'
import { LazyLineChart as LineChart, preloadChart } from './lazy-chart.tsx'
import { MovingTarget } from './moving-target.tsx'
import { NumberField } from './number-field.tsx'
import { type PaperSize, paperSizes, printRangeCard, RangeCard } from './range-card.tsx'
import { RecordSearch } from './record-search.tsx'
import { PanelTable } from './scroll-region.tsx'
import { SourceTitles } from './sources.tsx'
import { ErrorNote, Loading } from './states.tsx'
import { useFieldUnits, useUnits } from './units-settings.tsx'
import { useManufacturerNames } from './use-manufacturer-names.ts'

const allFields = [...shotFields, ...manualBulletFields]
/** The range fields with a default: zero range, largest range, range step. */
const rangeDefaults = (allFields as readonly FieldSpec[]).filter(
  (s) => s.quantity === 'range' && s.initial !== undefined,
)

/**
 * The start values. Range defaults are round in the shown range unit:
 * 100 yd, not 109.361 yd.
 */
function startFields(system: UnitSystem): Fields {
  return Object.fromEntries(
    (allFields as readonly FieldSpec[]).map((s) => {
      if (s.initial === undefined) return [s.key, { text: '', si: undefined }]
      const si = s.quantity === 'range' ? system.range.toSi(s.initial) : s.initial
      return [s.key, { text: roundedFieldText(s.quantity, system, si), si }]
    }),
  )
}
/** The fields a bullet design fills. */
const designKeys = ['mass', 'diameter', 'length']
type BulletDesignRecord = Extract<UserRecord, { kind: 'bulletDesign' }>
const panels = ['bullet', 'load', 'rifle', 'conditions', 'output']
/** The fields a firearm choice fills. */
const sightKeys = ['sightHeight', 'twist', 'zeroRange']
const omittedText: Record<OmittedEffect, string> = {
  coriolis: 'Coriolis',
  coriolisVertical: 'vertical Coriolis',
  spinDrift: 'spin drift (needs bullet length and twist)',
  jump: 'aerodynamic jump (needs bullet length and twist)',
  spinDecay: 'spin decay',
  magnus: 'Magnus force',
}

const stopText: Record<Exclude<Trajectory['stop'], 'done'>, string> = {
  apex: 'the bullet stopped moving forward along the line of sight',
  atmosphere: 'the path left the atmosphere model (above 11000 m or below -5000 m altitude)',
  maxTime: 'the largest time of flight (120 s) was reached',
  yaw: 'the yaw of repose reached its limit',
}

/**
 * `design`: the name of the user bullet design the bullet values came from; `si`: the SI
 * inputs of the result, so a later edit does not relabel its range card.
 */
type Result = TrajectoryResult & {
  bullet: string
  design?: string
  si: Record<string, number | undefined>
  /** The bullet values came from the manual fields, so the card lists mass and BC. */
  manual: boolean
  /** The chosen optic's turret click: the card gives the holds in clicks too. */
  click?: { value: number; unit?: 'MOA' | 'mrad' }
}

type RecordState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ok'; record: BulletRecord }
  | { status: 'error'; message: string }

/** Everything a computation reads; debounced as one value. */
type Inputs = {
  fields: Fields
  touched: Record<string, boolean>
  system: UnitSystem
  source: 'database' | 'manual'
  manualModel: DragModel
  recordModel: 'G1' | 'G7'
  record: RecordState
  names: ManufacturerNames
  choice: number | undefined
  twistHand: 'right' | 'left'
  design: string | undefined
  click: Result['click']
}

type Attempt =
  | { kind: 'ok'; result: Result }
  /** A changed field shows an error. */
  | { kind: 'invalid'; label: string }
  /** A missing choice or an empty field not yet edited: plain text, no alert. */
  | { kind: 'prompt'; text: string }
  | { kind: 'error'; message: string }

/** An angle in the correction unit, with its symbol. */
function angle(system: UnitSystem, rad: number) {
  return withUnit('correction', system, rad)
}

function noBcText(model: string) {
  return `This bullet has no ${model} BC in the database. Choose ${model === 'G7' ? 'G1' : 'G7'} or enter the drag manually.`
}

/** Field errors of the edited fields and the outcome of one computation. */
function evaluate(i: Inputs): { errors: Record<string, string>; attempt: Attempt } {
  const specs: readonly FieldSpec[] = i.source === 'manual' ? allFields : shotFields
  const errors: Record<string, string> = {}
  let invalid: string | undefined
  let empty: string | undefined
  for (const s of specs) {
    const error = fieldError(s, i.fields[s.key], i.system)
    if (!error) continue
    if (i.touched[s.key]) {
      errors[s.key] = error
      invalid ??= s.label
    } else empty ??= error
  }
  if (invalid) return { errors, attempt: { kind: 'invalid', label: invalid } }
  const prompt = (text: string) => ({ errors, attempt: { kind: 'prompt', text } as const })
  const si = siValues(i.fields)
  let projectile: ReturnType<typeof manualProjectile>
  let bullet: string
  if (i.source === 'manual') {
    if (empty) return prompt(empty)
    projectile = manualProjectile(si, i.manualModel)
    bullet = `${i.design ? `${i.design} (user design), ` : ''}${i.manualModel} manual drag`
  } else {
    if (i.record.status !== 'ok') return prompt('Choose a bullet from the database.')
    const { record } = i.record
    const drag = bulletDrag(record, i.recordModel, i.choice)
    if (drag.kind === 'none') return prompt(noBcText(i.recordModel))
    if (drag.kind === 'choose') return prompt('Choose one of the BC values of the record.')
    if (empty) return prompt(empty)
    const bc = bulletDrag(record, i.recordModel)
    const chosen = bc.kind === 'choose' && i.choice !== undefined ? bc.values[i.choice] : undefined
    projectile = drag.projectile
    bullet = `${productLabel(record, i.names)}, ${i.recordModel}${chosen ? ` ${chosen.value} lb/in²` : ''}`
  }
  try {
    return {
      errors,
      attempt: {
        kind: 'ok',
        result: {
          ...trajectoryResult(si, projectile, i.twistHand),
          bullet,
          si,
          manual: i.source === 'manual',
          ...(i.click && { click: i.click }),
          ...(i.source === 'manual' && i.design && { design: i.design }),
        },
      },
    }
  } catch (err) {
    return {
      errors,
      attempt: { kind: 'error', message: errorText(err) },
    }
  }
}

function RecordDetails({
  record,
  names,
  system,
}: {
  record: BulletRecord
  names: ManufacturerNames
  system: UnitSystem
}) {
  const mm = (x: number) => withUnit('length', system, x * 1e-3)
  return (
    <div className="record">
      <p>
        {productLabel(record, names)}: {formatQuantity('mass', system, record.mass.value * 1e-3)}{' '}
        {system.mass.symbol}, diameter {mm(record.diameter.value)}
        {record.length && `, length ${mm(record.length.value)}`}
      </p>
      <ul>
        {(record.ballisticCoefficients ?? []).map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: BCs keep the record order and have no id
          <li key={i}>
            {c.dragModel} {c.value} lb/in²
            {c.minVelocity && ` from ${withUnit('velocity', system, c.minVelocity.value)}`}
            {c.note && ` (${c.note})`}
          </li>
        ))}
      </ul>
      <p className="sources">
        Source ({record.provenance.kind}): <SourceTitles sources={record.provenance.sources} />
      </p>
    </div>
  )
}

/** The holds and the design note of a result. */
function ResultTop({ result, system }: { result: Result; system: UnitSystem }) {
  const u = (q: Parameters<typeof formatQuantity>[0]) => system[q].symbol
  const rows = result.tablePoints
  const last = rows[rows.length - 1]
  const at = last && `at ${formatQuantity('range', system, last.range)} ${u('range')}`
  return (
    <>
      {result.design && (
        <p className="note user-design">
          Computed from the user design {result.design}, not a catalogue record.
        </p>
      )}
      {last && (
        <dl className="readouts">
          <div>
            <dt>Elevation hold {at}</dt>
            <dd>{angle(system, last.elevationHold)}</dd>
          </div>
          <div>
            <dt>Windage hold {at}</dt>
            <dd>{angle(system, last.windageHold)}</dd>
          </div>
          <div>
            <dt>Velocity {at}</dt>
            <dd>
              {formatQuantity('velocity', system, last.velocity)} {u('velocity')}
            </dd>
          </div>
          <div>
            <dt>Energy {at}</dt>
            <dd>
              {formatQuantity('energy', system, last.energy)} {u('energy')}
            </dd>
          </div>
        </dl>
      )}
    </>
  )
}

/** The notes, the chart and the table of a result. */
function ResultDetail({
  result,
  system,
  chartHeight,
  staleLine,
}: {
  result: Result
  system: UnitSystem
  /** The chart's height, px; without it the chart fills the height its column leaves. */
  chartHeight?: number
  /** Over the chart's top right corner, so it shows and goes without moving the chart. */
  staleLine?: ReactNode
}) {
  const u = (q: Parameters<typeof formatQuantity>[0]) => system[q].symbol
  const { trajectory: t, tablePoints: rows, chartPoints: chart } = result
  const last = rows[rows.length - 1]
  const transonic = rows.find((p) => p.transonic || p.subsonic)
  const notes = (
    <ul className="summary">
      <li>Bore elevation above the line of sight: {angle(system, t.bore.elevationAngle)}</li>
      <li>
        Density altitude: {formatQuantity('altitude', system, result.densityAltitude)}{' '}
        {u('altitude')}
      </li>
      {t.stability !== undefined && (
        <li>Gyroscopic stability (Miller): {formatNumber(t.stability, 2)}</li>
      )}
      {t.stability !== undefined && result.lowStability && (
        <li className="exceeded">
          Gyroscopic stability falls below {formatNumber(minStability, 1)} from{' '}
          {formatQuantity('range', system, result.lowStability.range)} {u('range')} (
          {formatNumber(result.lowStability.stability, 2)} there, Miller's rule with the speed and
          air along the flight). Check the twist.
        </li>
      )}
      {transonic && (
        <li>
          Transonic from {formatQuantity('range', system, transonic.range)} {u('range')}
        </li>
      )}
      {t.omitted.length > 0 && (
        <li>Effects left out: {t.omitted.map((o) => omittedText[o]).join(', ')}</li>
      )}
      {t.stop !== 'done' && (
        <li>
          The computation stopped early: {stopText[t.stop]}. Last computed range:{' '}
          {last ? `${formatQuantity('range', system, last.range)} ${u('range')}` : 'none'}.
        </li>
      )}
    </ul>
  )
  const chartEl = (
    <LineChart
      height={chartHeight}
      fill={chartHeight === undefined}
      x={chart.map((p) => system.range.fromSi(p.range))}
      y={chart.map((p) => system.lineOfSightOffset.fromSi(p.height))}
      xLabel={`Range (${u('range')})`}
      yLabel={`Height above the line of sight (${u('lineOfSightOffset')})`}
      title="Height above the line of sight against range"
      description={`From 0 to ${formatQuantity('range', system, chart[chart.length - 1]?.range ?? 0)} ${u('range')}; lowest point ${formatQuantity('lineOfSightOffset', system, Math.min(...chart.map((p) => p.height)))} ${u('lineOfSightOffset')}. The table tab lists the values.`}
      zeroLine
    />
  )
  const tableEl = (
    <PanelTable
      label="Trajectory table"
      caption={
        <>
          Trajectory: {result.bullet}, zero {formatQuantity('range', system, result.zeroRange)}{' '}
          {u('range')}
        </>
      }
      columns={[
        `Range (${u('range')})`,
        `Height (${u('lineOfSightOffset')})`,
        `Elevation hold (${u('correction')})`,
        `Windage (${u('lineOfSightOffset')})`,
        `Windage hold (${u('correction')})`,
        `Velocity (${u('velocity')})`,
        'Mach',
        `Energy (${u('energy')})`,
        'Time (s)',
      ]}
      numeric
    >
      {rows.map((p) => (
        <tr key={p.range}>
          <td className="num">{formatQuantity('range', system, p.range)}</td>
          <td className="num">{formatQuantity('lineOfSightOffset', system, p.height)}</td>
          <td className="num">{formatQuantity('correction', system, p.elevationHold)}</td>
          <td className="num">{formatQuantity('lineOfSightOffset', system, p.windage)}</td>
          <td className="num">{formatQuantity('correction', system, p.windageHold)}</td>
          <td className="num">{formatQuantity('velocity', system, p.velocity)}</td>
          <td className="num">
            {formatNumber(p.mach, 2)}
            {p.subsonic ? ' subsonic' : p.transonic ? ' transonic' : ''}
          </td>
          <td className="num">{formatQuantity('energy', system, p.energy)}</td>
          <td className="num">{formatNumber(p.time, 3)}</td>
        </tr>
      ))}
    </PanelTable>
  )
  return (
    <>
      {notes}
      <div className="trajectory-chart">
        {staleLine}
        {chartEl}
      </div>
      {tableEl}
      <details className="values-details">
        <summary>Moving target and hit probability</summary>
        <MovingTarget points={rows} system={system} />
        <HitProbability
          points={rows}
          windPerUnit={result.windPerUnit.mps}
          wind={{ speed: result.si.windSpeed ?? 0, from: result.si.windFrom ?? Math.PI / 2 }}
          bulletDiameter={result.bulletDiameter}
          system={system}
        />
      </details>
    </>
  )
}

/** What the workbench reads from its Trajectory tab: the tab's query for Copy link. */
export type TrajectoryHandle = { query: () => string }

/**
 * The trajectory calculator of the workbench's Trajectory tab, the only trajectory UI. It takes the
 * muzzle velocity (m/s), bullet record id, twist and sight of the load; what the load does not
 * supply (a bullet record, a firearm) it offers itself, as the former page did. A workbench link
 * with `tab=trajectory` fills it once from its `tab.` keys.
 */
export function TrajectoryForm({
  load,
  ref,
}: {
  load: {
    muzzleVelocity?: number
    bullet?: string
    twist?: number
    /** The chosen firearm's sight, SI. */
    sightHeight?: number
    zeroRange?: number
  }
  ref?: Ref<TrajectoryHandle>
}) {
  const { choice: unitChoice, system, ready } = useUnits()
  const names = useManufacturerNames()
  const form = useForm<Fields>({
    mode: 'controlled',
    initialValues: startFields(system),
  })
  useFieldUnits(allFields, system, form.setValues, roundedFieldText)
  const [source, setSource] = useState<'database' | 'manual'>('database')
  const [manualModel, setManualModel] = useState<DragModel>('G7')
  const [recordModel, setRecordModel] = useState<'G1' | 'G7'>('G7')
  const [record, setRecord] = useState<RecordState>({ status: 'none' })
  const [choice, setChoice] = useState<number | undefined>(undefined)
  const [twistHand, setTwistHand] = useState<'right' | 'left'>('right')
  // from 62em the chart fills the results column's height
  const wide = useMediaQuery('(min-width: 62em)')
  const [last, setLast] = useState<Result | undefined>(undefined)
  const [sights, setSights] = useState<ReturnType<typeof sightOptions>>([])
  const [sight, setSight] = useState('')
  const [paper, setPaper] = useState<PaperSize>('a4')
  /** The chosen firearm was gone when the list was read again. */
  const [sightGone, setSightGone] = useState(false)
  const [designs, setDesigns] = useState<BulletDesignRecord[]>([])
  /** The bullet design the manual bullet values came from; an edit of one of them leaves it. */
  const [design, setDesign] = useState<BulletDesignRecord>()
  const loading = useRef<AbortController | null>(null)
  // when the stored or linked units replace the first render's, a range default not edited becomes
  // the round default of the shown unit (runs after useFieldUnits' conversion); a later unit switch
  // converts it like any value, so the result does not change
  const firstRange = useRef(system.range)
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once the units are read
  useEffect(() => {
    const before = firstRange.current
    if (!ready || before === system.range) return
    const edited = form.getTouched()
    form.setValues((f) => {
      const next = { ...f }
      for (const s of rangeDefaults) {
        const initial = s.initial as number
        if (!edited[s.key] && f[s.key]?.si === before.toSi(initial)) {
          const si = system.range.toSi(initial)
          next[s.key] = { text: roundedFieldText('range', system, si), si }
        }
      }
      return next as Fields
    })
  }, [ready])

  const fields = form.values
  const touched = form.getTouched()
  const inputs = useMemo(
    () => ({
      fields,
      touched,
      system,
      source,
      manualModel,
      recordModel,
      record,
      names,
      choice,
      twistHand,
      design: design?.name,
      click: sights.find((o) => o.value === sight)?.fill.click,
    }),
    [
      fields,
      touched,
      system,
      source,
      manualModel,
      recordModel,
      record,
      names,
      choice,
      twistHand,
      design,
      sights,
      sight,
    ],
  )
  const [debounced] = useDebouncedValue(inputs, 150)
  const { errors, attempt } = useMemo(() => evaluate(debounced), [debounced])
  // kept on each new attempt during render, without a second committed render
  const [seen, setSeen] = useState<Attempt>()
  if (seen !== attempt) {
    setSeen(attempt)
    if (attempt.kind === 'ok') setLast(attempt.result)
  }
  const result = attempt.kind === 'ok' ? attempt.result : last
  const stale = attempt.kind !== 'ok' && result !== undefined

  const u = (q: Parameters<typeof formatQuantity>[0]) => system[q].symbol
  const lastRow = result?.tablePoints[result.tablePoints.length - 1]
  const staleText =
    attempt.kind === 'invalid'
      ? `Result for earlier inputs. Fix ${attempt.label} to update.`
      : 'Result for earlier inputs.'
  let summary = ''
  if (attempt.kind === 'ok' && lastRow)
    summary = `Updated: ${attempt.result.tablePoints.length} ranges, elevation at ${formatQuantity('range', system, lastRow.range)} ${u('range')} ${angle(system, lastRow.elevationHold)}.`
  else if (stale) summary = staleText
  // announced and alerted 1 s after the last change, so values passed while typing stay quiet
  const [status] = useDebouncedValue(summary, 1000)
  const message = attempt.kind === 'error' ? attempt.message : ''
  const [alerted] = useDebouncedValue(message, 1000)
  const alert = alerted && alerted === message && <ErrorNote>{message}</ErrorNote>

  const drag = record.status === 'ok' ? bulletDrag(record.record, recordModel, choice) : undefined
  // without `choice`, so the BC list stays while one value is chosen
  const bcOptions = record.status === 'ok' ? bulletDrag(record.record, recordModel) : undefined
  const chosen =
    bcOptions?.kind === 'choose' && choice !== undefined ? bcOptions.values[choice] : undefined

  const field = (spec: FieldSpec) => (
    <NumberField
      key={spec.key}
      spec={spec}
      system={system}
      value={fields[spec.key]}
      onChange={(value) => {
        form.setFieldValue(spec.key, value)
        // the choice names the filled values; an edit of one leaves it
        if (sightKeys.includes(spec.key)) setSight('')
        if (designKeys.includes(spec.key)) setDesign(undefined)
      }}
      error={
        errors[spec.key]
          ? (s) => fieldError(spec, fields[spec.key], s) ?? errors[spec.key]
          : undefined
      }
    />
  )
  const group = (keys: string[]) => allFields.filter((s) => keys.includes(s.key)).map(field)

  function reset() {
    loading.current?.abort()
    form.reset()
    form.setValues(startFields(system))
    setSource('database')
    setManualModel('G7')
    setRecordModel('G7')
    setRecord({ status: 'none' })
    setChoice(undefined)
    setTwistHand('right')
    setLast(undefined)
    setSight('')
    setSightGone(false)
    setDesign(undefined)
  }

  /** The browser's bullet designs, read again on focus as the firearms are. */
  const readDesigns = () => {
    storedRecords()
      .then(({ records }) =>
        setDesigns(records.filter((r): r is BulletDesignRecord => r.kind === 'bulletDesign')),
      )
      .catch(() => {})
  }

  /** Fills mass, diameter and length from a bullet design; they stay editable. */
  function chooseDesign(id: string) {
    const d = designs.find((r) => r.id === id)
    setDesign(d)
    if (!d) return
    for (const s of allFields.filter((f) => designKeys.includes(f.key))) {
      const si = d.data.siValues[s.key]
      form.setFieldValue(
        s.key,
        si === undefined
          ? { text: '', si }
          : { text: roundedFieldText(s.quantity, system, si), si },
      )
    }
  }

  /** The firearm library's sights, read again on focus: the library may have changed meanwhile. */
  const readSights = () => {
    storedRecords()
      .then(({ records }) => {
        const options = sightOptions(records)
        setSights(options)
        if (sight && !options.some((o) => o.value === sight)) {
          setSight('')
          setSightGone(true)
        }
      })
      .catch(() => {})
  }

  /** Fills the rifle fields from a firearm's mount; they stay editable. */
  function chooseSight(value: string) {
    setSight(value)
    setSightGone(false)
    const s = sights.find((o) => o.value === value)
    if (!s) return
    const set = (key: string, q: FieldSpec['quantity'], si: number) =>
      form.setFieldValue(key, { text: roundedFieldText(q, system, si), si })
    set('sightHeight', 'length', s.fill.sightHeight)
    set('zeroRange', 'range', s.fill.zeroRange)
    // a firearm without twist empties the field, so no other rifle's twist stays
    if (s.fill.twist !== undefined) set('twist', 'twist', s.fill.twist)
    else form.setFieldValue('twist', { text: '', si: undefined })
    setTwistHand(s.fill.twistHand)
  }

  function fillExample() {
    reset()
    form.setValues(
      switchFields(
        exampleFields(allFields, exampleData.trajectory, system),
        allFields,
        system,
        roundedFieldText,
      ),
    )
    setSource('manual')
  }

  /** `linkedChoice`: the BC index of a copied link. */
  async function chooseRecord(id: string, linkedChoice?: number) {
    // each pick starts a request; only the latest may set the record
    loading.current?.abort()
    const controller = new AbortController()
    loading.current = controller
    setRecord({ status: 'loading' })
    setChoice(undefined)
    try {
      const body = await fetchRecord<BulletRecord>('bullets', id, controller.signal)
      if (!body) throw new Error('No such bullet')
      if (controller.signal.aborted) return
      setRecord({ status: 'ok', record: body })
      setChoice(linkedChoice)
    } catch {
      if (controller.signal.aborted) return
      setRecord({
        status: 'error',
        message: 'The database is unreachable; manual input still works.',
      })
    }
  }

  // a copied link fills the form once
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on mount only
  useEffect(() => {
    preloadChart()
    readDesigns()
    readSights()
    // the tab's keys under `tab.`: the workbench's query holds interior keys such as twist
    const query = tabQuery(linkParams(window.location).toString(), 'trajectory')
    if (!query) return
    const linked = queryFields(query, allFields, system, roundedFieldText)
    form.setValues(linked)
    // linked values count as edited, so one outside its bounds shows its error
    form.setTouched(
      Object.fromEntries(allFields.filter((s) => linked[s.key].text).map((s) => [s.key, true])),
    )
    const model = query.get('drag') as DragModel | null
    const bullet = query.get('bullet')
    if (bullet) {
      if (model === 'G1' || model === 'G7') setRecordModel(model)
      const linkedChoice = Number(query.get('choice') || Number.NaN)
      chooseRecord(bullet, Number.isInteger(linkedChoice) ? linkedChoice : undefined)
    } else if (query.has('mass')) {
      setSource('manual')
      if (model && dragModels.includes(model)) setManualModel(model)
    }
    if (query.get('hand') === 'left') setTwistHand('left')
  }, [])

  const loadVelocity = load.muzzleVelocity
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the load, not a unit switch
  useEffect(() => {
    if (loadVelocity !== undefined)
      form.setFieldValue('muzzleVelocity', {
        text: roundedFieldText('velocity', system, loadVelocity),
        si: loadVelocity,
      })
  }, [loadVelocity])
  const loadTwist = load.twist
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the load, not a unit switch
  useEffect(() => {
    if (loadTwist !== undefined)
      form.setFieldValue('twist', {
        text: roundedFieldText('twist', system, loadTwist),
        si: loadTwist,
      })
  }, [loadTwist])
  const [loadSight, loadZero] = [load.sightHeight, load.zeroRange]
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the load's firearm, not a unit switch
  useEffect(() => {
    if (loadSight !== undefined)
      form.setFieldValue('sightHeight', {
        text: roundedFieldText('length', system, loadSight),
        si: loadSight,
      })
    if (loadZero !== undefined)
      form.setFieldValue('zeroRange', {
        text: roundedFieldText('range', system, loadZero),
        si: loadZero,
      })
  }, [loadSight, loadZero])
  const loadBullet = load.bullet
  /** The load has no bullet record: the tab offers its own bullet, as the former page did. */
  const own = !loadBullet
  const ownSight = loadSight === undefined && loadZero === undefined
  const lastBullet = useRef(loadBullet)
  /** The load's bullet took the place of one entered or chosen in this tab. */
  const [replaced, setReplaced] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the load's bullet record
  useEffect(() => {
    const before = lastBullet.current
    lastBullet.current = loadBullet
    // the load's record left the load (none, or a user design): it goes and the tab's own bullet
    // inputs show; on mount a linked record stays
    if (!loadBullet) {
      if (!before) return
      loading.current?.abort()
      setRecord({ status: 'none' })
      setReplaced(false)
      return
    }
    if (!before)
      setReplaced(
        source === 'manual'
          ? [...designKeys, 'ballisticCoefficient'].some((k) => fields[k]?.text)
          : record.status === 'ok' && record.record.id !== loadBullet,
      )
    setSource('database')
    chooseRecord(loadBullet)
  }, [loadBullet])

  const fromDatabase = source === 'database' && record.status === 'ok'
  const query = () =>
    inputsQuery(unitChoice.preset, fields, {
      bullet: fromDatabase ? record.record.id : undefined,
      choice: fromDatabase && choice !== undefined ? String(choice) : undefined,
      drag: source === 'manual' ? manualModel : recordModel,
      hand: twistHand === 'left' ? 'left' : undefined,
    })
  useImperativeHandle(ref, () => ({ query }))

  const inputsPanel = (
    <form noValidate onSubmit={(e) => e.preventDefault()}>
      <Accordion multiple defaultValue={panels} order={2} className="panels">
        <Accordion.Item value="bullet">
          {/* the Bullet card of the workbench is a region "Bullet" too: one name per landmark */}
          <Accordion.Control aria-label="Bullet of the trajectory">Bullet</Accordion.Control>
          <Accordion.Panel>
            <div className="panel-fields">
              {/* with the load's bullet: no source switch or search */}
              {own && (
                <SegmentedControl
                  size={controlSize.row.toggle}
                  aria-label="Bullet source"
                  className="wide"
                  value={source}
                  onChange={(v) => setSource(v as 'database' | 'manual')}
                  data={[
                    { value: 'database', label: 'From the database' },
                    { value: 'manual', label: 'Manual drag' },
                  ]}
                />
              )}
              {source === 'database' ? (
                <>
                  {own && (
                    <div className="wide">
                      <RecordSearch<BulletSummary>
                        kind="bullets"
                        label="Search bullets by manufacturer or name"
                        // the chosen record in the field, as in the workbench's pickers
                        chosen={
                          record.status === 'ok'
                            ? productLabel(record.record, names)
                            : 'Search bullets'
                        }
                        describe={(b) =>
                          `${productLabel(b, names)}, ${formatQuantity('mass', system, b.mass * 1e-3)} ${u('mass')}`
                        }
                        onSelect={(b) => chooseRecord(b.id)}
                        noneText="No bullet found"
                        unreachableText="The database is unreachable; manual input still works."
                      />
                    </div>
                  )}
                  <NativeSelect
                    label="Drag model"
                    value={recordModel}
                    data={['G7', 'G1']}
                    onChange={(e) => {
                      setRecordModel(e.currentTarget.value as 'G1' | 'G7')
                      setChoice(undefined)
                    }}
                  />
                  <div className="wide">
                    {record.status === 'loading' && <Loading what="the bullet record" inline />}
                    {record.status === 'error' && <p>{record.message}</p>}
                    {/* the Bullet card shows the load's record */}
                    {record.status === 'ok' && own && (
                      <RecordDetails record={record.record} names={names} system={system} />
                    )}
                    {record.status === 'ok' && record.record.id === loadBullet && (
                      <p className="note from-load">
                        From the load: the bullet of the Bullet panel
                        {replaced && ', in place of the one entered here'}.
                      </p>
                    )}
                    {drag?.kind === 'none' && <p className="note">{noBcText(recordModel)}</p>}
                    {bcOptions?.kind === 'choose' && (
                      <Radio.Group
                        label={`The record lists several ${recordModel} BCs without velocity bands; choose one`}
                        value={choice === undefined ? null : String(choice)}
                        onChange={(v) => setChoice(Number(v))}
                      >
                        <Stack gap="xs" mt="xs">
                          {bcOptions.values.map((v, i) => (
                            <Radio
                              // biome-ignore lint/suspicious/noArrayIndexKey: BCs keep the record order and have no id
                              key={i}
                              value={String(i)}
                              label={`${v.value} lb/in²${v.note ? ` (${v.note})` : ''}`}
                            />
                          ))}
                        </Stack>
                      </Radio.Group>
                    )}
                    {chosen && (
                      <p>
                        {recordModel} BC {chosen.value} lb/in² chosen from the record, used from 0{' '}
                        {u('velocity')}.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <NativeSelect
                    className="wide"
                    label="Bullet design"
                    description="From your bullet designs in this browser; fills mass, diameter and length."
                    value={design?.id ?? ''}
                    onFocus={readDesigns}
                    onChange={(e) => chooseDesign(e.currentTarget.value)}
                    data={[
                      { value: '', label: designs.length ? 'None' : 'None in this browser' },
                      ...designs.map((d) => ({ value: d.id, label: d.name })),
                    ]}
                  />
                  {group(['mass', 'diameter', 'length'])}
                  <NativeSelect
                    label="Drag model"
                    value={manualModel}
                    data={dragModels}
                    onChange={(e) => setManualModel(e.currentTarget.value as DragModel)}
                  />
                  {group(['ballisticCoefficient'])}
                </>
              )}
            </div>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="load">
          <Accordion.Control>Load</Accordion.Control>
          <Accordion.Panel>
            <div className="panel-fields">
              {group(['muzzleVelocity'])}
              {loadVelocity !== undefined && fields.muzzleVelocity?.si === loadVelocity && (
                <p className="note from-load">From the load: muzzle velocity of the last run.</p>
              )}
            </div>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="rifle">
          <Accordion.Control>Rifle and scope</Accordion.Control>
          <Accordion.Panel>
            <div className="panel-fields">
              {ownSight && (
                <NativeSelect
                  className="wide"
                  label="Firearm and sight"
                  description={
                    sightGone
                      ? 'The chosen firearm is no longer in this browser; its values stay.'
                      : 'From your firearm library; fills sight height, twist and zero range.'
                  }
                  value={sight}
                  onFocus={readSights}
                  onChange={(e) => chooseSight(e.currentTarget.value)}
                  data={[
                    { value: '', label: sights.length ? 'None' : 'None in this browser' },
                    ...sights.map(({ value, label }) => ({ value, label })),
                  ]}
                />
              )}
              {group(['sightHeight', 'twist'])}
              <div className="twist-hand">
                <p className="segment-label" id="twist-hand">
                  Twist direction
                </p>
                <SegmentedControl
                  aria-labelledby="twist-hand"
                  size={controlSize.row.toggle}
                  value={twistHand}
                  onChange={(v) => {
                    setTwistHand(v as 'right' | 'left')
                    setSight('')
                  }}
                  data={[
                    { value: 'right', label: 'Right' },
                    { value: 'left', label: 'Left' },
                  ]}
                />
              </div>
              {group(['zeroRange'])}
            </div>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="conditions">
          <Accordion.Control>Conditions</Accordion.Control>
          <Accordion.Panel>
            <div className="panel-fields">
              {group(['temperature', 'pressure', 'altitude', 'humidity', 'windSpeed', 'windFrom'])}
            </div>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="output">
          <Accordion.Control>Output</Accordion.Control>
          <Accordion.Panel>
            <div className="panel-fields">{group(['maxRange', 'rangeStep'])}</div>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </form>
  )

  // before the first result with the tab's own bullet: what is missing, or the example; with
  // the load's bullet the prompt alone
  const emptyState = own && !result && attempt.kind !== 'ok'
  const needed = [
    ...(source === 'database' && record.status !== 'ok' ? ['Bullet'] : []),
    ...(source === 'manual' ? [...manualBulletFields, ...shotFields] : shotFields)
      .filter((s) => 'required' in s && s.required && !fields[s.key]?.text)
      .map((s) => s.label),
  ]

  // the stale line shows the state, so a stale or lagging stale text is only announced
  const statusLine = (
    <p
      role="status"
      className={stale || status.startsWith('Result for earlier') ? 'status-quiet' : 'status'}
    >
      {status}
    </p>
  )
  const formNotes = (
    <>
      {alert}
      {attempt.kind === 'prompt' && attempt.text && !emptyState && (
        <p className="prompt">{attempt.text}</p>
      )}
      {emptyState && (
        <section aria-labelledby="trajectory-empty" className="trajectory-empty">
          <h2 id="trajectory-empty">No result yet</h2>
          {attempt.kind === 'prompt' && <p className="prompt">{attempt.text}</p>}
          {needed.length > 0 && (
            <>
              <p>Still needed:</p>
              <ul>
                {needed.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </>
          )}
          {exampleData && (
            <Button variant="default" onClick={fillExample}>
              Use the example
            </Button>
          )}
        </section>
      )}
    </>
  )
  const staleLine = stale && <p className="stale-line">{staleText}</p>
  const printButton = (
    // an icon at the end of the holds row, so the hold labels keep their width
    <Menu position="bottom-end" withinPortal shadow="sm">
      <Menu.Target>
        <ActionIcon
          variant="default"
          size={controlSize.row.icon}
          className="range-card-button"
          aria-label="Print range card"
          title="Print range card"
        >
          <Printer aria-hidden="true" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {paperSizes.map((size) => (
          <Menu.Item
            key={size}
            onClick={() => {
              // the card is drawn for the paper before the dialog takes its snapshot
              flushSync(() => setPaper(size))
              printRangeCard()
            }}
          >
            Print on {size.toUpperCase()}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )

  // one view at every width: the holds and Print range card, the inputs, then the notes,
  // the chart and the table; from 62em the chart takes the height the results column leaves
  return (
    <div className="embedded-calculator trajectory-view">
      {statusLine}
      {result && (
        <section
          aria-labelledby="trajectory-result"
          className="result trajectory-top"
          data-stale={stale || undefined}
        >
          <h2 id="trajectory-result" className="visually-hidden">
            Trajectory result
          </h2>
          <ResultTop result={result} system={system} />
          {printButton}
        </section>
      )}
      {inputsPanel}
      {formNotes}
      {result && (
        <div className="trajectory-detail" data-stale={stale || undefined}>
          <ResultDetail
            result={result}
            system={system}
            chartHeight={wide ? undefined : 200}
            staleLine={staleLine}
          />
          <RangeCard result={result} system={system} paper={paper} />
        </div>
      )}
    </div>
  )
}
