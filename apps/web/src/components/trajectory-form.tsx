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
  type OmittedEffect,
  type Trajectory,
} from '@open-reloading/core'
import { type Bullet, toSi, type UserRecord } from '@open-reloading/schema'
import { Printer } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
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
import { useTranslation } from '../i18n/language.ts'
import { formatNumber } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import type { BulletSummary } from '../lib/api-types.ts'
import { type BulletValues, bulletDrag, typedBullet } from '../lib/bullet.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { errorText } from '../lib/error-text.ts'
import { loadExample as exampleData } from '../lib/example-data.ts'
import { exampleFields } from '../lib/examples.ts'
import {
  type FieldSpec,
  type Fields,
  fieldError,
  siValues,
  specText,
  switchFields,
} from '../lib/field-spec.ts'
import { sightPicker } from '../lib/firearm.ts'
import { type ManufacturerNames, productLabel } from '../lib/manufacturers.ts'
import { inputsQuery, linkParams, queryFields, tabQuery } from '../lib/query.ts'
import { zeroConditions } from '../lib/range-card.ts'
import { controlSize } from '../lib/theme.ts'
import {
  manualBulletFields,
  manualProjectile,
  shotFields,
  type TrajectoryResult,
  trajectoryResult,
  zeroKeys,
} from '../lib/trajectory-input.ts'
import { formatQuantity, roundedFieldText, type UnitSystem, withUnit } from '../lib/units.ts'
import { storedRecords } from '../lib/user-store.ts'
import { type UserBulletView, userBullets } from '../lib/variants.ts'
import { HitProbability } from './hit-probability.tsx'
import { LazyLineChart as LineChart, preloadChart } from './lazy-chart.tsx'
import { MovingTarget } from './moving-target.tsx'
import { NumberField } from './number-field.tsx'
import { type PaperSize, paperSizes, printRangeCard, RangeCard } from './range-card.tsx'
import { RecordSearch } from './record-search.tsx'
import { PanelTable } from './scroll-region.tsx'
import { provenanceKinds, RecordSourcesLink } from './sources.tsx'
import { ErrorNote, Loading } from './states.tsx'
import type { TruingNominal } from './truing-session.tsx'
import { useFieldUnits, useUnits } from './units-settings.tsx'
import { useManufacturerNames } from './use-manufacturer-names.ts'

const TruingSession = dynamic(() => import('./truing-session.tsx').then((m) => m.TruingSession), {
  ssr: false,
  loading: () => <Loading what="the truing" inline />,
})

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
/** The panels open at the start; the zero air and drag panel opens when a value fills it. */
const panels = ['bullet', 'load', 'rifle', 'conditions', 'output']
/** The fields a firearm choice fills and an edit leaves; the zero air and drag factor stay editable per run. */
const sightKeys = ['sightHeight', 'twist', 'zeroRange']
const omittedText: Record<OmittedEffect, Message> = {
  coriolis: msg('Coriolis'),
  coriolisVertical: msg('vertical Coriolis'),
  spinDrift: msg('spin drift (needs bullet length and twist)'),
  jump: msg('aerodynamic jump (needs bullet length and twist)'),
  spinDecay: msg('spin decay'),
  magnus: msg('Magnus force'),
}

const stopText: Record<Exclude<Trajectory['stop'], 'done'>, Message> = {
  apex: msg('the bullet stopped moving forward along the line of sight'),
  atmosphere: msg('the path left the atmosphere model (above 11000 m or below -5000 m altitude)'),
  maxTime: msg('the largest time of flight (120 s) was reached'),
  yaw: msg('the yaw of repose reached its limit'),
}

type T = Translator['t']

/**
 * `design`: the name of the user bullet design the bullet values came from; `si`: the SI
 * inputs of the result, so a later edit does not relabel its range card.
 */
type Result = TrajectoryResult & {
  /** The bullet's description in the language shown. */
  bulletText: string
  design?: string | undefined
  si: Record<string, number | undefined>
  /** The bullet values came from the manual fields, so the card lists mass and BC. */
  manual: boolean
  /** The chosen optic's turret click: the card gives the holds in clicks too. */
  click?: { value: number; unit?: 'MOA' | 'mrad' | undefined }
  /** Where the applied drag factor comes from: the mount it was filled from. */
  dragSource?: string
  /** The firearm configuration of the chosen sight, which a truing result is stored with. */
  target?: TruingNominal['target']
}

type RecordState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ok'; record: Bullet }
  | { status: 'error' }

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
  dragSource: string | undefined
  target: Result['target']
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

function noBcText(model: string, t: T) {
  return t(
    'This bullet has no {model} BC in the database. Choose {other} or enter the drag manually.',
    { model, other: model === 'G7' ? 'G1' : 'G7' },
  )
}

/** The errors of the edited fields, the first edited field with one, and the first empty one's error. */
function checkFields(i: Inputs, t: T) {
  const specs: readonly FieldSpec[] = i.source === 'manual' ? allFields : shotFields
  const errors: Record<string, string> = {}
  let invalid: string | undefined
  let empty: string | undefined
  for (const s of specs) {
    const error = fieldError(s, i.fields[s.key], i.system, t)
    if (!error) continue
    if (i.touched[s.key]) {
      errors[s.key] = error
      invalid ??= s.label
    } else empty ??= error
  }
  return { errors, invalid, empty }
}

type Drawn =
  | { projectile: ReturnType<typeof manualProjectile>; bullet: (t: T) => string }
  | { prompt: string }

