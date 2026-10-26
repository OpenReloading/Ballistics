'use client'

import { ActionIcon, Button, Card, Group, Menu, Text, Title, UnstyledButton } from '@mantine/core'
import type { Case, UserCaseRecord, UserRecord } from '@open-reloading/schema'
import { DotsThreeVertical, Plus } from '@phosphor-icons/react'
import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { fetchRecord } from '../lib/api-fetch.ts'
import type { CartridgeDetail } from '../lib/api-types.ts'
import { blankCaseGroup, caseGroupProblem, groupCapacity, withCapacity } from '../lib/case-group.ts'
import { errorText } from '../lib/error-text.ts'
import { catalogueCartridgeId, siOf } from '../lib/firearm.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText, matchesQuery } from '../lib/lists.ts'
import { capacityRecord } from '../lib/load-record.ts'
import { controlSize } from '../lib/theme.ts'
import { formatQuantity, type UnitSystem, waterVolume, withUnit } from '../lib/units.ts'
import { copyName } from '../lib/user-file-names.ts'
import { deleteRecord, putRecords, storedRecords } from '../lib/user-store.ts'
import { CaseEditor } from './case-editor.tsx'
import { offerUndo } from './confirm.tsx'
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { FileMenu, type FileMenuHandle } from './file-menu.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { EmptyList, ErrorNote, Loading } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'
import { recordLoadingText, useRecordLink } from './use-record-link.ts'

type CaseRecord = UserCaseRecord

/** What the list shows of a group of cases; the capacity is read from its record. */
interface Row extends CaseRecord {
  grams: number | undefined
}

