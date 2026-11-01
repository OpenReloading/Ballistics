'use client'

import {
  ActionIcon,
  Button,
  Group,
  Menu,
  NumberInput,
  Select,
  SimpleGrid,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import {
  type ShootingLogEntry,
  type ShootingLogRecord,
  type UserRecord,
  userRecord,
} from '@open-reloading/schema'
import { DotsThreeVertical, Plus } from '@phosphor-icons/react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { dayText } from '../lib/dates.ts'
import type { DirectorySort } from '../lib/directory.ts'
import { download } from '../lib/download.ts'
import { errorText } from '../lib/error-text.ts'
import type { FederationData } from '../lib/face-disciplines.ts'
import { fetchFederationData } from '../lib/face-records.ts'
import { countText, filterText, widestCount } from '../lib/lists.ts'
import { newId } from '../lib/new-id.ts'
import {
  ammunitionText,
  blankEntry,
  cleanEntry,
  entryName,
  entryProblem,
  entryRoundsDue,
  inFilter,
  type LogFilter,
  type LogNames,
  logCsv,
  logEntries,
  logFileName,
  logJson,
  logYears,
  userIdOf,
  withEntryRounds,
} from '../lib/shooting-log.ts'
import { controlSize } from '../lib/theme.ts'
import { parseUserDataFile, planImport, reasonText } from '../lib/user-data.ts'
import {
  deleteRecord,
  putRecords,
  storedRecord,
  storedRecords,
  updateRecord,
} from '../lib/user-store.ts'
import { confirmDialog, offerUndo } from './confirm.tsx'
import { type DirectoryColumn, DirectoryTable, useListState } from './directory-table.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { PrintButton } from './record-actions.tsx'
import { EmptyList, ErrorNote, Loading } from './states.tsx'

type FirearmRecord = Extract<UserRecord, { kind: 'firearm' }>
type LoadRecord = Extract<UserRecord, { kind: 'load' }>

/** The URL keys of the filters: a firearm id and a year. */
const facetKeys = ['firearm', 'year'] as const

/** The line on screen, in print and in the docs: the log claims no standing with anyone. */
export const ownRecordLine = msg(
  'The shooting log is your own record. Whether a club or an authority accepts it is up to them.',
)

/** What the browser holds for the log: its entries, the firearms and the saved loads. */
interface LogData {
  entries: ShootingLogRecord[]
  firearms: FirearmRecord[]
  loads: LoadRecord[]
}

/** The disciplines of the catalogue as select options, by federation; empty while unreachable. */
function useDisciplines() {
  const [data, setData] = useState<FederationData>()
  useEffect(() => {
    // unreachable: no discipline to choose, a stored one shows by its id
    fetchFederationData().then(setData, () => {})
  }, [])
  return useMemo(() => {
    const names = new Map<string, string>()
    const groups = new Map<string, { value: string; label: string }[]>()
    const federation = new Map(data?.federations.map((f) => [f.id, f.name]) ?? [])
    for (const d of data?.disciplines ?? []) {
      const label = [d.number, d.name].filter(Boolean).join(' ')
      names.set(`catalogue:${d.id}`, label)
      const group = federation.get(d.federation) ?? d.federation
      groups.set(group, [...(groups.get(group) ?? []), { value: `catalogue:${d.id}`, label }])
    }
    const options = [...groups].map(([group, items]) => ({ group, items }))
    return { options, names }
  }, [data])
}

/** The names of an entry's references, from this browser's records and the catalogue. */
function namesOf(
  data: LogData | undefined,
  disciplines: ReadonlyMap<string, string>,
  t: Translator['t'],
): LogNames {
  const own = new Map(
    [...(data?.firearms ?? []), ...(data?.loads ?? [])].map((r) => [r.id, r.name]),
  )
  const named = (ref: string | undefined) => {
    if (ref === undefined) return ''
    return own.get(userIdOf(ref) ?? '') ?? t('Not in this browser')
  }
  return {
    firearm: named,
    load: named,
    discipline: (ref) => (ref === undefined ? '' : (disciplines.get(ref) ?? ref.slice(10))),
  }
}

/** The period the filters name, for the printed sheet's heading. */
function periodText(t: Translator['t'], f: LogFilter, firearm?: string) {
  const range =
    f.from || f.to
      ? t('{from} to {to}', {
          from: f.from ? dayText(f.from) : '…',
          to: f.to ? dayText(f.to) : '…',
        })
      : ''
  const year = f.years?.[0] ? t('Year {year}', { year: f.years[0] }) : ''
  const period = [year, range].filter(Boolean).join(', ') || t('All entries')
  return firearm ? `${firearm}, ${period}` : period
}

/** The form of one entry: day, place, discipline, firearm, load or ammunition, rounds, result, notes, confirmation. */
function EntryForm({
  entry,
  setEntry,
  firearms,
  loads,
  disciplines,
  disciplineName,
  problem,
  onSave,
  onCancel,
  isNew,
}: {
  entry: ShootingLogEntry
  setEntry: (update: (e: ShootingLogEntry) => ShootingLogEntry) => void
  firearms: FirearmRecord[]
  loads: LoadRecord[]
  disciplines: { group: string; items: { value: string; label: string }[] }[]
  disciplineName: (ref: string | undefined) => string
  problem: Message | undefined
  onSave: () => void
  onCancel: () => void
  isNew: boolean
}) {
  const { t } = useTranslation()
  const patch = (p: Partial<ShootingLogEntry>) => setEntry((e) => ({ ...e, ...p }))
  const firearmOptions = firearms.map((f) => ({ value: `user:${f.id}`, label: f.name }))
  const loadOptions = loads.map((l) => ({ value: `user:${l.id}`, label: l.name }))
  // a stored discipline the catalogue does not list (offline) keeps its option
  const known = disciplines.some((g) => g.items.some((i) => i.value === entry.discipline))
  const disciplineOptions =
    entry.discipline && !known
      ? [
          ...disciplines,
          {
            group: t('Stored'),
            items: [{ value: entry.discipline, label: disciplineName(entry.discipline) }],
          },
        ]
      : disciplines
  return (
    <section aria-labelledby="log-entry" className="library-editor log-editor">
      <Title order={2} id="log-entry" className="page-panel-title">
        {isNew ? t('New entry') : t('Edit entry')}
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="sm" mt="sm">
        <TextInput
          type="date"
          label={t('Date')}
          required
          value={entry.date}
          onChange={(e) => patch({ date: e.currentTarget.value })}
        />
        <TextInput
          label={t('Place')}
          maxLength={200}
          value={entry.place ?? ''}
          onChange={(e) => patch({ place: e.currentTarget.value })}
        />
        <Select
          label={t('Discipline')}
          placeholder={t('None')}
          searchable
          clearable
          data={disciplineOptions}
          value={entry.discipline ?? null}
          onChange={(v) => patch({ discipline: v ?? undefined })}
          nothingFoundMessage={t('No discipline found')}
        />
        <Select
          label={t('Firearm')}
          placeholder={firearms.length ? t('None') : t('No firearm saved in this browser yet')}
          clearable
          data={firearmOptions}
          value={entry.firearm ?? null}
          onChange={(v) => patch({ firearm: v ?? undefined })}
        />
        <Select
          label={t('Load')}
          placeholder={t('Factory ammunition')}
          searchable
          clearable
          data={loadOptions}
          value={entry.load ?? null}
          onChange={(v) => patch({ load: v ?? undefined, ...(v && { ammunition: undefined }) })}
        />
        {!entry.load && (
          <TextInput
            label={t('Factory ammunition')}
            description={t('Maker and product, when no saved load was fired.')}
            maxLength={200}
            value={entry.ammunition ?? ''}
            onChange={(e) => patch({ ammunition: e.currentTarget.value })}
          />
        )}
        <NumberInput
          label={t('Rounds fired')}
          required
          min={0}
          max={100000}
          allowDecimal={false}
          allowNegative={false}
          value={entry.rounds}
          onChange={(v) => patch({ rounds: typeof v === 'number' ? v : Number(v) || 0 })}
        />
        <TextInput
          label={t('Result')}
          description={t('As you write it, such as rings or a placing.')}
          maxLength={200}
          value={entry.result ?? ''}
          onChange={(e) => patch({ result: e.currentTarget.value })}
        />
        <TextInput
          label={t('Confirmed by')}
          description={t('Who confirmed the entry, as you type it.')}
          maxLength={200}
          value={entry.confirmation?.by ?? ''}
          onChange={(e) => {
            const by = e.currentTarget.value
            patch({ confirmation: { ...entry.confirmation, by } })
          }}
        />
        <TextInput
          type="date"
          label={t('Confirmed on')}
          value={entry.confirmation?.date ?? ''}
          onChange={(e) => {
            const date = e.currentTarget.value || undefined
            patch({ confirmation: { by: entry.confirmation?.by ?? '', date } })
          }}
        />
        <Textarea
          className="wide"
          label={t('Notes')}
          autosize
          minRows={1}
          maxRows={4}
          maxLength={10000}
          value={entry.notes ?? ''}
          onChange={(e) => patch({ notes: e.currentTarget.value })}
        />
      </SimpleGrid>
      {problem && <ErrorNote>{t('Not saved: {reason}', { reason: t(problem) })}</ErrorNote>}
      <Group gap="xs" mt="md">
        <Button onClick={onSave}>{t('Save entry')}</Button>
        <Button variant="default" onClick={onCancel}>
          {t('Cancel')}
        </Button>
      </Group>
    </section>
  )
}

/** The printed log: one line per entry with a blank column for the club's signature. */
function LogSheet({
  entries,
  names,
  period,
}: {
  entries: ShootingLogRecord[]
  names: LogNames
  period: string
}) {
  const { t, tn } = useTranslation()
  const total = entries.reduce((n, r) => n + r.data.rounds, 0)
  return (
    <div className="print-only log-sheet">
      <p>{period}</p>
      <p>{t(ownRecordLine)}</p>
      <table>
        <thead>
          <tr>
            <th>{t('Date')}</th>
            <th>{t('Place')}</th>
            <th>{t('Discipline')}</th>
            <th>{t('Firearm')}</th>
            <th>{t('Load or ammunition')}</th>
            <th>{t('Rounds')}</th>
            <th>{t('Result')}</th>
            <th>{t('Confirmed by')}</th>
            <th className="log-signature">{t('Signature')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ id, data: e }) => (
            <tr key={id}>
              <td>{dayText(e.date)}</td>
              <td>{e.place}</td>
              <td>{names.discipline(e.discipline)}</td>
              <td>{names.firearm(e.firearm)}</td>
              <td>{ammunitionText(e, names)}</td>
              <td className="num">{e.rounds}</td>
              <td>{e.result}</td>
              <td>
                {[e.confirmation?.by, e.confirmation?.date && dayText(e.confirmation.date)]
                  .filter(Boolean)
                  .join(', ')}
              </td>
              <td className="log-signature" />
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        {tn(entries.length, '{count} entry', '{count} entries')},{' '}
        {tn(total, '{count} round', '{count} rounds')}
      </p>
    </div>
  )
}

/** Reads what the log shows from the browser store. */
async function readLog(): Promise<LogData> {
  const { records } = await storedRecords()
  return {
    entries: logEntries(records),
    firearms: records
      .filter((r): r is FirearmRecord => r.kind === 'firearm')
      .sort((a, b) => a.name.localeCompare(b.name)),
    loads: records
      .filter((r): r is LoadRecord => r.kind === 'load')
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/** The row menu: Edit and Delete. */
function RowActions({
  record,
  tabIndex,
  onEdit,
  onDelete,
}: {
  record: ShootingLogRecord
  tabIndex?: number | undefined
  onEdit: () => void
  onDelete: () => void
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
          aria-label={t('Actions for {name}', { name: record.name })}
        >
          <DotsThreeVertical size={18} aria-hidden="true" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onEdit}>{t('Edit')}</Menu.Item>
        <Menu.Item color="red" onClick={onDelete}>
          {t('Delete')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

/**
 * The one-confirm flow of the round count (#633) for a saved entry: asks, and only a yes changes
 * the firearm. The line to show after it; empty when nothing was asked.
 */
async function offerRounds(id: string, entry: ShootingLogEntry, { t, tn }: Translator) {
  const firearmId = userIdOf(entry.firearm)
  if (!firearmId || entry.rounds < 1) return ''
  const found = userRecord.safeParse(await storedRecord(firearmId))
  if (!found.success || found.data.kind !== 'firearm') return ''
  const name = found.data.name
  if (found.data.data.roundCount === undefined)
    return t('{name} has no round count; set one on the Firearms page to add the log to it.', {
      name,
    })
  const due = entryRoundsDue(found.data, id, entry.rounds)
  if (due < 1) return ''
  const ok = await confirmDialog({
    title: t('Add to the round count?'),
    message: tn(
      due,
      'Add {count} round of this entry to the round count of {name}?',
      'Add {count} rounds of this entry to the round count of {name}?',
      { name },
    ),
    confirmLabel: t('Add'),
  })
  if (!ok) return t('The round count of {name} is unchanged.', { name })
  const written = await updateRecord(firearmId, (raw) => {
    const stored = userRecord.safeParse(raw)
    return stored.success ? withEntryRounds(stored.data, id, entry.rounds) : undefined
  })
  return written?.kind === 'firearm' && written.data.roundCount !== undefined
    ? t('Round count of {name}: {count}.', { name, count: written.data.roundCount })
    : t('The round count of {name} holds this entry already.', { name })
}

/**
 * Stores the entries of a user data file: the new ones, and after one question the ones that
 * differ from the browser's. The report line; a throw with the reason when the file is refused.
 */
async function importEntries(f: File, { t, tn }: Translator) {
  const parsed = parseUserDataFile(await f.text())
  if (!parsed.ok) throw new Error(reasonText(parsed.reason, t))
  const incoming = logEntries(parsed.records)
  const stored = await storedRecords()
  const plan = planImport(incoming, stored.records, stored.invalid)
  await putRecords(plan.added)
  // only an entry replaces an entry: another kind with the id, or an invalid record, holds it
  const conflicts = plan.conflicts.filter((c) => c.stored.kind === 'shootingLogEntry')
  const held = plan.blocked.length + plan.conflicts.length - conflicts.length
  const replace =
    conflicts.length > 0 &&
    (await confirmDialog({
      title: t('Replace entries?'),
      message: tn(
        conflicts.length,
        '{count} entry of the file differs from the one in this browser. Replace it?',
        '{count} entries of the file differ from the ones in this browser. Replace them?',
      ),
      confirmLabel: t('Replace'),
    }))
  if (replace) await putRecords(conflicts.map((c) => c.incoming))
  const others = parsed.records.length - incoming.length
  return [
    t('{added} entries added, {equal} already in this browser, {replaced} replaced.', {
      added: plan.added.length,
      equal: plan.equal.length,
      replaced: replace ? conflicts.length : 0,
    }),
    held > 0 &&
      tn(
        held,
        '{count} entry not imported: a record of this browser has its id.',
        '{count} entries not imported: records of this browser have their ids.',
      ),
    others > 0 &&
      tn(
        others,
        '{count} record of another kind left out; Import of a File menu reads it.',
        '{count} records of other kinds left out; Import of a File menu reads them.',
      ),
  ]
    .filter(Boolean)
    .join(' ')
}

/** The record of the entry in the form, as Save stores it. */
const entryRecord = (id: string, e: ShootingLogEntry, names: LogNames) => {
  const entry = cleanEntry(e)
  return userRecord.parse({
    kind: 'shootingLogEntry',
    id,
    name: entryName(entry, names.firearm(entry.firearm) || undefined),
    saved: new Date().toISOString(),
    data: entry,
  }) as ShootingLogRecord
}

/** The table's columns. */
function logColumns(
  names: LogNames,
  actions: (r: ShootingLogRecord, tabIndex?: number) => ReactNode,
): DirectoryColumn<ShootingLogRecord>[] {
  const text = (
    key: string,
    label: Message,
    width: string,
    of: (r: ShootingLogRecord) => string,
  ) => ({
    key,
    label,
    width,
    value: (r: ShootingLogRecord) => of(r) || undefined,
    cell: of,
  })
  return [
    {
      key: 'date',
      label: msg('Date'),
      width: '9.5rem',
      value: (r) => r.data.date,
      cell: (r) => dayText(r.data.date),
    },
    text('place', msg('Place'), '9rem', (r) => r.data.place ?? ''),
    text('discipline', msg('Discipline'), '10rem', (r) => names.discipline(r.data.discipline)),
    text('firearm', msg('Firearm'), '10rem', (r) => names.firearm(r.data.firearm)),
    text('ammunition', msg('Load or ammunition'), '10rem', (r) => ammunitionText(r.data, names)),
    {
      key: 'rounds',
      label: msg('Rounds'),
      num: true,
      width: '5rem',
      value: (r) => r.data.rounds,
      cell: (r) => r.data.rounds,
    },
    text('result', msg('Result'), '8rem', (r) => r.data.result ?? ''),
    text('confirmed', msg('Confirmed by'), '8rem', (r) => r.data.confirmation?.by ?? ''),
    {
      key: 'actions',
      label: msg('Actions'),
      width: '3rem',
      screenOnly: true,
      sticky: true,
      cell: (r, tabIndex) => actions(r, tabIndex),
    },
  ]
}

/** A bar button that says in its title why it does nothing while `nothing` holds a reason. */
function BarButton({
  nothing,
  onClick,
  children,
}: {
  nothing: string | false
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      variant="default"
      {...(nothing && { 'data-disabled': true, 'aria-disabled': true, title: nothing })}
      onClick={nothing ? undefined : onClick}
    >
      {children}
    </Button>
  )
}

/** The filter row: firearm, year and a day range. */
function LogFilters({
  firearms,
  years,
  firearm,
  year,
  from,
  to,
  onFacet,
  onFrom,
  onTo,
}: {
  firearms: FirearmRecord[]
  years: string[]
  firearm: string | null
  year: string | null
  from: string
  to: string
  onFacet: (key: (typeof facetKeys)[number], value: string | null) => void
  onFrom: (day: string) => void
  onTo: (day: string) => void
}) {
  const { t } = useTranslation()
  return (
    <Group className="directory-filters log-filters" gap="xs" py="xs" align="end">
      <Select
        label={t('Firearm')}
        size={controlSize.row.input}
        placeholder={t('All firearms')}
        clearable
        data={firearms.map((f) => ({ value: f.id, label: f.name }))}
        value={firearm}
        onChange={(v) => onFacet('firearm', v)}
      />
      <Select
        label={t('Year')}
        size={controlSize.row.input}
        placeholder={t('All years')}
        clearable
        data={years}
        value={year}
        onChange={(v) => onFacet('year', v)}
      />
      <TextInput
        type="date"
        label={t('From')}
        size={controlSize.row.input}
        value={from}
        onChange={(e) => onFrom(e.currentTarget.value)}
      />
      <TextInput
        type="date"
        label={t('To')}
        size={controlSize.row.input}
        value={to}
        onChange={(e) => onTo(e.currentTarget.value)}
      />
    </Group>
  )
}

/** The log's filters, kept in the URL (firearm, year) and in the page (the day range). */
function useLogFilter(data: LogData | undefined, t: Translator['t']) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [filters, setFilters, clearFilters] = useListState(facetKeys)
  const firearm = filters.facets?.firearm?.[0] ?? null
  const year = filters.facets?.year?.[0] ?? null
  const filter: LogFilter = {
    firearms: filters.facets?.firearm,
    years: filters.facets?.year,
    from,
    to,
  }
  const firearmName = data?.firearms.find((f) => f.id === firearm)?.name ?? firearm ?? ''
  const named = [
    !!firearm && t('firearm {name}', { name: firearmName }),
    !!year && t('year {year}', { year }),
    !!(from || to) && periodText(t, { from, to }),
  ].filter((n): n is string => !!n)
  return {
    filter,
    named,
    firearmName: firearm ? firearmName : undefined,
    sort: filters.sort,
    setSort: (sort: typeof filters.sort) => setFilters({ sort }),
    clear: () => {
      clearFilters()
      setFrom('')
      setTo('')
    },
    row: {
      firearm,
      year,
      from,
      to,
      onFacet: (key: (typeof facetKeys)[number], value: string | null) =>
        setFilters({ facets: { ...filters.facets, [key]: value ? [value] : [] } }),
      onFrom: setFrom,
      onTo: setTo,
    },
  }
}

/** The stored log, read again by `refresh`; an older answer arriving later is dropped. */
function useLogData() {
  const [data, setData] = useState<LogData>()
  const [readError, setReadError] = useState('')
  const reads = useRef(0)
  const refresh = useCallback(() => {
    const read = ++reads.current
    setReadError('')
    readLog().then(
      (d) => read === reads.current && setData(d),
      (e) => {
        if (read !== reads.current) return
        setData({ entries: [], firearms: [], loads: [] })
        setReadError(errorText(e))
      },
    )
  }, [])
  useEffect(refresh, [refresh])
  return { data, readError, refresh }
}

type Editing = { id: string; entry: ShootingLogEntry; isNew: boolean }

/** `?record=<id>` opens that entry in the form once the log is read. */
function useEntryLink(data: LogData | undefined, open: (r: ShootingLogRecord) => void) {
  const done = useRef(false)
  useEffect(() => {
    if (!data || done.current) return
    done.current = true
    const id = new URLSearchParams(window.location.search).get('record')
    const r = id ? data.entries.find((e) => e.id === id) : undefined
    if (r) open(r)
  }, [data, open])
}

/** The list area: the read error, the loading state or the table of the entries shown. */
function LogBody({
  data,
  readError,
  onRetry,
  shown,
  names,
  named,
  sort,
  onSort,
  onOpen,
  actions,
  onClear,
}: {
  data: LogData | undefined
  readError: string
  onRetry: () => void
  shown: ShootingLogRecord[]
  names: LogNames
  named: string[]
  sort: DirectorySort
  onSort: (sort: DirectorySort) => void
  onOpen: (r: ShootingLogRecord) => void
  actions: (r: ShootingLogRecord, tabIndex?: number) => ReactNode
  onClear: () => void
}) {
  const { t, tn } = useTranslation()
  if (readError)
    return (
      <ErrorNote title={t('The records of this browser could not be read.')} onRetry={onRetry}>
        {readError}
      </ErrorNote>
    )
  if (!data) return <Loading what="your data" />
  return (
    <DirectoryTable
      rows={shown}
      columns={logColumns(names, actions)}
      link="date"
      href={(r) => `/firearms/log?record=${encodeURIComponent(r.id)}`}
      onOpen={onOpen}
      facts={(r) =>
        [
          names.firearm(r.data.firearm),
          ammunitionText(r.data, names),
          tn(r.data.rounds, '{count} round', '{count} rounds'),
          r.data.place,
          r.data.result,
        ]
          .filter(Boolean)
          .join(' · ')
      }
      label={(r) => `${dayText(r.data.date)} ${r.name}`}
      caption={
        named.length
          ? t('Shooting log, {filters}', { filters: named.join(', ') })
          : t('Shooting log entries in this browser')
      }
      noun="log entries"
      sort={sort}
      onSort={onSort}
      phoneAction={(r, tabIndex) => actions(r, tabIndex)}
      empty={
        data.entries.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t('No entry yet. New entry adds the first range day.')}
          </Text>
        ) : (
          <EmptyList noun="log entries" filters={filterText(named)} onClear={onClear} />
        )
      }
    />
  )
}

/**
 * The shooting log (Schiessbuch): the entries of this browser by date with filters by firearm,
 * year and a day range, an entry form, print of the shown entries with a blank signature column,
 * and CSV and JSON export. Saving an entry offers to add its rounds to the firearm's round count,
 * one confirm, never on its own.
 */
export function ShootingLog() {
  const tr = useTranslation()
  const { t } = tr
  const { data, readError, refresh } = useLogData()
  const [failure, setFailure] = useState('')
  const [note, setNote] = useState('')
  /** The entry in the form and its record id; undefined while no form is open. */
  const [editing, setEditing] = useState<Editing>()
  const [tried, setTried] = useState(false)
  const disciplines = useDisciplines()
  const file = useRef<HTMLInputElement>(null)
  const open = useCallback(
    (r: ShootingLogRecord) => setEditing({ id: r.id, entry: r.data, isNew: false }),
    [],
  )
  useEntryLink(data, open)
  const names = namesOf(data, disciplines.names, t)
  const lf = useLogFilter(data, t)
  const all = data?.entries ?? []
  const shown = all.filter((r) => inFilter(r, lf.filter))
  const problem = editing && entryProblem(editing.entry)

  /** Saves the open entry, then offers its new rounds to the firearm's count. */
  async function save() {
    if (!editing) return
    setTried(true)
    if (problem) return
    const record = entryRecord(editing.id, editing.entry, names)
    setFailure('')
    setNote('')
    try {
      await putRecords([record])
    } catch (e) {
      setFailure(t('Not saved: {reason}', { reason: errorText(e) }))
      return
    }
    setEditing(undefined)
    setTried(false)
    refresh()
    setNote(await offerRounds(record.id, record.data, tr).catch(errorText))
  }

  async function remove(r: ShootingLogRecord) {
    setFailure('')
    try {
      await deleteRecord(r.id)
    } catch (e) {
      setFailure(t('Delete of {name} failed: {reason}', { name: r.name, reason: errorText(e) }))
      return refresh()
    }
    setEditing((s) => (s?.id === r.id ? undefined : s))
    refresh()
    offerUndo(t('Deleted {name} from this browser.', { name: r.name }), () =>
      putRecords([r]).then(refresh, (e) =>
        setFailure(t('Undo of {name} failed: {reason}', { name: r.name, reason: errorText(e) })),
      ),
    )
  }

  function importFile(f: File) {
    setFailure('')
    setNote('')
    importEntries(f, tr).then(
      (line) => {
        setNote(line)
        refresh()
      },
      (e) => setFailure(t('Not imported: {reason}', { reason: errorText(e) })),
    )
  }

  const actions = (r: ShootingLogRecord, tabIndex?: number) => (
    <RowActions record={r} tabIndex={tabIndex} onEdit={() => open(r)} onDelete={() => remove(r)} />
  )
  const startNew = () => {
    setTried(false)
    setEditing({ id: newId(), entry: blankEntry(), isNew: true })
  }
  const exportText = (ext: 'csv' | 'json') => {
    const text = ext === 'csv' ? logCsv(shown, names) : logJson(shown)
    const type = ext === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
    download(new Blob([text], { type }), logFileName(ext))
  }
  const nothing = shown.length === 0 && t('No entry shown to export or print.')

  return (
    <>
      <PageBar
        title={msg('Shooting log')}
        translated
        status={
          data && (
            <BarCount widest={widestCount(tr, all.length, 'log entries')}>
              {countText(tr, shown.length, all.length, 'log entries')}
            </BarCount>
          )
        }
        actions={
          <>
            <Button leftSection={<Plus aria-hidden="true" />} onClick={startNew}>
              {t('New entry')}
            </Button>
            <Button variant="default" onClick={() => file.current?.click()}>
              {t('Import JSON')}
            </Button>
            <BarButton nothing={nothing} onClick={() => exportText('csv')}>
              {t('Export CSV')}
            </BarButton>
            <BarButton nothing={nothing} onClick={() => exportText('json')}>
              {t('Export JSON')}
            </BarButton>
            <PrintButton disabled={nothing} hint={t('Print the entries shown')} />
          </>
        }
      />
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        className="visually-hidden"
        tabIndex={-1}
        aria-label={t('Import JSON')}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (f) importFile(f)
        }}
      />
      <div className="library shooting-log screen-only">
        <Text size="sm" c="dimmed" className="log-own-record">
          {t(ownRecordLine)}
        </Text>
        {editing && (
          <EntryForm
            key={editing.id}
            entry={editing.entry}
            setEntry={(update) => setEditing((s) => (s ? { ...s, entry: update(s.entry) } : s))}
            firearms={data?.firearms ?? []}
            loads={data?.loads ?? []}
            disciplines={disciplines.options}
            disciplineName={names.discipline}
            problem={tried ? problem : undefined}
            onSave={() => void save()}
            onCancel={() => {
              setEditing(undefined)
              setTried(false)
            }}
            isNew={editing.isNew}
          />
        )}
        <section aria-labelledby="log-list" className="directory">
          <Title order={2} id="log-list" className="visually-hidden">
            {t('Entries')}
          </Title>
          <LogFilters firearms={data?.firearms ?? []} years={logYears(all)} {...lf.row} />
          {failure && <ErrorNote>{failure}</ErrorNote>}
          {note && (
            <Text size="sm" role="status" className="log-note">
              {note}
            </Text>
          )}
          <LogBody
            data={data}
            readError={readError}
            onRetry={refresh}
            shown={shown}
            names={names}
            named={lf.named}
            sort={lf.sort}
            onSort={lf.setSort}
            onOpen={open}
            actions={actions}
            onClear={lf.clear}
          />
        </section>
      </div>
      <LogSheet entries={shown} names={names} period={periodText(t, lf.filter, lf.firearmName)} />
    </>
  )
}
