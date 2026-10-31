'use client'

import { CloseButton, Group, Select, TextInput, Tooltip, UnstyledButton } from '@mantine/core'
import { CaretDown, CaretUp, CaretUpDown, MagnifyingGlass } from '@phosphor-icons/react'
import Link from 'next/link'
import {
  type CSSProperties,
  type FocusEvent,
  Fragment,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg } from '../i18n/translate.ts'
import {
  type DirectorySort,
  type DirectoryState,
  emptyDirectory,
  noFilters,
  readDirectory,
  writeDirectory,
} from '../lib/directory.ts'
import { basePath } from '../lib/edition.ts'
import { type ListNoun, sortRows } from '../lib/lists.ts'
import { pickRange } from '../lib/selection.ts'
import { shortcutAriaKeys } from '../lib/shortcuts.ts'
import { controlSize, tipEvents } from '../lib/theme.ts'
import { Noted } from './field-table.tsx'
import { usePrintEvents } from './print.ts'
import { watchOverflow } from './scroll-region.tsx'
import { useShortcuts, useSingleKeys } from './shortcuts.tsx'

export interface DirectoryColumn<T> {
  key: string
  label: Message
  /** The unit, in a muted line under the label ("(mm)"); the value cells carry none. */
  unit?: string | undefined
  /** `tabIndex`: for the cell's focusable content (0 only on the table's one tab stop). */
  cell: (row: T, tabIndex: number) => ReactNode
  /** Sort key; columns without one do not sort. */
  value?: (row: T) => string | number | null | undefined
  /** Ascending order of two rows, where the key's own order is not the column's. */
  compare?: (a: T, b: T) => number
  num?: boolean
  /** A value equal to the row above's is set muted (a manufacturer's name once per run of its rows). */
  dim?: boolean
  /** Column width (CSS); one column without it takes the rest. */
  width?: string
  /** Help on the header, shown on hover, focus and touch. */
  help?: Message | undefined
  /** Not printed, as a row action. */
  screenOnly?: boolean
  /** Shown only in a list box of 64rem or more, so the name keeps its room on a tablet. */
  wide?: boolean
  /** At the header's end, after its label: a scale's ticks. */
  head?: ReactNode
}

/**
 * Row checkboxes: the chosen ids in the order ticked, at most `max`; a row `can` refuses gets none.
 * A click on a box ticks or unticks its row, a shift click the rows from the box clicked before.
 */
type Selection<T> = {
  ids: readonly string[]
  max: number
  onChange: (ids: string[]) => void
  can?: (row: T) => boolean
}

const focusable = 'a[href], input:not(:disabled), [tabindex]'

/** The first focusable element of `scope` that is rendered (not under `display: none`). */
const focusableIn = (scope: ParentNode | null) =>
  scope
    ? [...scope.querySelectorAll<HTMLElement>(focusable)].find(
        (el) => el.getClientRects().length > 0,
      )
    : undefined

/**
 * Arrow keys in the rows: up and down to the row above or below in the same column (the name's link
 * when that cell holds nothing to focus), left and right to the neighbouring cell of the row that
 * holds something to focus. A cell is a `td[data-col]` or a phone row's action; cells that are not
 * rendered (hidden by the width) are skipped. The row above or below is the previous or next of
 * `rows` (the DOM neighbour of a row held outside the window is a window row); `reveal` renders it
 * when it is not in the DOM.
 */
function moveFocus(
  e: KeyboardEvent<HTMLElement>,
  rows: readonly { id: string }[],
  reveal: (id: string, col: string) => void,
) {
  const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-col]')
  const row = cell?.closest<HTMLElement>('tr[data-row]')
  if (!cell || !row || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
  let next: HTMLElement | null | undefined
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp')
    next = verticalTarget(e, row, cell, rows, reveal)
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') next = sideTarget(e.key, row, cell)
  else return
  if (!next) return
  e.preventDefault()
  next.focus()
}