/** The projectile of the manual fields, or the prompt for the field still empty. */
function manualDrawn(i: Inputs, si: ReturnType<typeof siValues>, empty: string | undefined): Drawn {
  if (empty) return { prompt: empty }
  const { design, manualModel: model } = i
  return {
    projectile: manualProjectile(si, model),
    bullet: (t) =>
      design
        ? t('{design} (user design), {model} manual drag', { design, model })
        : t('{model} manual drag', { model }),
  }
}

/** The projectile of the chosen bullet record, or the prompt for what is missing. */
function recordDrawn(i: Inputs, empty: string | undefined, t: T): Drawn {
  if (i.record.status !== 'ok') return { prompt: t('Choose a bullet from the database.') }
  const { record } = i.record
  const drag = bulletDrag(record, i.recordModel, i.choice)
  if (drag.kind === 'none') return { prompt: noBcText(i.recordModel, t) }
  if (drag.kind === 'choose') return { prompt: t('Choose one of the BC values of the record.') }
  if (empty) return { prompt: empty }
  const bc = bulletDrag(record, i.recordModel)
  const chosen = bc.kind === 'choose' && i.choice !== undefined ? bc.values[i.choice] : undefined
  const product = productLabel(record, i.names)
  const model = i.recordModel
  return {
    projectile: drag.projectile,
    bullet: (t) =>
      chosen
        ? t('{product}, {model} {value} lb/in²', { product, model, value: chosen.value })
        : t('{product}, {model}', { product, model }),
  }
}

/** The result's fields that only some inputs have: the optic's click, the drag source, the design. */
function resultExtras(i: Inputs) {
  return {
    ...(i.click && { click: i.click }),
    ...(i.dragSource && { dragSource: i.dragSource }),
    ...(i.target && { target: i.target }),
    ...(i.source === 'manual' && i.design && { design: i.design }),
  }
}

