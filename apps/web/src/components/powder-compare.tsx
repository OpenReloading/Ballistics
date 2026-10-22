'use client'

import { Button, NumberInput, SegmentedControl, Select, UnstyledButton } from '@mantine/core'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { refusalText, targetError, targetNumber, targetUnit } from '../lib/charge-target.ts'
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
import { formatNumber, formatQuantity, type UnitSystem } from '../lib/units.ts'
import { shownLength } from '../lib/workbench.ts'
import { ScrollRegion, withTableRoles } from './scroll-region.tsx'
import { type CompareRow, usePowderCompare } from './use-powder-compare.ts'
import { useLoad } from './workbench-context.ts'
import { flagView } from './workbench-readouts.tsx'

type Column = {
  key: string
  label: string
  /** The quantity whose unit symbol follows the label. */
  unit?: 'charge' | 'pressure' | 'velocity'
  value: (r: CompareRow) => string | number | undefined
}

const columns: readonly Column[] = [
  { key: 'powder', label: 'Powder', value: (r) => productLabel(r) },
  { key: 'charge', label: 'Charge', unit: 'charge', value: (r) => r.charge },
  { key: 'flags', label: 'Flags', value: (r) => r.flag },
  { key: 'peak', label: 'Peak pressure', unit: 'pressure', value: (r) => r.values?.peak },
  { key: 'percent', label: 'Percent of maximum', value: (r) => r.values?.percent },
  { key: 'velocity', label: 'Muzzle velocity', unit: 'velocity', value: (r) => r.values?.velocity },
  { key: 'fill', label: 'Case fill', value: (r) => r.ratio },
  { key: 'burnt', label: 'Burnt at the muzzle', value: (r) => r.values?.burnt },
  { key: 'burnout', label: 'Burnout', value: (r) => r.values?.burnout },
]

/** The target mode shows the pressure range at the charge found where the other modes show the peak. */
const rangeColumn: Column = {
  key: 'range',
  label: 'Pressure range',
  unit: 'pressure',
  value: (r) => r.values?.range.low,
}
const columnsFor = (target: boolean) =>
  target ? columns.map((c) => (c.key === 'peak' ? rangeColumn : c)) : columns

