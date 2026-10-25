'use client'

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import type {
  Firearm,
  Optic,
  OpticConfiguration,
  OpticMount,
  UserRecord,
} from '@openreloading/schema'
import { DotsThreeVertical, Plus } from '@phosphor-icons/react'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { fetchRecord } from '../lib/api-fetch.ts'
import type { CartridgeDetail } from '../lib/api-types.ts'
import { errorText } from '../lib/error-text.ts'
import { loadExample } from '../lib/example-data.ts'
import {
  blankFirearm,
  cardFacts,
  catalogueCartridgeId,
  firearmCells,
  firearmIssues,
  firearmProblem,
} from '../lib/firearm.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText, matchesQuery } from '../lib/lists.ts'
import { originNames, origins, readOrigins } from '../lib/sources.ts'
import { controlSize } from '../lib/theme.ts'
import { copyName } from '../lib/user-file-names.ts'
import { deleteRecord, putRecords, storedRecords } from '../lib/user-store.ts'
import { offerUndo } from './confirm.tsx'
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { FileMenu, type FileMenuHandle } from './file-menu.tsx'
import { DataCard } from './firearm-data-card.tsx'
import { FirearmEditor } from './firearm-editor.tsx'
import { SourceFilter } from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { PrintButton } from './record-actions.tsx'
import { EmptyList, ErrorNote, Loading } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'
import { useManufacturers } from './use-manufacturers.ts'
import { recordLoadingText, useRecordLink } from './use-record-link.ts'

type FirearmRecord = Extract<UserRecord, { kind: 'firearm' }>

/** The example load's rifle: listed last, opened read-only; Copy to edit and Duplicate make an editable copy. */
const example = loadExample.firearm as FirearmRecord

/**
 * The firearm library: the firearms kept in this
 * browser as cards and an editor for one firearm in the tabs Firearm, Optics and Configurations,
 * saved and opened through the File menu of the user data files; print gives its data card.
 */