/** Field errors of the edited fields and the outcome of one computation, texts in the language of `t`. */
function evaluate(i: Inputs, t: T): { errors: Record<string, string>; attempt: Attempt } {
  const { errors, invalid, empty } = checkFields(i, t)
  if (invalid) return { errors, attempt: { kind: 'invalid', label: invalid } }
  const prompt = (text: string) => ({ errors, attempt: { kind: 'prompt', text } as const })
  const si = siValues(i.fields)
  const drawn = i.source === 'manual' ? manualDrawn(i, si, empty) : recordDrawn(i, empty, t)
  if ('prompt' in drawn) return prompt(drawn.prompt)
  try {
    return {
      errors,
      attempt: {
        kind: 'ok',
        result: {
          ...trajectoryResult(si, drawn.projectile, i.twistHand),
          bulletText: drawn.bullet(t),
          si,
          manual: i.source === 'manual',
          ...resultExtras(i),
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
  record: Bullet
  names: ManufacturerNames
  system: UnitSystem
}) {
  const { t } = useTranslation()
  const mm = (x: number) => withUnit('length', system, toSi('length', x))
  const product = productLabel(record, names)
  const mass = withUnit('mass', system, toSi('mass', record.mass.value))
  const diameter = mm(record.diameter.value)
  return (
    <div className="record">
      <p>
        {record.length
          ? t('{product}: {mass}, diameter {diameter}, length {length}', {
              product,
              mass,
              diameter,
              length: mm(record.length.value),
            })
          : t('{product}: {mass}, diameter {diameter}', { product, mass, diameter })}
      </p>
      <ul>
        {(record.ballisticCoefficients ?? []).map((c, i) => {
          const values = { model: c.dragModel, value: c.value }
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: BCs keep the record order and have no id
            <li key={i}>
              {c.minVelocity
                ? t('{model} {value} lb/in² from {velocity}', {
                    ...values,
                    velocity: withUnit('velocity', system, c.minVelocity.value),
                  })
                : t('{model} {value} lb/in²', values)}
              {c.note && ` (${c.note})`}
            </li>
          )
        })}
      </ul>
      <p className="sources">
        <RecordSourcesLink
          kind="bullets"
          id={record.id}
          label={t('Sources ({kind})', { kind: t(provenanceKinds[record.provenance.kind]) })}
        />
      </p>
    </div>
  )
}

/** The holds and the design note of a result. */
function ResultTop({ result, system }: { result: Result; system: UnitSystem }) {
  const { t } = useTranslation()
  const u = (q: Parameters<typeof formatQuantity>[0]) => system[q].symbol
  const rows = result.tablePoints
  const last = rows[rows.length - 1]
  const at = { range: last ? withUnit('range', system, last.range) : '' }
  return (
    <>
      {result.design && (
        <p className="note user-design">
          {t('Computed from the user design {design}, not a catalogue record.', {
            design: result.design,
          })}
        </p>
      )}
      {last && (
        <dl className="readouts">
          <div>
            <dt>{t('Elevation hold at {range}', at)}</dt>
            <dd>{angle(system, last.elevationHold)}</dd>
          </div>
          <div>
            <dt>{t('Windage hold at {range}', at)}</dt>
            <dd>{angle(system, last.windageHold)}</dd>
          </div>
          <div>
            <dt>{t('Velocity at {range}', at)}</dt>
            <dd>
              {formatQuantity('velocity', system, last.velocity)} {u('velocity')}
            </dd>
          </div>
          <div>
            <dt>{t('Energy at {range}', at)}</dt>
            <dd>
              {formatQuantity('energy', system, last.energy)} {u('energy')}
            </dd>
          </div>
        </dl>
      )}
    </>
  )
}

/** The summary list of a result: bore elevation, air, stability, transonic range and what was left out. */
function ResultNotes({ result, system }: { result: Result; system: UnitSystem }) {
  const { t } = useTranslation()
  const { trajectory: flight, tablePoints: rows } = result
  const last = rows[rows.length - 1]
  const transonic = rows.find((p) => p.transonic || p.subsonic)
  const zero = zeroConditions(result.si, system, result.dragSource, t)
  return (
    <ul className="summary">
      <li>
        {t('Bore elevation above the line of sight: {angle}', {
          angle: angle(system, flight.bore.elevationAngle),
        })}
      </li>
      <li>
        {t('Density altitude: {altitude}', {
          altitude: withUnit('altitude', system, result.densityAltitude),
        })}
      </li>
      {zero.zeroAir && <li>{t('Zero air: {air}', { air: zero.zeroAir })}</li>}
      {zero.dragFactor && (
        <li>{t('Drag factor applied: {factor}', { factor: zero.dragFactor })}</li>
      )}
      {flight.stability !== undefined && (
        <li>
          {t('Gyroscopic stability (Miller): {value}', {
            value: formatNumber(flight.stability, 2),
          })}
        </li>
      )}
      {transonic && (
        <li>
          {t('Transonic from {range}', { range: withUnit('range', system, transonic.range) })}
        </li>
      )}
      {flight.omitted.length > 0 && (
        <li>
          {t('Effects left out: {list}', {
            list: flight.omitted.map((o) => t(omittedText[o])).join(', '),
          })}
        </li>
      )}
      {flight.stop !== 'done' && (
        <li>
          {t('The computation stopped early: {reason}. Last computed range: {range}.', {
            reason: t(stopText[flight.stop]),
            range: last ? withUnit('range', system, last.range) : t('none'),
          })}
        </li>
      )}
    </ul>
  )
}

/** The trajectory table of a result. */
function ResultTable({ result, system }: { result: Result; system: UnitSystem }) {
  const { t } = useTranslation()
  const u = (q: Parameters<typeof formatQuantity>[0]) => system[q].symbol
  const rows = result.tablePoints
  return (
    <PanelTable
      label={t('Trajectory table')}
      caption={t('Trajectory: {label}, zero {range}', {
        label: result.bulletText,
        range: withUnit('range', system, result.zeroRange),
      })}
      columns={[
        t('Range ({unit})', { unit: u('range') }),
        t('Height ({unit})', { unit: u('lineOfSightOffset') }),
        t('Elevation hold ({unit})', { unit: u('correction') }),
        t('Windage ({unit})', { unit: u('lineOfSightOffset') }),
        t('Windage hold ({unit})', { unit: u('correction') }),
        t('Velocity ({unit})', { unit: u('velocity') }),
        t('Mach'),
        t('Energy ({unit})', { unit: u('energy') }),
        t('Time (s)'),
      ]}
      numeric
    >
      {rows.map((p) => {
        const mach = formatNumber(p.mach, 2)
        return (
          <tr key={p.range}>
            <td className="num">{formatQuantity('range', system, p.range)}</td>
            <td className="num">{formatQuantity('lineOfSightOffset', system, p.height)}</td>
            <td className="num">{formatQuantity('correction', system, p.elevationHold)}</td>
            <td className="num">{formatQuantity('lineOfSightOffset', system, p.windage)}</td>
            <td className="num">{formatQuantity('correction', system, p.windageHold)}</td>
            <td className="num">{formatQuantity('velocity', system, p.velocity)}</td>
            <td className="num">
              {p.subsonic
                ? t('{mach} subsonic', { mach })
                : p.transonic
                  ? t('{mach} transonic', { mach })
                  : mach}
            </td>
            <td className="num">{formatQuantity('energy', system, p.energy)}</td>
            <td className="num">{formatNumber(p.time, 3)}</td>
          </tr>
        )
      })}
    </PanelTable>
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
  chartHeight?: number | undefined
  /** Over the chart's top right corner, so it shows and goes without moving the chart. */
  staleLine?: ReactNode
}) {
  const { t } = useTranslation()
  const u = (q: Parameters<typeof formatQuantity>[0]) => system[q].symbol
  const { tablePoints: rows, chartPoints: chart } = result
  const notes = <ResultNotes result={result} system={system} />
  const chartEl = (
    <LineChart
      height={chartHeight}
      fill={chartHeight === undefined}
      x={chart.map((p) => system.range.fromSi(p.range))}
      y={chart.map((p) => system.lineOfSightOffset.fromSi(p.height))}
      xLabel={t('Range ({unit})', { unit: u('range') })}
      yLabel={t('Height above the line of sight ({unit})', { unit: u('lineOfSightOffset') })}
      title={t('Height above the line of sight against range')}
      description={t('From 0 to {range}; lowest point {low}. The table tab lists the values.', {
        range: withUnit('range', system, chart[chart.length - 1]?.range ?? 0),
        low: withUnit('lineOfSightOffset', system, Math.min(...chart.map((p) => p.height))),
      })}
      zeroLine
    />
  )
  const tableEl = <ResultTable result={result} system={system} />
  return (
    <>
      {notes}
      <div className="trajectory-chart">
        {staleLine}
        {chartEl}
      </div>
      {tableEl}
      <details className="values-details">
        <summary>{t('Moving target and hit probability')}</summary>
        <MovingTarget points={rows} system={system} />
        <HitProbability
          points={rows}
          windPerUnit={result.windPerUnit.mps}
          wind={{ speed: result.si.windSpeed ?? 0, from: result.si.windFrom ?? Math.PI / 2 }}
          bulletDiameter={result.bulletDiameter}
          system={system}
        />
      </details>
      <details className="values-details screen-only">
        <summary>{t('Truing from range strings')}</summary>
        <TruingSession
          nominal={{
            shot: result.shot,
            bullet: result.bulletText,
            zeroRange: result.zeroRange,
            click: result.click?.value,
            target: result.target,
          }}
          system={system}
        />
      </details>
    </>
  )
}

/** What the workbench reads from its Trajectory tab: the tab's query for Copy link. */
export type TrajectoryHandle = { query: () => string }

/** The firearm record and configuration a sight option names (`<record>/<configuration>/<mount>`). */
function targetOf(o: { value: string; label: string } | undefined): Result['target'] {
  // the example rifle is never stored, so nothing can be stored with it
  if (!o || o.value.startsWith(`${exampleData.firearm.id}/`)) return
  const [first, last] = [o.value.indexOf('/'), o.value.lastIndexOf('/')]
  return { record: o.value.slice(0, first), config: o.value.slice(first + 1, last), label: o.label }
}

/** What the tab's keys of a copied link set: the fields, the bullet and the drag model. */
function readLink(system: UnitSystem) {
  // the tab's keys under `tab.`: the workbench's query holds interior keys such as twist
  const query = tabQuery(linkParams(window.location).toString(), 'trajectory')
  if (!query) return
  const fields = queryFields(query, allFields, system, roundedFieldText)
  const choice = Number(query.get('choice') || Number.NaN)
  const bullet = query.get('bullet')
  return {
    fields,
    touched: Object.fromEntries(
      allFields.filter((s) => fields[s.key]?.text).map((s) => [s.key, true]),
    ),
    showZero: zeroKeys.some((k) => fields[k]?.text),
    model: query.get('drag') as DragModel | null,
    bullet,
    choice: Number.isInteger(choice) ? choice : undefined,
    manual: !bullet && query.has('mass'),
    left: query.get('hand') === 'left',
  }
}

type LinkActions = {
  form: { setValues: (f: Fields) => void; setTouched: (t: Record<string, boolean>) => void }
  showZero: () => void
  setRecordModel: (m: 'G1' | 'G7') => void
  chooseRecord: (id: string, choice?: number) => Promise<void>
  setSource: (s: 'database' | 'manual') => void
  setManualModel: (m: DragModel) => void
  setTwistHand: (h: 'right' | 'left') => void
}

/** Sets the form and its choices from what a copied link holds. */
function applyLink(link: NonNullable<ReturnType<typeof readLink>>, a: LinkActions) {
  a.form.setValues(link.fields)
  if (link.showZero) a.showZero()
  // linked values count as edited, so one outside its bounds shows its error
  a.form.setTouched(link.touched)
  if (link.bullet) {
    if (link.model === 'G1' || link.model === 'G7') a.setRecordModel(link.model)
    void a.chooseRecord(link.bullet, link.choice)
  } else if (link.manual) {
    a.setSource('manual')
    if (link.model && dragModels.includes(link.model)) a.setManualModel(link.model)
  }
  if (link.left) a.setTwistHand('left')
}

type BulletFieldsProps = {
  own: boolean
  source: 'database' | 'manual'
  setSource: (s: 'database' | 'manual') => void
  system: UnitSystem
  names: ManufacturerNames
  record: RecordState
  recordModel: 'G1' | 'G7'
  setRecordModel: (m: 'G1' | 'G7') => void
  setChoice: (c: number | undefined) => void
  choice: number | undefined
  chooseRecord: (id: string) => Promise<void>
  loadBullet: string | undefined
  replaced: boolean
  designs: UserBulletView[]
  design: UserBulletView | undefined
  readDesigns: () => void
  chooseDesign: (id: string) => void
  manualModel: DragModel
  setManualModel: (m: DragModel) => void
  group: (keys: string[]) => ReactNode[]
}

/** The bullet record the form draws the drag from: its search, drag model, BC choice and facts. */
function DatabaseBullet({
  own,
  system,
  names,
  record,
  recordModel,
  setRecordModel,
  setChoice,
  choice,
  chooseRecord,
  loadBullet,
  replaced,
}: BulletFieldsProps) {
  const { t } = useTranslation()
  const u = (q: Parameters<typeof formatQuantity>[0]) => system[q].symbol
  const drag = record.status === 'ok' ? bulletDrag(record.record, recordModel, choice) : undefined
  // without `choice`, so the BC list stays while one value is chosen
  const bcOptions = record.status === 'ok' ? bulletDrag(record.record, recordModel) : undefined
  const chosen =
    bcOptions?.kind === 'choose' && choice !== undefined ? bcOptions.values[choice] : undefined
  return (
    <>
      {own && (
        <div className="wide">
          <RecordSearch<BulletSummary>
            kind="bullets"
            label={t('Search bullets by manufacturer or name')}
            // the chosen record in the field, as in the workbench's pickers
            chosen={
              record.status === 'ok' ? productLabel(record.record, names) : t('Search bullets')
            }
            describe={(b) =>
              `${productLabel(b, names)}, ${formatQuantity('mass', system, toSi('mass', b.mass))} ${u('mass')}`
            }
            onSelect={(b) => chooseRecord(b.id)}
            noneText={t('No bullet found')}
            unreachableText={t('The database is unreachable; manual input still works.')}
          />
        </div>
      )}
      <NativeSelect
        label={t('Drag model')}
        value={recordModel}
        data={['G7', 'G1']}
        onChange={(e) => {
          setRecordModel(e.currentTarget.value as 'G1' | 'G7')
          setChoice(undefined)
        }}
      />
      <div className="wide">
        {record.status === 'loading' && <Loading what="the bullet record" inline />}
        {record.status === 'error' && (
          <p>{t('The database is unreachable; manual input still works.')}</p>
        )}
        {/* the Bullet card shows the load's record */}
        {record.status === 'ok' && own && (
          <RecordDetails record={record.record} names={names} system={system} />
        )}
        {record.status === 'ok' && record.record.id === loadBullet && (
          <p className="note from-load">
            {replaced
              ? t(
                  'From the load: the bullet of the Bullet panel, in place of the one entered here.',
                )
              : t('From the load: the bullet of the Bullet panel.')}
          </p>
        )}
        {drag?.kind === 'none' && <p className="note">{noBcText(recordModel, t)}</p>}
        {bcOptions?.kind === 'choose' && (
          <Radio.Group
            label={t('The record lists several {model} BCs without velocity bands; choose one', {
              model: recordModel,
            })}
            value={choice === undefined ? null : String(choice)}
            onChange={(v) => setChoice(Number(v))}
          >
            <Stack gap="xs" mt="xs">
              {bcOptions.values.map((v, i) => (
                <Radio
                  // biome-ignore lint/suspicious/noArrayIndexKey: BCs keep the record order and have no id
                  key={i}
                  value={String(i)}
                  label={`${t('{value} lb/in²', { value: v.value })}${v.note ? ` (${v.note})` : ''}`}
                />
              ))}
            </Stack>
          </Radio.Group>
        )}
        {chosen && (
          <p>
            {t('{model} BC {value} lb/in² chosen from the record, used from 0 {unit}.', {
              model: recordModel,
              value: chosen.value,
              unit: u('velocity'),
            })}
          </p>
        )}
      </div>
    </>
  )
}

/** The manual bullet: a design of this browser, the values and the drag model. */
function ManualBullet({
  designs,
  design,
  readDesigns,
  chooseDesign,
  manualModel,
  setManualModel,
  group,
}: BulletFieldsProps) {
  const { t } = useTranslation()
  return (
    <>
      <NativeSelect
        className="wide"
        label={t('Bullet design')}
        description={t(
          'From your bullet designs in this browser; fills mass, diameter and length.',
        )}
        value={design?.id ?? ''}
        onFocus={readDesigns}
        onChange={(e) => chooseDesign(e.currentTarget.value)}
        data={[
          { value: '', label: designs.length ? t('None') : t('None in this browser') },
          ...designs.map((d) => ({ value: d.id, label: d.name })),
        ]}
      />
      {group(['mass', 'diameter', 'length'])}
      <NativeSelect
        label={t('Drag model')}
        value={manualModel}
        data={dragModels}
        onChange={(e) => setManualModel(e.currentTarget.value as DragModel)}
      />
      {group(['ballisticCoefficient'])}
    </>
  )
}

/** The Bullet panel's fields: with the load's bullet no source switch or search. */
function BulletFields(props: BulletFieldsProps) {
  const { own, source, setSource } = props
  const { t } = useTranslation()
  return (
    <>
      {/* with the load's bullet: no source switch or search */}
      {own && (
        <SegmentedControl
          size={controlSize.row.toggle}
          aria-label={t('Bullet source')}
          className="wide"
          value={source}
          onChange={(v) => setSource(v as 'database' | 'manual')}
          data={[
            { value: 'database', label: t('From the database') },
            { value: 'manual', label: t('Manual drag') },
          ]}
        />
      )}
      {source === 'database' ? <DatabaseBullet {...props} /> : <ManualBullet {...props} />}
    </>
  )
}

type RifleFieldsProps = {
  ownSight: boolean
  sightGone: boolean
  sight: string
  sights: ReturnType<typeof sightPicker>
  readSights: () => void
  chooseSight: (value: string) => void
  twistHand: 'right' | 'left'
  setTwistHand: (h: 'right' | 'left') => void
  setSight: (value: string) => void
  group: (keys: string[]) => ReactNode[]
}

/** The Rifle and scope panel's fields: the firearm's sight, the twist and its direction, the zero range. */
function RifleFields({
  ownSight,
  sightGone,
  sight,
  sights,
  readSights,
  chooseSight,
  twistHand,
  setTwistHand,
  setSight,
  group,
}: RifleFieldsProps) {
  const { t } = useTranslation()
  return (
    <>
      {ownSight && (
        <NativeSelect
          className="wide"
          label={t('Firearm and sight')}
          description={
            sightGone
              ? t('The chosen firearm is no longer in this browser; its values stay.')
              : t(
                  'From your firearm library; fills sight height, twist, zero range, zero air and drag factor.',
                )
          }
          value={sight}
          onFocus={readSights}
          onChange={(e) => chooseSight(e.currentTarget.value)}
          data={[
            { value: '', label: sights.none },
            ...sights.options.map(({ value, label }) => ({ value, label })),
          ]}
        />
      )}
      {group(['sightHeight', 'twist'])}
      <div className="twist-hand">
        <p className="segment-label" id="twist-hand">
          {t('Twist direction')}
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
            { value: 'right', label: t('Right') },
            { value: 'left', label: t('Left') },
          ]}
        />
      </div>
      {group(['zeroRange'])}
    </>
  )
}

