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
import {
  type Firearm,
  type Optic,
  type OpticConfiguration,
  type OpticMount,
  parseRef,
  type UserRecord,
} from '@open-reloading/schema'
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
import { useTranslation } from '../i18n/language.ts'
import { canonicalNumberText } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import { errorText } from '../lib/error-text.ts'
import { loadExample } from '../lib/example-data.ts'
import {
  blankFirearm,
  cardFacts,
  catalogueCartridgeId,
  firearmCells,
  firearmIssues,
  firearmProblem,
  schemaMessage,
} from '../lib/firearm.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText, matchesQuery, matchingText, widestCount } from '../lib/lists.ts'
import { controlSize } from '../lib/theme.ts'
import type { UnitSystem } from '../lib/units.ts'
import { copyName } from '../lib/user-file-names.ts'
import { deleteRecord, putRecords, storedRecords } from '../lib/user-store.ts'
import { catalogueIdOf } from '../lib/variants.ts'
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
import { LibraryTabs } from './library-tabs.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { PrintButton } from './record-actions.tsx'
import { EmptyList, ErrorNote, Loading } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'
import { useManufacturers } from './use-manufacturers.ts'
import { recordLoadingText, useRecordLink } from './use-record-link.ts'

type FirearmRecord = Extract<UserRecord, { kind: 'firearm' }>

/** The example load's rifle: listed last, opened read-only; Copy to edit and Duplicate make an editable copy. */
const example = loadExample.firearm as FirearmRecord

function ExampleBadge() {
  const { t } = useTranslation()
  return (
    <Badge
      component="span"
      variant="light"
      size="sm"
      color="gray"
      tt="none"
      className="firearm-card-badge"
    >
      {t('Example')}
    </Badge>
  )
}

const nameOf = (r: FirearmRecord) => (r === example ? r.data.name : r.name)

const rowHref = (r: FirearmRecord) =>
  r === example ? '/firearms' : `/firearms?record=${encodeURIComponent(r.id)}`

const tableCaption = (t: Translator['t'], named: unknown[]) =>
  named.length > 0
    ? t('Firearms, {filters}', { filters: named.join(', ') })
    : t('Firearms in this browser and the example')

/** The filters set, named for the empty list and the caption. */
const namedFilters = (t: Translator['t'], query: string) => [matchingText(t, query)].filter(Boolean)

/** The hand of the twist as the record stores it, in the language shown. */
const hands: Record<string, Message> = { right: msg('right'), left: msg('left') }

type Cells = ReturnType<typeof firearmCells>

/** The table's columns; `cells` reads a row's cells once per render. */
function firearmColumns(
  t: Translator['t'],
  system: UnitSystem,
  cartridgeName: (ref: string | undefined) => string | undefined,
  cells: (r: FirearmRecord) => Cells,
  actionsMenu: (r: FirearmRecord, tabIndex?: number) => ReactNode,
): DirectoryColumn<FirearmRecord>[] {
  return [
    {
      key: 'name',
      label: msg('Name'),
      value: nameOf,
      cell: (r) =>
        r === example ? (
          <>
            {nameOf(r)} <ExampleBadge />
          </>
        ) : (
          r.name
        ),
    },
    {
      key: 'cartridge',
      label: msg('Cartridge'),
      width: '9rem',
      value: (r) => cartridgeName(r.data.cartridge),
      cell: (r) => cartridgeName(r.data.cartridge) ?? '',
    },
    {
      key: 'barrel',
      label: msg('Barrel'),
      unit: system.barrelLength.symbol,
      num: true,
      width: '6rem',
      value: (r) => r.data.barrelLength?.value,
      cell: (r) => cells(r).barrel,
    },
    {
      key: 'twist',
      label: msg('Twist'),
      unit: t('{unit} per turn', { unit: system.twist.symbol }),
      help: msg('Barrel length per turn of the rifling.'),
      num: true,
      width: '6.5rem',
      value: (r) => r.data.twist?.value,
      cell: (r) => cells(r).twist,
    },
    {
      key: 'hand',
      label: msg('Hand'),
      width: '7rem',
      value: (r) => cells(r).hand || undefined,
      cell: (r) => {
        const hand = cells(r).hand
        return hands[hand] ? t(hands[hand]) : hand
      },
    },
    {
      key: 'optic',
      label: msg('Optic'),
      help: msg('The first optic of the active configuration.'),
      width: '9.5rem',
      value: (r) => cells(r).optic || undefined,
      cell: (r) => cells(r).optic,
    },
    {
      key: 'zero',
      label: msg('Zero'),
      unit: system.range.symbol,
      help: msg('Zero range of that optic.'),
      num: true,
      width: '5.5rem',
      value: (r) => Number(canonicalNumberText(cells(r).zero)) || undefined,
      cell: (r) => cells(r).zero,
    },
    {
      key: 'configuration',
      label: msg('Active configuration'),
      help: msg('The configuration the trajectory form offers first.'),
      width: '9.5rem',
      value: (r) => cells(r).configuration || undefined,
      cell: (r) => cells(r).configuration,
    },
    {
      key: 'actions',
      label: msg('Actions'),
      width: '3rem',
      screenOnly: true,
      cell: (r, tabIndex) => actionsMenu(r, tabIndex),
    },
  ]
}

