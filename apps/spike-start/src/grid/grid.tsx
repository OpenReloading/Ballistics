import { TextInput } from '@mantine/core'
import type { DataSource } from '@open-reloading/ui'
import {
  type ColumnFiltersState,
  columnFilteringFeature,
  flexRender,
  type RowData,
  rowSortingFeature,
  type SortingState,
  type TableOptions,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { defaultRangeExtractor, type Range, useVirtualizer } from '@tanstack/react-virtual'
import {
  type FocusEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import './grid.css'

export const gridFeatures = tableFeatures({ rowSortingFeature, columnFilteringFeature })

export interface GridProps<Row extends RowData> {
  readonly source: DataSource<Row>
  readonly columns: TableOptions<typeof gridFeatures, Row>['columns']
  readonly label: string
  readonly filterColumn: string
  readonly filterLabel: string
  readonly numeric: ReadonlySet<string>
  readonly overscan?: number
}

interface Loaded<Row> {
  readonly start: number
  readonly rows: readonly Row[]
  readonly total: number
  readonly sorting: SortingState
  readonly filters: ColumnFiltersState
}

interface Pending {
  readonly ctrl: AbortController
  readonly start: number
  readonly end: number
  readonly sorting: SortingState
  readonly filters: ColumnFiltersState
}

/** A cell position: `row` -1 is the header row, `col` counts from 0. */
interface Cell {
  readonly row: number
  readonly col: number
}

const none: readonly never[] = []
const firstRequest = 64

/** One table over a data source: only the visible rows plus overscan are asked for, made into rows and rendered. */
export function Grid<Row extends RowData>({
  source,
  columns,
  label,
  filterColumn,
  filterLabel,
  numeric,
  overscan = 12,
}: GridProps<Row>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [loaded, setLoaded] = useState<Loaded<Row>>()
  const [rowHeight, setRowHeight] = useState(30)
  const [focus, setFocus] = useState<Cell>({ row: -1, col: 0 })
  const scroller = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  // a key moved the focus: the next render focuses the cell it names
  const moved = useRef(false)
  const pending = useRef<Pending>(undefined)

  const current =
    loaded?.sorting === sorting && loaded.filters === columnFilters ? loaded : undefined
  const total = loaded?.total ?? 0
  const f: Cell = { row: Math.min(focus.row, total - 1), col: focus.col }

  const table = useTable({
    features: gridFeatures,
    columns,
    data: current?.rows ?? none,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    manualSorting: true,
    manualFiltering: true,
  })
  const leaves = table.getAllLeafColumns()

  // the focused row stays rendered when it leaves the window, so its cell keeps the focus
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range)
      if (f.row >= 0 && f.row < range.count && !indexes.includes(f.row)) {
        indexes.push(f.row)
        indexes.sort((a, b) => a - b)
      }
      return indexes
    },
    [f.row],
  )
  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => scroller.current,
    estimateSize: () => rowHeight,
    overscan,
    paddingStart: rowHeight,
    scrollPaddingStart: rowHeight,
    rangeExtractor,
  })

  useLayoutEffect(() => {
    const height = head.current?.getBoundingClientRect().height
    if (height) setRowHeight(height)
  }, [])
  useLayoutEffect(() => {
    virtualizer.measure()
  }, [rowHeight, virtualizer])

  const pageRows = Math.max(
    1,
    Math.floor(((scroller.current?.clientHeight ?? 600) - rowHeight) / rowHeight),
  )
  const visible = virtualizer.range
  const wantStart = loaded ? Math.max(0, (visible?.startIndex ?? 0) - pageRows) : 0
  const wantEnd = loaded
    ? Math.min(total - 1, (visible?.endIndex ?? 0) + pageRows)
    : firstRequest - 1

  useEffect(() => {
    const covers = (start: number, end: number) => start <= wantStart && end >= wantEnd
    if (current && covers(current.start, current.start + current.rows.length - 1)) return
    const p = pending.current
    if (p && p.sorting === sorting && p.filters === columnFilters && covers(p.start, p.end)) return
    p?.ctrl.abort()
    const ctrl = new AbortController()
    pending.current = { ctrl, start: wantStart, end: wantEnd, sorting, filters: columnFilters }
    source
      .query(
        {
          filters: columnFilters,
          sorting,
          range: { start: wantStart, count: wantEnd - wantStart + 1 },
        },
        ctrl.signal,
      )
      .then(
        (page) => {
          if (pending.current?.ctrl === ctrl) pending.current = undefined
          setLoaded({ start: wantStart, ...page, sorting, filters: columnFilters })
        },
        (error: unknown) => {
          if (!ctrl.signal.aborted) console.error(error)
        },
      )
  }, [source, sorting, columnFilters, wantStart, wantEnd, current])
  useEffect(() => () => pending.current?.ctrl.abort(), [])

  useLayoutEffect(() => {
    if (!moved.current) return
    const cell = scroller.current?.querySelector<HTMLElement>(`[data-cell="${f.row}:${f.col}"]`)
    if (!cell) return
    moved.current = false
    cell.focus({ preventScroll: true })
  })

  const move = (next: Cell, toTop: boolean) => {
    moved.current = true
    if (next.row >= 0) virtualizer.scrollToIndex(next.row, { align: 'auto' })
    else if (toTop) virtualizer.scrollToOffset(0)
    setFocus(next)
  }

  // the keys of the grid pattern (https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const { row, col } = f
    const lastRow = total - 1
    const lastCol = leaves.length - 1
    const control = e.ctrlKey || e.metaKey
    let next: Cell
    switch (e.key) {
      case 'ArrowDown':
        next = { row: Math.min(row + 1, lastRow), col }
        break
      case 'ArrowUp':
        next = { row: Math.max(row - 1, -1), col }
        break
      case 'ArrowRight':
        next = { row, col: Math.min(col + 1, lastCol) }
        break
      case 'ArrowLeft':
        next = { row, col: Math.max(col - 1, 0) }
        break
      case 'Home':
        next = control ? { row: -1, col: 0 } : { row, col: 0 }
        break
      case 'End':
        next = control ? { row: lastRow, col: lastCol } : { row, col: lastCol }
        break
      case 'PageDown':
        next = { row: Math.min(row + pageRows, lastRow), col }
        break
      case 'PageUp':
        next = { row: row < 0 ? row : Math.max(row - pageRows, 0), col }
        break
      default:
        return
    }
    e.preventDefault()
    move(next, e.key === 'Home' && control)
  }

  // a click or Tab put the focus on a cell: it becomes the grid's one tab stop
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const [row, col] = (e.target.dataset.cell ?? '').split(':').map(Number)
    if (row === undefined || col === undefined || Number.isNaN(row) || Number.isNaN(col)) return
    if (row !== f.row || col !== f.col) setFocus({ row, col })
  }

  const filter = table.getColumn(filterColumn)
  const modelRows = table.getRowModel().rows
  const tabIndex = (row: number, col: number) => (row === f.row && col === f.col ? 0 : -1)

  return (
    <>
      <TextInput
        size="xs"
        maw={320}
        label={filterLabel}
        value={String(filter?.getFilterValue() ?? '')}
        onChange={(e) => filter?.setFilterValue(e.currentTarget.value)}
        data-testid="grid-filter"
      />
      <div className="grid-scroll" ref={scroller} tabIndex={-1}>
        <div
          role="grid"
          aria-label={label}
          aria-rowcount={total + 1}
          aria-colcount={leaves.length}
          aria-busy={!current}
          tabIndex={-1}
          className="grid"
          style={{ height: virtualizer.getTotalSize() }}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
        >
          <div role="rowgroup" className="grid-head">
            <div role="row" aria-rowindex={1} className="grid-row" ref={head}>
              {table.getHeaderGroups()[0]?.headers.map((header, c) => {
                const sorted = header.column.getIsSorted()
                return (
                  <div
                    key={header.id}
                    role="columnheader"
                    aria-colindex={c + 1}
                    aria-sort={
                      sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
                    }
                    data-cell={`-1:${c}`}
                    data-numeric={numeric.has(header.column.id) || undefined}
                    tabIndex={tabIndex(-1, c)}
                    className="grid-cell"
                    onClick={header.column.getToggleSortingHandler()}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      header.column.toggleSorting()
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </div>
                )
              })}
            </div>
          </div>
          <div role="rowgroup">
            {virtualizer.getVirtualItems().map((item) => {
              const offset = current ? item.index - current.start : -1
              const row = offset >= 0 ? modelRows[offset] : undefined
              const cells = row?.getAllCells()
              return (
                <div
                  key={item.index}
                  role="row"
                  aria-rowindex={item.index + 2}
                  className="grid-row"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  {leaves.map((column, c) => {
                    const cell = cells?.[c]
                    return (
                      <div
                        key={column.id}
                        role="gridcell"
                        aria-colindex={c + 1}
                        data-cell={`${item.index}:${c}`}
                        data-numeric={numeric.has(column.id) || undefined}
                        tabIndex={tabIndex(item.index, c)}
                        className="grid-cell"
                      >
                        {cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
