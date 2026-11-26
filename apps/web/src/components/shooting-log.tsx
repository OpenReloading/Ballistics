'use client'

import type { I18n, MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
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
} from '@rangefoundry/schema'
import { EllipsisVertical, Plus } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteRecord,
  putRecords,
  storedRecord,
  storedRecords,
  updateRecord,
} from '@/platform/user-store.ts'
import { useTranslation } from '../i18n/language.ts'
import { loadEnglish, ungrouped } from '../i18n/lingui.ts'
import type { Translator } from '../i18n/translate.ts'
import { type EventRecord, eventRecords, resultText } from '../lib/competition-events.ts'
import { dayText } from '../lib/dates.ts'
import type { DirectorySort } from '../lib/directory.ts'
import { download } from '../lib/download.ts'
import { errorText } from '../lib/error-text.ts'
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
  withEntryDeclined,
  withEntryRounds,
} from '../lib/shooting-log.ts'
import { summaryYears } from '../lib/shooting-log-summary.ts'
import { controlSize } from '../lib/theme.ts'
import { parseUserDataFile, planImport, reasonText } from '../lib/user-data.ts'
import englishMessages from '../locales/en/components/shooting-log.json' with { type: 'json' }
import { confirmDialog, offerUndo } from './confirm.tsx'
import { type DirectoryColumn, DirectoryTable, useListState } from './directory-table.tsx'
import { BarButton, useDisciplines } from './log-parts.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { PrintButton } from './record-actions.tsx'
import { LogSummary } from './shooting-log-summary.tsx'
import { EmptyList, ErrorNote, Loading } from './states.tsx'

loadEnglish(englishMessages)

type FirearmRecord = Extract<UserRecord, { kind: 'firearm' }>
type LoadRecord = Extract<UserRecord, { kind: 'load' }>

/** The URL keys of the filters: a firearm id and a year. */
const facetKeys = ['firearm', 'year'] as const

/** The line on screen, in print and in the docs: the log claims no standing with anyone. */
const ownRecordLine = /*i18n*/ {
  id: 'log.ownRecord',
  message: 'Your own record; a club or authority decides whether to accept it.',
}

/** What the browser holds for the log: its entries, the firearms and the saved loads. */
interface LogData {
  /** Every valid record of the browser, for the summary's loads and cartridge designs. */
  records: UserRecord[]
  entries: ShootingLogRecord[]
  firearms: FirearmRecord[]
  loads: LoadRecord[]
  /** The competition events, the latest first, for the entry's link. */
  events: EventRecord[]
}

/** The names of an entry's references, from this browser's records and the catalogue. */
function namesOf(
  data: LogData | undefined,
  disciplines: ReadonlyMap<string, string>,
  i18n: I18n,
): LogNames {
  const own = new Map(
    [...(data?.firearms ?? []), ...(data?.loads ?? []), ...(data?.events ?? [])].map((r) => [
      r.id,
      r.name,
    ]),
  )
  const named = (ref: string | undefined) => {
    if (ref === undefined) return ''
    return (
      own.get(userIdOf(ref) ?? '') ??
      i18n._({ id: 'log.notInBrowser', message: 'Not in this browser' })
    )
  }
  return {
    firearm: named,
    load: named,
    event: named,
    discipline: (ref) => (ref === undefined ? '' : (disciplines.get(ref) ?? ref.slice(10))),
  }
}

/** The period the filters name, for the printed sheet's heading. */
function periodText(i18n: I18n, f: LogFilter, firearm?: string) {
  const range =
    f.from || f.to
      ? i18n._({
          id: 'log.fromTo',
          message: '{from} to {to}',
          values: {
            from: f.from ? dayText(f.from) : '…',
            to: f.to ? dayText(f.to) : '…',
          },
        })
      : ''
  const year = f.years?.[0]
    ? i18n._({ id: 'log.yearOf', message: 'Year {year}', values: { year: f.years[0] } })
    : ''
  const period =
    [year, range].filter(Boolean).join(', ') ||
    i18n._({ id: 'log.allEntries', message: 'All entries' })
  return firearm ? `${firearm}, ${period}` : period
}