/** Open, Duplicate and Delete of a stored firearm, Duplicate only for the example. */
function RowActions({
  record: r,
  tabIndex,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  record: FirearmRecord
  tabIndex?: number | undefined
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const stored = r !== example
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          className="row-action"
          tabIndex={tabIndex}
          size={controlSize.row.icon}
          variant="subtle"
          aria-label={t('Actions for {name}', { name: r.name })}
        >
          <DotsThreeVertical size={18} aria-hidden="true" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {stored && <Menu.Item onClick={onOpen}>{t('Open')}</Menu.Item>}
        <Menu.Item onClick={onDuplicate}>{t('Duplicate')}</Menu.Item>
        {stored && (
          <Menu.Item color="red" onClick={onDelete}>
            {t('Delete')}
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}

function FirearmCard({
  record: r,
  stored,
  lines,
  actions,
  onOpen,
  onView,
}: {
  record: FirearmRecord
  stored: boolean
  lines: (string | undefined)[]
  actions: ReactNode
  onOpen: () => void
  onView: () => void
}) {
  return (
    <Card component="li" withBorder padding="xs">
      <Group justify="space-between" wrap="nowrap" gap={4}>
        {stored ? (
          <UnstyledButton className="firearm-card-name" title={r.name} onClick={onOpen}>
            {r.name}
          </UnstyledButton>
        ) : (
          <Group gap={6} wrap="nowrap" miw={0}>
            <UnstyledButton className="firearm-card-name" title={r.data.name} onClick={onView}>
              {r.data.name}
            </UnstyledButton>
            <ExampleBadge />
          </Group>
        )}
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

/** The list area: the read error, the loading state, the cards beside an open firearm or the table. */
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
  const { t } = useTranslation()
  if (readError)
    return (
      <ErrorNote title={t('The firearms of this browser could not be read.')} onRetry={onRetry}>
        {readError}
      </ErrorNote>
    )
  if (!loaded) return <Loading what="firearms" />
  const listed = cards?.some(Boolean)
  return (
    <>
      {cards ? listed ? <ul>{cards}</ul> : empty : table}
      {hint && <p className="note screen-only">{t('Your firearms in this browser show here.')}</p>}
    </>
  )
}

/** An optic's name, else its place in the list; the ids stay internal. */
const opticNameIn = (f: Firearm, t: Translator['t']) => (id: string) => {
  const i = f.optics.findIndex((o) => o.id === id)
  return f.optics[i]?.name || (i < 0 ? t('Removed optic') : t('Optic {n}', { n: i + 1 }))
}

/** The listed firearms and the example that the search keeps. */
function matching(list: FirearmRecord[] | undefined, matches: (r: FirearmRecord) => boolean) {
  const shown = list?.filter(matches)
  const exampleShown = matches(example) ? example : undefined
  // the browser's firearms first, the example last under the group rule
  const rows = exampleShown ? [...(shown ?? []), exampleShown] : (shown ?? [])
  return { shown, exampleShown, rows }
}

/** The cards of the compact list: the example first, then the firearms of this browser. */
const cardsOf = (
  shown: FirearmRecord[] | undefined,
  exampleShown: FirearmRecord | undefined,
  card: (r: FirearmRecord, stored: boolean) => ReactNode,
) => [exampleShown && card(exampleShown, false), ...(shown ?? []).map((r) => card(r, true))]

/** Reads the stored firearms, sorted by name; `read` is this read's number, an older answer arriving later is dropped. */
function readFirearms(
  read: number,
  reads: { current: number },
  setList: (list: FirearmRecord[]) => void,
  setReadError: (message: string) => void,
) {
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
}

/** Asks the API once for the name of each record id (newline separated), `asked` holds the ones asked. */
function askNames(
  kind: 'cartridges' | 'bullets',
  ids: string,
  asked: Set<string>,
  setNames: (update: (n: Record<string, string>) => Record<string, string>) => void,
) {
  for (const id of new Set(ids.split('\n'))) {
    if (!id || asked.has(id)) continue
    asked.add(id)
    fetchRecord<{ id: string; name: string }>(kind, id)
      .then((c) => c && setNames((n) => ({ ...n, [c.id]: c.name })))
      // unreachable or unknown: the stored id shows
      .catch(() => {})
  }
}

/** The names of the records of `kind` among the newline separated `ids`, each asked once. */
function useRecordNames(kind: 'cartridges' | 'bullets', ids: string) {
  const [names, setNames] = useState<Record<string, string>>({})
  const asked = useRef(new Set<string>())
  useEffect(() => askNames(kind, ids, asked.current, setNames), [kind, ids])
  return [names, setNames] as const
}

/** The catalogue id of the bullet of a firearm's lands contact; '' without one. */
const catalogueBulletId = (f: Firearm) =>
  (f.landsBullet === undefined ? undefined : catalogueIdOf(f.landsBullet)) ?? ''

const nameOfBullet = (
  t: Translator['t'],
  names: Record<string, string>,
  ref: string | undefined,
) => {
  const parsed = ref === undefined ? undefined : parseRef(ref)
  if (parsed?.scope === 'user') return t('A bullet design of this browser')
  return parsed ? (names[parsed.id] ?? parsed.id) : ref
}

const nameOfCartridge = (names: Record<string, string>, ref: string | undefined) => {
  const id = catalogueCartridgeId(ref)
  return id === undefined ? ref : (names[id] ?? id)
}

/** The data cards that print: the open firearm's, or the example's. */
function PrintCards({
  editing,
  viewing,
  data,
  cartridgeName,
  bulletName,
  manufacturer,
  system,
  opticName,
  exampleOpticName,
}: {
  editing: boolean
  viewing: boolean
  data: Firearm
  cartridgeName: (ref: string | undefined) => string | undefined
  bulletName: (ref: string | undefined) => string | undefined
  manufacturer: string | undefined
  system: UnitSystem
  opticName: (id: string) => string
  exampleOpticName: (id: string) => string
}) {
  return (
    <>
      {editing && (
        <DataCard
          f={data}
          cartridge={cartridgeName(data.cartridge)}
          landsBullet={bulletName(data.landsBullet)}
          manufacturer={manufacturer}
          system={system}
          opticName={opticName}
        />
      )}
      {viewing && (
        <DataCard
          f={example.data}
          cartridge={cartridgeName(example.data.cartridge)}
          system={system}
          opticName={exampleOpticName}
        />
      )}
    </>
  )
}

/** The example open read-only: its data card and Copy to edit. */
function ExampleView({
  cartridge,
  system,
  opticName,
  onCopy,
}: {
  cartridge: string | undefined
  system: UnitSystem
  opticName: (id: string) => string
  onCopy: () => void
}) {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="library-editor" className="library-editor">
      <Group gap="md" wrap="nowrap" className="page-panel-head library-head">
        <h2 id="library-editor" className="page-panel-title record-heading">
          {example.data.name}
        </h2>
        <ExampleBadge />
        <Button variant="default" size={controlSize.row.button} ml="auto" onClick={onCopy}>
          {t('Copy to edit')}
        </Button>
      </Group>
      <DataCard
        f={example.data}
        cartridge={cartridge}
        system={system}
        opticName={opticName}
        title={false}
      />
    </section>
  )
}

/**
 * The firearm library: the firearms kept in this
 * browser as cards and an editor for one firearm in the tabs Firearm, Optics and Configurations,
 * saved and opened through the File menu of the user data files; print gives its data card.
 */
export function FirearmLibrary() {
  const tr = useTranslation()
  const { t } = tr
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
  const manufacturers = useManufacturers()
  const menu = useRef<FileMenuHandle>(null)
  // a row's link in a new tab: `?record=<id>` opens that firearm
  // the alert line shows alerts only, not the reading of the linked record
  useRecordLink('firearm', menu, (m) => setFailure(m && m !== recordLoadingText ? m : ''))

  /** The latest read: an older answer that arrives later is dropped. */
  const reads = useRef(0)
  const refresh = useCallback(() => {
    readFirearms(++reads.current, reads, setList, setReadError)
  }, [])
  useEffect(refresh, [refresh])

  const reloadManufacturers = manufacturers.reload
  const onOpen = useCallback(
    (d: Firearm) => {
      setData(d)
      setGeneration((g) => g + 1)
      setEditing(true)
      setViewing(false)
      // the opened record may have brought its manufacturer along
      void reloadManufacturers()
    },
    [reloadManufacturers],
  )

  // the names of the open firearm's and the listed firearms' cartridges, each asked once
  const cartridgeIds = [
    data.cartridge,
    example.data.cartridge,
    ...(list ?? []).map((r) => r.data.cartridge),
  ]
    .map(catalogueCartridgeId)
    .filter((c): c is string => !!c)
    .join('\n')
  /** Cartridge names by record id: chosen in the search or read from the API. */
  const [cartridgeNames, setCartridgeNames] = useRecordNames('cartridges', cartridgeIds)
  /** Bullet names by record id, for the bullet of the lands contact. */
  const [bulletNames, setBulletNames] = useRecordNames('bullets', catalogueBulletId(data))
  const bulletName = (ref: string | undefined) => nameOfBullet(t, bulletNames, ref)
  /** The name of the cartridge a reference names, else the reference as stored. */
  const cartridgeName = (ref: string | undefined) => nameOfCartridge(cartridgeNames, ref)

  // the File menu renders after an edit, from the deferred data
  const fileData = useDeferredValue(data)
  const problem = useMemo(() => firearmProblem(fileData.name, fileData, t), [fileData, t])
  const issues = useMemo(() => firearmIssues(data), [data])
  /** The schema's cross-field error at `path`, shown on that field. */
  const crossError = (...path: (string | number)[]) =>
    schemaMessage(
      issues.find((i) => i.code === 'custom' && i.path.join('/') === path.join('/'))?.message ?? '',
      t,
    ) || undefined

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
      setFailure(t('Delete of {name} failed: {reason}', { name: r.name, reason: errorText(e) }))
      return refresh()
    }
    refresh()
    // no question before the delete: Undo puts the record back
    offerUndo(t('Deleted {name} from this browser.', { name: r.name }), () =>
      putRecords([r]).then(refresh, (e) =>
        setFailure(t('Undo of {name} failed: {reason}', { name: r.name, reason: errorText(e) })),
      ),
    )
  }

  const opticName = opticNameIn(data, t)
  const exampleOpticName = opticNameIn(example.data, t)
  const mounted = (id: string) =>
    data.configurations.some((c) => c.mounts.some((m) => m.optic === id))
  const newFirearm = () => start(blankFirearm())
  /** An open firearm or the example narrows the list to cards beside it. */
  const compact = editing || viewing
  // the shared list pattern: the search, kept in the URL
  const [filters, setFilters, clearFilters] = useListState()
  const lines = (r: FirearmRecord) => {
    const facts = cardFacts(r.data, system, t)
    return [cartridgeName(r.data.cartridge), facts.barrel, facts.sight]
  }
  const matches = (r: FirearmRecord) => matchesQuery([r.name, ...lines(r)], filters.query)
  const { shown, exampleShown, rows } = matching(list, matches)
  const named = namedFilters(t, filters.query)
  const duplicate = (r: FirearmRecord) => start({ ...r.data, name: copyName(r.data.name) })
  const actionsMenu = (r: FirearmRecord, tabIndex?: number) => (
    <RowActions
      record={r}
      tabIndex={tabIndex}
      onOpen={() => menu.current?.open(r)}
      onDuplicate={() => duplicate(r)}
      onDelete={() => remove(r)}
    />
  )
  const total = (list?.length ?? 0) + 1
  // each row's cells once per render: every column and the sort read them
  const cellCache = new Map<FirearmRecord, ReturnType<typeof firearmCells>>()
  const cells = (r: FirearmRecord) => {
    const c = cellCache.get(r) ?? firearmCells(r.data, system, t)
    cellCache.set(r, c)
    return c
  }
  const columns = firearmColumns(t, system, cartridgeName, cells, actionsMenu)
  const card = (r: FirearmRecord, stored: boolean) => (
    <FirearmCard
      key={r.id}
      record={r}
      stored={stored}
      lines={lines(r)}
      actions={actionsMenu(r)}
      onOpen={() => menu.current?.open(r)}
      onView={view}
    />
  )

  return (
    <>
      <PageBar
        title={listTitles.firearms}
        translated
        status={
          list && (
            <BarCount widest={widestCount(tr, total, 'firearms')}>
              {countText(tr, rows.length, total, 'firearms')}
            </BarCount>
          )
        }
        actions={
          <>
            <Button leftSection={<Plus aria-hidden="true" />} onClick={newFirearm}>
              {t('New firearm')}
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
      <LibraryTabs />
      <div className="library" data-editing={compact || undefined}>
        <section aria-labelledby="library-list" className={compact ? 'library-list' : 'directory'}>
          <Title order={2} id="library-list" className="visually-hidden">
            {t('In this browser')}
          </Title>
          <DirectoryFilters
            query={filters.query}
            onQuery={(q) => setFilters({ query: q })}
            placeholder={t('Name or cartridge, 308…')}
            sorting={
              compact
                ? undefined
                : { columns, sort: filters.sort, onSort: (sort) => setFilters({ sort }) }
            }
          />
          {failure && <ErrorNote>{failure}</ErrorNote>}
          <LibraryBody
            readError={readError}
            onRetry={refresh}
            loaded={shown !== undefined}
            hint={list?.length === 0 && named.length === 0}
            cards={compact ? cardsOf(shown, exampleShown, card) : undefined}
            empty={<EmptyList noun="firearms" filters={filterText(named)} onClear={clearFilters} />}
            table={
              <DirectoryTable
                rows={rows}
                columns={columns}
                link="name"
                href={rowHref}
                onOpen={(r) => (r === example ? view() : menu.current?.open(r))}
                facts={(r) => lines(r).filter(Boolean).join(' · ')}
                label={nameOf}
                caption={tableCaption(t, named)}
                noun="firearms"
                sort={filters.sort}
                onSort={(sort) => setFilters({ sort })}
                phoneAction={(r, tabIndex) => actionsMenu(r, tabIndex)}
                breakBefore={filters.sort ? undefined : (r) => r === example}
                empty={
                  <EmptyList noun="firearms" filters={filterText(named)} onClear={clearFilters} />
                }
              />
            }
          />
        </section>

        {viewing && (
          <ExampleView
            cartridge={cartridgeName(example.data.cartridge)}
            system={system}
            opticName={exampleOpticName}
            onCopy={() => duplicate(example)}
          />
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
            setBulletNames={setBulletNames}
            bulletName={bulletName}
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
      <PrintCards
        editing={editing}
        viewing={viewing}
        data={data}
        cartridgeName={cartridgeName}
        bulletName={bulletName}
        manufacturer={manufacturers.nameOf(data.manufacturer)}
        system={system}
        opticName={opticName}
        exampleOpticName={exampleOpticName}
      />
    </>
  )
}
