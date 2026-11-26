'use client'

import type { I18n, MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { Button, NumberInput, SegmentedControl, Select, UnstyledButton } from '@mantine/core'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { loadEnglish } from '../i18n/lingui.ts'
import { formatNumber } from '../i18n/number.ts'
import {
  noComparableLimitText,
  refusalText,
  targetError,
  targetNumber,
  targetUnit,
} from '../lib/charge-target.ts'
import { refusalText as thrownText, translateMessage } from '../lib/core-messages.ts'
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
import englishMessages from '../locales/en/components/powder-compare.json' with { type: 'json' }
import {
  type PowderTabState,
  powderTableCsv,
  restoredPowderTab,
  savedPowderTab,
  switchedTarget,
  targetPressure,
} from './powder-csv.ts'
import { ScrollRegion, withTableRoles } from './scroll-region.tsx'
import { TableCsv } from './table-csv.tsx'
import { useManufacturerNames } from './use-manufacturer-names.ts'
import {
  type CompareMessage,
  type CompareRow,
  noBulkDensity,
  notMetallicReason,
  reasonText,
  usePowderCompare,
} from './use-powder-compare.ts'
import { useLoad } from './workbench-context.ts'
import { flagView } from './workbench-readouts.tsx'

loadEnglish(englishMessages)

const targetLabel = /*i18n*/ { id: 'powderCompare.target', context: 'charge', message: 'Target' }

type Column = {
  key: string
  label: MessageDescriptor
  /** The quantity whose unit symbol follows the label. */
  unit?: 'charge' | 'pressure' | 'velocity' | undefined
  value: (r: CompareRow) => string | number | undefined
}

const columns: readonly Column[] = [
  {
    key: 'powder',
    label: /*i18n*/ { id: 'powderCompare.powder', message: 'Powder' },
    value: (r) => productLabel(r),
  },
  {
    key: 'charge',
    label: /*i18n*/ { id: 'powderCompare.charge', message: 'Charge' },
    unit: 'charge',
    value: (r) => r.charge,
  },
  {
    key: 'flags',
    label: /*i18n*/ { id: 'powderCompare.flags', message: 'Flags' },
    value: (r) => r.flag,
  },
  {
    key: 'peak',
    label: /*i18n*/ { id: 'powderCompare.peakPressure', message: 'Peak pressure' },
    unit: 'pressure',
    value: (r) => r.values?.peak,
  },
  {
    key: 'percent',
    label: /*i18n*/ { id: 'powderCompare.percentMaximum', message: 'Percent of maximum' },
    value: (r) => r.values?.percent,
  },
  {
    key: 'velocity',
    label: /*i18n*/ { id: 'powderCompare.muzzleVelocity', message: 'Muzzle velocity' },
    unit: 'velocity',
    value: (r) => r.values?.velocity,
  },
  {
    key: 'fill',
    label: /*i18n*/ { id: 'powderCompare.caseFill', message: 'Case fill' },
    value: (r) => r.ratio,
  },
  {
    key: 'burnt',
    label: /*i18n*/ { id: 'powderCompare.burntMuzzle', message: 'Burnt at the muzzle' },
    value: (r) => r.values?.burnt,
  },
  {
    key: 'burnout',
    label: /*i18n*/ { id: 'powderCompare.burnout', message: 'Burnout' },
    value: (r) => r.values?.burnout,
  },
]

/** The target mode shows the pressure range at the charge found where the other modes show the peak. */
const rangeColumn: Column = {
  key: 'range',
  label: /*i18n*/ { id: 'powderCompare.pressureRange', message: 'Pressure range' },
  unit: 'pressure',
  value: (r) => r.values?.range.low,
}
const columnsFor = (target: boolean) =>
  target ? columns.map((c) => (c.key === 'peak' ? rangeColumn : c)) : columns

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
  const { i18n } = useLingui()
  return (
    <th
      scope="col"
      aria-sort={dir}
      className={first || c.key === 'flags' ? undefined : 'num'}
      data-col={c.key}
    >
      <UnstyledButton className="sort-button" onClick={() => onSort(nextSort(c.key, dir))}>
        <span>
          {i18n._(c.label)}
          {c.unit && <span className="th-unit"> {system[c.unit].symbol}</span>}
        </span>
        {dir && (
          <span aria-hidden="true" className="sort-mark">
            {dir === 'ascending' ? (
              <ChevronUp size={12} strokeWidth={2.25} />
            ) : (
              <ChevronDown size={12} strokeWidth={2.25} />
            )}
          </span>
        )}
      </UnstyledButton>
    </th>
  )
}

