'use client'

import { Button, NumberInput, SegmentedControl, Select, UnstyledButton } from '@mantine/core'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import {
  noComparableLimitText,
  refusalText,
  targetError,
  targetNumber,
  targetUnit,
} from '../lib/charge-target.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { productLabel } from '../lib/manufacturers.ts'
import {
  type ColumnSort,
  type CompareMode,
  caseFillPercentRange,
  compareKey,
  distinctValues,
  filterPowderRows,
  type PowderFilters,
  sortForMode,
  sortPowderRows,
} from '../lib/powder-compare.ts'
import { controlSize } from '../lib/theme.ts'
import { formatQuantity, shownLength, type UnitSystem } from '../lib/units.ts'
import { ScrollRegion, withTableRoles } from './scroll-region.tsx'
import {
  type CompareMessage,
  type CompareRow,
  noBulkDensity,
  reasonText,
  usePowderCompare,
} from './use-powder-compare.ts'
import { useLoad } from './workbench-context.ts'
import { flagView } from './workbench-readouts.tsx'

type Column = {
  key: string
  label: Message
  /** The quantity whose unit symbol follows the label. */
  unit?: 'charge' | 'pressure' | 'velocity' | undefined
  value: (r: CompareRow) => string | number | undefined
}

const columns: readonly Column[] = [
  { key: 'powder', label: msg('Powder'), value: (r) => productLabel(r) },
  { key: 'charge', label: msg('Charge'), unit: 'charge', value: (r) => r.charge },
  { key: 'flags', label: msg('Flags'), value: (r) => r.flag },
  { key: 'peak', label: msg('Peak pressure'), unit: 'pressure', value: (r) => r.values?.peak },
  { key: 'percent', label: msg('Percent of maximum'), value: (r) => r.values?.percent },
  {
    key: 'velocity',
    label: msg('Muzzle velocity'),
    unit: 'velocity',
    value: (r) => r.values?.velocity,
  },
  { key: 'fill', label: msg('Case fill'), value: (r) => r.ratio },
  { key: 'burnt', label: msg('Burnt at the muzzle'), value: (r) => r.values?.burnt },
  { key: 'burnout', label: msg('Burnout'), value: (r) => r.values?.burnout },
]

/** The target mode shows the pressure range at the charge found where the other modes show the peak. */
const rangeColumn: Column = {
  key: 'range',
  label: msg('Pressure range'),
  unit: 'pressure',
  value: (r) => r.values?.range.low,
}
const columnsFor = (target: boolean) =>
  target ? columns.map((c) => (c.key === 'peak' ? rangeColumn : c)) : columns

const noFilters: PowderFilters = { manufacturerName: '', base: '', form: '' }

const nextSort = (
  key: string,
  dir: 'ascending' | 'descending' | undefined,
): ColumnSort | undefined => {
  if (dir === undefined) return { column: key, dir: 'ascending' }
  return dir === 'ascending' ? { column: key, dir: 'descending' } : undefined
}

function SortHead({
  column: c,
  first,
  dir,
  system,
  onSort,
}: {
  column: Column
  first: boolean
  dir: 'ascending' | 'descending' | undefined
  system: UnitSystem
  onSort: (sort: ColumnSort | undefined) => void
}) {
  const { t } = useTranslation()
  return (
    <th
      scope="col"
      aria-sort={dir}
      className={first || c.key === 'flags' ? undefined : 'num'}
      data-col={c.key}
    >
      <UnstyledButton className="sort-button" onClick={() => onSort(nextSort(c.key, dir))}>
        <span>
          {t(c.label)}
          {c.unit && <span className="th-unit"> {system[c.unit].symbol}</span>}
        </span>
        {dir && (
          <span aria-hidden="true" className="sort-mark">
            {dir === 'ascending' ? (
              <CaretUp size={12} weight="bold" />
            ) : (
              <CaretDown size={12} weight="bold" />
            )}
          </span>
        )}
      </UnstyledButton>
    </th>
  )
}