/** The focusable of the same column in the row above or below, revealed when it is not rendered. */
function verticalTarget(
  e: KeyboardEvent<HTMLElement>,
  row: HTMLElement,
  cell: HTMLElement,
  rows: readonly { id: string }[],
  reveal: (id: string, col: string) => void,
) {
  // aria-rowindex is the index in `rows` plus 2 (the head row is 1)
  const id =
    rows[Number(row.getAttribute('aria-rowindex')) - 2 + (e.key === 'ArrowDown' ? 1 : -1)]?.id
  if (!id) return
  // the focused row can leave the DOM with the reveal, so look in the tbody
  const body = e.currentTarget
  const find = () =>
    [...body.querySelectorAll<HTMLElement>('tr[data-row]')].find((r) => r.dataset.id === id)
  let target = find()
  if (!target) {
    flushSync(() => reveal(id, cell.dataset.col ?? ''))
    target = find()
  }
  if (!target) return
  return (
    focusableIn(target.querySelector(`[data-col="${cell.dataset.col}"]`)) ??
    target.querySelector<HTMLElement>('td.name-cell a')
  )
}

/** The focusable of the neighbouring cell of the row that holds something to focus. */
function sideTarget(key: string, row: HTMLElement, cell: HTMLElement) {
  const cells = [...row.querySelectorAll<HTMLElement>('[data-col]')].filter(focusableIn)
  const at = cells.indexOf(cell) + (key === 'ArrowRight' ? 1 : -1)
  return focusableIn(cells[at] ?? null)
}

const cellClass = <T,>(c: DirectoryColumn<T>, link: string, repeat = false) =>
  c.key === link
    ? 'name-cell'
    : [c.num && 'num', c.screenOnly && 'screen-only', c.wide && 'wide-only', repeat && 'repeat']
        .filter(Boolean)
        .join(' ') || undefined

const noFacetKeys: readonly string[] = []

/**
 * The list's filters and sort, kept in the URL with `history.replaceState`, and `clear`, which
 * resets every filter and keeps the sort. `facetKeys` are the URL keys of the list's choice filters
 * (`facets.ts`), a constant of the list. Read after mounting,
 * not with `useSearchParams`, so the page stays prerendered with its first rows (Next.js renders a
 * `useSearchParams` tree in the browser only).
 */
export function useListState(facetKeys: readonly string[] = noFacetKeys) {
  const [state, setState] = useState<DirectoryState>(emptyDirectory)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the keys of a list are fixed
  useEffect(() => setState(readDirectory(window.location.search, facetKeys)), [])
  useEffect(() => {
    // the first render's empty state is not the URL's: written only after a change
    if (state === emptyDirectory) return
    const { pathname, search } = window.location
    const next = writeDirectory(state, search, facetKeys)
    if (next !== search) window.history.replaceState(null, '', `${pathname}${next}`)
  }, [state, facetKeys])
  const set = useCallback(
    (next: Partial<DirectoryState>) => setState((s) => ({ ...s, ...next })),
    [],
  )
  const clear = useCallback(() => set({ ...noFilters, sort: state.sort }), [set, state.sort])
  return [state, set, clear] as const
}

