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
import { Fragment, type KeyboardEvent, type ReactNode, useId, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { type Translator, translator } from '../i18n/translate.ts'
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
import { say, type Wording } from '../lib/wording.ts'
import { Sized, slotUnits } from './fact-cards.tsx'
import { Panel } from './panel.tsx'
import { ScrollRegion } from './scroll-region.tsx'
import { useUnits } from './units-settings.tsx'

type Translate = Translator['t']

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
 * description. `inline`: a row header's symbol (the cartridge record's dimensions tables), whose
 * notes are only its description and whose tab stop the table sets.
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

/** A text that may wrap after a slash before a digit, so a combined number such as 1.40/1.41 fits a phone and a unit such as lb/in² stays whole. */
export function SlashBreaks({ text }: { text: string }) {
  return text.split(/\/(?=\d)/).map((part, i) =>
    i === 0 ? (
      part
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed text
      <Fragment key={i}>
        /<wbr />
        {part}
      </Fragment>
    ),
  )
}

function Row({ row, system }: { row: FieldRow; system: UnitSystem }) {
  const { t } = useTranslation()
  const value = <SlashBreaks text={rowValue(row, system, t)} />
  const notes = rowNotes(row, t)
  return (
    <TableTr>
      <TableTh scope="row">{rowLabel(row, system, t)}</TableTh>
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
  symbolColumn,
}: {
  row: FieldRow
  system: UnitSystem
  tabbable: boolean
  /** The Symbol column is drawn. */
  symbolColumn: boolean
  /** Left out by the filter or the search: hidden on screen, printed. */
  off: boolean
}) {
  const { t } = useTranslation()
  const notes = rowNotes(row, t)
  const { number, unit } = rowParts(row, system, t)
  return (
    <TableTr data-symbol={row.symbol} data-off={off || undefined}>
      {symbolColumn && (
        <TableTd className="field-symbol">
          {row.symbol && <SymbolStop tabIndex={tabbable ? 0 : -1}>{row.symbol}</SymbolStop>}
        </TableTd>
      )}
      <TableTh scope="row">{rowLabel(row, system, t)}</TableTh>
      <TableTd className="nowrap num">
        {notes.length > 0 ? <Noted value={number} notes={notes} /> : number}
      </TableTd>
      <TableTd className="field-unit-cell">
        <Sized now={unit} also={slotUnits.map((u) => rowParts(row, u, t).unit)} />
      </TableTd>
    </TableTr>
  )
}

/**
 * A record's values as Symbol, Quantity, Value and Unit, a heading row per group, every row with a
 * drawing symbol carrying it as `data-symbol` for the linked marking. One tab stop for the
 * symbols, the arrow keys move between them. Rows not in `on` are hidden on screen and printed.
 * Without `symbolColumn` (a record without a drawing: case, primer) the Symbol column is left out.
 */
function SymbolTable({
  label,
  groups,
  on,
  symbolColumn,
}: {
  label: string
  groups: FieldGroup[]
  on: Set<FieldRow>
  symbolColumn: boolean
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const symbols = groups.flatMap((g) =>
    g.rows.flatMap((r) => (r.symbol && on.has(r) ? [r.symbol] : [])),
  )
  const [active, setActive] = useState<string>()
  const stop = symbols.includes(active ?? '') ? active : symbols[0]
  return (
    <ScrollRegion label={t('{label} table', { label })}>
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
            {symbolColumn && (
              <TableTh scope="col" className="field-symbol">
                {t('Symbol')}
              </TableTh>
            )}
            <TableTh scope="col">{t('Quantity')}</TableTh>
            <TableTh scope="col" className="num">
              {t('Value')}
            </TableTh>
            <TableTh scope="col" className="field-unit-cell">
              {t('Unit')}
            </TableTh>
          </TableTr>
        </TableThead>
        {groups.map((g, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: groups keep their order
          <TableTbody key={i} data-off={g.rows.some((r) => on.has(r)) ? undefined : true}>
            {g.title && (
              <TableTr className="field-group">
                <TableTh scope="rowgroup" colSpan={symbolColumn ? 4 : 3}>
                  {say(t, g.title)}
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
                symbolColumn={symbolColumn}
              />
            ))}
          </TableTbody>
        ))}
      </Table>
    </ScrollRegion>
  )
}