/** The competition event of an entry; choosing one fills an empty result with the event's. */
function EventSelect({
  events,
  entry,
  patch,
}: {
  events: EventRecord[]
  entry: ShootingLogEntry
  patch: (p: Partial<ShootingLogEntry>) => void
}) {
  const { t } = useTranslation()
  const { i18n } = useLingui()
  return (
    <Select
      label={i18n._({ id: 'log.competitionEvent', message: 'Competition event' })}
      description={i18n._({
        id: 'log.fillsResult',
        message: "Fills an empty result with the event's total.",
      })}
      placeholder={
        events.length
          ? i18n._({ id: 'log.none', message: 'None' })
          : i18n._({ id: 'log.noEvent', message: 'No competition event saved yet' })
      }
      searchable
      clearable
      data={events.map((r) => ({
        value: `user:${r.id}`,
        label: `${dayText(r.data.date)} ${r.name}`,
      }))}
      value={entry.event ?? null}
      onChange={(v) => {
        const linked = events.find((r) => `user:${r.id}` === v)
        const result = linked && !entry.result?.trim() ? resultText(linked.data, t) : undefined
        patch({ event: v ?? undefined, ...(result && { result }) })
      }}
    />
  )
}

/** The form of one entry: day, place, discipline, firearm, load or ammunition, rounds, result, notes, confirmation. */
function EntryForm({
  entry,
  setEntry,
  firearms,
  loads,
  events,
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
  events: EventRecord[]
  disciplines: { group: string; items: { value: string; label: string }[] }[]
  disciplineName: (ref: string | undefined) => string
  problem: MessageDescriptor | undefined
  onSave: () => void
  onCancel: () => void
  isNew: boolean
}) {
  const { i18n } = useLingui()
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
            group: i18n._({ id: 'log.stored', message: 'Stored' }),
            items: [{ value: entry.discipline, label: disciplineName(entry.discipline) }],
          },
        ]
      : disciplines
  return (
    <section aria-labelledby="log-entry" className="library-editor log-editor">
      <Title order={2} id="log-entry" className="page-panel-title">
        {isNew
          ? i18n._({ id: 'log.newEntry', message: 'New entry' })
          : i18n._({ id: 'log.editEntry', message: 'Edit entry' })}
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="sm" mt="sm">
        <TextInput
          type="date"
          label={i18n._({ id: 'log.date', message: 'Date' })}
          required
          value={entry.date}
          onChange={(e) => patch({ date: e.currentTarget.value })}
        />
        <TextInput
          label={i18n._({ id: 'log.place', message: 'Place' })}
          maxLength={200}
          value={entry.place ?? ''}
          onChange={(e) => patch({ place: e.currentTarget.value })}
        />
        <Select
          label={i18n._({ id: 'log.discipline', message: 'Discipline' })}
          placeholder={i18n._({ id: 'log.none', message: 'None' })}
          searchable
          clearable
          data={disciplineOptions}
          value={entry.discipline ?? null}
          onChange={(v) => patch({ discipline: v ?? undefined })}
          nothingFoundMessage={i18n._({ id: 'log.noDiscipline', message: 'No discipline found' })}
        />
        <Select
          label={i18n._({ id: 'log.firearm', message: 'Firearm' })}
          placeholder={
            firearms.length
              ? i18n._({ id: 'log.none', message: 'None' })
              : i18n._({ id: 'log.noFirearm', message: 'No firearm saved in this browser yet' })
          }
          clearable
          data={firearmOptions}
          value={entry.firearm ?? null}
          onChange={(v) => patch({ firearm: v ?? undefined })}
        />
        <Select
          label={i18n._({ id: 'log.load', message: 'Load' })}
          placeholder={i18n._({ id: 'log.factoryAmmunition', message: 'Factory ammunition' })}
          searchable
          clearable
          data={loadOptions}
          value={entry.load ?? null}
          onChange={(v) => patch({ load: v ?? undefined, ...(v && { ammunition: undefined }) })}
        />
        {!entry.load && (
          <TextInput
            label={i18n._({ id: 'log.factoryAmmunition', message: 'Factory ammunition' })}
            description={i18n._({
              id: 'log.ammunitionHint',
              message: 'Maker and product, when no saved load was fired.',
            })}
            maxLength={200}
            value={entry.ammunition ?? ''}
            onChange={(e) => patch({ ammunition: e.currentTarget.value })}
          />
        )}
        <NumberInput
          label={i18n._({ id: 'log.roundsFired', message: 'Rounds fired' })}
          required
          min={0}
          max={100000}
          allowDecimal={false}
          allowNegative={false}
          value={entry.rounds}
          onChange={(v) => patch({ rounds: typeof v === 'number' ? v : Number(v) || 0 })}
        />
        <TextInput
          label={i18n._({ id: 'log.result', message: 'Result' })}
          description={i18n._({ id: 'log.resultHint', message: 'Such as rings or a placing.' })}
          maxLength={200}
          value={entry.result ?? ''}
          onChange={(e) => patch({ result: e.currentTarget.value })}
        />
        <EventSelect events={events} entry={entry} patch={patch} />
        <TextInput
          label={i18n._({ id: 'log.confirmedBy', message: 'Confirmed by' })}
          maxLength={200}
          value={entry.confirmation?.by ?? ''}
          onChange={(e) => {
            const by = e.currentTarget.value
            patch({ confirmation: { ...entry.confirmation, by } })
          }}
        />
        <TextInput
          type="date"
          label={i18n._({ id: 'log.confirmedOn', message: 'Confirmed on' })}
          value={entry.confirmation?.date ?? ''}
          onChange={(e) => {
            const date = e.currentTarget.value || undefined
            patch({ confirmation: { by: entry.confirmation?.by ?? '', date } })
          }}
        />
        <Textarea
          className="wide"
          label={i18n._({ id: 'log.notes', message: 'Notes' })}
          autosize
          minRows={1}
          maxRows={4}
          maxLength={10000}
          value={entry.notes ?? ''}
          onChange={(e) => patch({ notes: e.currentTarget.value })}
        />
      </SimpleGrid>
      {problem && (
        <ErrorNote>
          {i18n._({
            id: 'log.notSaved',
            message: 'Not saved: {reason}',
            values: { reason: i18n._(problem) },
          })}
        </ErrorNote>
      )}
      <Group gap="xs" mt="md">
        <Button onClick={onSave}>{i18n._({ id: 'log.saveEntry', message: 'Save entry' })}</Button>
        <Button variant="default" onClick={onCancel}>
          {i18n._({ id: 'log.cancel', message: 'Cancel' })}
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
  const { i18n } = useLingui()
  const total = entries.reduce((n, r) => n + r.data.rounds, 0)
  return (
    <div className="print-only log-sheet">
      <p>{period}</p>
      <p>{i18n._(ownRecordLine)}</p>
      <table>
        <thead>
          <tr>
            <th>{i18n._({ id: 'log.date', message: 'Date' })}</th>
            <th>{i18n._({ id: 'log.place', message: 'Place' })}</th>
            <th>{i18n._({ id: 'log.discipline', message: 'Discipline' })}</th>
            <th>{i18n._({ id: 'log.firearm', message: 'Firearm' })}</th>
            <th>{i18n._({ id: 'log.loadAmmunition', message: 'Load or ammunition' })}</th>
            <th>{i18n._({ id: 'log.rounds', message: 'Rounds' })}</th>
            <th>{i18n._({ id: 'log.result', message: 'Result' })}</th>
            <th>{i18n._({ id: 'log.confirmedBy', message: 'Confirmed by' })}</th>
            <th className="log-signature">
              {i18n._({ id: 'log.signature', message: 'Signature' })}
            </th>
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
        {i18n._(
          'log.entryCount',
          { count: entries.length },
          { message: '{count, plural, one {# entry} other {# entries}}', formats: ungrouped },
        )}
        ,{' '}
        {i18n._(
          'log.roundTotal',
          { count: total },
          { message: '{count, plural, one {# round} other {# rounds}}', formats: ungrouped },
        )}
      </p>
    </div>
  )
}

