'use client'

import {
  SegmentedControl,
  Table,
  TableCaption,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { type KeyboardEvent, type ReactNode, useId, useState } from 'react'
import {
  type FieldGroup,
  type FieldRow,
  rowLabel,
  rowNotes,
  rowParts,
  rowValue,
} from '../lib/record-fields.ts'
import { controlSize, tipEvents } from '../lib/theme.ts'
import type { UnitSystem } from '../lib/units.ts'
import { Sized, slotUnits } from './fact-cards.tsx'
import { Panel } from './panel.tsx'
import { ScrollRegion } from './scroll-region.tsx'
import { useUnits } from './units-settings.tsx'

/** Arrow up and down, Home and End between the `selector` stops of a table: one tab stop, the rows by the arrows. */
export function arrowStops(e: KeyboardEvent<HTMLElement>, selector: string) {
  const stops = [...e.currentTarget.querySelectorAll<HTMLElement>(selector)]
  const at = stops.indexOf(document.activeElement as HTMLElement)
  const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: stops.length - 1 }[e.key]
  if (at < 0 || to === undefined || !stops[to]) return
  e.preventDefault()
  stops[to].focus()
}

/**
 * A value with notes: a button that shows them on hover, focus and touch; they stay its
 * description. `inline`: a focusable span instead, for rows too tight for a 24 px target (the
 * cartridge record's symbols), where nothing is pressed.
 */
export function Noted({
  value,
  notes,
  inline = false,
  className = 'field-note',
  tabIndex = 0,
}: {
  value: ReactNode
  notes: string[]
  inline?: boolean
  className?: string
  /** `inline` only: -1 for a symbol in a list with one tab stop. */
  tabIndex?: number | undefined
}) {
  const id = useId()
  return (
    <>
      <Tooltip
        label={notes.map((n) => <div key={n}>{n}</div>)}
        events={tipEvents}
        multiline
        maw={320}
      >
        <button
          type="button"
          className={className}
          aria-describedby={id}
          tabIndex={inline ? tabIndex : undefined}
        >
          {value}
        </button>
      </Tooltip>
      {/* inline: hidden, so a row header's name stays the symbol; a description may name hidden text */}
      <span id={id} className="visually-hidden" hidden={inline}>
        {notes.join(' ')}
      </span>
    </>
  )
}

function Row({ row, system }: { row: FieldRow; system: UnitSystem }) {
  const value = rowValue(row, system)
  const notes = rowNotes(row)
  return (
    <TableTr>
      <TableTh scope="row">{rowLabel(row, system)}</TableTh>
      <TableTd className="nowrap num">
        {notes.length > 0 ? <Noted value={value} notes={notes} /> : value}
      </TableTd>
    </TableTr>
  )
}

/** A symbol that takes focus, the keyboard path of the linked marking: a button, as a click, Enter or Space keeps the mark (`RecordScope`). */
export function SymbolStop({ tabIndex, children }: { tabIndex: number; children: ReactNode }) {
  return (
    <button type="button" className="symbol-stop" tabIndex={tabIndex}>
      {children}
    </button>
  )
}

/**
 * A row of the symbol table: the drawing symbol (a tab stop when `tabbable`, the keyboard path of
 * the linked marking), the quantity, the value and its unit in their own columns. The unit takes
 * the room of its longest form, so a unit change moves nothing.
 */
function SymbolRow({
  row,
  system,
  tabbable,
  off,
}: {
  row: FieldRow
  system: UnitSystem
  tabbable: boolean
  /** Left out by the filter or the search: hidden on screen, printed. */
  off: boolean
}) {
  const notes = rowNotes(row)
  const { number, unit } = rowParts(row, system)
  return (
    <TableTr data-symbol={row.symbol} data-off={off || undefined}>
      <TableTd className="field-symbol">
        {row.symbol && <SymbolStop tabIndex={tabbable ? 0 : -1}>{row.symbol}</SymbolStop>}
      </TableTd>
      <TableTh scope="row">{rowLabel(row, system)}</TableTh>
      <TableTd className="nowrap num">
        {notes.length > 0 ? <Noted value={number} notes={notes} /> : number}
      </TableTd>
      <TableTd className="field-unit-cell">
        <Sized now={unit} also={slotUnits.map((u) => rowParts(row, u).unit)} />
      </TableTd>
    </TableTr>
  )
}

/**
 * A record's values as Symbol, Quantity, Value and Unit, a heading row per group, every row with a
 * drawing symbol carrying it as `data-symbol` for the linked marking. One tab stop for the
 * symbols, the arrow keys move between them. Rows not in `on` are hidden on screen and printed.
 */
function SymbolTable({
  label,
  groups,
  on,
}: {
  label: string
  groups: FieldGroup[]
  on: Set<FieldRow>
}) {
  const { system } = useUnits()
  const symbols = groups.flatMap((g) =>
    g.rows.flatMap((r) => (r.symbol && on.has(r) ? [r.symbol] : [])),
  )
  const [active, setActive] = useState<string>()
  const stop = symbols.includes(active ?? '') ? active : symbols[0]
  return (
    <ScrollRegion label={`${label} table`}>
      <Table
        className="field-table symbol-table"
        aria-label={label}
        stickyHeader
        onFocus={(e) => {
          const symbol = (e.target as Element)
            .closest('tr[data-symbol]')
            ?.getAttribute('data-symbol')
          if (symbol) setActive(symbol)
        }}
        // only the rows shown: the filter and the search hide the others
        onKeyDown={(e) => arrowStops(e, 'tr:not([data-off]) > .field-symbol [tabindex]')}
      >
        <TableThead>
          <TableTr>
            <TableTh scope="col" className="field-symbol">
              Symbol
            </TableTh>
            <TableTh scope="col">Quantity</TableTh>
            <TableTh scope="col" className="num">
              Value
            </TableTh>
            <TableTh scope="col" className="field-unit-cell">
              Unit
            </TableTh>
          </TableTr>
        </TableThead>
        {groups.map((g, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: groups keep their order
          <TableTbody key={i} data-off={g.rows.some((r) => on.has(r)) ? undefined : true}>
            {g.title && (
              <TableTr className="field-group">
                <TableTh scope="rowgroup" colSpan={4}>
                  {g.title}
                </TableTh>
              </TableTr>
            )}
            {g.rows.map((row, k) => (
              <SymbolRow
                // biome-ignore lint/suspicious/noArrayIndexKey: a label can repeat
                key={k}
                row={row}
                system={system}
                tabbable={!!row.symbol && row.symbol === stop && on.has(row)}
                off={!on.has(row)}
              />
            ))}
          </TableTbody>
        ))}
      </Table>
    </ScrollRegion>
  )
}