/** The case fill of a row; the reason it is unknown is the title. */
function FillCell({ ratio }: { ratio: number | undefined }) {
  const { i18n } = useLingui()
  return (
    <td
      data-label={i18n._({ id: 'powderCompare.caseFill', message: 'Case fill' })}
      className="num"
      title={ratio === undefined ? i18n._(noBulkDensity) : undefined}
    >
      {ratio === undefined ? (
        <>
          <span aria-hidden="true">&ndash;</span>
          <span className="visually-hidden">
            {i18n._({ id: 'powderCompare.unknown', message: 'unknown' })}
          </span>
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
  const { i18n } = useLingui()
  const flag = r.flagText?.(t)
  return (
    <>
      <td data-label={i18n._({ id: 'powderCompare.flags', message: 'Flags' })}>
        {flag && flagView(flag)}
      </td>
      {target ? (
        <td
          data-label={i18n._({
            id: 'powderCompare.pressureRangeUnit',
            message: 'Pressure range, {unit}',
            values: { unit: system.pressure.symbol },
          })}
          className="num"
        >
          {i18n._({
            id: 'powderCompare.lowToHigh',
            message: '{low} to {high}',
            values: {
              low: formatQuantity('pressure', system, values.range.low),
              high: formatQuantity('pressure', system, values.range.high),
            },
          })}
        </td>
      ) : (
        <td
          data-label={i18n._({
            id: 'powderCompare.peakPressureUnit',
            message: 'Peak pressure, {unit}',
            values: { unit: system.pressure.symbol },
          })}
          className="num"
        >
          {formatQuantity('pressure', system, values.peak)}
        </td>
      )}
      <td
        data-label={i18n._({ id: 'powderCompare.percentMaximum', message: 'Percent of maximum' })}
        className="num"
      >
        {values.percent === undefined
          ? i18n._({ id: 'powderCompare.noLimit', message: 'no limit' })
          : `${formatNumber(values.percent, 0)} %`}
      </td>
      <td
        data-label={i18n._({
          id: 'powderCompare.muzzleVelocityUnit',
          message: 'Muzzle velocity, {unit}',
          values: { unit: system.velocity.symbol },
        })}
        className="num"
      >
        {formatQuantity('velocity', system, values.velocity)}
      </td>
      <FillCell ratio={r.ratio} />
      <td
        data-label={i18n._({ id: 'powderCompare.burntMuzzle', message: 'Burnt at the muzzle' })}
        className="num"
      >
        {formatNumber(values.burnt * 100, 0)} %
      </td>
      <td data-label={i18n._({ id: 'powderCompare.burnout', message: 'Burnout' })} className="num">
        {values.burnout === undefined
          ? i18n._({ id: 'powderCompare.none', message: 'none' })
          : shownLength('travel', system, values.burnout)}
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
  const { i18n } = useLingui()
  const name = productLabel(r)
  return (
    <tr aria-current={r.id === current ? 'true' : undefined}>
      <td data-label={i18n._({ id: 'powderCompare.powder', message: 'Powder' })}>
        {/* a long name is cut after two lines: the title holds it in full */}
        <UnstyledButton
          className="powder-open"
          title={`${name}\n${i18n._({ id: 'powderCompare.usePowderWorkbench', message: 'Use this powder in the workbench' })}`}
          onClick={() => onOpen(r)}
        >
          {name}
        </UnstyledButton>
        {r.id === current && (
          <span className="barrel-current">
            {i18n._({ id: 'powderCompare.current', message: 'current' })}
          </span>
        )}
      </td>
      <td
        data-label={i18n._({
          id: 'powderCompare.chargeUnit',
          message: 'Charge, {unit}',
          values: { unit: system.charge.symbol },
        })}
        className="num"
      >
        {r.charge !== undefined && formatQuantity('charge', system, r.charge)}
      </td>
      {r.values ? (
        <ValueCells row={r} values={r.values} target={target} system={system} />
      ) : (
        <td
          data-label={i18n._({ id: 'powderCompare.result', message: 'Result' })}
          colSpan={columns.length - 2}
        >
          {i18n._({
            id: 'powderCompare.notComputedReason',
            message: 'Not computed: {reason}',
            values: {
              reason: r.refusal
                ? refusalText(r.refusal, 'peakPressure', system, percent, t, i18n)
                : reasonText(r, i18n),
            },
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
  const { i18n } = useLingui()
  return (
    <ScrollRegion
      label={i18n._({ id: 'powderCompare.powdersLoad', message: 'Powders for this load' })}
    >
      {withTableRoles(
        <table className="limits ladder-table powder-table">
          <caption className="visually-hidden">
            {i18n._({
              id: 'powderCompare.powdersLoadSimulation',
              message: 'Powders for this load (simulation)',
            })}
          </caption>
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

/** A share of Pmax stays a share without a cartridge (a load opened before its cartridge record, or a design): it is not read as a pressure, and Compute waits for the cartridge. */
function targetOf(
  text: number | string,
  left: boolean,
  percent: boolean,
  withCartridge: boolean,
  system: UnitSystem,
  i18n: I18n,
) {
  const unit = targetUnit('peakPressure', system, percent)
  const reason =
    percent && !withCartridge
      ? i18n._({
          id: 'powderCompare.sharePmaxNeedsCartridge',
          message: "A share of Pmax needs the cartridge's CIP Pmax.",
        })
      : targetError(text, unit, i18n)
  return {
    unit,
    valid: reason === undefined,
    shown: text !== '' || left ? reason : undefined,
  }
}

const modeValid = (kind: CompareMode['kind'], fillValid: boolean, targetValid: boolean) =>
  (kind !== 'fill' || fillValid) && (kind !== 'target' || targetValid)

/** The typed target and the pressure it keeps: a unit switch shows it in the new unit, as the workbench fields do. */
function useTargetText(first: PowderTabState, percent: boolean, system: UnitSystem) {
  const [target, setTarget] = useState<Pick<PowderTabState, 'targetText' | 'targetKept'>>({
    targetText: first.targetText,
    targetKept: first.targetKept,
  })
  const [shown, setShown] = useState(system)
  if (shown !== system) {
    setShown(system)
    setTarget(switchedTarget({ ...target, percent }, shown, system))
  }
  // a typed value is read in the shown unit: the pressure kept from a unit switch no longer applies
  const setTargetText = (targetText: number | string) =>
    setTarget({ targetText, targetKept: undefined })
  return { ...target, setTargetText }
}

/** Whether the tab shows what it opened with: the manufacturer filter compared by its id. */
function sameTab(
  now: PowderTabState,
  first: PowderTabState,
  idOf: (name: string) => string | undefined,
) {
  const key = (s: PowderTabState) =>
    JSON.stringify([
      s.kind,
      s.fill,
      s.targetText,
      s.percent,
      s.filters.base,
      s.filters.form,
      s.filters.manufacturerName ? idOf(s.filters.manufacturerName) : s.maker,
    ])
  return key(now) === key(first)
}

/** The filters, from what the load kept: a kept manufacturer's name shows once the names arrive. */
function useKeptFilters(first: PowderTabState, names: ReadonlyMap<string, string>) {
  const [filters, setFilters] = useState(first.filters)
  // a kept manufacturer filter whose name is not known yet; picking one clears it
  const [maker, setMaker] = useState(first.maker)
  const makerName = maker && names.get(maker)
  if (makerName && !filters.manufacturerName)
    setFilters((f) => ({ ...f, manufacturerName: makerName }))
  return { filters, setFilters, maker, setMaker }
}

/** A tab only looked at keeps what the load kept, to the digit, in any unit: a target typed in bar and shown in psi is not rounded into the file. */
function useKeptTab(
  now: PowderTabState,
  first: PowderTabState,
  system: UnitSystem,
  names: ReadonlyMap<string, string>,
) {
  const { powderTab } = useLoad()
  // what the load kept when the tab opened (the tab mounts afresh for each opened load)
  const [opened] = useState(powderTab.saved)
  const idOf = (name: string) => [...names].find(([, n]) => n === name)?.[0]
  const saved = sameTab(now, first, idOf) ? opened : savedPowderTab(now, system, idOf)
  const save = powderTab.set
  useEffect(() => save(saved), [save, saved])
}

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
    /** Rows of shotgun-only powders, not in `failed`. */
    shotgun: number
    message: CompareMessage | undefined
    targetShown: string | undefined
    stale: boolean
  },
  i18n: I18n,
) {
  let head: string | undefined
  if (o.running && o.progress)
    head = i18n._({
      id: 'powderCompare.computingPowders',
      message: 'Computing {done, decimal} of {total, decimal} powders',
      values: {
        done: o.progress.done,
        total: o.progress.total,
      },
    })
  else if (o.total > 0)
    head =
      o.shown === o.total
        ? i18n._({
            id: 'powderCompare.powdersNotComputed',
            message: '{total, decimal} powders, {failed, decimal} not computed',
            values: { total: o.total, failed: o.failed },
          })
        : i18n._({
            id: 'powderCompare.shownPowdersNotComputed',
            message: '{shown, decimal} of {total, decimal} powders, {failed, decimal} not computed',
            values: {
              shown: o.shown,
              total: o.total,
              failed: o.failed,
            },
          })
  const parts = [
    head,
    o.shotgun > 0 && !o.running
      ? i18n._({
          id: 'powderCompare.shotgunOnlyPowdersLeft',
          message: 'Shotgun-only powders left out: {shotgun, decimal}',
          values: { shotgun: o.shotgun },
        })
      : undefined,
    o.message && messageText(o.message, i18n),
    o.targetShown,
    o.stale
      ? i18n._({
          id: 'powderCompare.inputsChangedSinceThese',
          message: 'Inputs changed since these rows',
        })
      : undefined,
  ].filter(Boolean)
  return parts.length > 0 ? `${parts.map((p) => p?.replace(/\.$/, '')).join('. ')}.` : ''
}

/** The line after a batch that stopped early or failed. */
function messageText(message: CompareMessage, i18n: I18n) {
  if (message.kind === 'stopped')
    return i18n._({
      id: 'powderCompare.stoppedReason',
      message: 'Stopped. {reason}',
      values: { reason: i18n._(noComparableLimitText) },
    })
  if (message.kind === 'cancelled')
    return i18n._({
      id: 'powderCompare.cancelledAfterPowders',
      message: 'Cancelled after {done, decimal} of {total, decimal} powders.',
      values: {
        done: message.done,
        total: message.total,
      },
    })
  return translateMessage(thrownText(message.error), i18n)
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
  const { i18n } = useLingui()
  if (kind === 'target')
    return (
      <NumberInput
        size={controlSize.row.input}
        aria-label={i18n._({
          id: 'powderCompare.targetPeakPressure',
          message: 'Target peak pressure',
        })}
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
      aria-label={i18n._({ id: 'powderCompare.caseFill', message: 'Case fill' })}
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

/** Cancels the run when another powder is picked (a design's id before its powder's, which a record and its designs share), as its parameters go into the fields the later rows read. */
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

/** Nothing runs until Compute. */
export function PowderCompare({ system }: { system: UnitSystem }) {
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const { loadRequest, powder, powderDesign, pickPowder, applyCharge, fields, cartridge } =
    useLoad()
  const { powderTab } = useLoad()
  // the mode and the filters the load was saved with (`key` on this tab: an opened load starts afresh)
  const names = useManufacturerNames()
  const [first] = useState(() => restoredPowderTab(powderTab.saved, system, names))
  const [kind, setKind] = useState<CompareMode['kind']>(first.kind)
  const [fill, setFill] = useState<number | string>(first.fill)
  const fillValid = isFillValid(fill)
  // the target of the charge target dialog: a peak pressure, or a share of the cartridge's CIP Pmax
  const [percent, setPercent] = useState(first.percent)
  const { targetText, targetKept, setTargetText } = useTargetText(first, percent, system)
  // the reason shows for a typed value, and for an empty field once it was left
  const [targetLeft, setTargetLeft] = useState(false)
  const targetField = targetOf(
    targetText,
    targetLeft,
    percent,
    cartridge !== undefined,
    system,
    i18n,
  )
  const { unit, valid: targetValid, shown: targetShown } = targetField
  const asPercent = percent && cartridge !== undefined
  const mode = modeOf(
    kind,
    fillValid ? (fill as number) / 100 : undefined,
    // a share of Pmax is no pressure: its unit reads the percentage
    targetValid
      ? (targetPressure({ targetText, targetKept, percent }, system) ??
          unit.toSi(targetNumber(targetText)))
      : undefined,
    asPercent,
  )
  const study = usePowderCompare(loadRequest, mode)
  useCancelOnPick(powderDesign?.id, powder?.id, study.cancel)
  // the load keeps the mode and the filters; a filter stays while Compute fills the rows again
  const { filters, setFilters, maker, setMaker } = useKeptFilters(first, names)
  useKeptTab({ kind, fill, targetText, targetKept, percent, filters, maker }, first, system, names)
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
  const reason = (r: CompareRow) =>
    r.refusal
      ? refusalText(
          r.refusal,
          'peakPressure',
          system,
          study.mode?.kind === 'target' && study.mode.percent,
          t,
          i18n,
        )
      : reasonText(r, i18n)
  const csv = () => powderTableCsv(shown, target, system, t, reason)
  const { progress, running, message } = study
  const shotgun = study.rows.filter((r) => r.reason === notMetallicReason).length
  const failed = study.rows.filter((r) => !r.values).length - shotgun
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
      shotgun,
      message,
      targetShown,
      stale,
    },
    i18n,
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
      // a filter of the saved load shows before Compute lists its facets
      data={filters[key] && !data.includes(filters[key]) ? [filters[key], ...data] : data}
      value={filters[key]}
      onChange={(v) => {
        if (key === 'manufacturerName') setMaker(undefined)
        setFilters((f) => ({ ...f, [key]: v }))
      }}
    />
  )
  return (
    <div className="powder-compare screen-only">
      <div className="powder-controls">
        <SegmentedControl
          size={controlSize.row.toggle}
          aria-label={i18n._({ id: 'powderCompare.charge', message: 'Charge' })}
          data={[
            {
              value: 'typed',
              label: i18n._({ id: 'powderCompare.typedCharge', message: 'Typed charge' }),
            },
            {
              value: 'fill',
              label: i18n._({ id: 'powderCompare.caseFill', message: 'Case fill' }),
            },
            {
              value: 'target',
              label: i18n._(targetLabel),
            },
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
          aria-pressed={percent}
          // a share kept by a load opened without its cartridge can still be switched off
          disabled={kind !== 'target' || (cartridge === undefined && !percent)}
          title={i18n._({
            id: 'powderCompare.readTargetPercentageCartridge',
            message: "Read the target as a percentage of the cartridge's CIP Pmax",
          })}
          onClick={() => {
            setPercent(!percent)
            setTargetText('')
            setTargetLeft(false)
          }}
        >
          {i18n._({ id: 'powderCompare.percentPmax', message: '% Pmax' })}
        </Button>
        <Button
          size={controlSize.row.button}
          variant={running ? 'default' : 'filled'}
          disabled={!running && !modeValid(kind, fillValid, targetValid)}
          onClick={running ? study.cancel : study.compute}
        >
          {running
            ? i18n._({ id: 'powderCompare.cancel', message: 'Cancel' })
            : i18n._({ id: 'powderCompare.compute', message: 'Compute' })}
        </Button>
      </div>
      <div className="powder-filters">
        {select(
          'manufacturerName',
          i18n._({ id: 'powderCompare.manufacturer', message: 'Manufacturer' }),
          manufacturers,
        )}
        {select('base', i18n._({ id: 'powderCompare.base', message: 'Base' }), bases)}
        {select('form', i18n._({ id: 'powderCompare.form', message: 'Form' }), forms)}
        <TableCsv csv={csv} disabled={shown.length === 0} />
      </div>
      <p className="barrel-status" aria-hidden="true">
        <span className="barrel-status-text" title={text}>
          {text}
        </span>
      </p>
      {/* the count changes with every answer: the live region says only start, end and cancel */}
      <p className="visually-hidden" role="status">
        {running
          ? i18n._({ id: 'powderCompare.computingPowdersShort', message: 'Computing powders.' })
          : text}
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
