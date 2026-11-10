'use client'

import { Tooltip } from '@mantine/core'
import { DataTable, type DataTableColumn, type DataTableProps } from 'mantine-datatable'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import { basePath } from '../lib/edition.ts'
import { tipEvents } from '../lib/theme.ts'
import {
  Cell,
  cellClass,
  type DirectoryTable,
  HeadLabel,
  helpText,
  printCap,
  printedLines,
  sortedRows,
  usePrinting,
} from './directory-table.tsx'

type Props<T extends { id: string }> = Omit<Parameters<typeof DirectoryTable<T>>[0], 'onOpen'>

const pageSize = 50

const controlLabels = {
  first: msg('First page'),
  last: msg('Last page'),
  previous: msg('Previous page'),
  next: msg('Next page'),
}

/** The trial: DirectoryTable's props on mantine-datatable, paged at 50 rows instead of windowed. */
export function DatatableTrial<T extends { id: string }>({
  rows,
  columns,
  link,
  href,
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
}: Props<T>) {
  const { t } = useTranslation()
  const printing = usePrinting()
  const shown = sortedRows(rows, columns, sort)
  const [page, setPage] = useState(1)
  // a new filter or sort shows the first page
  useEffect(() => setPage(1), [rows, sort])
  const records = printing
    ? shown.slice(0, printCap)
    : shown.slice((page - 1) * pageSize, page * pageSize)
  const ids = selection?.ids ?? []
  const byId = new Map(rows.map((r) => [r.id, r]))
  const tableColumns: DataTableColumn<T>[] = columns.map((c) => ({
    accessor: c.key,
    title: c.help ? (
      <Tooltip label={helpText(c.help, t)} position="bottom" events={tipEvents} multiline w={260}>
        <span>
          <HeadLabel column={c} />
        </span>
      </Tooltip>
    ) : (
      <HeadLabel column={c} />
    ),
    sortable: Boolean(c.value),
    textAlign: c.num ? 'right' : 'left',
    ...(c.width && { width: c.width }),
    ...(c.key !== link && {
      visibleMediaQuery: c.wide ? '(min-width: 64em)' : '(min-width: 48em)',
    }),
    titleClassName: cellClass(c, link) ?? '',
    cellsClassName: (r, i) => {
      const previous = records[i - 1]
      return (
        cellClass(c, link, Boolean(c.dim && previous && c.value?.(previous) === c.value?.(r))) ?? ''
      )
    },
    ...(c.key === link && {
      customCellAttributes: (r: T) => (phoneAction?.(r, 0) ? { 'data-action': '' } : {}),
    }),
    render: (r) =>
      c.key === link ? (
        <>
          {/* no prefetch: a long list of links (Next.js docs) */}
          <Link href={href(r)} prefetch={false}>
            {c.cell(r, 0)}
          </Link>
          <span className="facts">{facts(r)}</span>
          {phoneAction?.(r, 0) && (
            <span className="phone-action" data-col="action">
              {phoneAction(r, 0)}
            </span>
          )}
        </>
      ) : (
        <Cell>{c.cell(r, 0)}</Cell>
      ),
  }))
  const full = ids.length >= (selection?.max ?? 0)
  // the package's props are unions of optional groups that TypeScript cannot narrow from conditional spreads
  const props = {
    'aria-label': caption,
    withTableBorder: false,
    classNames: { table: 'directory-table' },
    columns: tableColumns,
    records,
    emptyState: empty,
    sortStatus: {
      columnAccessor: sort?.column ?? '',
      direction: sort?.dir === 'descending' ? 'desc' : 'asc',
    },
    onSortStatusChange: ({ columnAccessor }: { columnAccessor: string }) => {
      const dir = sort?.column === columnAccessor ? sort.dir : undefined
      onSort(
        dir === undefined
          ? { column: columnAccessor, dir: 'ascending' }
          : dir === 'ascending'
            ? { column: columnAccessor, dir: 'descending' }
            : undefined,
      )
    },
    customRowAttributes: (r: T, i: number) => ({
      'data-row': '',
      'data-id': r.id,
      'data-picked': ids.includes(r.id) || undefined,
      'data-break': (i > 0 && breakBefore?.(r, records[i - 1] as T)) || undefined,
    }),
    ...(selection && {
      selectionColumnClassName: 'select-cell',
      // 24 px boxes (WCAG 2.5.8)
      selectionCheckboxProps: { size: 'md' },
      selectedRecords: ids.map((id) => byId.get(id) ?? ({ id } as T)),
      // a ticked row stays enabled; a full selection disables the others
      isRecordSelectable: (r: T) => (selection.can?.(r) ?? true) && (ids.includes(r.id) || !full),
      onSelectedRecordsChange: (next: T[]) =>
        selection.onChange(next.map((r) => r.id).slice(0, selection.max)),
      getRecordSelectionCheckboxProps: (r: T) => ({
        'aria-label': t('Select {name}', { name: label(r) }),
      }),
      allRecordsSelectionCheckboxProps: { disabled: true, 'aria-label': t('Select') },
    }),
    ...(!printing && {
      page,
      onPageChange: setPage,
      totalRecords: shown.length,
      recordsPerPage: pageSize,
      paginationWithEdges: true,
      paginationText: ({
        from,
        to,
        totalRecords,
      }: {
        from: number
        to: number
        totalRecords: number
      }) => t('{from} to {to} of {total}', { from, to, total: totalRecords }),
      getPaginationControlProps: (control: keyof typeof controlLabels) => ({
        'aria-label': t(controlLabels[control]),
      }),
      getPaginationItemProps: (n: number) => ({ 'aria-label': t('Page {number}', { number: n }) }),
    }),
  } as DataTableProps<T>
  return (
    <div className="directory-scroll page-panel page-panel-flush">
      <DataTable<T> {...props} />
      {shown.length > printCap && (
        <p className="print-only">
          {t(printedLines[noun], { limit: printCap, total: shown.length })}
        </p>
      )}
      {/* every record link in the HTML for readers without JavaScript and for crawlers */}
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