/** Rows whose label or symbol holds `q`, ignoring case; groups left without rows drop out. */
export function searchGroups(groups: FieldGroup[], q: string): FieldGroup[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return groups
  return groups
    .map((g) => ({
      ...g,
      rows: g.rows.filter((r) =>
        [r.label, r.symbol].some((t) => t?.toLowerCase().includes(needle)),
      ),
    }))
    .filter((g) => g.rows.length > 0)
}

/**
 * A titled panel of a record's values as a symbol table: a group filter (All and each group's
 * `filter` or title) in its title row where there are two filters or more, a search field over
 * symbols and names above the table where it has more than 20 rows.
 */
export function FieldPanel({
  id,
  title,
  groups,
  className,
  children,
}: {
  id: string
  title: string
  groups: FieldGroup[]
  className?: string
  /** Under the table: the record's note. */
  children?: ReactNode
}) {
  const [group, setGroup] = useState('All')
  const [q, setQ] = useState('')
  const filters = [...new Set(groups.flatMap((g) => g.filter ?? g.title ?? []))]
  const shown = searchGroups(
    group === 'All' ? groups : groups.filter((g) => (g.filter ?? g.title) === group),
    q,
  )
  return (
    <Panel
      id={id}
      title={title}
      className={className ? `field-panel ${className}` : 'field-panel'}
      controls={
        filters.length > 1 && (
          <SegmentedControl
            aria-label={`${title}: group`}
            size={controlSize.row.toggle}
            data={['All', ...filters].map((t) => ({
              value: t,
              label: t.replace(' and ', ', '),
            }))}
            value={group}
            onChange={setGroup}
          />
        )
      }
    >
      {groups.reduce((n, g) => n + g.rows.length, 0) > 20 && (
        <TextInput
          className="field-search"
          type="search"
          size={controlSize.row.input}
          aria-label={`Search ${title.toLowerCase()}`}
          placeholder="Symbol or name"
          leftSection={<MagnifyingGlass aria-hidden="true" />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
        />
      )}
      {/* every row stays in the table: print has them all */}
      <SymbolTable label={title} groups={groups} on={new Set(shown.flatMap((g) => g.rows))} />
      {shown.length === 0 && <p className="record-note">No row matches {q.trim()}.</p>}
      {children}
    </Panel>
  )
}

/**
 * A bullet's ballistic coefficients: the drag model (with its velocity band), the value in the
 * viewer's unit, named in the header, and the record's note.
 */
export function CoefficientTable({ label, rows }: { label: string; rows: FieldRow[] }) {
  const { system } = useUnits()
  const unit = (u: UnitSystem) => `BC (${u.ballisticCoefficient.symbol})`
  return (
    <ScrollRegion label={`${label} table`}>
      <Table className="field-table coefficient-table" aria-label={label}>
        <TableThead>
          <TableTr>
            <TableTh scope="col">Drag model</TableTh>
            <TableTh scope="col" className="num">
              <Sized now={unit(system)} also={slotUnits.map(unit)} />
            </TableTh>
            <TableTh scope="col">Note</TableTh>
          </TableTr>
        </TableThead>
        <TableTbody>
          {rows.map((row, k) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a drag model can repeat
            <TableTr key={k}>
              <TableTh scope="row">{rowLabel(row, system)}</TableTh>
              <TableTd className="nowrap num">{rowParts(row, system).number}</TableTd>
              <TableTd className="field-note-cell">{row.method}</TableTd>
            </TableTr>
          ))}
        </TableTbody>
      </Table>
    </ScrollRegion>
  )
}

/**
 * A record's values in one column, in the unit of the viewer's Settings preset (rounded to the
 * unit's decimals): no header row, a heading row per titled group, the text as printed and the
 * method of a computed value on hover. Named by the heading `labelledBy` names (whose text is
 * `caption`), else by `caption` as its caption.
 */
export function FieldTable({
  caption,
  labelledBy,
  groups,
}: {
  caption: string
  labelledBy?: string | undefined
  groups: FieldGroup[]
}) {
  const { system } = useUnits()
  return (
    <ScrollRegion label={`${caption} table`}>
      <Table className="field-table" captionSide="top" aria-labelledby={labelledBy}>
        {!labelledBy && <TableCaption>{caption}</TableCaption>}
        {groups
          .filter((g) => g.rows.length > 0)
          .map((g, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: groups keep their order and may have no title
            <TableTbody key={i}>
              {g.title && (
                <TableTr className="field-group">
                  <TableTh scope="rowgroup" colSpan={2}>
                    {g.title}
                  </TableTh>
                </TableTr>
              )}
              {g.rows.map((row, k) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a coefficient's label can repeat
                <Row key={k} row={row} system={system} />
              ))}
            </TableTbody>
          ))}
      </Table>
    </ScrollRegion>
  )
}