/** The case fill of a row; the reason it is unknown is the title. */
function FillCell({ ratio }: { ratio: number | undefined }) {
  const { t } = useTranslation()
  return (
    <td
      data-label={t('Case fill')}
      className="num"
      title={ratio === undefined ? t(noBulkDensity) : undefined}
    >
      {ratio === undefined ? (
        <>
          <span aria-hidden="true">&ndash;</span>
          <span className="visually-hidden">{t('unknown')}</span>
        </>
      ) : (
        `${formatNumber(ratio * 100, 0)} %`
      )}
    </td>
  )
}

type Values = NonNullable<CompareRow['values']>

/** The cells of a computed row after the charge. */
function ValueCells({
  row: r,
  values,
  target,
  system,
}: {
  row: CompareRow
  values: Values
  target: boolean
  system: UnitSystem
}) {
  const { t } = useTranslation()
  const flag = r.flagText?.(t)
  return (
    <>
      <td data-label={t('Flags')}>{flag && flagView(flag)}</td>
      {target ? (
        <td
          data-label={t('Pressure range, {unit}', { unit: system.pressure.symbol })}
          className="num"
        >
          {t('{low} to {high}', {
            low: formatQuantity('pressure', system, values.range.low),
            high: formatQuantity('pressure', system, values.range.high),
          })}
        </td>
      ) : (
        <td
          data-label={t('Peak pressure, {unit}', { unit: system.pressure.symbol })}
          className="num"
        >
          {formatQuantity('pressure', system, values.peak)}
        </td>
      )}
      <td data-label={t('Percent of maximum')} className="num">
        {values.percent === undefined ? t('no limit') : `${formatNumber(values.percent, 0)} %`}
      </td>
      <td
        data-label={t('Muzzle velocity, {unit}', { unit: system.velocity.symbol })}
        className="num"
      >
        {formatQuantity('velocity', system, values.velocity)}
      </td>
      <FillCell ratio={r.ratio} />
      <td data-label={t('Burnt at the muzzle')} className="num">
        {formatNumber(values.burnt * 100, 0)} %
      </td>
      <td data-label={t('Burnout')} className="num">
        {values.burnout === undefined ? t('none') : shownLength('travel', system, values.burnout)}
      </td>
    </>
  )
}

function PowderRow({
  row: r,
  current,
  target,
  percent,
  system,
  onOpen,
}: {
  row: CompareRow
  current: string | undefined
  target: boolean
  percent: boolean
  system: UnitSystem
  onOpen: (row: CompareRow) => void
}) {
  const { t } = useTranslation()
  const name = productLabel(r)
  return (
    <tr aria-current={r.id === current ? 'true' : undefined}>
      <td data-label={t('Powder')}>
        {/* a long name is cut after two lines: the title holds it in full */}
        <UnstyledButton
          className="powder-open"
          title={`${name}\n${t('Use this powder in the workbench')}`}
          onClick={() => onOpen(r)}
        >
          {name}
        </UnstyledButton>
        {r.id === current && <span className="barrel-current">{t('current')}</span>}
      </td>
      <td data-label={t('Charge, {unit}', { unit: system.charge.symbol })} className="num">
        {r.charge !== undefined && formatQuantity('charge', system, r.charge)}
      </td>
      {r.values ? (
        <ValueCells row={r} values={r.values} target={target} system={system} />
      ) : (
        <td data-label={t('Result')} colSpan={columns.length - 2}>
          {t('Not computed: {reason}', {
            reason: r.refusal
              ? refusalText(r.refusal, 'peakPressure', system, percent, t)
              : reasonText(r.reason ?? '', t),
          })}
        </td>
      )}
    </tr>
  )
}