const noFilters: PowderFilters = { manufacturerName: '', base: '', form: '' }

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
  return (
    <ScrollRegion label="Powders for this load">
      {withTableRoles(
        <table className="limits ladder-table powder-table">
          <caption className="visually-hidden">Powders for this load (simulation)</caption>
          <thead>
            <tr>
              {columnsFor(target).map((c, i) => {
                const dir = sort?.column === c.key ? sort.dir : undefined
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={dir}
                    className={i === 0 || c.key === 'flags' ? undefined : 'num'}
                    data-col={c.key}
                  >
                    <UnstyledButton
                      className="sort-button"
                      onClick={() =>
                        onSort(
                          dir === undefined
                            ? { column: c.key, dir: 'ascending' }
                            : dir === 'ascending'
                              ? { column: c.key, dir: 'descending' }
                              : undefined,
                        )
                      }
                    >
                      <span>
                        {c.label}
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
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} aria-current={r.id === current ? 'true' : undefined}>
                <td data-label="Powder">
                  <UnstyledButton
                    className="powder-open"
                    title="Use this powder in the workbench"
                    onClick={() => onOpen(r)}
                  >
                    {productLabel(r)}
                  </UnstyledButton>
                  {r.id === current && <span className="barrel-current"> current</span>}
                </td>
                <td data-label={`Charge, ${system.charge.symbol}`} className="num">
                  {r.charge !== undefined && formatQuantity('charge', system, r.charge)}
                </td>
                {r.values ? (
                  <>
                    <td data-label="Flags">{r.flag && flagView(r.flag)}</td>
                    {target ? (
                      <td data-label={`Pressure range, ${system.pressure.symbol}`} className="num">
                        {formatQuantity('pressure', system, r.values.range.low)} to{' '}
                        {formatQuantity('pressure', system, r.values.range.high)}
                      </td>
                    ) : (
                      <td data-label={`Peak pressure, ${system.pressure.symbol}`} className="num">
                        {formatQuantity('pressure', system, r.values.peak)}
                      </td>
                    )}
                    <td data-label="Percent of maximum" className="num">
                      {r.values.percent === undefined
                        ? 'no limit'
                        : `${formatNumber(r.values.percent, 0)} %`}
                    </td>
                    <td data-label={`Muzzle velocity, ${system.velocity.symbol}`} className="num">
                      {formatQuantity('velocity', system, r.values.velocity)}
                    </td>
                    <td
                      data-label="Case fill"
                      className="num"
                      title={r.ratio === undefined ? 'No bulk density in the record' : undefined}
                    >
                      {r.ratio === undefined ? (
                        <>
                          <span aria-hidden="true">&ndash;</span>
                          <span className="visually-hidden">unknown</span>
                        </>
                      ) : (
                        `${formatNumber(r.ratio * 100, 0)} %`
                      )}
                    </td>
                    <td data-label="Burnt at the muzzle" className="num">
                      {formatNumber(r.values.burnt * 100, 0)} %
                    </td>
                    <td data-label="Burnout" className="num">
                      {r.values.burnout === undefined
                        ? 'none'
                        : shownLength('travel', system, r.values.burnout)}
                    </td>
                  </>
                ) : (
                  <td data-label="Result" colSpan={columns.length - 2}>
                    Not computed:{' '}
                    {r.refusal ? refusalText(r.refusal, 'peakPressure', system, percent) : r.reason}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>,
      )}
    </ScrollRegion>
  )
})

/**
 * The Powders tab: every powder with model parameters for the load of the workbench. Nothing runs
 * until Compute.
 */
export function PowderCompare({ system }: { system: UnitSystem }) {
  const { loadRequest, powder, choosePowder, applyCharge, fields, cartridge } = useLoad()
  const [kind, setKind] = useState<CompareMode['kind']>('typed')
  const [fill, setFill] = useState<number | string>(caseFillPercentRange.initial)
  const fillValid =
    typeof fill === 'number' && fill >= caseFillPercentRange.min && fill <= caseFillPercentRange.max
  // the target of the charge target dialog: a peak pressure, or a share of the cartridge's CIP Pmax
  const [targetText, setTargetText] = useState<number | string>('')
  const [percent, setPercent] = useState(false)
  const asPercent = percent && cartridge !== undefined
  const unit = targetUnit('peakPressure', system, asPercent)
  // the reason shows for a typed value, and for an empty field once it was left
  const [targetLeft, setTargetLeft] = useState(false)
  const targetReason = targetError(targetText, unit)
  const targetValid = targetReason === undefined
  const targetShown = targetText !== '' || targetLeft ? targetReason : undefined
  const mode: CompareMode =
    kind === 'fill' && fillValid
      ? { kind, fill: (fill as number) / 100 }
      : kind === 'target' && targetValid
        ? { kind, value: unit.toSi(targetNumber(targetText)), percent: asPercent }
        : { kind: 'typed' }
  const study = usePowderCompare(loadRequest, mode)
  const [filters, setFilters] = useState(noFilters)
  // Compute empties the rows and with them the facets the filters name
  if (study.rows.length === 0 && (filters.manufacturerName || filters.base || filters.form))
    setFilters(noFilters)
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
  // the rows were computed for another load or charge than the fields hold now
  // `loadRequest` is a new function on each change of the load, so filter and sort changes skip it
  const stale = useMemo(() => {
    if (study.key === undefined || running) return false
    try {
      const now = loadRequest()
      return compareKey(now.body, mode, now.recordInputs) !== study.key
    } catch {
      return true
    }
  }, [loadRequest, mode, study.key, running])
  const parts = [
    running && progress
      ? `Computing ${progress.done} of ${progress.total} powders`
      : study.rows.length > 0
        ? `${shown.length === study.rows.length ? study.rows.length : `${shown.length} of ${study.rows.length}`} powders, ${failed} not computed`
        : undefined,
    message,
    targetShown,
    stale ? 'Inputs changed since these rows' : undefined,
    'Simulation, not load data. A row is no recommendation',
  ].filter(Boolean)
  const text = `${parts.map((p) => p?.replace(/\.$/, '')).join('. ')}.`
  const open = (r: CompareRow) => {
    choosePowder(r.id)
    // the row's values are for its charge: a case fill row sets it too
    const typed = fields.charge?.si
    if (
      r.charge !== undefined &&
      (typed === undefined || Math.abs(typed - r.charge) > 1e-9 * r.charge)
    )
      applyCharge(r.charge)
  }
  // the table is memoized: the handler it holds does not change with the fields
  const latest = useRef(open)
  latest.current = open
  const onOpen = useCallback((r: CompareRow) => latest.current(r), [])
  const select = (key: keyof PowderFilters, label: string, data: string[]) => (
    <Select
      aria-label={label}
      placeholder={label}
      size={controlSize.row.input}
      searchable={key === 'manufacturerName'}
      clearable
      disabled={data.length === 0}
      data={data}
      value={filters[key] || null}
      onChange={(v) => setFilters((f) => ({ ...f, [key]: v ?? '' }))}
    />
  )
  return (
    <div className="powder-compare screen-only">
      <div className="powder-controls">
        <SegmentedControl
          size={controlSize.row.toggle}
          aria-label="Charge"
          data={[
            { value: 'typed', label: 'Typed charge' },
            { value: 'fill', label: 'Case fill' },
            { value: 'target', label: 'Target' },
          ]}
          value={kind}
          onChange={(v) => setKind(v as CompareMode['kind'])}
        />
        {kind === 'target' ? (
          <NumberInput
            size={controlSize.row.input}
            aria-label="Target peak pressure"
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
            onChange={setTargetText}
            onBlur={() => setTargetLeft(true)}
          />
        ) : (
          <NumberInput
            size={controlSize.row.input}
            aria-label="Case fill"
            suffix=" %"
            min={caseFillPercentRange.min}
            max={caseFillPercentRange.max}
            step={5}
            allowNegative={false}
            clampBehavior="none"
            disabled={kind !== 'fill'}
            error={kind === 'fill' && !fillValid}
            value={fill}
            onChange={setFill}
          />
        )}
        <Button
          size={controlSize.row.button}
          variant="default"
          aria-pressed={asPercent}
          disabled={kind !== 'target' || cartridge === undefined}
          title="Read the target as a percentage of the cartridge's CIP Pmax"
          onClick={() => {
            setPercent(!asPercent)
            setTargetText('')
            setTargetLeft(false)
          }}
        >
          % Pmax
        </Button>
        <Button
          size={controlSize.row.button}
          variant={running ? 'default' : 'filled'}
          disabled={
            !running && ((kind === 'fill' && !fillValid) || (kind === 'target' && !targetValid))
          }
          onClick={running ? study.cancel : study.compute}
        >
          {running ? 'Cancel' : 'Compute'}
        </Button>
      </div>
      <div className="powder-filters">
        {select('manufacturerName', 'Manufacturer', manufacturers)}
        {select('base', 'Base', bases)}
        {select('form', 'Form', forms)}
      </div>
      <p className="barrel-status" aria-hidden="true">
        <span className="barrel-status-text" title={text}>
          {text}
        </span>
      </p>
      {/* the count changes with every answer: the live region says only start, end and cancel */}
      <p className="visually-hidden" role="status">
        {running ? 'Computing powders.' : text}
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
