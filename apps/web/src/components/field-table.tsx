import type { I18n } from '@lingui/core'
import { useLingui } from '@lingui/react'
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
import { Search as SearchIcon } from 'lucide-react'
import { Fragment, type KeyboardEvent, type ReactNode, useId, useState } from 'react'
import Link from '@/platform/link.tsx'
import { linguiOf, loadEnglish } from '../i18n/lingui.ts'
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
import { type LinguiWording, sayLingui } from '../lib/wording.ts'
import englishMessages from '../locales/en/components/field-table.json' with { type: 'json' }
// oxlint-disable-next-line import/no-cycle -- fact-cards imports Noted back; moving one of them breaks the cycle
import { Sized, slotUnits } from './fact-cards.tsx'
import { Panel } from './panel.tsx'
import { ScrollRegion } from './scroll-region.tsx'
import { useUnits } from './units-settings.tsx'

loadEnglish(englishMessages)

/** The name of a table's scroll region. */
const tableLabel = (i18n: I18n, label: string) =>
  i18n._({ id: 'fieldTable.region', message: '{label} table', values: { label } })

/** Arrow up and down, Home and End between the `selector` stops of a table: one tab stop, the rows by the arrows. */
export function arrowStops(e: KeyboardEvent<HTMLElement>, selector: string) {
  const stops = [...e.currentTarget.querySelectorAll<HTMLElement>(selector)]
  const at = stops.indexOf(document.activeElement as HTMLElement)
  const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: stops.length - 1 }[e.key]
  if (at < 0 || to === undefined || !stops[to]) return
  e.preventDefault()
  stops[to].focus()
}

/** The notes show on hover, focus and touch and stay its description; `inline` (a row header's symbol) has them only as its description, its tab stop set by the table. */
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
      // oxlint-disable-next-line react/no-array-index-key -- the parts of one fixed text
      <Fragment key={i}>
        /<wbr />
        {part}
      </Fragment>
    ),
  )
}

/** A row's links, as the listed cartridges of a powder: separated as the plain text is, free to wrap. */
function RowLinks({ links }: { links: NonNullable<FieldRow['links']> }) {
  return links.map((l, i) => (
    <Fragment key={l.href}>
      {i > 0 && '; '}
      <Link href={l.href}>{l.text}</Link>
    </Fragment>
  ))
}