/** The text over a result whose inputs changed. */
function staleTextOf(attempt: Attempt, t: T) {
  return attempt.kind === 'invalid'
    ? t('Result for earlier inputs. Fix {label} to update.', { label: specText(t, attempt.label) })
    : t('Result for earlier inputs.')
}

/** The status line of an attempt: the update it made, or that the result is of earlier inputs. */
function summaryOf(attempt: Attempt, stale: boolean, system: UnitSystem, t: T) {
  if (attempt.kind === 'ok') {
    const rows = attempt.result.tablePoints
    const lastRow = rows[rows.length - 1]
    if (lastRow)
      return t('Updated: {rows} ranges, elevation at {range} {angle}.', {
        rows: rows.length,
        range: withUnit('range', system, lastRow.range),
        angle: angle(system, lastRow.elevationHold),
      })
  }
  return stale ? staleTextOf(attempt, t) : ''
}

/** The fields a computation still needs before its first result. */
function neededOf(
  source: 'database' | 'manual',
  record: RecordState,
  fields: Fields,
): readonly Message[] {
  return [
    ...(source === 'database' && record.status !== 'ok' ? [msg('Bullet')] : []),
    ...(source === 'manual' ? [...manualBulletFields, ...shotFields] : shotFields)
      .filter((s) => 'required' in s && s.required && !fields[s.key]?.text)
      .map((s) => s.label),
  ]
}