export function FirearmLibrary() {
  const { system } = useUnits()
  const [data, setData] = useState<Firearm>(blankFirearm)
  const [list, setList] = useState<FirearmRecord[]>()
  const [failure, setFailure] = useState('')
  /** Why the browser store could not be read. */
  const [readError, setReadError] = useState('')
  /** The name field was left once; its error shows from then on, not on a fresh page. */
  const [nameLeft, setNameLeft] = useState(false)
  /** The editor shows once a firearm is started or opened; before, the page shows the list only. */
  const [editing, setEditing] = useState(false)
  /** The example open read-only in the editor's place; Copy to edit starts an editable copy. */
  const [viewing, setViewing] = useState(false)
  /** A new or opened firearm remounts the editor, so no field starts as left. */
  const [generation, setGeneration] = useState(0)
  /** Cartridge names by record id: chosen in the search or read from the API. */
  const [cartridgeNames, setCartridgeNames] = useState<Record<string, string>>({})
  const asked = useRef(new Set<string>())
  const manufacturers = useManufacturers()
  const menu = useRef<FileMenuHandle>(null)
  // a row's link in a new tab: `?record=<id>` opens that firearm
  // the alert line shows alerts only, not the reading of the linked record
  useRecordLink('firearm', menu, (m) => setFailure(m && m !== recordLoadingText ? m : ''))

  /** The latest read: an older answer that arrives later is dropped. */
  const reads = useRef(0)
  const refresh = useCallback(() => {
    const read = ++reads.current
    setReadError('')
    storedRecords()
      .then(({ records }) => {
        if (read !== reads.current) return
        setList(
          records
            .filter((r): r is FirearmRecord => r.kind === 'firearm')
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
      })
      .catch((e) => {
        if (read !== reads.current) return
        setList([])
        setReadError(errorText(e))
      })
  }, [])
  useEffect(refresh, [refresh])

  const onOpen = useCallback((d: Firearm) => {
    setData(d)
    setGeneration((g) => g + 1)
    setEditing(true)
    setViewing(false)
  }, [])

  // the names of the open firearm's and the listed firearms' cartridges, each asked once
  const cartridgeIds = [
    data.cartridge,
    example.data.cartridge,
    ...(list ?? []).map((r) => r.data.cartridge),
  ]
    .map(catalogueCartridgeId)
    .filter((c): c is string => !!c)
    .join('\n')
  useEffect(() => {
    for (const id of new Set(cartridgeIds.split('\n'))) {
      if (!id || asked.current.has(id)) continue
      asked.current.add(id)
      fetchRecord<CartridgeDetail>('cartridges', id)
        .then((c) => c && setCartridgeNames((n) => ({ ...n, [c.id]: c.name })))
        // unreachable or unknown: the stored id shows
        .catch(() => {})
    }
  }, [cartridgeIds])
  /** The name of the cartridge a reference names, else the reference as stored. */
  const cartridgeName = (ref: string | undefined) => {
    const id = catalogueCartridgeId(ref)
    return id === undefined ? ref : (cartridgeNames[id] ?? id)
  }

  // the File menu renders after an edit, from the deferred data
  const fileData = useDeferredValue(data)
  const problem = useMemo(() => firearmProblem(fileData.name, fileData), [fileData])
  const issues = useMemo(() => firearmIssues(data), [data])
  /** The schema's cross-field error at `path`, shown on that field. */
  const crossError = (...path: (string | number)[]) =>
    issues.find((i) => i.code === 'custom' && i.path.join('/') === path.join('/'))?.message

  const patch = (p: Partial<Firearm>) => setData((d) => ({ ...d, ...p }))
  const setOptic = (i: number, p: Partial<Optic>) =>
    setData((d) => ({ ...d, optics: d.optics.map((o, j) => (j === i ? { ...o, ...p } : o)) }))
  const setConfig = (i: number, p: Partial<OpticConfiguration>) =>
    setData((d) => ({
      ...d,
      configurations: d.configurations.map((c, j) => (j === i ? { ...c, ...p } : c)),
    }))
  const setMount = (i: number, k: number, p: Partial<OpticMount>) =>
    setData((d) => ({
      ...d,
      configurations: d.configurations.map((c, j) =>
        j === i ? { ...c, mounts: c.mounts.map((m, l) => (l === k ? { ...m, ...p } : m)) } : c,
      ),
    }))

  async function start(next: Firearm) {
    if (!(await menu.current?.startNew(next))) return
    setData(next)
    setNameLeft(false)
    setGeneration((g) => g + 1)
    setEditing(true)
    setViewing(false)
  }

  /** The example read-only; an open firearm with changes is asked about first, as for New. */
  async function view() {
    if (editing) {
      const blank = blankFirearm()
      if (!(await menu.current?.startNew(blank))) return
      setData(blank)
      setNameLeft(false)
      setEditing(false)
    }
    setViewing(true)
  }

  async function remove(r: FirearmRecord) {
    if (menu.current?.id() === r.id) {
      const blank = blankFirearm()
      if (!(await menu.current.startNew(blank))) return
      setData(blank)
      setNameLeft(false)
      setGeneration((g) => g + 1)
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

  /** An optic's name, else its place in the list; the ids stay internal. */
  const opticNameIn = (f: Firearm) => (id: string) => {
    const i = f.optics.findIndex((o) => o.id === id)
    return f.optics[i]?.name || (i < 0 ? 'Removed optic' : `Optic ${i + 1}`)
  }
  const opticName = opticNameIn(data)
  const mounted = (id: string) =>
    data.configurations.some((c) => c.mounts.some((m) => m.optic === id))
  const newFirearm = () => start(blankFirearm())
  // the shared list pattern: search, Source and Clear filters, kept in the URL
  const [filters, setFilters, clearFilters] = useListState()
  // the example is OpenReloading's, the firearms of this browser are Mine
  const on = readOrigins(filters.sources)
  const lines = (r: FirearmRecord) => {
    const facts = cardFacts(r.data, system)
    return [cartridgeName(r.data.cartridge), facts.barrel, facts.sight]
  }
  const matches = (r: FirearmRecord) => matchesQuery([r.name, ...lines(r)], filters.query)
  const shown = list?.filter((r) => on.includes('user') && matches(r))
  const exampleShown = on.includes('openreloading') && matches(example) ? example : undefined
  const named = [
    on.length < origins.length && `${originNames[on[0]]} only`,
    filters.query.trim() && `matching "${filters.query.trim()}"`,
  ].filter(Boolean)
  const duplicate = (r: FirearmRecord) => start({ ...r.data, name: copyName(r.data.name) })
  /** Open, Duplicate and Delete of a stored firearm, Duplicate only for the example. */
  const actionsMenu = (r: FirearmRecord, tabIndex?: number) => {
    const stored = r !== example
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
          {stored && <Menu.Item onClick={() => menu.current?.open(r)}>Open</Menu.Item>}
          <Menu.Item onClick={() => duplicate(r)}>Duplicate</Menu.Item>
          {stored && (
            <Menu.Item color="red" onClick={() => remove(r)}>
              Delete
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
    )
  }
  const exampleBadge = (
    <Badge
      component="span"
      variant="light"
      size="sm"
      color="gray"
      tt="none"
      className="firearm-card-badge"
    >
      Example
    </Badge>
  )
  const total = (list?.length ?? 0) + 1
  // the browser's firearms first, the example last under the group rule
  const rows = [...(shown ?? []), ...(exampleShown ? [exampleShown] : [])]
  const nameOf = (r: FirearmRecord) => (r === example ? r.data.name : r.name)
  // each row's cells once per render: every column and the sort read them
  const cellCache = new Map<FirearmRecord, ReturnType<typeof firearmCells>>()
  const cells = (r: FirearmRecord) => {
    const c = cellCache.get(r) ?? firearmCells(r.data, system)
    cellCache.set(r, c)
    return c
  }
  const columns: DirectoryColumn<FirearmRecord>[] = [
    {
      key: 'name',
      label: 'Name',
      value: nameOf,
      cell: (r) =>
        r === example ? (
          <>
            {nameOf(r)} {exampleBadge}
          </>
        ) : (
          r.name
        ),
    },
    {
      key: 'cartridge',
      label: 'Cartridge',
      width: '9rem',
      value: (r) => cartridgeName(r.data.cartridge),
      cell: (r) => cartridgeName(r.data.cartridge) ?? '',
    },
    {
      key: 'barrel',
      label: 'Barrel',
      unit: system.barrelLength.symbol,
      num: true,
      width: '6rem',
      value: (r) => r.data.barrelLength?.value,
      cell: (r) => cells(r).barrel,
    },
    {
      key: 'twist',
      label: 'Twist',
      unit: `${system.twist.symbol} per turn`,
      help: 'Barrel length per turn of the rifling.',
      num: true,
      width: '6.5rem',
      value: (r) => r.data.twist?.value,
      cell: (r) => cells(r).twist,
    },
    {
      key: 'hand',
      label: 'Hand',
      width: '4.5rem',
      value: (r) => cells(r).hand || undefined,
      cell: (r) => cells(r).hand,
    },
    {
      key: 'optic',
      label: 'Optic',
      help: 'The first optic of the active configuration.',
      width: '9.5rem',
      value: (r) => cells(r).optic || undefined,
      cell: (r) => cells(r).optic,
    },
    {
      key: 'zero',
      label: 'Zero',
      unit: system.range.symbol,
      help: 'Zero range of that optic.',
      num: true,
      width: '5.5rem',
      value: (r) => Number(cells(r).zero) || undefined,
      cell: (r) => cells(r).zero,
    },
    {
      key: 'configuration',
      label: 'Active configuration',
      help: 'The configuration the trajectory form offers first.',
      width: '9.5rem',
      value: (r) => cells(r).configuration || undefined,
      cell: (r) => cells(r).configuration,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '3rem',
      screenOnly: true,
      cell: (r, tabIndex) => actionsMenu(r, tabIndex),
    },
  ]
  const card = (r: FirearmRecord, stored: boolean) => (
    <Card component="li" key={r.id} withBorder padding="xs">
      <Group justify="space-between" wrap="nowrap" gap={4}>
        {stored ? (
          <UnstyledButton
            className="firearm-card-name"
            title={r.name}
            onClick={() => menu.current?.open(r)}
          >
            {r.name}
          </UnstyledButton>
        ) : (
          <Group gap={6} wrap="nowrap" miw={0}>
            <UnstyledButton className="firearm-card-name" title={r.data.name} onClick={view}>
              {r.data.name}
            </UnstyledButton>
            {exampleBadge}
          </Group>
        )}
        {actionsMenu(r)}
      </Group>
      {lines(r).map(
        (line) =>
          line && (
            <Text key={line} size="xs" c="dimmed" truncate="end" title={line}>
              {line}
            </Text>
          ),
      )}
    </Card>
  )

  return (
    <>
      <PageBar
        title={listTitles.firearms}
        status={
          list && (
            <BarCount widest={`${total} of ${countText(total, total, 'firearms')}`}>
              {countText(rows.length, total, 'firearms')}
            </BarCount>
          )
        }
        actions={
          <>
            <Button leftSection={<Plus aria-hidden="true" />} onClick={newFirearm}>
              New firearm
            </Button>
            <FileMenu
              ref={menu}
              kind="firearm"
              name={fileData.name}
              data={fileData}
              problem={problem}
              idle={!editing}
              onOpen={onOpen}
              onStored={refresh}
            />
            <UnitsIconButton />
            <PrintButton disabled={!editing && !viewing} />
          </>
        }
      />
      <div className="library" data-editing={editing || viewing || undefined}>
        <section
          aria-labelledby="library-list"
          className={editing || viewing ? 'library-list' : 'directory'}
        >
          <Title order={2} id="library-list" className="visually-hidden">
            In this browser
          </Title>
          <DirectoryFilters
            query={filters.query}
            onQuery={(q) => setFilters({ query: q })}
            placeholder="Name or cartridge, 308…"
            active={Boolean(filters.query) || on.length < origins.length}
            onClear={clearFilters}
            sorting={
              editing || viewing
                ? undefined
                : { columns, sort: filters.sort, onSort: (sort) => setFilters({ sort }) }
            }
          >
            <SourceFilter
              src={filters.sources}
              counts={{ openreloading: 1, user: list?.length ?? 0 }}
              onChange={(src) => setFilters({ sources: src })}
            />
          </DirectoryFilters>
          {failure && <ErrorNote>{failure}</ErrorNote>}
          {readError ? (
            <ErrorNote title="The firearms of this browser could not be read." onRetry={refresh}>
              {readError}
            </ErrorNote>
          ) : list === undefined || shown === undefined ? (
            <Loading what="firearms" />
          ) : (
            <>
              {editing || viewing ? (
                rows.length > 0 ? (
                  <ul>
                    {exampleShown && card(exampleShown, false)}
                    {shown.map((r) => card(r, true))}
                  </ul>
                ) : (
                  <EmptyList noun="firearms" filters={filterText(named)} onClear={clearFilters} />
                )
              ) : (
                <DirectoryTable
                  rows={rows}
                  columns={columns}
                  link="name"
                  href={(r) =>
                    r === example ? '/firearms' : `/firearms?record=${encodeURIComponent(r.id)}`
                  }
                  onOpen={(r) => (r === example ? view() : menu.current?.open(r))}
                  facts={(r) => lines(r).filter(Boolean).join(' · ')}
                  label={nameOf}
                  caption={
                    named.length > 0
                      ? `Firearms, ${named.join(', ')}`
                      : 'Firearms in this browser and the example'
                  }
                  noun="firearms"
                  sort={filters.sort}
                  onSort={(sort) => setFilters({ sort })}
                  phoneAction={(r, tabIndex) => actionsMenu(r, tabIndex)}
                  breakBefore={filters.sort ? undefined : (r) => r === example}
                  empty={
                    <EmptyList noun="firearms" filters={filterText(named)} onClear={clearFilters} />
                  }
                />
              )}
              {list.length === 0 && named.length === 0 && (
                <p className="note screen-only">Your firearms in this browser show here.</p>
              )}
            </>
          )}
        </section>

        {viewing && (
          <section aria-labelledby="library-editor" className="library-editor">
            <Group gap="md" wrap="nowrap" className="page-panel-head library-head">
              <h2 id="library-editor" className="page-panel-title record-heading">
                {example.data.name}
              </h2>
              {exampleBadge}
              <Button
                variant="default"
                size={controlSize.row.button}
                ml="auto"
                onClick={() => duplicate(example)}
              >
                Copy to edit
              </Button>
            </Group>
            <DataCard
              f={example.data}
              cartridge={cartridgeName(example.data.cartridge)}
              system={system}
              opticName={opticNameIn(example.data)}
              title={false}
            />
          </section>
        )}

        {editing && (
          <FirearmEditor
            key={generation}
            data={data}
            system={system}
            nameLeft={nameLeft}
            setNameLeft={setNameLeft}
            setCartridgeNames={setCartridgeNames}
            cartridgeName={cartridgeName}
            manufacturers={manufacturers}
            patch={patch}
            setOptic={setOptic}
            setConfig={setConfig}
            setMount={setMount}
            crossError={crossError}
            opticName={opticName}
            mounted={mounted}
          />
        )}
      </div>
      {editing && (
        <DataCard
          f={data}
          cartridge={cartridgeName(data.cartridge)}
          manufacturer={manufacturers.nameOf(data.manufacturer)}
          system={system}
          opticName={opticName}
        />
      )}
      {viewing && (
        <DataCard
          f={example.data}
          cartridge={cartridgeName(example.data.cartridge)}
          system={system}
          opticName={opticNameIn(example.data)}
        />
      )}
    </>
  )
}
