'use client'

import {
  ActionIcon,
  Button,
  Card,
  Group,
  Menu,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { DotsThreeVertical, Plus } from '@phosphor-icons/react'
import {
  type Firearm,
  type Optic,
  type OpticConfiguration,
  type OpticMount,
  parseRef,
  type UserRecord,
} from '@rangefoundry/schema'
import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from '@/platform/link.tsx'
import { deleteRecord, putRecords, storedRecords } from '@/platform/user-store.ts'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import {
  type ClassMembers,
  classDisciplinesHref,
  classOfCartridge,
  fetchClassMembers,
} from '../lib/caliber-class-of.ts'
import { dayText } from '../lib/dates.ts'
import { errorText } from '../lib/error-text.ts'
import {
  blankFirearm,
  cardFacts,
  catalogueCartridgeId,
  firearmCells,
  firearmIssues,
  firearmPatch,
  firearmProblem,
  schemaMessage,
} from '../lib/firearm.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText, matchesQuery, matchingText, widestCount } from '../lib/lists.ts'
import { gapNotes, loadGaps } from '../lib/load-gaps.ts'
import { type FirearmUse, loadUse } from '../lib/load-use.ts'
import { controlSize } from '../lib/theme.ts'
import type { UnitSystem } from '../lib/units.ts'
import { copyName } from '../lib/user-file-names.ts'
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
import type { FirearmRangeCards, LoadRangeCard } from './firearm-range-cards.tsx'
import { LibraryTabs } from './library-tabs.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { LinkButton, PrintButton } from './record-actions.tsx'
import { EmptyList, EmptyNote, ErrorNote, Loading } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'
import { useManufacturers } from './use-manufacturers.ts'
import { recordLoadingText, useRecordLink } from './use-record-link.ts'

type FirearmRecord = Extract<UserRecord, { kind: 'firearm' }>

const rowHref = (r: FirearmRecord) => `/firearms?record=${encodeURIComponent(r.id)}`

const tableCaption = (t: Translator['t'], named: unknown[]) =>
  named.length > 0 ? t('Firearms, {filters}', { filters: named.join(', ') }) : t('Firearms')

/** The filters set, named for the empty list and the caption. */
const namedFilters = (t: Translator['t'], query: string) => [matchingText(t, query)].filter(Boolean)

/** The twist with its hand as one cell ("1:12 R"); a hand the record does not know shows as stored. */
const twists: Record<string, Message> = { right: msg('1:{twist} R'), left: msg('1:{twist} L') }

const twistText = (t: Translator['t'], { twist, hand }: { twist: string; hand: string }) => {
  if (!twist) return ''
  const message = twists[hand]
  return message ? t(message, { twist }) : `1:${twist} ${hand}`.trim()
}

type Cells = ReturnType<typeof firearmCells>

/** The table's columns; `cells` reads a row's cells once per render. */
function firearmColumns(
  t: Translator['t'],
  system: UnitSystem,
  cartridgeName: (ref: string | undefined) => string | undefined,
  cells: (r: FirearmRecord) => Cells,
  usageOf: (r: FirearmRecord) => FirearmUse,
  notesOf: (r: FirearmRecord) => string[],
  actionsMenu: (r: FirearmRecord, tabIndex?: number) => ReactNode,
): DirectoryColumn<FirearmRecord>[] {
  return [
    {
      key: 'name',
      label: msg('Name'),
      // every column has a width, so the table scrolls sideways before the name is squeezed; they add up to 72rem, which a 1280 px window holds
      width: '12.5rem',
      value: (r) => r.name,
      cell: (r) => r.name,
    },
    {
      key: 'cartridge',
      label: msg('Cartridge'),
      width: '8.5rem',
      value: (r) => cartridgeName(r.data.cartridge),
      cell: (r) => cartridgeName(r.data.cartridge) ?? '',
    },
    {
      key: 'barrel',
      label: msg('Barrel'),
      unit: system.barrelLength.symbol,
      num: true,
      width: '4.5rem',
      value: (r) => r.data.barrelLength?.value,
      cell: (r) => cells(r).barrel,
    },
    {
      key: 'twist',
      label: msg('Twist'),
      unit: t('{unit} per turn', { unit: system.twist.symbol }),
      help: msg('R right hand, L left hand.'),
      num: true,
      width: '6rem',
      value: (r) => r.data.twist?.value,
      cell: (r) => twistText(t, cells(r)),
    },
    {
      key: 'optic',
      label: msg('Optic, zero'),
      unit: system.range.symbol,
      help: msg('The first optic of the active configuration and its zero range.'),
      width: '11.5rem',
      value: (r) => cells(r).opticZero,
      cell: (r) => [cells(r).optic, cells(r).zero].filter(Boolean).join(' · '),
    },
    {
      key: 'configuration',
      label: msg('Configuration'),
      help: msg('The configuration the trajectory form offers first.'),
      width: '8rem',
      value: (r) => cells(r).configuration || undefined,
      cell: (r) => cells(r).configuration,
    },
    {
      key: 'loads',
      label: msg('Loads'),
      num: true,
      width: '4rem',
      value: (r) => usageOf(r).loads,
      cell: (r) => usageOf(r).loads,
    },
    {
      key: 'lastSession',
      label: msg('Last session'),
      help: msg('Latest chronograph session of these loads.'),
      width: '6.5rem',
      value: (r) => usageOf(r).last,
      cell: (r) => {
        const last = usageOf(r).last
        return last ? dayText(last) : ''
      },
    },
    {
      key: 'notes',
      label: msg('Notes'),
      help: msg('Saved loads of another cartridge, or no saved load.'),
      width: '7.5rem',
      value: (r) => notesOf(r).join(' ') || undefined,
      cell: (r) => notesOf(r).join(' '),
    },
    {
      key: 'actions',
      label: msg('Actions'),
      width: '3rem',
      screenOnly: true,
      // the row menu stays in view while the table scrolls sideways
      sticky: true,
      cell: (r, tabIndex) => actionsMenu(r, tabIndex),
    },
  ]
}

/** Print range cards only with saved loads; the disciplines that name the caliber class of its cartridge where it is in one. */
function RowActions({
  record: r,
  tabIndex,
  caliberClass,
  onOpen,
  onDuplicate,
  onDelete,
  loads,
  onPrintCards,
}: {
  record: FirearmRecord
  tabIndex?: number | undefined
  caliberClass: ClassMembers | undefined
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
  /** The saved loads of the firearm: none, no Print range cards. */
  loads: number
  onPrintCards: () => void
}) {
  const { t } = useTranslation()
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
        <Menu.Item onClick={onOpen}>{t('Open')}</Menu.Item>
        <Menu.Item onClick={onDuplicate}>{t('Duplicate')}</Menu.Item>
        {caliberClass && (
          <Menu.Item component={Link} href={classDisciplinesHref(caliberClass.id)}>
            {t('Disciplines listing {class}', { class: caliberClass.name })}
          </Menu.Item>
        )}
        {loads > 0 && <Menu.Item onClick={onPrintCards}>{t('Print range cards')}</Menu.Item>}
        <Menu.Item color="red" onClick={onDelete}>
          {t('Delete')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

function FirearmCard({
  record: r,
  lines,
  actions,
  onOpen,
}: {
  record: FirearmRecord
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

/** Without firearms it says why in its tooltip, focusable (aria-disabled, as a disabled button shows no tooltip). */
function ExportCsvButton({
  disabled,
  loaded,
  onClick,
}: {
  disabled: boolean
  /** The browser's firearms were read: before, or after a failed read, no reason is given. */
  loaded: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const why = useId()
  const reason = loaded ? t('No firearm saved in this browser yet') : ''
  return (
    <>
      <Tooltip label={reason} disabled={!disabled || !reason} multiline maw={320}>
        <Button
          variant="default"
          {...(disabled && { 'data-disabled': true, 'aria-disabled': true })}
          aria-describedby={disabled && reason ? why : undefined}
          onClick={disabled ? undefined : onClick}
        >
          {t('Export CSV')}
        </Button>
      </Tooltip>
      {disabled && reason && (
        <span id={why} className="visually-hidden">
          {reason}
        </span>
      )}
    </>
  )
}

/** The list area: the read error, the loading state, the cards beside an open firearm or the table. */
function LibraryBody({
  readError,
  onRetry,
  loaded,
  cards,
  empty,
  table,
}: {
  readError: string
  onRetry: () => void
  loaded: boolean
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
  if (!cards) return table
  return cards.some(Boolean) ? <ul>{cards}</ul> : empty
}

/** An optic's name, else its place in the list; the ids stay internal. */
const opticNameIn = (f: Firearm, t: Translator['t']) => (id: string) => {
  const i = f.optics.findIndex((o) => o.id === id)
  return f.optics[i]?.name || (i < 0 ? t('Removed optic') : t('Optic {n}', { n: i + 1 }))
}

/** The cards of its loads are computed in a chunk of their own, then rendered and printed until the dialog closes. */
function useRangeCards(system: UnitSystem, setFailure: (message: string) => void) {
  const [shown, setShown] = useState<{ View: typeof FirearmRangeCards; cards: LoadRangeCard[] }>()
  const printCards = (r: FirearmRecord) =>
    void import('./firearm-range-cards.tsx')
      .then(async (m) =>
        setShown({ View: m.FirearmRangeCards, cards: await m.firearmCards(r.id, system) }),
      )
      .catch((e) => setFailure(errorText(e)))
  const rangeCards = shown && (
    <shown.View cards={shown.cards} system={system} onDone={() => setShown(undefined)} />
  )
  return { printCards, rangeCards }
}

/** Reads the stored firearms, sorted by name; `read` is this read's number, an older answer arriving later is dropped. */
function readFirearms(
  read: number,
  reads: { current: number },
  setList: (list: FirearmRecord[]) => void,
  setUses: (uses: Map<string, FirearmUse>) => void,
  setGaps: (gaps: ReturnType<typeof loadGaps>) => void,
  setReadError: (message: string) => void,
) {
  setReadError('')
  storedRecords()
    .then(({ records }) => {
      if (read !== reads.current) return
      setUses(loadUse(records).firearms)
      setGaps(loadGaps(records))
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

const nameOfCartridge = (
  names: Record<string, string>,
  designs: ReadonlyMap<string, string>,
  ref: string | undefined,
) => {
  const id = catalogueCartridgeId(ref)
  return id === undefined ? ((ref && designs.get(ref)) ?? ref) : (names[id] ?? id)
}

/** Saved and opened through the File menu of the user data files; print gives the data card. */
export function FirearmLibrary() {
  const tr = useTranslation()
  const { t, tn } = tr
  const { system } = useUnits()
  const [data, setData] = useState<Firearm>(blankFirearm)
  const [list, setList] = useState<FirearmRecord[]>()
  /** The saved loads that name each firearm, by firearm id. */
  const [uses, setUses] = useState(new Map<string, FirearmUse>())
  const [gaps, setGaps] = useState(() => loadGaps([]))
  const [failure, setFailure] = useState('')
  /** Why the firearm that `?record=` names could not be opened. */
  const [linkFailure, setLinkFailure] = useState<Message>()
  /** Why the browser store could not be read. */
  const [readError, setReadError] = useState('')
  /** The name field was left once; its error shows from then on, not on a fresh page. */
  const [nameLeft, setNameLeft] = useState(false)
  /** The editor shows once a firearm is started or opened; before, the page shows the list only. */
  const [editing, setEditing] = useState(false)
  /** A new or opened firearm remounts the editor, so no field starts as left. */
  const [generation, setGeneration] = useState(0)
  const manufacturers = useManufacturers()
  const menu = useRef<FileMenuHandle>(null)
  // `?record=<id>` (a row's link in a new tab) opens that firearm; the alert line shows alerts only, not the reading of the linked record
  useRecordLink('firearm', menu, (m) => setLinkFailure(m === recordLoadingText ? undefined : m))

  /** The latest read: an older answer that arrives later is dropped. */
  const reads = useRef(0)
  const refresh = useCallback(() => {
    readFirearms(++reads.current, reads, setList, setUses, setGaps, setReadError)
  }, [])
  useEffect(refresh, [refresh])

  const reloadManufacturers = manufacturers.reload
  const onOpen = useCallback(
    (d: Firearm) => {
      setData(d)
      setGeneration((g) => g + 1)
      setEditing(true)
      // the opened record may have brought its manufacturer along
      void reloadManufacturers()
    },
    [reloadManufacturers],
  )

  // the names of the open firearm's and the listed firearms' cartridges, each asked once
  const cartridgeIds = [
    data.cartridge,
    ...(list ?? []).map((r) => r.data.cartridge),
    ...[...gaps.mismatches.values()].flat().map((m) => m.cartridge),
  ]
    .map(catalogueCartridgeId)
    .filter((c): c is string => !!c)
    .join('\n')
  /** Cartridge names by record id: chosen in the search or read from the API. */
  const [cartridgeNames, setCartridgeNames] = useRecordNames('cartridges', cartridgeIds)
  /** The caliber classes with their members, for the link to the disciplines of a row's class. */
  const [classes, setClasses] = useState<ClassMembers[]>([])
  useEffect(() => {
    // unreachable: the rows show no link
    fetchClassMembers().then(setClasses, () => {})
  }, [])
  /** Bullet names by record id, for the bullet of the lands contact. */
  const [bulletNames, setBulletNames] = useRecordNames('bullets', catalogueBulletId(data))
  const bulletName = (ref: string | undefined) => nameOfBullet(t, bulletNames, ref)
  /** The name of the cartridge a reference names, else the reference as stored. */
  const cartridgeName = (ref: string | undefined) =>
    nameOfCartridge(cartridgeNames, gaps.designs, ref)

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

  const patch = (p: Partial<Firearm>) => setData((d) => firearmPatch(d, p))
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
  const mounted = (id: string) =>
    data.configurations.some((c) => c.mounts.some((m) => m.optic === id))
  const newFirearm = () => start(blankFirearm())
  /** An open firearm narrows the list to cards beside it. */
  const compact = editing
  const [filters, setFilters, clearFilters] = useListState()
  const lines = (r: FirearmRecord) => {
    const facts = cardFacts(r.data, system, t)
    return [cartridgeName(r.data.cartridge), facts.barrel, facts.sight]
  }
  const matches = (r: FirearmRecord) => matchesQuery([r.name, ...lines(r)], filters.query)
  const shown = list?.filter(matches)
  const rows = shown ?? []
  const named = namedFilters(t, filters.query)
  const empty = list?.length ? (
    <EmptyList noun="firearms" filters={filterText(named)} onClear={clearFilters} />
  ) : (
    <EmptyNote
      icon={<Plus size={24} aria-hidden="true" />}
      title={t('No firearm saved in this browser yet')}
    />
  )
  const duplicate = (r: FirearmRecord) => start({ ...r.data, name: copyName(r.data.name) })
  const { printCards, rangeCards } = useRangeCards(system, setFailure)
  const actionsMenu = (r: FirearmRecord, tabIndex?: number) => (
    <RowActions
      record={r}
      tabIndex={tabIndex}
      caliberClass={classOfCartridge(classes, catalogueCartridgeId(r.data.cartridge))}
      onOpen={() => menu.current?.open(r)}
      onDuplicate={() => duplicate(r)}
      onDelete={() => remove(r)}
      loads={usageOf(r).loads}
      onPrintCards={() => printCards(r)}
    />
  )
  const total = list?.length ?? 0
  // each row's cells once per render: every column and the sort read them
  const cellCache = new Map<FirearmRecord, ReturnType<typeof firearmCells>>()
  const cells = (r: FirearmRecord) => {
    const c = cellCache.get(r) ?? firearmCells(r.data, system, t)
    cellCache.set(r, c)
    return c
  }
  const usageOf = (r: FirearmRecord) => uses.get(r.id) ?? { loads: 0 }
  const notesOf = (r: FirearmRecord) => gapNotes(r, gaps, cartridgeName, t)
  const columns = firearmColumns(t, system, cartridgeName, cells, usageOf, notesOf, actionsMenu)
  /** The phone row's line: the record's facts, its loads, last session day and notes. */
  const facts = (r: FirearmRecord) => {
    const { loads, last } = usageOf(r)
    return [
      ...lines(r),
      tn(loads, '{count} load', '{count} loads'),
      last && dayText(last),
      ...notesOf(r),
    ]
      .filter(Boolean)
      .join(' · ')
  }
  const card = (r: FirearmRecord) => (
    <FirearmCard
      key={r.id}
      record={r}
      lines={lines(r)}
      actions={actionsMenu(r)}
      onOpen={() => menu.current?.open(r)}
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
            <LinkButton href="/firearms/log">{t('Shooting log')}</LinkButton>
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
            <ExportCsvButton
              disabled={!list?.length}
              loaded={list !== undefined && !readError}
              onClick={() =>
                list &&
                void import('../lib/records-csv.ts')
                  .then((m) => m.saveFirearmsCsv(list, uses, cartridgeName))
                  .catch((e) => setFailure(errorText(e)))
              }
            />
            <UnitsIconButton />
            <PrintButton disabled={!editing && t('Open a firearm to print its data card.')} />
          </>
        }
      />
      <LibraryTabs />
      {rangeCards}
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
          {linkFailure && <ErrorNote>{t(linkFailure)}</ErrorNote>}
          <LibraryBody
            readError={readError}
            onRetry={refresh}
            loaded={shown !== undefined}
            cards={compact ? rows.map(card) : undefined}
            empty={empty}
            table={
              <DirectoryTable
                rows={rows}
                columns={columns}
                link="name"
                href={rowHref}
                onOpen={(r) => menu.current?.open(r)}
                facts={facts}
                label={(r) => r.name}
                caption={tableCaption(t, named)}
                noun="firearms"
                sort={filters.sort}
                onSort={(sort) => setFilters({ sort })}
                phoneAction={(r, tabIndex) => actionsMenu(r, tabIndex)}
                empty={empty}
              />
            }
          />
        </section>

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
      {editing && (
        <DataCard
          f={data}
          cartridge={cartridgeName(data.cartridge)}
          landsBullet={bulletName(data.landsBullet)}
          manufacturer={manufacturers.nameOf(data.manufacturer)}
          system={system}
          opticName={opticName}
        />
      )}
    </>
  )
}