/** True while the page prints (the print dialog or print media), rendered before the snapshot. */
function usePrinting() {
  const [printing, setPrinting] = useState(false)
  const fromMedia = () => flushSync(() => setPrinting(matchMedia('print').matches))
  usePrintEvents(() => flushSync(() => setPrinting(true)), fromMedia)
  useEffect(() => {
    const media = matchMedia('print')
    const change = () => flushSync(() => setPrinting(media.matches))
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  return printing
}

/** The note under a printed list: whole sentences, one per kind. */
const printedLines: Record<ListNoun, Message> = {
  bullets: msg('Printed: the first {limit} of {total} bullets in this selection.'),
  cartridges: msg('Printed: the first {limit} of {total} cartridges in this selection.'),
  cases: msg('Printed: the first {limit} of {total} brass in this selection.'),
  disciplines: msg('Printed: the first {limit} of {total} disciplines in this selection.'),
  faces: msg('Printed: the first {limit} of {total} targets in this selection.'),
  federations: msg('Printed: the first {limit} of {total} federations in this selection.'),
  firearms: msg('Printed: the first {limit} of {total} firearms in this selection.'),
  powders: msg('Printed: the first {limit} of {total} powders in this selection.'),
  primers: msg('Printed: the first {limit} of {total} primers in this selection.'),
}

/** Rows printed at most. */
const printCap = 200
/** Rows rendered before the first measurement: the prerendered HTML holds these. */
const firstRows = 40
/** Rows rendered beyond each edge of the view. */
const overscan = 10

/**
 * The rows in view of a fixed-row-height table body, in window coordinates, so one rule serves the
 * table's own scroll box (from 62em) and the page scroll (phones). A capture listener sees the
 * scroll of every box. Hand-written: about 30 lines against a dependency for one list.
 */
function useWindowedRows(count: number) {
  const body = useRef<HTMLTableSectionElement>(null)
  const [range, setRange] = useState({ start: 0, end: Math.min(count, firstRows), height: 0 })
  useLayoutEffect(() => {
    const update = () => {
      const tbody = body.current
      if (!tbody) return
      const row = tbody.querySelector<HTMLElement>('tr[data-row]')
      const height = row?.getBoundingClientRect().height || range.height || 32
      const top = tbody.getBoundingClientRect().top
      const start = Math.max(0, Math.min(count, Math.floor(-top / height) - overscan))
      const end = Math.max(
        start,
        Math.min(count, Math.ceil((innerHeight - top) / height) + overscan),
      )
      setRange((r) =>
        r.start === start && r.end === end && r.height === height ? r : { start, end, height },
      )
    }
    update()
    document.addEventListener('scroll', update, { capture: true, passive: true })
    window.addEventListener('resize', update)
    return () => {
      document.removeEventListener('scroll', update, { capture: true })
      window.removeEventListener('resize', update)
    }
  }, [count, range.height])
  return { body, ...range }
}

/** Sorts the rows by the sort's column when it has a value, else keeps the list order. */
function sortedRows<T>(rows: readonly T[], columns: DirectoryColumn<T>[], sort: DirectorySort) {
  const by = columns.find((c) => c.key === sort?.column)
  const { compare } = by ?? {}
  if (sort && compare)
    return rows.toSorted((a, b) => (sort.dir === 'ascending' ? 1 : -1) * compare(a, b))
  return sort && by?.value ? sortRows(rows, (r) => by.value?.(r) ?? undefined, sort.dir) : rows
}

/** Whether a row's box can be ticked: not under a full selection unless it is ticked. */
const boxEnabled = <T extends { id: string }>(selection: Selection<T> | undefined, row: T) =>
  selection !== undefined &&
  (selection.can?.(row) ?? true) &&
  (selection.ids.includes(row.id) || selection.ids.length < selection.max)

/**
 * Keeps one tab stop live: the remembered cell may hold nothing to focus or be hidden at this
 * width, then the row's link is the stop. Returns the cleanup of its resize listener.
 */
function keepStop(
  body: HTMLElement | null,
  stopId: string | undefined,
  link: string,
  setNav: (
    update: (n: { id: string; col: string } | null) => { id: string; col: string } | null,
  ) => void,
) {
  const ensureStop = () => {
    const stops = body?.querySelectorAll<HTMLInputElement>('[tabindex="0"]') ?? []
    const live = [...stops].some((el) => !el.disabled && el.getClientRects().length > 0)
    if (!live && stopId)
      setNav((n) => (n?.id === stopId && n.col === link ? n : { id: stopId, col: link }))
  }
  ensureStop()
  window.addEventListener('resize', ensureStop)
  return () => window.removeEventListener('resize', ensureStop)
}

/** The row id and column of the cell around `target`. */
function cellAt(target: EventTarget) {
  const cell = (target as HTMLElement).closest<HTMLElement>('[data-col]')
  const id = cell?.closest<HTMLElement>('tr[data-id]')?.dataset.id
  return cell?.dataset.col && id ? { id, col: cell.dataset.col } : undefined
}

/** True when a blur leaves the table body; a window or tab switch blurs with no `relatedTarget` but keeps the element active. */
const focusLeft = (e: FocusEvent<HTMLElement>) =>
  !e.currentTarget.contains(e.relatedTarget) &&
  document.activeElement !== e.target &&
  document.hasFocus()

/** The indexes of the rows to render: the window and the row that holds focus, kept outside it. */
function visibleIndexes(pinned: number, from: number, to: number, count: number) {
  // `to` can exceed the rows for one render after the rows shrink (a filter), before the window is measured
  const end = Math.min(to, count)
  return [
    ...(pinned >= 0 && pinned < from ? [pinned] : []),
    ...Array.from({ length: Math.max(0, end - from) }, (_, i) => from + i),
    ...(pinned >= end ? [pinned] : []),
  ]
}

const sameIds = (a: readonly { id: string }[], b: readonly { id: string }[]) =>
  a.length === b.length && a.every((r, i) => r.id === b[i]?.id)

/** The table box from the top, and the page back to the table's top when it lies above the view. */
function scrollToTop(el: HTMLElement | null) {
  if (!el) return
  el.scrollTop = 0
  const top = el.getBoundingClientRect().top
  if (top < 0) window.scrollBy(0, top)
}

/**
 * A directory list: the table is the page's scroll box from 62em, the header sticks, the
 * whole row is its link, rows are windowed (the DOM holds the rows in view), headers sort
 * ascending, descending and back to the list order. Below 48em a row is the name over a muted
 * facts line. Print shows the first `printCap` rows and says so.
 */
export function DirectoryTable<T extends { id: string }>({
  rows,
  columns,
  link,
  href,
  onOpen,
  facts,
  label,
  caption,
  noun,
  sort,
  onSort,
  empty,
  selection,
  breakBefore,
  phoneAction,
}: {
  rows: readonly T[]
  columns: DirectoryColumn<T>[]
  /** Key of the column whose cell is the row's link. */
  link: string
  href: (row: T) => string
  /** A plain click on the row's link opens the row in the page instead (the firearm library's editor). */
  onOpen?: ((row: T) => void) | undefined
  /** The phone row's second line. */
  facts: (row: T) => string
  /** The row's name as plain text, for the link index. */
  label: (row: T) => string
  caption: string
  noun: ListNoun
  sort: DirectorySort
  onSort: (sort: DirectorySort) => void
  empty: ReactNode
  /** A full selection disables the other boxes. */
  selection?: Selection<T> | undefined
  /** A heavier rule above a row that starts a group (the browser's own rows end before the catalogue's). */
  breakBefore?: ((row: T, previous: T) => boolean) | undefined
  /** A row action for phones, where the columns after the name are hidden (a Mine row's Delete); not shown from 48em. `tabIndex` as for a column's cell. */
  phoneAction?: (row: T, tabIndex: number) => ReactNode
}) {
  const { t } = useTranslation()
  const shown = sortedRows(rows, columns, sort)
  const printing = usePrinting()
  const { body, start, end, height } = useWindowedRows(shown.length)
  const [from, to] = printing ? [0, Math.min(shown.length, printCap)] : [start, end]
  const pad = (n: number) => (n > 0 && !printing ? n * (height || 32) : 0)
  const box = useRef<HTMLDivElement>(null)
  // one tab stop for the rows (roving): the cell last focused, else the first rendered row's link
  // (the checkbox only while enabled)
  const [nav, setNav] = useState<{ id: string; col: string } | null>(null)
  // the row that holds focus stays rendered when a large scroll (PageDown, End) takes it out of the
  // window: an unmounted focus falls to the body and keyboard scrolling stops
  const [held, setHeld] = useState(false)
  const pinned = held && !printing ? shown.findIndex((r) => r.id === nav?.id) : -1
  const visible = visibleIndexes(pinned, from, to, shown.length)
  const rendered = visible.map((i) => shown[i] as T)
  const stopId = rendered.some((r) => r.id === nav?.id) ? nav?.id : rendered[0]?.id
  const boxOn = (row: T) => boxEnabled(selection, row)
  // the box clicked last, where a shift click starts its range
  const anchor = useRef<string>(undefined)
  const pick = (row: T, range: boolean) => {
    if (!selection) return
    selection.onChange(
      pickRange(
        shown,
        selection.ids,
        range ? anchor.current : undefined,
        row.id,
        selection.max,
        selection.can,
      ),
    )
    anchor.current = row.id
  }
  const tabIndexOf = (row: T, col: string) => {
    if (stopId !== row.id) return -1
    const remembered = nav?.id === row.id && (col !== 'select' || boxOn(row))
    return (remembered ? nav.col === col : col === link) ? 0 : -1
  }
  // the remembered cell may hold nothing to focus or be hidden at this width (below 48em): then
  // the row's link is the stop, so the table never has none
  useLayoutEffect(() => keepStop(body.current, stopId, link, setNav))
  // the server rows are unfiltered (the URL is read after mounting): a tick before hydration
  // would be replayed on a row the filters then hide, so the select cells swallow clicks until
  // mounted (CSS on `data-booting`, nothing visible changes)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // a region and a tab stop until measured, as ScrollRegion
  const [over, setOver] = useState(true)
  useEffect(() => (box.current ? watchOverflow(box.current, setOver) : undefined), [])
  // a filter change shows the first matches: the table box from the top, and on a phone the page
  // back to the table's top when it lies above the view; the same rows again (the URL read after
  // mounting, a sort) move nothing; rows are the same by id, as a list rebuilds its row objects
  // when the browser's records arrive
  const before = useRef(rows)
  useEffect(() => {
    const was = before.current
    before.current = rows
    if (!sameIds(was, rows)) scrollToTop(box.current)
  }, [rows])
  return (
    // a scroll box needs focus to scroll by keyboard: a named region while it overflows, with the
    // row stop as its focus (a tab stop of its own only when there are no rows)
    <div
      ref={box}
      className="directory-scroll page-panel page-panel-flush"
      {...(over && {
        role: 'region',
        'aria-label': caption,
        ...(shown.length === 0 && { tabIndex: 0 }),
      })}
    >
      {/* no match keeps the header: the note is a row across the table */}
      <table className="directory-table" aria-rowcount={shown.length + 1}>
        <caption>{caption}</caption>
        <colgroup>
          {selection && <col className="select-cell" />}
          {columns.map((c) => (
            <col
              key={c.key}
              className={
                c.key === link
                  ? 'name-cell'
                  : [c.screenOnly && 'screen-only', c.wide && 'wide-only']
                      .filter(Boolean)
                      .join(' ') || undefined
              }
              data-sorted={sort?.column === c.key || undefined}
              style={c.width ? ({ '--w': c.width } as CSSProperties) : undefined}
            />
          ))}
          <col className="filler" />
        </colgroup>
        <thead>
          <tr aria-rowindex={1}>
            {selection && (
              <th scope="col" className="select-cell">
                <span className="visually-hidden">{t('Select')}</span>
              </th>
            )}
            {columns.map((c) => (
              <HeadCell key={c.key} column={c} link={link} sort={sort} onSort={onSort} />
            ))}
            <td className="filler" inert />
          </tr>
        </thead>
        <tbody
          ref={body}
          onFocus={(e) => {
            const at = cellAt(e.target)
            if (!at) return
            setNav(at)
            setHeld(true)
          }}
          onBlur={(e) => {
            if (focusLeft(e)) setHeld(false)
          }}
          onKeyDown={(e) =>
            moveFocus(e, shown, (id, col) => {
              setNav({ id, col })
              setHeld(true)
            })
          }
        >
          {visible.map((index, n) => {
            const row = shown[index] as T
            const previous = shown[index - 1]
            const gap = index - (visible[n - 1] ?? -1) - 1
            const action = phoneAction?.(row, tabIndexOf(row, 'action'))
            return (
              <Fragment key={row.id}>
                {pad(gap) > 0 && <tr inert style={{ height: pad(gap) }} />}
                <DirectoryRow
                  row={row}
                  previous={previous}
                  index={index}
                  columns={columns}
                  link={link}
                  href={href}
                  onOpen={onOpen}
                  facts={facts}
                  label={label}
                  selection={selection}
                  breakBefore={breakBefore}
                  mounted={mounted}
                  action={action}
                  tabIndexOf={tabIndexOf}
                  onPick={(range) => pick(row, range)}
                />
              </Fragment>
            )
          })}
          {pad(shown.length - 1 - (visible.at(-1) ?? -1)) > 0 && (
            <tr inert style={{ height: pad(shown.length - 1 - (visible.at(-1) ?? -1)) }} />
          )}
          {shown.length === 0 && (
            <tr>
              <td className="empty-cell" colSpan={columns.length + (selection ? 2 : 1)}>
                <div className="directory-empty">{empty}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {shown.length > printCap && (
        <p className="print-only">
          {t(printedLines[noun], { limit: printCap, total: shown.length })}
        </p>
      )}
      {/* every record link in the HTML for readers without JavaScript and for crawlers; not in the DOM with JavaScript */}
      <noscript>
        <ul>
          {rows.map((r) => (
            <li key={r.id}>
              <a href={`${basePath}${href(r)}`}>{label(r)}</a>
            </li>
          ))}
        </ul>
      </noscript>
    </div>
  )
}

const nextSort = (key: string, dir: 'ascending' | 'descending' | undefined): DirectorySort => {
  if (dir === undefined) return { column: key, dir: 'ascending' }
  return dir === 'ascending' ? { column: key, dir: 'descending' } : undefined
}

function SortMark({ dir }: { dir: 'ascending' | 'descending' | undefined }) {
  return (
    <span aria-hidden="true" className="sort-mark" data-dir={dir}>
      {dir === 'ascending' && <CaretUp size={12} weight="bold" />}
      {dir === 'descending' && <CaretDown size={12} weight="bold" />}
      {dir === undefined && <CaretUpDown size={12} />}
    </span>
  )
}

function HeadCell<T>({
  column: c,
  link,
  sort,
  onSort,
}: {
  column: DirectoryColumn<T>
  link: string
  sort: DirectorySort
  onSort: (sort: DirectorySort) => void
}) {
  const { t } = useTranslation()
  const dir = sort?.column === c.key ? sort.dir : undefined
  return (
    <th
      scope="col"
      aria-sort={dir}
      className={cellClass(c, link)}
      data-help={c.help ? '' : undefined}
    >
      {c.head && <span className="th-end">{c.head}</span>}
      {c.value ? (
        <Tooltip
          label={c.help && t(c.help)}
          disabled={!c.help}
          position="bottom"
          events={tipEvents}
          multiline
          w={260}
        >
          <UnstyledButton className="sort-button" onClick={() => onSort(nextSort(c.key, dir))}>
            <HeadLabel column={c} />
            <SortMark dir={dir} />
          </UnstyledButton>
        </Tooltip>
      ) : c.help ? (
        <Noted inline value={<HeadLabel column={c} />} notes={[t(c.help)]} />
      ) : (
        <HeadLabel column={c} />
      )}
    </th>
  )
}

function DirectoryRow<T extends { id: string }>({
  row,
  previous,
  index,
  columns,
  link,
  href,
  onOpen,
  facts,
  label,
  selection,
  breakBefore,
  mounted,
  action,
  tabIndexOf,
  onPick,
}: {
  row: T
  previous: T | undefined
  index: number
  columns: DirectoryColumn<T>[]
  link: string
  href: (row: T) => string
  onOpen?: ((row: T) => void) | undefined
  facts: (row: T) => string
  label: (row: T) => string
  selection?: Selection<T> | undefined
  breakBefore?: ((row: T, previous: T) => boolean) | undefined
  mounted: boolean
  action: ReactNode
  tabIndexOf: (row: T, col: string) => number
  onPick: (range: boolean) => void
}) {
  return (
    <tr
      data-row
      data-id={row.id}
      data-picked={selection?.ids.includes(row.id) || undefined}
      data-break={(previous && breakBefore?.(row, previous)) || undefined}
      aria-rowindex={index + 2}
    >
      {selection && (
        <td className="select-cell" data-col="select" data-booting={mounted ? undefined : ''}>
          {(selection.can?.(row) ?? true) && (
            <SelectBox
              row={row}
              label={label(row)}
              selection={selection}
              onPick={onPick}
              tabIndex={mounted ? tabIndexOf(row, 'select') : -1}
            />
          )}
        </td>
      )}
      {columns.map((c) =>
        c.key === link ? (
          <td
            key={c.key}
            data-col={c.key}
            className="name-cell"
            data-action={action ? '' : undefined}
          >
            {/* no prefetch: a long list of links (Next.js docs); a click fetches the page, which the offline worker stores */}
            <Link
              href={href(row)}
              prefetch={false}
              tabIndex={tabIndexOf(row, c.key)}
              onClick={(e) => {
                if (onOpen) openInPage(e, () => onOpen(row))
              }}
            >
              {c.cell(row, -1)}
            </Link>
            <span className="facts">{facts(row)}</span>
            {action && (
              <span className="phone-action" data-col="action">
                {action}
              </span>
            )}
          </td>
        ) : (
          <td
            key={c.key}
            data-col={c.key}
            className={cellClass(
              c,
              link,
              Boolean(c.dim && previous && c.value?.(previous) === c.value?.(row)),
            )}
          >
            <Cell>{c.cell(row, tabIndexOf(row, c.key))}</Cell>
          </td>
        ),
      )}
      <td className="filler" inert />
    </tr>
  )
}

/** A plain click opens the row in the page; a modified one keeps the link's own behaviour. */
function openInPage(e: ReactMouseEvent<HTMLAnchorElement>, open: () => void) {
  if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  open()
}

/** A cell's content; an empty cell shows the app's missing-value marker. */
function Cell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return children === '' || children == null ? (
    <span className="missing">
      <span aria-hidden="true">-</span>
      <span className="visually-hidden">{t('n/a')}</span>
    </span>
  ) : (
    children
  )
}

/** A header's label with its unit in a muted line of its own. */
function HeadLabel<T>({ column: { label, unit } }: { column: DirectoryColumn<T> }) {
  const { t } = useTranslation()
  return (
    <span className="th-label">
      <span className="th-text">{t(label)}</span>
      {unit && (
        <>
          {' '}
          <span className="th-unit">({unit})</span>
        </>
      )}
    </span>
  )
}

/** A row's checkbox above the row's link; unchecked ones are disabled while the selection is full. `onPick` says whether shift was held. */
function SelectBox({
  row,
  label,
  selection: { ids, max },
  onPick,
  tabIndex,
}: {
  row: { id: string }
  label: string
  selection: Pick<Selection<unknown>, 'ids' | 'max'>
  onPick: (range: boolean) => void
  tabIndex: number
}) {
  const { t } = useTranslation()
  const checked = ids.includes(row.id)
  const full = !checked && ids.length >= max
  const space = useRef(false)
  // the tooltip on a wrapper: a disabled input gets no pointer events
  return (
    <Tooltip label={t('At most {max} at once', { max })} disabled={!full} events={tipEvents}>
      <span className="row-action">
        <input
          type="checkbox"
          aria-label={t('Select {name}', { name: label })}
          tabIndex={tabIndex}
          checked={checked}
          disabled={full}
          // a checkbox's change is its click, which carries the shift key; for Space the key's own
          // state covers a browser that synthesizes that click without it
          onKeyDown={(e) => {
            space.current = e.key === ' ' && e.shiftKey
          }}
          onBlur={() => {
            space.current = false
          }}
          onChange={(e) => {
            onPick((e.nativeEvent as MouseEvent).shiftKey || space.current)
            space.current = false
          }}
        />
      </span>
    </Tooltip>
  )
}

/** A column as the phone's Sort select reads it. */
type SortColumn = { key: string; label: Message; num?: boolean; value?: unknown }

/**
 * The phone's sort (below 48em only the name column shows its head), also shown when a tablet's
 * list box hides the wide columns: one option per sortable column and direction, cleared to the
 * list's own order.
 */
function SortSelect({
  columns,
  sort,
  onSort,
}: {
  columns: readonly SortColumn[]
  sort: DirectorySort
  onSort: (sort: DirectorySort) => void
}) {
  const { t } = useTranslation()
  // the input shows the chosen option as "Sort: Burn rate, low to high", the list the option alone
  const plain = new Map<string, string>()
  const data = columns
    .filter((c) => c.value)
    .flatMap((c) => {
      const label = t(c.label)
      return [
        {
          value: `${c.key} ascending`,
          text: c.num ? t('{label}, low to high', { label }) : t('{label}, A to Z', { label }),
        },
        {
          value: `${c.key} descending`,
          text: c.num ? t('{label}, high to low', { label }) : t('{label}, Z to A', { label }),
        },
      ].map(({ value, text }) => {
        plain.set(value, text)
        return { value, label: t('Sort: {text}', { text }) }
      })
    })
  return (
    <Select
      className="sort-select"
      aria-label={t('Sort')}
      placeholder={t('Sort')}
      size={controlSize.row.input}
      clearable
      data={data}
      renderOption={({ option }) => plain.get(option.value)}
      value={sort ? `${sort.column} ${sort.dir}` : null}
      onChange={(v) => {
        const [column, dir] = v?.split(' ') ?? []
        onSort(
          column && (dir === 'ascending' || dir === 'descending') ? { column, dir } : undefined,
        )
      }}
    />
  )
}

/** Moves the focus to the search box: where it goes when the control that held it is removed. */
export const focusSearch = () =>
  document.querySelector<HTMLInputElement>('.directory-search input')?.focus()

/** A scope the page was opened with (a cartridge's fit, a federation): named, with a button that lifts it. */
type Scope = { label: string; onRemove: () => void }

/**
 * The filter row: search with an icon and a clear button, the source choice (`children`), the scope
 * the page was opened with and the phone's Sort.
 */
export function DirectoryFilters({
  query,
  onQuery,
  placeholder,
  sorting,
  scope,
  children,
}: {
  query: string
  onQuery: (q: string) => void
  placeholder: string
  /** The table's columns and sort, for the phone's Sort select. */
  sorting?:
    | {
        columns: readonly SortColumn[]
        sort: DirectorySort
        onSort: (sort: DirectorySort) => void
      }
    | undefined
  scope?: Scope | undefined
  children?: ReactNode | undefined
}) {
  const { t } = useTranslation()
  const search = useRef<HTMLInputElement>(null)
  useShortcuts({ focusSearch: () => search.current?.focus() })
  const singleKeys = useSingleKeys()
  return (
    <Group className="directory-filters" gap="xs" py="xs">
      <TextInput
        ref={search}
        className="directory-search"
        aria-label={t('Search')}
        aria-keyshortcuts={singleKeys ? shortcutAriaKeys('focusSearch') : undefined}
        title={placeholder}
        placeholder={placeholder}
        name="q"
        autoComplete="off"
        spellCheck={false}
        type="search"
        size={controlSize.row.input}
        leftSection={<MagnifyingGlass size={14} aria-hidden="true" />}
        // always mounted, hidden while empty, so the text does not move when it appears
        rightSection={
          <CloseButton
            aria-label={t('Clear search')}
            style={query ? undefined : { visibility: 'hidden' }}
            onClick={() => onQuery('')}
          />
        }
        value={query}
        onChange={(e) => onQuery(e.currentTarget.value)}
      />
      {children}
      {scope && (
        <span className="scope-chip">
          <span title={scope.label}>{scope.label}</span>
          <CloseButton
            aria-label={t('Remove {name}', { name: scope.label })}
            onClick={() => {
              scope.onRemove()
              focusSearch()
            }}
          />
        </span>
      )}
      {sorting && <SortSelect {...sorting} />}
    </Group>
  )
}