/** Open, Duplicate and Delete of a stored group of cases. */
function RowActions({
  record: r,
  tabIndex,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  record: CaseRecord
  tabIndex?: number | undefined
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          className="row-action"
          tabIndex={tabIndex}
          size={controlSize.row.icon}
          variant="subtle"
          aria-label={`Actions for ${r.name}`}
        >
          <DotsThreeVertical size={18} aria-hidden="true" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onOpen}>Open</Menu.Item>
        <Menu.Item onClick={onDuplicate}>Duplicate</Menu.Item>
        <Menu.Item color="red" onClick={onDelete}>
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

/** The browser's groups of cases with their measured capacity, read again by `refresh`. */
function useCaseRecords() {
  const [records, setRecords] = useState<UserRecord[]>()
  const [readError, setReadError] = useState('')
  /** The latest read: an older answer that arrives later is dropped. */
  const reads = useRef(0)
  const refresh = useCallback(() => {
    const read = ++reads.current
    setReadError('')
    storedRecords().then(
      ({ records: all }) => read === reads.current && setRecords(all),
      (e) => {
        if (read !== reads.current) return
        setRecords([])
        setReadError(errorText(e))
      },
    )
  }, [])
  useEffect(refresh, [refresh])
  const list = useMemo<Row[] | undefined>(
    () =>
      records
        ?.filter((r): r is CaseRecord => r.kind === 'case')
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((r) => ({ ...r, grams: groupCapacity(r.data, records) })),
    [records],
  )
  return { records, list, readError, refresh }
}

/** Cartridge names by record id, each asked of the API once; the stored reference shows until it answers. */
function useCartridgeNames(refs: readonly (string | undefined)[]) {
  const [names, setNames] = useState<Record<string, string>>({})
  const asked = useRef(new Set<string>())
  const ids = refs
    .map((c) => catalogueCartridgeId(c))
    .filter((c): c is string => !!c)
    .join('\n')
  useEffect(() => {
    for (const id of new Set(ids.split('\n'))) {
      if (!id || asked.current.has(id)) continue
      asked.current.add(id)
      fetchRecord<CartridgeDetail>('cartridges', id)
        .then((c) => c && setNames((n) => ({ ...n, [c.id]: c.name })))
        // unreachable or unknown: the stored id shows
        .catch(() => {})
    }
  }, [ids])
  const nameOf = (ref: string | undefined) => {
    const id = catalogueCartridgeId(ref)
    return id === undefined ? ref || undefined : (names[id] ?? id)
  }
  return { nameOf, setNames }
}

/** The measured capacity of a group as the form holds it, m3. */
const capacityIn = (c: Case, records: readonly UserRecord[] | undefined) => {
  const grams = groupCapacity(c, records ?? [])
  return grams === undefined ? undefined : waterVolume(grams)
}

/** The table's columns. */
function caseColumns(
  system: UnitSystem,
  cartridgeName: (ref: string | undefined) => string | undefined,
  actions: (r: Row, tabIndex?: number) => ReactNode,
): DirectoryColumn<Row>[] {
  return [
    { key: 'name', label: 'Name', value: (r) => r.name, cell: (r) => r.name },
    {
      key: 'cartridge',
      label: 'Cartridge',
      width: '11rem',
      value: (r) => cartridgeName(r.data.cartridge),
      cell: (r) => cartridgeName(r.data.cartridge) ?? '',
    },
    {
      key: 'capacity',
      label: 'Water capacity',
      unit: system.capacity.symbol,
      num: true,
      width: '8rem',
      value: (r) => r.grams,
      cell: (r) =>
        r.grams === undefined ? '' : formatQuantity('capacity', system, waterVolume(r.grams)),
    },
    {
      key: 'firings',
      label: 'Times fired',
      num: true,
      width: '6.5rem',
      value: (r) => r.data.numberOfFirings,
      cell: (r) => r.data.numberOfFirings ?? '',
    },
    {
      key: 'trim',
      label: 'Trim length',
      unit: system.length.symbol,
      num: true,
      width: '7rem',
      value: (r) => r.data.trimLength?.value,
      cell: (r) => {
        const trim = siOf('length', r.data.trimLength)
        return trim === undefined ? '' : formatQuantity('length', system, trim)
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '3rem',
      screenOnly: true,
      cell: (r, t) => actions(r, t),
    },
  ]
}

/** One group as a compact card beside the editor. */
function CaseCard({
  record: r,
  lines,
  actions,
  onOpen,
}: {
  record: Row
  lines: (string | undefined)[]
  actions: ReactNode
  onOpen: () => void
}) {
  return (
    <Card component="li" withBorder padding="xs">
      <Group justify="space-between" wrap="nowrap" gap={4}>
        <UnstyledButton className="firearm-card-name" title={r.name} onClick={onOpen}>
          {r.name}
        </UnstyledButton>
        {actions}
      </Group>
      {lines.map(
        (line) =>
          line && (
            <Text key={line} size="xs" c="dimmed" truncate="end" title={line}>
              {line}
            </Text>
          ),
      )}
    </Card>
  )
}

/**
 * The list of the user's groups of cases: the browser's `case` records as a table, and an editor for
 * one group beside compact cards, saved and opened through the File menu of the user data files.
 */
export function CaseLibrary() {
  const { system } = useUnits()
  const [data, setData] = useState<Case>(blankCaseGroup)
  /** The measured water capacity, m3: a record of its own that the group names. */
  const [capacity, setCapacity] = useState<number>()
  const [failure, setFailure] = useState('')
  const [nameLeft, setNameLeft] = useState(false)
  /** The editor shows once a group is started or opened; before, the page shows the list only. */
  const [editing, setEditing] = useState(false)
  /** A new or opened group remounts the editor, so no field starts as left. */
  const [generation, setGeneration] = useState(0)
  const menu = useRef<FileMenuHandle>(null)
  useRecordLink('case', menu, (m) => setFailure(m && m !== recordLoadingText ? m : ''))
  const { records, list, readError, refresh } = useCaseRecords()
  const { nameOf: cartridgeName, setNames: setCartridgeNames } = useCartridgeNames([
    data.cartridge,
    ...(list ?? []).map((r) => r.data.cartridge),
  ])

  /** Shows `next` in a remounted editor, with its measured capacity `m3`. */
  const show = (next: Case, m3?: number, open = true) => {
    setData(next)
    setCapacity(m3)
    setNameLeft(false)
    setGeneration((g) => g + 1)
    setEditing(open)
  }
  const onOpen = (d: Case) => show(d, capacityIn(d, records))

  // the File menu renders after an edit, from the deferred data
  const fileData = useDeferredValue(withCapacity(data, capacity))
  const problem = caseGroupProblem(fileData.name ?? '', fileData)
  const patch = (p: Partial<Case>) => setData((d) => ({ ...d, ...p }))
  /** A cleared field also drops the reference to a record this browser does not hold. */
  const changeCapacity = (m3: number | undefined) => {
    setCapacity(m3)
    if (m3 === undefined) patch({ capacity: undefined })
  }

  /** Save's browser copy: the group with the record of its measured capacity. */
  const store = useCallback(
    async (record: CaseRecord) => {
      await putRecords([
        ...(capacity === undefined
          ? []
          : [capacityRecord(record.data.cartridge, capacity, new Date())]),
        record,
      ])
      return true
    },
    [capacity],
  )

  async function start(next: Case, m3?: number) {
    if (await menu.current?.startNew(next)) show(next, m3)
  }

  async function remove(r: CaseRecord) {
    if (menu.current?.id() === r.id) {
      const blank = blankCaseGroup()
      if (!(await menu.current.startNew(blank))) return
      show(blank, undefined, editing)
    }
    setFailure('')
    try {
      await deleteRecord(r.id)
    } catch (e) {
      setFailure(`Delete of ${r.name} failed: ${errorText(e)}`)
      return refresh()
    }
    refresh()
    // no question before the delete: Undo puts the record back
    offerUndo(`Deleted ${r.name} from this browser.`, () =>
      putRecords([r]).then(refresh, (e) => setFailure(`Undo of ${r.name} failed: ${errorText(e)}`)),
    )
  }

  const [filters, setFilters, clearFilters] = useListState()
  const lines = (r: Row) => [
    cartridgeName(r.data.cartridge),
    r.grams === undefined
      ? undefined
      : `${withUnit('capacity', system, waterVolume(r.grams))} water`,
    r.data.numberOfFirings === undefined ? undefined : `${r.data.numberOfFirings} firings`,
  ]
  const rows = (list ?? []).filter((r) => matchesQuery([r.name, ...lines(r)], filters.query))
  const actions = (r: Row, tabIndex?: number) => (
    <RowActions
      record={r}
      tabIndex={tabIndex}
      onOpen={() => menu.current?.open(r)}
      onDuplicate={() =>
        start({ ...r.data, name: copyName(r.data.name ?? r.name) }, capacityIn(r.data, records))
      }
      onDelete={() => remove(r)}
    />
  )
  const columns = caseColumns(system, cartridgeName, actions)
  const total = list?.length ?? 0
  const empty = (
    <EmptyList
      noun="case groups"
      filters={filterText([filters.query.trim() && `matching "${filters.query.trim()}"`])}
      onClear={clearFilters}
    />
  )
  const cards = rows.map((r) => (
    <CaseCard
      key={r.id}
      record={r}
      lines={lines(r)}
      actions={actions(r)}
      onOpen={() => menu.current?.open(r)}
    />
  ))
  const table = (
    <DirectoryTable
      rows={rows}
      columns={columns}
      link="name"
      href={(r) => `/my-cases?record=${encodeURIComponent(r.id)}`}
      onOpen={(r) => menu.current?.open(r)}
      facts={(r) => lines(r).filter(Boolean).join(' · ')}
      label={(r) => r.name}
      caption="Case groups in this browser"
      noun="case groups"
      sort={filters.sort}
      onSort={(sort) => setFilters({ sort })}
      phoneAction={(r, t) => actions(r, t)}
      empty={empty}
    />
  )

  return (
    <>
      <PageBar
        title={listTitles.myCases}
        status={
          list && (
            <BarCount widest={`${total} of ${countText(total, total, 'case groups')}`}>
              {countText(rows.length, total, 'case groups')}
            </BarCount>
          )
        }
        actions={
          <>
            <Button
              leftSection={<Plus aria-hidden="true" />}
              onClick={() => start(blankCaseGroup())}
            >
              New case group
            </Button>
            <FileMenu
              ref={menu}
              kind="case"
              name={fileData.name ?? ''}
              data={fileData}
              problem={problem}
              idle={!editing}
              store={store}
              onOpen={onOpen}
              onStored={refresh}
            />
            <UnitsIconButton />
          </>
        }
      />
      <div className="library" data-editing={editing || undefined}>
        <section aria-labelledby="library-list" className={editing ? 'library-list' : 'directory'}>
          <Title order={2} id="library-list" className="visually-hidden">
            In this browser
          </Title>
          <DirectoryFilters
            query={filters.query}
            onQuery={(q) => setFilters({ query: q })}
            placeholder="Name or cartridge, 308…"
            sorting={
              editing
                ? undefined
                : { columns, sort: filters.sort, onSort: (sort) => setFilters({ sort }) }
            }
          />
          {failure && <ErrorNote>{failure}</ErrorNote>}
          <LibraryBody
            readError={readError}
            onRetry={refresh}
            loaded={list !== undefined}
            hint={list?.length === 0 && filters.query === ''}
            cards={editing ? cards : undefined}
            empty={empty}
            table={table}
          />
        </section>
        {editing && (
          <CaseEditor
            key={generation}
            data={data}
            capacity={capacity}
            system={system}
            nameLeft={nameLeft}
            setNameLeft={setNameLeft}
            setCartridgeNames={setCartridgeNames}
            cartridgeName={cartridgeName}
            patch={patch}
            setCapacity={changeCapacity}
          />
        )}
      </div>
    </>
  )
}

/** The list area: the read error, the loading state, the cards beside an open group or the table. */
function LibraryBody({
  readError,
  onRetry,
  loaded,
  hint,
  cards,
  empty,
  table,
}: {
  readError: string
  onRetry: () => void
  loaded: boolean
  hint: boolean
  /** The cards of the compact list beside an editor; none for the table. */
  cards: ReactNode[] | undefined
  empty: ReactNode
  table: ReactNode
}) {
  if (readError)
    return (
      <ErrorNote title="The case groups of this browser could not be read." onRetry={onRetry}>
        {readError}
      </ErrorNote>
    )
  if (!loaded) return <Loading what="case groups" />
  return (
    <>
      {cards ? cards.length > 0 ? <ul>{cards}</ul> : empty : table}
      {hint && <p className="note screen-only">Your case groups in this browser show here.</p>}
    </>
  )
}