function Row({ row, system }: { row: FieldRow; system: UnitSystem }) {
  const { i18n } = useLingui()
  const notes = rowNotes(row, i18n)
  if (row.links)
    return (
      <TableTr>
        <TableTh scope="row">{rowLabel(row, system, i18n)}</TableTh>
        <TableTd className="field-links">
          <RowLinks links={row.links} />
        </TableTd>
      </TableTr>
    )
  const value = <SlashBreaks text={rowValue(row, system, i18n)} />
  return (
    <TableTr>
      <TableTh scope="row">{rowLabel(row, system, i18n)}</TableTh>
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

/** The symbol is a tab stop when `tabbable`, the keyboard path of the linked marking; the unit takes the room of its longest form, so a unit change moves nothing. */
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
  const { i18n } = useLingui()
  const notes = rowNotes(row, i18n)
  const { number, unit } = rowParts(row, system, i18n)
  return (
    <TableTr data-symbol={row.symbol} data-off={off || undefined}>
      {symbolColumn && (
        <TableTd className="field-symbol">
          {row.symbol && <SymbolStop tabIndex={tabbable ? 0 : -1}>{row.symbol}</SymbolStop>}
        </TableTd>
      )}
      <TableTh scope="row">{rowLabel(row, system, i18n)}</TableTh>
      <TableTd className="nowrap num">
        {notes.length > 0 ? <Noted value={number} notes={notes} /> : number}
      </TableTd>
      <TableTd className="field-unit-cell">
        <Sized now={unit} also={slotUnits.map((u) => rowParts(row, u, i18n).unit)} />
      </TableTd>
    </TableTr>
  )
}

/** Each drawn symbol carries `data-symbol` for the linked marking, one tab stop with arrow keys between them; rows not in `on` are hidden on screen and printed. */
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
  const { i18n } = useLingui()
  const { system } = useUnits()
  const symbols = groups.flatMap((g) =>
    g.rows.flatMap((r) => (r.symbol && on.has(r) ? [r.symbol] : [])),
  )
  const [active, setActive] = useState<string>()
  const stop = symbols.includes(active ?? '') ? active : symbols[0]
  return (
    <ScrollRegion label={tableLabel(i18n, label)}>
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
                {i18n._({ id: 'fieldTable.column.symbol', message: 'Symbol' })}
              </TableTh>
            )}
            <TableTh scope="col">
              {i18n._({ id: 'fieldTable.column.quantity', message: 'Quantity' })}
            </TableTh>
            <TableTh scope="col" className="num">
              {i18n._({ id: 'fieldTable.column.value', message: 'Value' })}
            </TableTh>
            <TableTh scope="col" className="field-unit-cell">
              {i18n._({ id: 'fieldTable.column.unit', message: 'Unit' })}
            </TableTh>
          </TableTr>
        </TableThead>
        {groups.map((g, i) => (
          // oxlint-disable-next-line react/no-array-index-key -- groups keep their order
          <TableTbody key={i} data-off={g.rows.some((r) => on.has(r)) ? undefined : true}>
            {g.title && (
              <TableTr className="field-group">
                <TableTh scope="rowgroup" colSpan={symbolColumn ? 4 : 3}>
                  {sayLingui(i18n, g.title)}
                </TableTh>
              </TableTr>
            )}
            {g.rows.map((row, k) => (
              <SymbolRow
                // oxlint-disable-next-line react/no-array-index-key -- a label can repeat
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

/** Rows whose label (in the language of `i18n`) or symbol holds `q`, ignoring case; groups left without rows drop out. */
export function searchGroups(
  groups: FieldGroup[],
  q: string,
  i18n: I18n = linguiOf('en'),
): FieldGroup[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return groups
  return groups
    .map((g) => ({
      ...g,
      rows: g.rows.filter((r) =>
        [sayLingui(i18n, r.label), r.symbol].some((x) => x?.toLowerCase().includes(needle)),
      ),
    }))
    .filter((g) => g.rows.length > 0)
}

/** A group filter where there are two filters or more, a search above more than 20 rows; a search covers every group (the filter shows All meanwhile), a group choice clears it. */
export function FieldPanel({
  id,
  title,
  groups,
  className,
  symbols = true,
  children,
}: {
  id: string
  title: LinguiWording
  groups: FieldGroup[]
  className?: string
  /** false: no Symbol column, for a record whose rows have no drawing symbol (case, primer). */
  symbols?: boolean
  /** Under the table: the record's note. */
  children?: ReactNode
}) {
  const { i18n } = useLingui()
  // the filter is kept by the English text of its label, so a change of language keeps it
  const key = (w: LinguiWording) => sayLingui(linguiOf('en'), w)
  const [group, setGroup] = useState('All')
  const [q, setQ] = useState('')
  const filters = [
    ...new Map(groups.flatMap((g) => g.filter ?? g.title ?? []).map((w) => [key(w), w])).entries(),
  ]
  // a search looks through every group: the filter shows All while it has text
  const scope = q.trim() ? 'All' : group
  const shown = searchGroups(
    scope === 'All'
      ? groups
      : groups.filter((g) => {
          const w = g.filter ?? g.title
          return w !== undefined && key(w) === scope
        }),
    q,
    i18n,
  )
  const name = sayLingui(i18n, title)
  return (
    <Panel
      id={id}
      title={name}
      className={className ? `field-panel ${className}` : 'field-panel'}
      controls={
        filters.length > 1 && (
          <SegmentedControl
            aria-label={i18n._({
              id: 'fieldTable.groupFilter',
              message: '{title}: group',
              values: { title: name },
            })}
            size={controlSize.row.toggle}
            data={[
              { value: 'All', label: i18n._({ id: 'fieldTable.allGroups', message: 'All' }) },
              ...filters.map(([value, w]) => ({
                value,
                label: sayLingui(i18n, w).replace(' and ', ', ').replace(' und ', ', '),
              })),
            ]}
            value={scope}
            onChange={(v) => {
              // a group chosen while searching shows that group, not the search
              setQ('')
              setGroup(v)
            }}
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
          aria-label={i18n._({
            id: 'fieldTable.search',
            message: 'Search {title}',
            values: { title: i18n.locale === 'en' ? name.toLowerCase() : name },
          })}
          placeholder={
            symbols
              ? i18n._({ id: 'fieldTable.searchSymbolOrName', message: 'Symbol or name' })
              : i18n._({ id: 'fieldTable.searchName', message: 'Name' })
          }
          leftSection={<SearchIcon aria-hidden="true" />}
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
        <p className="record-note">
          {i18n._({
            id: 'fieldTable.noMatch',
            message: 'No row of {table} matches {query}.',
            values: { table: name, query: q.trim() },
          })}
        </p>
      )}
      {children}
    </Panel>
  )
}

/** The drag model with its velocity band, the value in the viewer's unit, and the record's note. */
export function CoefficientTable({ label, rows }: { label: LinguiWording; rows: FieldRow[] }) {
  const { i18n } = useLingui()
  const { system } = useUnits()
  const name = sayLingui(i18n, label)
  const unit = (u: UnitSystem) =>
    i18n._({
      id: 'fieldTable.coefficientUnit',
      message: 'BC ({unit})',
      values: { unit: u.ballisticCoefficient.symbol },
    })
  return (
    <ScrollRegion label={tableLabel(i18n, name)}>
      <Table className="field-table coefficient-table" aria-label={name}>
        <TableThead>
          <TableTr>
            <TableTh scope="col">
              {i18n._({ id: 'fieldTable.column.dragModel', message: 'Drag model' })}
            </TableTh>
            <TableTh scope="col" className="num">
              <Sized now={unit(system)} also={slotUnits.map(unit)} />
            </TableTh>
            <TableTh scope="col">
              {i18n._({ id: 'fieldTable.column.note', message: 'Note' })}
            </TableTh>
          </TableTr>
        </TableThead>
        <TableTbody>
          {rows.map((row, k) => (
            // oxlint-disable-next-line react/no-array-index-key -- a drag model can repeat
            <TableTr key={k}>
              <TableTh scope="row">{rowLabel(row, system, i18n)}</TableTh>
              <TableTd className="nowrap num">{rowParts(row, system, i18n).number}</TableTd>
              <TableTd className="field-note-cell">
                {row.method && sayLingui(i18n, row.method)}
              </TableTd>
            </TableTr>
          ))}
        </TableTbody>
      </Table>
    </ScrollRegion>
  )
}

/** In the viewer's preset unit, rounded to its decimals; named by the heading `labelledBy` names (text `caption`), else by `caption` as its caption. */
export function FieldTable({
  caption,
  labelledBy,
  groups,
}: {
  caption: LinguiWording
  labelledBy?: string | undefined
  groups: FieldGroup[]
}) {
  const { i18n } = useLingui()
  const { system } = useUnits()
  const name = sayLingui(i18n, caption)
  return (
    <ScrollRegion label={tableLabel(i18n, name)}>
      <Table className="field-table" captionSide="top" aria-labelledby={labelledBy}>
        {!labelledBy && <TableCaption>{name}</TableCaption>}
        {groups
          .filter((g) => g.rows.length > 0)
          .map((g, i) => (
            // oxlint-disable-next-line react/no-array-index-key -- groups keep their order and may have no title
            <TableTbody key={i}>
              {g.title && (
                <TableTr className="field-group">
                  <TableTh scope="rowgroup" colSpan={2}>
                    {sayLingui(i18n, g.title)}
                  </TableTh>
                </TableTr>
              )}
              {g.rows.map((row, k) => (
                // oxlint-disable-next-line react/no-array-index-key -- a coefficient's label can repeat
                <Row key={k} row={row} system={system} />
              ))}
            </TableTbody>
          ))}
      </Table>
    </ScrollRegion>
  )
}