/** Reads what the log shows from the browser store. */
async function readLog(): Promise<LogData> {
  const { records } = await storedRecords()
  return {
    records,
    entries: logEntries(records),
    firearms: records
      .filter((r): r is FirearmRecord => r.kind === 'firearm')
      .sort((a, b) => a.name.localeCompare(b.name)),
    loads: records
      .filter((r): r is LoadRecord => r.kind === 'load')
      .sort((a, b) => a.name.localeCompare(b.name)),
    events: eventRecords(records),
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
  const { i18n } = useLingui()
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          className="row-action"
          tabIndex={tabIndex}
          size={controlSize.row.icon}
          variant="subtle"
          aria-label={i18n._({
            id: 'log.actionsFor',
            message: 'Actions for {name}',
            values: { name: record.name },
          })}
        >
          <EllipsisVertical size={18} aria-hidden="true" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onEdit}>{i18n._({ id: 'log.edit', message: 'Edit' })}</Menu.Item>
        <Menu.Item color="red" onClick={onDelete}>
          {i18n._({ id: 'log.delete', message: 'Delete' })}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

/** One confirm (#633), and only a yes changes the firearm; the line to show after it, empty when nothing was asked. */
async function offerRounds(id: string, entry: ShootingLogEntry, i18n: I18n) {
  const firearmId = userIdOf(entry.firearm)
  if (!firearmId || entry.rounds < 1) return ''
  const found = userRecord.safeParse(await storedRecord(firearmId))
  if (!found.success || found.data.kind !== 'firearm') return ''
  const name = found.data.name
  if (found.data.data.roundCount === undefined)
    return i18n._({
      id: 'log.noRoundCount',
      message: '{name} has no round count; set one on the Firearms page to add the log to it.',
      values: {
        name,
      },
    })
  // the other entries of the same match on this firearm: they share the event's rounds (#961)
  const siblings = entry.event
    ? (await storedRecords()).records.flatMap((r) =>
        r.kind === 'shootingLogEntry' &&
        r.id !== id &&
        r.data.event === entry.event &&
        r.data.firearm === entry.firearm
          ? [{ id: r.id, rounds: r.data.rounds }]
          : [],
      )
    : []
  const due = entryRoundsDue(found.data, id, entry.rounds, entry.event, siblings)
  if (due < 1) return ''
  const ok = await confirmDialog({
    title: i18n._({ id: 'log.addRoundCount', message: 'Add to the round count?' }),
    message: i18n._(
      'log.addRounds',
      { count: due, name },
      {
        message:
          '{count, plural, one {Add # round to the round count of {name}?} other {Add # rounds to the round count of {name}?}}',
        formats: ungrouped,
      },
    ),
    confirmLabel: i18n._({ id: 'log.add', message: 'Add' }),
  })
  if (!ok) {
    // noted, so the other entries of the match do not count this one's rounds as the event's (#974)
    if (entry.event)
      await updateRecord(firearmId, (raw) => {
        const stored = userRecord.safeParse(raw)
        return stored.success ? withEntryDeclined(stored.data, id) : undefined
      })
    return i18n._({
      id: 'log.roundCountUnchanged',
      message: 'The round count of {name} is unchanged.',
      values: { name },
    })
  }
  const written = await updateRecord(firearmId, (raw) => {
    const stored = userRecord.safeParse(raw)
    return stored.success
      ? withEntryRounds(stored.data, id, entry.rounds, new Date(), entry.event, siblings)
      : undefined
  })
  return written?.kind === 'firearm' && written.data.roundCount !== undefined
    ? i18n._({
        id: 'log.roundCount',
        message: 'Round count of {name}: {count, decimal}.',
        values: { name, count: written.data.roundCount },
      })
    : i18n._({
        id: 'log.roundCountHasEntry',
        message: 'The round count of {name} holds this entry already.',
        values: { name },
      })
}

/** The new entries, and after one question those that differ from the browser's; the report line, a throw with the reason when the file is refused. */
async function importEntries(f: File, { t, tn }: Translator, i18n: I18n) {
  const parsed = parseUserDataFile(await f.text())
  if (!parsed.ok) throw new Error(reasonText(parsed.reason, { t, tn, i18n }))
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
      title: i18n._({ id: 'log.replaceEntries', message: 'Replace entries?' }),
      message: i18n._(
        'log.replaceCount',
        { count: conflicts.length },
        {
          message:
            '{count, plural, one {# entry of the file differs from the one in this browser. Replace it?} other {# entries of the file differ from the ones in this browser. Replace them?}}',
          formats: ungrouped,
        },
      ),
      confirmLabel: i18n._({ id: 'log.replace', message: 'Replace' }),
    }))
  if (replace) await putRecords(conflicts.map((c) => c.incoming))
  const others = parsed.records.length - incoming.length
  return [
    i18n._({
      id: 'log.imported',
      message:
        '{added, decimal} entries added, {equal, decimal} already in this browser, {replaced, decimal} replaced.',
      values: {
        added: plan.added.length,
        equal: plan.equal.length,
        replaced: replace ? conflicts.length : 0,
      },
    }),
    held > 0 &&
      i18n._(
        'log.idTaken',
        { count: held },
        {
          message:
            '{count, plural, one {# entry not imported: a record of this browser has its id.} other {# entries not imported: records of this browser have their ids.}}',
          formats: ungrouped,
        },
      ),
    others > 0 &&
      i18n._(
        'log.otherKinds',
        { count: others },
        {
          message:
            '{count, plural, one {# record of another kind left out; Import of a File menu reads it.} other {# records of other kinds left out; Import of a File menu reads them.}}',
          formats: ungrouped,
        },
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

function logColumns(
  names: LogNames,
  actions: (r: ShootingLogRecord, tabIndex?: number) => ReactNode,
): DirectoryColumn<ShootingLogRecord>[] {
  const text = (
    key: string,
    label: MessageDescriptor,
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
      label: /*i18n*/ { id: 'log.column.date', message: 'Date' },
      width: '9.5rem',
      value: (r) => r.data.date,
      cell: (r) => dayText(r.data.date),
    },
    text(
      'place',
      /*i18n*/ { id: 'log.column.place', message: 'Place' },
      '9rem',
      (r) => r.data.place ?? '',
    ),
    text(
      'discipline',
      /*i18n*/ { id: 'log.column.discipline', message: 'Discipline' },
      '10rem',
      (r) => names.discipline(r.data.discipline),
    ),
    text('firearm', /*i18n*/ { id: 'log.column.firearm', message: 'Firearm' }, '10rem', (r) =>
      names.firearm(r.data.firearm),
    ),
    text(
      'ammunition',
      /*i18n*/ { id: 'log.column.ammunition', message: 'Load or ammunition' },
      '10rem',
      (r) => ammunitionText(r.data, names),
    ),
    {
      key: 'rounds',
      label: /*i18n*/ { id: 'log.column.rounds', message: 'Rounds' },
      num: true,
      width: '5rem',
      value: (r) => r.data.rounds,
      cell: (r) => r.data.rounds,
    },
    text(
      'result',
      /*i18n*/ { id: 'log.column.result', message: 'Result' },
      '8rem',
      (r) => r.data.result ?? '',
    ),
    text('event', /*i18n*/ { id: 'log.column.event', message: 'Competition event' }, '10rem', (r) =>
      names.event(r.data.event),
    ),
    text(
      'confirmed',
      /*i18n*/ { id: 'log.column.confirmed', message: 'Confirmed by' },
      '8rem',
      (r) => r.data.confirmation?.by ?? '',
    ),
    {
      key: 'actions',
      label: /*i18n*/ { id: 'log.column.actions', message: 'Actions' },
      width: '3rem',
      screenOnly: true,
      sticky: true,
      cell: (r, tabIndex) => actions(r, tabIndex),
    },
  ]
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
  const { i18n } = useLingui()
  return (
    <Group className="directory-filters log-filters" gap="xs" py="xs" align="end">
      <Select
        label={i18n._({ id: 'log.firearm', message: 'Firearm' })}
        size={controlSize.row.input}
        placeholder={i18n._({ id: 'log.allFirearms', message: 'All firearms' })}
        clearable
        data={firearms.map((f) => ({ value: f.id, label: f.name }))}
        value={firearm}
        onChange={(v) => onFacet('firearm', v)}
      />
      <Select
        label={i18n._({ id: 'log.year', message: 'Year' })}
        size={controlSize.row.input}
        placeholder={i18n._({ id: 'log.allYears', message: 'All years' })}
        clearable
        data={years}
        value={year}
        onChange={(v) => onFacet('year', v)}
      />
      <TextInput
        type="date"
        label={i18n._({ id: 'log.from', message: 'From' })}
        size={controlSize.row.input}
        value={from}
        onChange={(e) => onFrom(e.currentTarget.value)}
      />
      <TextInput
        type="date"
        label={i18n._({ id: 'log.to', message: 'To' })}
        size={controlSize.row.input}
        value={to}
        onChange={(e) => onTo(e.currentTarget.value)}
      />
    </Group>
  )
}

/** The log's filters, kept in the URL (firearm, year) and in the page (the day range). */
function useLogFilter(data: LogData | undefined, i18n: I18n) {
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
    !!firearm &&
      i18n._({ id: 'log.filterFirearm', message: 'firearm {name}', values: { name: firearmName } }),
    !!year && i18n._({ id: 'log.filterYear', message: 'year {year}', values: { year } }),
    !!(from || to) && periodText(i18n, { from, to }),
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
  // whether `data` is a read's answer: the empty stand-in after a failure stays one during a retry
  const [read, setRead] = useState(false)
  const reads = useRef(0)
  const refresh = useCallback(() => {
    const current = ++reads.current
    setReadError('')
    readLog().then(
      (d) => {
        if (current !== reads.current) return
        setData(d)
        setRead(true)
      },
      (e) => {
        if (current !== reads.current) return
        setData({ records: [], entries: [], firearms: [], loads: [], events: [] })
        setRead(false)
        setReadError(errorText(e))
      },
    )
  }, [])
  useEffect(refresh, [refresh])
  return { data, read, readError, refresh }
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
  const { i18n } = useLingui()
  if (readError)
    return (
      <ErrorNote
        title={i18n._({
          id: 'log.readFailed',
          message: 'The records of this browser could not be read.',
        })}
        onRetry={onRetry}
      >
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
          i18n._(
            'log.roundTotal',
            { count: r.data.rounds },
            { message: '{count, plural, one {# round} other {# rounds}}', formats: ungrouped },
          ),
          r.data.place,
          r.data.result,
          names.event(r.data.event),
        ]
          .filter(Boolean)
          .join(' · ')
      }
      label={(r) => `${dayText(r.data.date)} ${r.name}`}
      caption={
        named.length
          ? i18n._({
              id: 'log.titleFiltered',
              message: 'Shooting log, {filters}',
              values: { filters: named.join(', ') },
            })
          : i18n._({ id: 'log.title', message: 'Shooting log entries in this browser' })
      }
      noun="log entries"
      sort={sort}
      onSort={onSort}
      phoneAction={(r, tabIndex) => actions(r, tabIndex)}
      empty={
        data.entries.length === 0 ? (
          <Text size="sm" c="dimmed">
            {i18n._({
              id: 'log.noEntry',
              message: 'No entry yet. New entry adds the first range day.',
            })}
          </Text>
        ) : (
          <EmptyList noun="log entries" filters={filterText(named)} onClear={onClear} />
        )
      }
    />
  )
}