/** The alert, the prompt, or before the first result what is still needed and the example. */
function FormNotes({
  alert,
  attempt,
  emptyState,
  needed,
  fillExample,
}: {
  alert: ReactNode
  attempt: Attempt
  emptyState: boolean
  needed: readonly Message[]
  fillExample: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {alert}
      {attempt.kind === 'prompt' && attempt.text && !emptyState && (
        <p className="prompt">{attempt.text}</p>
      )}
      {emptyState && (
        <section aria-labelledby="trajectory-empty" className="trajectory-empty">
          <h2 id="trajectory-empty">{t('No result yet')}</h2>
          {attempt.kind === 'prompt' && <p className="prompt">{attempt.text}</p>}
          {needed.length > 0 && (
            <>
              <p>{t('Still needed:')}</p>
              <ul>
                {needed.map((label) => (
                  <li key={label}>{t(label)}</li>
                ))}
              </ul>
            </>
          )}
          {exampleData && (
            <Button variant="default" onClick={fillExample}>
              {t('Use the example')}
            </Button>
          )}
        </section>
      )}
    </>
  )
}

/** The range card's Print menu, one entry per paper size. */
function RangeCardMenu({ setPaper }: { setPaper: (size: PaperSize) => void }) {
  const { t } = useTranslation()
  return (
    // an icon at the end of the holds row, so the hold labels keep their width
    <Menu position="bottom-end" withinPortal shadow="sm">
      <Menu.Target>
        <ActionIcon
          variant="default"
          size={controlSize.row.icon}
          className="range-card-button"
          aria-label={t('Print range card')}
          title={t('Print range card')}
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
            {t('Print on {size}', { size: size.toUpperCase() })}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

/** The holds of the result and the range card's Print menu. */
function TrajectoryTop({
  result,
  system,
  stale,
  printButton,
}: {
  result: Result
  system: UnitSystem
  stale: boolean
  printButton: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <section
      aria-labelledby="trajectory-result"
      className="result trajectory-top"
      data-stale={stale || undefined}
    >
      <h2 id="trajectory-result" className="visually-hidden">
        {t('Trajectory result')}
      </h2>
      <ResultTop result={result} system={system} />
      {printButton}
    </section>
  )
}

/** The notes, the chart, the table and the range card of the result. */
function TrajectoryDetail({
  result,
  system,
  stale,
  wide,
  staleLine,
  paper,
}: {
  result: Result
  system: UnitSystem
  stale: boolean
  wide: boolean
  staleLine: ReactNode
  paper: PaperSize
}) {
  return (
    <div className="trajectory-detail" data-stale={stale || undefined}>
      <ResultDetail
        result={result}
        system={system}
        chartHeight={wide ? undefined : 200}
        staleLine={staleLine}
      />
      <RangeCard result={result} system={system} paper={paper} />
    </div>
  )
}

/** The latest result, kept on each new attempt during render without a second committed render. */
function useLastResult(attempt: Attempt) {
  const [last, setLast] = useState<Result | undefined>(undefined)
  const [seen, setSeen] = useState<Attempt>()
  if (seen !== attempt) {
    setSeen(attempt)
    if (attempt.kind === 'ok') setLast(attempt.result)
  }
  const result = attempt.kind === 'ok' ? attempt.result : last
  const stale = attempt.kind !== 'ok' && result !== undefined
  return { result, stale, clearLast: () => setLast(undefined) }
}

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
    muzzleVelocity?: number | undefined
    bullet?: string | undefined
    /** The mass, diameter, length and BCs of the load's bullet, with what the user typed over the record. */
    bulletValues?: BulletValues | undefined
    twist?: number | undefined
    /** The chosen firearm's sight, SI. */
    sightHeight?: number | undefined
    zeroRange?: number | undefined
    /** The chosen firearm's zero air and drag factor with its source, SI. */
    zeroTemperature?: number | undefined
    zeroPressure?: number | undefined
    zeroHumidity?: number | undefined
    dragFactor?: number | undefined
    dragFactorSource?: string | undefined
  }
  ref?: Ref<TrajectoryHandle> | undefined
}) {
  const { t } = useTranslation()
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
  const [fetched, setRecord] = useState<RecordState>({ status: 'none' })
  /** The record with the values the load typed over it, while it is the load's. */
  const { bulletValues, bullet: loadRecordId } = load
  const record = useMemo<RecordState>(
    () =>
      fetched.status === 'ok' && bulletValues && fetched.record.id === loadRecordId
        ? { status: 'ok', record: typedBullet(fetched.record, bulletValues) }
        : fetched,
    [fetched, bulletValues, loadRecordId],
  )
  const [choice, setChoice] = useState<number | undefined>(undefined)
  const [twistHand, setTwistHand] = useState<'right' | 'left'>('right')
  // from 62em the chart fills the results column's height
  const wide = useMediaQuery('(min-width: 62em)')
  const [sights, setSights] = useState(() => sightPicker([], exampleData.firearm as UserRecord, t))
  const [sight, setSight] = useState('')
  const [paper, setPaper] = useState<PaperSize>('a4')
  /** The chosen firearm was gone when the list was read again. */
  const [sightGone, setSightGone] = useState(false)
  /** The drag factor as a firearm's mount filled it and that mount's source note. */
  const [dragFrom, setDragFrom] = useState<{ factor: number; source: string }>()
  const [openPanels, setOpenPanels] = useState(panels)
  const showZero = () => setOpenPanels((o) => (o.includes('zero') ? o : [...o, 'zero']))
  const [designs, setDesigns] = useState<UserBulletView[]>([])
  /** The bullet design the manual bullet values came from; an edit of one of them leaves it. */
  const [design, setDesign] = useState<UserBulletView>()
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
      click: sights.options.find((o) => o.value === sight)?.fill.click,
      target: targetOf(sights.options.find((o) => o.value === sight)),
      dragSource: dragFrom?.factor === fields.dragFactor?.si ? dragFrom?.source : undefined,
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
      dragFrom,
    ],
  )
  const [debounced] = useDebouncedValue(inputs, 150)
  const { errors, attempt } = useMemo(() => evaluate(debounced, t), [debounced, t])
  const { result, stale, clearLast } = useLastResult(attempt)

  const staleText = staleTextOf(attempt, t)
  const summary = summaryOf(attempt, stale, system, t)
  // announced and alerted 1 s after the last change, so values passed while typing stay quiet
  const [status] = useDebouncedValue(summary, 1000)
  const [staleStatus] = useDebouncedValue(stale, 1000)
  const message = attempt.kind === 'error' ? attempt.message : ''
  const [alerted] = useDebouncedValue(message, 1000)
  const alert = alerted && alerted === message && (
    <ErrorNote>{translateMessage(message, t)}</ErrorNote>
  )

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
        // an edited factor is no longer the one the source names
        if (spec.key === 'dragFactor') setDragFrom(undefined)
      }}
      error={
        errors[spec.key]
          ? (s) => fieldError(spec, fields[spec.key], s, t) ?? errors[spec.key]
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
    clearLast()
    setSight('')
    setSightGone(false)
    setDragFrom(undefined)
    setDesign(undefined)
  }

  /**
   * Sets the zero air and drag factor fields from a firearm's mount; a mount without them empties
   * the fields, so no other firearm's factor stays applied.
   */
  function fillZero(get: (key: (typeof zeroKeys)[number]) => number | undefined, source?: string) {
    for (const key of zeroKeys) {
      const si = get(key)
      const q = (allFields as readonly FieldSpec[]).find((f) => f.key === key)?.quantity
      form.setFieldValue(
        key,
        si === undefined || !q
          ? { text: '', si: undefined }
          : { text: roundedFieldText(q, system, si), si },
      )
    }
    if (zeroKeys.some((k) => get(k) !== undefined)) showZero()
    const factor = get('dragFactor')
    setDragFrom(factor !== undefined && source ? { factor, source } : undefined)
  }

  /** The browser's bullet designs, read again on focus as the firearms are. */
  const readDesigns = () => {
    storedRecords()
      .then(({ records }) => userBullets(records))
      .then(setDesigns)
      .catch(() => {})
  }

  /** Fills mass, diameter and length from a bullet design; they stay editable. */
  function chooseDesign(id: string) {
    const d = designs.find((r) => r.id === id)
    setDesign(d)
    if (!d) return
    for (const s of allFields.filter((f) => designKeys.includes(f.key))) {
      const si = d.si[s.key as keyof UserBulletView['si']]
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
        const picker = sightPicker(records, exampleData.firearm as UserRecord, t)
        setSights(picker)
        if (sight && !picker.options.some((o) => o.value === sight)) {
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
    const s = sights.options.find((o) => o.value === value)
    if (!s) return
    const set = (key: string, q: FieldSpec['quantity'], si: number) =>
      form.setFieldValue(key, { text: roundedFieldText(q, system, si), si })
    set('sightHeight', 'length', s.fill.sightHeight)
    set('zeroRange', 'range', s.fill.zeroRange)
    // a firearm without twist empties the field, so no other rifle's twist stays
    if (s.fill.twist !== undefined) set('twist', 'twist', s.fill.twist)
    else form.setFieldValue('twist', { text: '', si: undefined })
    setTwistHand(s.fill.twistHand)
    fillZero((key) => s.fill[key], s.fill.dragFactorSource)
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
      const body = await fetchRecord<Bullet>('bullets', id, controller.signal)
      if (!body) throw new Error('No such bullet')
      if (controller.signal.aborted) return
      setRecord({ status: 'ok', record: body })
      setChoice(linkedChoice)
    } catch {
      if (controller.signal.aborted) return
      setRecord({ status: 'error' })
    }
  }

  // a copied link fills the form once
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on mount only
  useEffect(() => {
    preloadChart()
    readDesigns()
    readSights()
    const link = readLink(system)
    if (link)
      applyLink(link, {
        form,
        showZero,
        setRecordModel,
        chooseRecord,
        setSource,
        setManualModel,
        setTwistHand,
      })
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
  /** The zero air and drag factor fields hold a firearm of the load's values. */
  const zeroFromLoad = useRef(false)
  const loadZeroAir = [load.zeroTemperature, load.zeroPressure, load.zeroHumidity]
  const [loadFactor, loadFactorSource] = [load.dragFactor, load.dragFactorSource]
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the load's firearm, not a unit switch
  useEffect(() => {
    if (loadSight !== undefined) {
      // a firearm without them leaves typed or linked values alone, unless they are another
      // firearm's
      const has = zeroKeys.some((key) => load[key] !== undefined)
      if (has || zeroFromLoad.current) fillZero((key) => load[key], loadFactorSource)
      zeroFromLoad.current = has
    } else if (zeroFromLoad.current) {
      // the load's firearm has no mount or was cleared: its zero air and factor go with it
      zeroFromLoad.current = false
      fillZero(() => undefined)
    }
  }, [loadSight, ...loadZeroAir, loadFactor, loadFactorSource])
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
    void chooseRecord(loadBullet)
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
      <Accordion multiple value={openPanels} onChange={setOpenPanels} order={2} className="panels">
        <Accordion.Item value="bullet">
          {/* the Bullet card of the workbench is a region "Bullet" too: one name per landmark */}
          <Accordion.Control aria-label={t('Bullet of the trajectory')}>
            {t('Bullet')}
          </Accordion.Control>
          <Accordion.Panel>
            <div className="panel-fields">
              <BulletFields
                own={own}
                source={source}
                setSource={setSource}
                system={system}
                names={names}
                record={record}
                recordModel={recordModel}
                setRecordModel={setRecordModel}
                setChoice={setChoice}
                choice={choice}
                chooseRecord={chooseRecord}
                loadBullet={loadBullet}
                replaced={replaced}
                designs={designs}
                design={design}
                readDesigns={readDesigns}
                chooseDesign={chooseDesign}
                manualModel={manualModel}
                setManualModel={setManualModel}
                group={group}
              />
            </div>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="load">
          <Accordion.Control>{t('Load')}</Accordion.Control>
          <Accordion.Panel>
            <div className="panel-fields">
              {group(['muzzleVelocity'])}
              {loadVelocity !== undefined && fields.muzzleVelocity?.si === loadVelocity && (
                <p className="note from-load">
                  {t('From the load: muzzle velocity of the last run.')}
                </p>
              )}
            </div>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="rifle">
          <Accordion.Control>{t('Rifle and scope')}</Accordion.Control>
          <Accordion.Panel>
            <div className="panel-fields">
              <RifleFields
                ownSight={ownSight}
                sightGone={sightGone}
                sight={sight}
                sights={sights}
                readSights={readSights}
                chooseSight={chooseSight}
                twistHand={twistHand}
                setTwistHand={setTwistHand}
                setSight={setSight}
                group={group}
              />
            </div>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="zero">
          <Accordion.Control>{t('Zero air and drag')}</Accordion.Control>
          <Accordion.Panel>
            <div className="panel-fields">
              {group(['zeroTemperature', 'zeroPressure', 'zeroHumidity', 'dragFactor'])}
              {inputs.dragSource && (
                <p className="note from-load">
                  {t('Drag factor source: {source}', { source: inputs.dragSource })}
                </p>
              )}
            </div>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="conditions">
          <Accordion.Control>{t('Conditions')}</Accordion.Control>
          <Accordion.Panel>
            <div className="panel-fields">
              {group(['temperature', 'pressure', 'altitude', 'humidity', 'windSpeed', 'windFrom'])}
            </div>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="output">
          <Accordion.Control>{t('Output')}</Accordion.Control>
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
  const needed = neededOf(source, record, fields)

  // the stale line shows the state, so a stale or lagging stale text is only announced
  const statusLine = (
    <p role="status" className={stale || staleStatus ? 'status-quiet' : 'status'}>
      {status}
    </p>
  )
  const formNotes = (
    <FormNotes
      alert={alert}
      attempt={attempt}
      emptyState={emptyState}
      needed={needed}
      fillExample={fillExample}
    />
  )
  const staleLine = stale && <p className="stale-line">{staleText}</p>
  const printButton = <RangeCardMenu setPaper={setPaper} />

  // one view at every width: the holds and Print range card, the inputs, then the notes,
  // the chart and the table; from 62em the chart takes the height the results column leaves
  return (
    <div className="embedded-calculator trajectory-view">
      {statusLine}
      {result && (
        <TrajectoryTop result={result} system={system} stale={stale} printButton={printButton} />
      )}
      {inputsPanel}
      {formNotes}
      {result && (
        <TrajectoryDetail
          result={result}
          system={system}
          stale={stale}
          wide={Boolean(wide)}
          staleLine={staleLine}
          paper={paper}
        />
      )}
    </div>
  )
}