/** The rows as a sortable table; the powder's name opens it in the workbench. */
const Rows = memo(function Rows({
  rows,
  target,
  percent,
  sort,
  onSort,
  system,
  current,
  onOpen,
}: {
  rows: CompareRow[]
  /** The rows are the charges found for a peak pressure; `percent`: the target was a share of Pmax. */
  target: boolean
  percent: boolean
  sort: ColumnSort | undefined
  onSort: (sort: ColumnSort | undefined) => void
  system: UnitSystem
  current: string | undefined
  onOpen: (row: CompareRow) => void
}) {
  const { t } = useTranslation()
  return (
    <ScrollRegion label={t('Powders for this load')}>
      {withTableRoles(
        <table className="limits ladder-table powder-table">
          <caption className="visually-hidden">{t('Powders for this load (simulation)')}</caption>
          <thead>
            <tr>
              {columnsFor(target).map((c, i) => (
                <SortHead
                  key={c.key}
                  column={c}
                  first={i === 0}
                  dir={sort?.column === c.key ? sort.dir : undefined}
                  system={system}
                  onSort={onSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <PowderRow
                key={r.id}
                row={r}
                current={current}
                target={target}
                percent={percent}
                system={system}
                onOpen={onOpen}
              />
            ))}
          </tbody>
        </table>,
      )}
    </ScrollRegion>
  )
})

const isFillValid = (fill: number | string) =>
  typeof fill === 'number' && fill >= caseFillPercentRange.min && fill <= caseFillPercentRange.max

const isFiltering = (f: PowderFilters) => Boolean(f.manufacturerName || f.base || f.form)

/** The mode the chosen charge kind and its valid value give; the typed charge otherwise. */
function modeOf(
  kind: CompareMode['kind'],
  fill: number | undefined,
  target: number | undefined,
  percent: boolean,
): CompareMode {
  if (kind === 'fill' && fill !== undefined) return { kind, fill }
  if (kind === 'target' && target !== undefined) return { kind, value: target, percent }
  return { kind: 'typed' }
}

const modeValid = (kind: CompareMode['kind'], fillValid: boolean, targetValid: boolean) =>
  (kind !== 'fill' || fillValid) && (kind !== 'target' || targetValid)

/** The rows were computed for another load or charge than the fields hold now. */
function isStale(
  loadRequest: ReturnType<typeof useLoad>['loadRequest'],
  mode: CompareMode,
  key: string | undefined,
  running: boolean,
) {
  if (key === undefined || running) return false
  try {
    const now = loadRequest()
    return compareKey(now.body, mode, now.recordInputs) !== key
  } catch {
    return true
  }
}

/** The status line: the progress or the count, the message, the target's reason, and staleness. */
function statusText(
  o: {
    running: boolean
    progress: { done: number; total: number } | undefined
    shown: number
    total: number
    failed: number
    message: CompareMessage | undefined
    targetShown: string | undefined
    stale: boolean
  },
  t: Translator['t'],
) {
  let head: string | undefined
  if (o.running && o.progress)
    head = t('Computing {done} of {total} powders', {
      done: o.progress.done,
      total: o.progress.total,
    })
  else if (o.total > 0)
    head =
      o.shown === o.total
        ? t('{total} powders, {failed} not computed', { total: o.total, failed: o.failed })
        : t('{shown} of {total} powders, {failed} not computed', {
            shown: o.shown,
            total: o.total,
            failed: o.failed,
          })
  const parts = [
    head,
    o.message && messageText(o.message, t),
    o.targetShown,
    o.stale ? t('Inputs changed since these rows') : undefined,
  ].filter(Boolean)
  return parts.length > 0 ? `${parts.map((p) => p?.replace(/\.$/, '')).join('. ')}.` : ''
}

/** The line after a batch that stopped early or failed. */
function messageText(message: CompareMessage, t: Translator['t']) {
  if (message.kind === 'stopped')
    return t('Stopped. {reason}', { reason: t(noComparableLimitText) })
  if (message.kind === 'cancelled')
    return t('Cancelled after {done} of {total} powders.', {
      done: message.done,
      total: message.total,
    })
  return translateMessage(message.text, t)
}

/** Whether the row's charge is not the typed one (to a part in a billion). */
const differsFrom = (typed: number | undefined, charge: number) =>
  typed === undefined || Math.abs(typed - charge) > 1e-9 * charge

function FilterSelect({
  label,
  searchable,
  data,
  value,
  onChange,
}: {
  label: string
  searchable: boolean
  data: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Select
      aria-label={label}
      placeholder={label}
      size={controlSize.row.input}
      searchable={searchable}
      clearable
      disabled={data.length === 0}
      data={data}
      value={value || null}
      onChange={(v) => onChange(v ?? '')}
    />
  )
}

/** The charge value: the target pressure for a target, else the case fill (disabled for a typed charge). */
function ChargeInput({
  kind,
  unit,
  targetShown,
  targetText,
  onTargetText,
  onTargetLeft,
  fill,
  onFill,
  fillValid,
}: {
  kind: CompareMode['kind']
  unit: ReturnType<typeof targetUnit>
  targetShown: string | undefined
  targetText: number | string
  onTargetText: (v: number | string) => void
  onTargetLeft: () => void
  fill: number | string
  onFill: (v: number | string) => void
  fillValid: boolean
}) {
  const { t } = useTranslation()
  if (kind === 'target')
    return (
      <NumberInput
        size={controlSize.row.input}
        aria-label={t('Target peak pressure')}
        suffix={` ${unit.symbol}`}
        hideControls
        allowNegative={false}
        decimalScale={unit.decimals}
        // the reason stands in the status line, which does not move the controls: the field keeps it as its description
        error={targetShown}
        classNames={{ error: 'field-error-elsewhere' }}
        styles={{ wrapper: { marginBottom: 0 } }}
        title={targetShown}
        value={targetText}
        onChange={onTargetText}
        onBlur={onTargetLeft}
      />
    )
  return (
    <NumberInput
      size={controlSize.row.input}
      aria-label={t('Case fill')}
      suffix=" %"
      min={caseFillPercentRange.min}
      max={caseFillPercentRange.max}
      step={5}
      allowNegative={false}
      clampBehavior="none"
      disabled={kind !== 'fill'}
      error={kind === 'fill' && !fillValid}
      value={fill}
      onChange={onFill}
    />
  )
}

/**
 * Cancels the Powders tab's run when another powder is picked (a design's id before its powder's,
 * which a record and its designs share): its parameters go into the fields the later
 * rows read.
 */
function useCancelOnPick(
  design: string | undefined,
  powder: string | undefined,
  cancel: () => void,
) {
  const picked = design ?? powder
  const runFor = useRef(picked)
  useEffect(() => {
    if (runFor.current === picked) return
    runFor.current = picked
    cancel()
  }, [picked, cancel])
}

/**
 * The Powders tab: every powder with model parameters for the load of the workbench. Nothing runs
 * until Compute.
 */
export function PowderCompare({ system }: { system: UnitSystem }) {
  const { t } = useTranslation()
  const { loadRequest, powder, powderDesign, pickPowder, applyCharge, fields, cartridge } =
    useLoad()
  const [kind, setKind] = useState<CompareMode['kind']>('typed')
  const [fill, setFill] = useState<number | string>(caseFillPercentRange.initial)
  const fillValid = isFillValid(fill)
  // the target of the charge target dialog: a peak pressure, or a share of the cartridge's CIP Pmax
  const [targetText, setTargetText] = useState<number | string>('')
  const [percent, setPercent] = useState(false)
  const asPercent = percent && cartridge !== undefined
  const unit = targetUnit('peakPressure', system, asPercent)
  // the reason shows for a typed value, and for an empty field once it was left
  const [targetLeft, setTargetLeft] = useState(false)
  const targetReason = targetError(targetText, unit, t)
  const targetValid = targetReason === undefined
  const targetShown = targetText !== '' || targetLeft ? targetReason : undefined
  const mode = modeOf(
    kind,
    fillValid ? (fill as number) / 100 : undefined,
    targetValid ? unit.toSi(targetNumber(targetText)) : undefined,
    asPercent,
  )
  const study = usePowderCompare(loadRequest, mode)
  useCancelOnPick(powderDesign?.id, powder?.id, study.cancel)
  const [filters, setFilters] = useState(noFilters)
  // Compute empties the rows and with them the facets the filters name
  if (study.rows.length === 0 && isFiltering(filters)) setFilters(noFilters)
  const [sort, setSort] = useState<ColumnSort | undefined>()
  // the columns follow the mode the rows were computed for, not the one chosen since
  const target = study.mode?.kind === 'target'
  // a sort on the peak (range) column moves to the range (peak) column of the other mode
  const sorted = sortForMode(sort, target)
  if (sorted !== sort) setSort(sorted)
  const shown = useMemo(
    () =>
      sortPowderRows(
        filterPowderRows(study.rows, filters),
        sort,
        (column) => columnsFor(target).find((c) => c.key === column)?.value,
      ),
    [study.rows, filters, sort, target],
  )
  const manufacturers = useMemo(() => distinctValues(study.rows, 'manufacturerName'), [study.rows])
  const bases = useMemo(() => distinctValues(study.rows, 'base'), [study.rows])
  const forms = useMemo(() => distinctValues(study.rows, 'form'), [study.rows])
  const { progress, running, message } = study
  const failed = study.rows.filter((r) => !r.values).length
  // `loadRequest` is a new function on each change of the load, so filter and sort changes skip it
  const stale = useMemo(
    () => isStale(loadRequest, mode, study.key, running),
    [loadRequest, mode, study.key, running],
  )
  const text = statusText(
    {
      running,
      progress,
      shown: shown.length,
      total: study.rows.length,
      failed,
      message,
      targetShown,
      stale,
    },
    t,
  )
  const open = (r: CompareRow) => {
    pickPowder(r.id)
    // the row's values are for its charge: a case fill row sets it too
    if (r.charge !== undefined && differsFrom(fields.charge?.si, r.charge)) applyCharge(r.charge)
  }
  // the table is memoized: the handler it holds does not change with the fields
  const latest = useRef(open)
  latest.current = open
  const onOpen = useCallback((r: CompareRow) => latest.current(r), [])
  const select = (key: keyof PowderFilters, label: string, data: string[]) => (
    <FilterSelect
      label={label}
      searchable={key === 'manufacturerName'}
      data={data}
      value={filters[key]}
      onChange={(v) => setFilters((f) => ({ ...f, [key]: v }))}
    />
  )
  return (
    <div className="powder-compare screen-only">
      <div className="powder-controls">
        <SegmentedControl
          size={controlSize.row.toggle}
          aria-label={t('Charge')}
          data={[
            { value: 'typed', label: t('Typed charge') },
            { value: 'fill', label: t('Case fill') },
            { value: 'target', label: t('charge\u0004Target') },
          ]}
          value={kind}
          onChange={(v) => setKind(v as CompareMode['kind'])}
        />
        <ChargeInput
          kind={kind}
          unit={unit}
          targetShown={targetShown}
          targetText={targetText}
          onTargetText={setTargetText}
          onTargetLeft={() => setTargetLeft(true)}
          fill={fill}
          onFill={setFill}
          fillValid={fillValid}
        />
        <Button
          size={controlSize.row.button}
          variant="default"
          aria-pressed={asPercent}
          disabled={kind !== 'target' || cartridge === undefined}
          title={t("Read the target as a percentage of the cartridge's CIP Pmax")}
          onClick={() => {
            setPercent(!asPercent)
            setTargetText('')
            setTargetLeft(false)
          }}
        >
          {t('% Pmax')}
        </Button>
        <Button
          size={controlSize.row.button}
          variant={running ? 'default' : 'filled'}
          disabled={!running && !modeValid(kind, fillValid, targetValid)}
          onClick={running ? study.cancel : study.compute}
        >
          {running ? t('Cancel') : t('Compute')}
        </Button>
      </div>
      <div className="powder-filters">
        {select('manufacturerName', t('Manufacturer'), manufacturers)}
        {select('base', t('Base'), bases)}
        {select('form', t('Form'), forms)}
      </div>
      <p className="barrel-status" aria-hidden="true">
        <span className="barrel-status-text" title={text}>
          {text}
        </span>
      </p>
      {/* the count changes with every answer: the live region says only start, end and cancel */}
      <p className="visually-hidden" role="status">
        {running ? t('Computing powders.') : text}
      </p>
      <Rows
        rows={shown}
        target={target}
        percent={study.mode?.kind === 'target' && study.mode.percent}
        sort={sort}
        onSort={setSort}
        system={system}
        current={powder?.id}
        onOpen={onOpen}
      />
    </div>
  )
}