/** Rows whose label (in the language of `t`) or symbol holds `q`, ignoring case; groups left without rows drop out. */
export function searchGroups(
  groups: FieldGroup[],
  q: string,
  t: Translate = translator().t,
): FieldGroup[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return groups
  return groups
    .map((g) => ({
      ...g,
      rows: g.rows.filter((r) =>
        [say(t, r.label), r.symbol].some((x) => x?.toLowerCase().includes(needle)),
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
  symbols = true,
  children,
}: {
  id: string
  title: Wording
  groups: FieldGroup[]
  className?: string
  /** false: no Symbol column, for a record whose rows have no drawing symbol (case, primer). */
  symbols?: boolean
  /** Under the table: the record's note. */
  children?: ReactNode
}) {
  const { t, language } = useTranslation()
  // the filter is kept by the English text of its label, so a change of language keeps it
  const key = (w: Wording) => say(translator().t, w)
  const [group, setGroup] = useState('All')
  const [q, setQ] = useState('')
  const filters = [
    ...new Map(groups.flatMap((g) => g.filter ?? g.title ?? []).map((w) => [key(w), w])).entries(),
  ]
  const shown = searchGroups(
    group === 'All'
      ? groups
      : groups.filter((g) => {
          const w = g.filter ?? g.title
          return w !== undefined && key(w) === group
        }),
    q,
    t,
  )
  const name = say(t, title)
  return (
    <Panel
      id={id}
      title={name}
      className={className ? `field-panel ${className}` : 'field-panel'}
      controls={
        filters.length > 1 && (
          <SegmentedControl
            aria-label={t('{title}: group', { title: name })}
            size={controlSize.row.toggle}
            data={[
              { value: 'All', label: t('All') },
              ...filters.map(([value, w]) => ({
                value,
                label: say(t, w).replace(' and ', ', ').replace(' und ', ', '),
              })),
            ]}
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
          // a German noun keeps its capital
          aria-label={t('Search {title}', {
            title: language === 'en' ? name.toLowerCase() : name,
          })}
          placeholder={symbols ? t('Symbol or name') : t('Name')}
          leftSection={<MagnifyingGlass aria-hidden="true" />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
        />
      )}
      {/* every row stays in the table: print has them all */}
      <SymbolTable
        label={name}
        groups={groups}
        on={new Set(shown.flatMap((g) => g.rows))}
        symbolColumn={symbols}
      />
      {shown.length === 0 && (
        <p className="record-note">{t('No row matches {query}.', { query: q.trim() })}</p>
      )}
      {children}
    </Panel>
  )
}

/**
 * A bullet's ballistic coefficients: the drag model (with its velocity band), the value in the
 * viewer's unit, named in the header, and the record's note.
 */
export function CoefficientTable({ label, rows }: { label: Wording; rows: FieldRow[] }) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const name = say(t, label)
  const unit = (u: UnitSystem) => t('BC ({unit})', { unit: u.ballisticCoefficient.symbol })
  return (
    <ScrollRegion label={t('{label} table', { label: name })}>
      <Table className="field-table coefficient-table" aria-label={name}>
        <TableThead>
          <TableTr>
            <TableTh scope="col">{t('Drag model')}</TableTh>
            <TableTh scope="col" className="num">
              <Sized now={unit(system)} also={slotUnits.map(unit)} />
            </TableTh>
            <TableTh scope="col">{t('Note')}</TableTh>
          </TableTr>
        </TableThead>
        <TableTbody>
          {rows.map((row, k) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a drag model can repeat
            <TableTr key={k}>
              <TableTh scope="row">{rowLabel(row, system, t)}</TableTh>
              <TableTd className="nowrap num">{rowParts(row, system, t).number}</TableTd>
              <TableTd className="field-note-cell">{row.method && say(t, row.method)}</TableTd>
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
  caption: Wording
  labelledBy?: string | undefined
  groups: FieldGroup[]
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const name = say(t, caption)
  return (
    <ScrollRegion label={t('{label} table', { label: name })}>
      <Table className="field-table" captionSide="top" aria-labelledby={labelledBy}>
        {!labelledBy && <TableCaption>{name}</TableCaption>}
        {groups
          .filter((g) => g.rows.length > 0)
          .map((g, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: groups keep their order and may have no title
            <TableTbody key={i}>
              {g.title && (
                <TableTr className="field-group">
                  <TableTh scope="rowgroup" colSpan={2}>
                    {say(t, g.title)}
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