/** The Schiessbuch: print gives a blank signature column, and saving offers the entry's rounds to the firearm's round count, one confirm, never on its own. */
export function ShootingLog() {
  const tr = useTranslation()
  const { i18n } = useLingui()
  const { data, read, readError, refresh } = useLogData()
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
  const names = namesOf(data, disciplines.names, i18n)
  const lf = useLogFilter(data, i18n)
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
      setFailure(
        i18n._({
          id: 'log.notSaved',
          message: 'Not saved: {reason}',
          values: { reason: errorText(e) },
        }),
      )
      return
    }
    setEditing(undefined)
    setTried(false)
    refresh()
    setNote(await offerRounds(record.id, record.data, i18n).catch(errorText))
  }

  async function remove(r: ShootingLogRecord) {
    setFailure('')
    try {
      await deleteRecord(r.id)
    } catch (e) {
      setFailure(
        i18n._({
          id: 'log.deleteFailed',
          message: 'Delete of {name} failed: {reason}',
          values: { name: r.name, reason: errorText(e) },
        }),
      )
      return refresh()
    }
    setEditing((s) => (s?.id === r.id ? undefined : s))
    refresh()
    offerUndo(
      i18n._({
        id: 'log.deleted',
        message: 'Deleted {name} from this browser.',
        values: { name: r.name },
      }),
      () =>
        putRecords([r]).then(refresh, (e) =>
          setFailure(
            i18n._({
              id: 'log.undoFailed',
              message: 'Undo of {name} failed: {reason}',
              values: { name: r.name, reason: errorText(e) },
            }),
          ),
        ),
    )
  }

  function importFile(f: File) {
    setFailure('')
    setNote('')
    importEntries(f, tr, i18n).then(
      (line) => {
        setNote(line)
        refresh()
      },
      (e) =>
        setFailure(
          i18n._({
            id: 'log.notImported',
            message: 'Not imported: {reason}',
            values: { reason: errorText(e) },
          }),
        ),
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
  const nothing =
    shown.length === 0 &&
    i18n._({ id: 'log.nothingShown', message: 'No entry shown to export or print.' })

  return (
    <>
      <PageBar
        title={/*i18n*/ { id: 'page.firearmsLog', message: 'Shooting log' }}
        translated
        status={
          data && (
            <BarCount widest={widestCount(i18n, all.length, 'log entries')}>
              {countText(i18n, shown.length, all.length, 'log entries')}
            </BarCount>
          )
        }
        actions={
          <>
            <Button leftSection={<Plus aria-hidden="true" />} onClick={startNew}>
              {i18n._({ id: 'log.newEntry', message: 'New entry' })}
            </Button>
            <Button variant="default" onClick={() => file.current?.click()}>
              {i18n._({ id: 'log.importJson', message: 'Import JSON' })}
            </Button>
            <BarButton nothing={nothing} onClick={() => exportText('csv')}>
              {i18n._({ id: 'log.exportCsv', message: 'Export CSV' })}
            </BarButton>
            <BarButton nothing={nothing} onClick={() => exportText('json')}>
              {i18n._({ id: 'log.exportJson', message: 'Export JSON' })}
            </BarButton>
            <PrintButton
              disabled={nothing}
              hint={i18n._({ id: 'log.printHint', message: 'Print the entries shown' })}
            />
          </>
        }
      />
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        className="visually-hidden"
        tabIndex={-1}
        aria-label={i18n._({ id: 'log.importJson', message: 'Import JSON' })}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (f) importFile(f)
        }}
      />
      <div className="library shooting-log screen-only">
        <Text size="sm" c="dimmed" className="log-own-record">
          {i18n._(ownRecordLine)}
        </Text>
        {editing && (
          <EntryForm
            key={editing.id}
            entry={editing.entry}
            setEntry={(update) => setEditing((s) => (s ? { ...s, entry: update(s.entry) } : s))}
            firearms={data?.firearms ?? []}
            loads={data?.loads ?? []}
            events={data?.events ?? []}
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
            {i18n._({ id: 'log.entries', message: 'Entries' })}
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
      {/* after a failed read, and while its retry runs, the records are an empty stand-in */}
      {data && read && (
        <LogSummary
          entries={data.entries}
          records={data.records}
          years={summaryYears(data.entries, data.events)}
          year={lf.row.year}
          firearmName={names.firearm}
        />
      )}
      <LogSheet
        entries={shown}
        names={names}
        period={periodText(i18n, lf.filter, lf.firearmName)}
      />
    </>
  )
}
