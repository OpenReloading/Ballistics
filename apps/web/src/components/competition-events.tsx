'use client'

import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import type { EventTotals, StageScore } from '@open-reloading/core'
import {
  type CompetitionEvent,
  type EventType,
  type UserRecord,
  userRecord,
} from '@open-reloading/schema'
import { Plus, Trash } from '@phosphor-icons/react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import {
  blankEvent,
  blankStage,
  cleanEvent,
  divisionsOf,
  type EventNames,
  type EventRecord,
  eventName,
  eventProblem,
  eventRecords,
  eventsCsv,
  eventsFileName,
  eventsJson,
  eventTotals,
  hitFactorText,
  majorAllowed,
  parseShots,
  scoreText,
  stateLabels,
  totalText,
  typeOf,
  withEventType,
} from '../lib/competition-events.ts'
import { dayText } from '../lib/dates.ts'
import type { DirectorySort } from '../lib/directory.ts'
import { download } from '../lib/download.ts'
import { errorText } from '../lib/error-text.ts'
import { eventRounds, eventRoundsDue, withEventRounds } from '../lib/firearm.ts'
import { countText, widestCount } from '../lib/lists.ts'
import { newId } from '../lib/new-id.ts'
import { userIdOf } from '../lib/shooting-log.ts'
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
import { BarButton, useDisciplines } from './log-parts.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { LinkButton, PrintButton } from './record-actions.tsx'
import { ErrorNote, Loading } from './states.tsx'

type FirearmRecord = Extract<UserRecord, { kind: 'firearm' }>
type LoadRecord = Extract<UserRecord, { kind: 'load' }>
type SheetRecord = Extract<UserRecord, { kind: 'targetSheet' }>
type Results = CompetitionEvent['results']
type Rings = Extract<Results, { method: 'rings' }>
type Stages = Extract<Results, { method: 'hit-factor' }>
type Stage = Stages['stages'][number]

/** On screen, in print and in the docs: the score is the person's, not an official result. */
const ownRecordLine = msg(
  'What you enter here is your own record, not an official result. The official result is the one the organiser publishes.',
)

/** What the browser holds for the events: the events and the records they can link. */
interface EventsData {
  events: EventRecord[]
  firearms: FirearmRecord[]
  loads: LoadRecord[]
  sheets: SheetRecord[]
}

/** User records as select options, by their `user:` reference. */
const refOptions = (rs: readonly { id: string; name: string }[] = []) =>
  rs.map((r) => ({ value: `user:${r.id}`, label: r.name }))

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)

async function readEvents(): Promise<EventsData> {
  const { records } = await storedRecords()
  const of = <K extends UserRecord['kind']>(kind: K) =>
    records.filter((r): r is Extract<UserRecord, { kind: K }> => r.kind === kind).sort(byName)
  return {
    events: eventRecords(records),
    firearms: of('firearm'),
    loads: of('load'),
    sheets: of('targetSheet'),
  }
}

/** The stored events, read again by `refresh`; an older answer arriving later is dropped. */
function useEventsData() {
  const [data, setData] = useState<EventsData>()
  const [readError, setReadError] = useState('')
  const reads = useRef(0)
  const refresh = useCallback(() => {
    const current = ++reads.current
    setReadError('')
    readEvents().then(
      (d) => current === reads.current && setData(d),
      (e) => {
        if (current !== reads.current) return
        setData({ events: [], firearms: [], loads: [], sheets: [] })
        setReadError(errorText(e))
      },
    )
  }, [])
  useEffect(refresh, [refresh])
  return { data, readError, refresh }
}

/** The names of an event's references, from this browser's records and the event types. */
function namesOf(
  data: EventsData | undefined,
  types: readonly EventType[],
  t: Translator['t'],
): EventNames {
  const own = new Map(
    [...(data?.firearms ?? []), ...(data?.loads ?? [])].map((r) => [r.id, r.name]),
  )
  const named = (ref: string | undefined) =>
    ref === undefined ? '' : (own.get(userIdOf(ref) ?? '') ?? t('Not in this browser'))
  return {
    type: (e) => typeOf(e, types)?.name ?? e.eventType.slice(10),
    firearm: named,
    load: named,
  }
}

/** A whole-number field of a score sheet. */
function CountInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (n: number) => void
}) {
  return (
    <NumberInput
      label={label}
      size={controlSize.row.input}
      min={0}
      max={10000}
      allowDecimal={false}
      allowNegative={false}
      value={value ?? 0}
      onChange={(v) => onChange(typeof v === 'number' ? v : Number(v) || 0)}
    />
  )
}

/** The ring values of a series as one text field; a value that is no number waits for the next key. */
function ShotsInput({
  label,
  shots,
  onChange,
}: {
  label: string
  shots: readonly number[] | undefined
  onChange: (shots: number[] | undefined) => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(shots?.join(' ') ?? '')
  // the text of another series (a series above was removed): show this one's shots
  const typed = parseShots(text)
  if (typed && (typed.length ? typed.join(' ') : undefined) !== shots?.join(' '))
    setText(shots?.join(' ') ?? '')
  return (
    <TextInput
      label={label}
      description={t('Ring values separated by spaces, such as 10 9 10.')}
      size={controlSize.row.input}
      value={text}
      onChange={(e) => {
        const typed = e.currentTarget.value
        setText(typed)
        const parsed = parseShots(typed)
        if (parsed) onChange(parsed.length ? parsed : undefined)
      }}
    />
  )
}

/** The ring series of an event, each with its shots or total and its target sheet. */
function SeriesEditor({
  results,
  totals,
  sheets,
  onChange,
}: {
  results: Rings
  totals: readonly number[] | undefined
  sheets: SheetRecord[]
  onChange: (r: Rings) => void
}) {
  const { t } = useTranslation()
  const set = (i: number, s: Rings['series'][number] | undefined) =>
    onChange({
      ...results,
      series: s
        ? results.series.map((x, k) => (k === i ? s : x))
        : results.series.filter((_, k) => k !== i),
    })
  return (
    <div className="event-parts">
      {results.series.map((s, i) => {
        const n = i + 1
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: series have no id; their order is their name
          <fieldset key={i} className="event-part">
            <legend>{t('Series {n}', { n })}</legend>
            <Group gap="xs" align="end" wrap="wrap">
              <ShotsInput
                label={t('Shots')}
                shots={s.shots}
                onChange={(shots) => {
                  const { shots: _, total, ...rest } = s
                  set(i, { ...rest, ...(shots ? { shots } : { total: total ?? 0 }) })
                }}
              />
              {!s.shots?.length && (
                <NumberInput
                  label={t('Series total')}
                  size={controlSize.row.input}
                  min={0}
                  max={1090}
                  decimalScale={1}
                  allowNegative={false}
                  value={s.total ?? ''}
                  onChange={(v) => {
                    const { total: _, ...rest } = s
                    set(i, typeof v === 'number' ? { ...rest, total: v } : rest)
                  }}
                />
              )}
              <Select
                label={t('Target sheet')}
                size={controlSize.row.input}
                placeholder={sheets.length ? t('None') : t('No target sheet saved yet')}
                clearable
                data={refOptions(sheets)}
                value={s.targetSheet ?? null}
                onChange={(v) => {
                  const { targetSheet: _, ...rest } = s
                  set(i, v ? { ...rest, targetSheet: v } : rest)
                }}
              />
              <Text size="sm" className="event-part-total">
                {t('Total {total}', { total: scoreText(totals?.[i]) || '–' })}
              </Text>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={t('Remove series {n}', { n })}
                onClick={() => set(i, undefined)}
              >
                <Trash aria-hidden="true" />
              </ActionIcon>
            </Group>
          </fieldset>
        )
      })}
      <Button
        variant="default"
        size={controlSize.row.button}
        leftSection={<Plus aria-hidden="true" />}
        onClick={() => onChange({ ...results, series: [...results.series, { total: 0 }] })}
      >
        {t('Add series')}
      </Button>
    </div>
  )
}

/** The practical stages of an event: hits per zone, penalties, time, power factor. */
function StagesEditor({
  results,
  scores,
  majorOk,
  onChange,
}: {
  results: Stages
  scores: readonly StageScore[] | undefined
  majorOk: boolean
  onChange: (r: Stages) => void
}) {
  const { t } = useTranslation()
  const set = (i: number, s: Stage | undefined) =>
    onChange({
      ...results,
      stages: s
        ? results.stages.map((x, k) => (k === i ? s : x))
        : results.stages.filter((_, k) => k !== i),
    })
  return (
    <div className="event-parts">
      {results.stages.map((s, i) => {
        const patch = (p: Partial<Stage>) => set(i, { ...s, ...p })
        const hits = (zone: keyof Stage['hits']) => (n: number) =>
          patch({ hits: { ...s.hits, [zone]: n } })
        const score = scores?.[i]
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stages are edited in place by their order
          <fieldset key={i} className="event-part">
            <legend>{s.name}</legend>
            <SimpleGrid cols={{ base: 2, xs: 4, md: 6 }} spacing="xs" verticalSpacing="xs">
              <TextInput
                label={t('Stage name')}
                size={controlSize.row.input}
                maxLength={200}
                value={s.name}
                onChange={(e) => patch({ name: e.currentTarget.value })}
              />
              <CountInput label="A" value={s.hits.A} onChange={hits('A')} />
              <CountInput label="C" value={s.hits.C} onChange={hits('C')} />
              <CountInput label="D" value={s.hits.D} onChange={hits('D')} />
              <CountInput label={t('Metal')} value={s.hits.metal} onChange={hits('metal')} />
              <CountInput
                label={t('Misses')}
                value={s.misses}
                onChange={(misses) => patch({ misses })}
              />
              <CountInput
                label={t('No-shoots')}
                value={s.noShoots}
                onChange={(noShoots) => patch({ noShoots })}
              />
              <CountInput
                label={t('Procedurals')}
                value={s.procedurals}
                onChange={(procedurals) => patch({ procedurals })}
              />
              <NumberInput
                label={t('Time (s)')}
                size={controlSize.row.input}
                min={0.01}
                max={3600}
                decimalScale={2}
                allowNegative={false}
                value={s.time}
                onChange={(v) => patch({ time: typeof v === 'number' ? v : Number(v) || 0 })}
              />
              <Select
                label={t('Power factor')}
                size={controlSize.row.input}
                allowDeselect={false}
                data={[
                  { value: 'minor', label: t('Minor') },
                  { value: 'major', label: t('Major'), disabled: !majorOk },
                ]}
                value={s.powerFactor}
                onChange={(v) => v && patch({ powerFactor: v as Stage['powerFactor'] })}
              />
              <NumberInput
                label={t('Stage points')}
                description={t('From the official result, where published.')}
                size={controlSize.row.input}
                min={0}
                decimalScale={4}
                allowNegative={false}
                value={s.stagePoints ?? ''}
                onChange={(v) => {
                  const { stagePoints: _, ...rest } = s
                  set(i, typeof v === 'number' ? { ...rest, stagePoints: v } : rest)
                }}
              />
            </SimpleGrid>
            <Group gap="xs" mt="xs" justify="space-between">
              <Text size="sm" className="event-part-total">
                {score
                  ? t('{points} points, hit factor {hf}', {
                      points: scoreText(score.points),
                      hf: hitFactorText(score.hitFactor),
                    })
                  : '–'}
              </Text>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={t('Remove {name}', { name: s.name })}
                onClick={() => set(i, undefined)}
              >
                <Trash aria-hidden="true" />
              </ActionIcon>
            </Group>
          </fieldset>
        )
      })}
      <Button
        variant="default"
        size={controlSize.row.button}
        leftSection={<Plus aria-hidden="true" />}
        onClick={() =>
          onChange({
            ...results,
            stages: [
              ...results.stages,
              blankStage(t('Stage {n}', { n: results.stages.length + 1 })),
            ],
          })
        }
      >
        {t('Add stage')}
      </Button>
    </div>
  )
}

/** The line of an event's total, or why it has none. */
function totalLine(
  t: Translator['t'],
  e: CompetitionEvent,
  totals: EventTotals | undefined,
  type: EventType | undefined,
): string {
  if (e.state === 'disqualified') return t('Disqualified: no total.')
  if (totals?.total !== undefined)
    return t('Event total: {total}', { total: scoreText(totals.total) })
  // without its type (not in the catalogue) the event cannot be scored here
  if (!type) return t('Event total: {total}', { total: '–' })
  const parts = e.results.method === 'rings' ? e.results.series : e.results.stages
  // no totals for results that exist: a value the scoring refuses, such as a stage time of 0
  if (!totals && parts.length) return t('Check the event: a value is out of its range.')
  return e.results.method === 'hit-factor'
    ? t('Event total: type the stage points of each stage from the official result.')
    : t('Event total: add a series.')
}

/** The series or stages of an event by its scoring method, with each part's score and the total. */
function ResultsEditor({
  e,
  type,
  sheets,
  onChange,
}: {
  e: CompetitionEvent
  type: EventType | undefined
  sheets: SheetRecord[]
  onChange: (r: Results) => void
}) {
  const { t } = useTranslation()
  const totals = eventTotals(e, type)
  return (
    <>
      <Title order={3} size="h4" mt="md">
        {e.results.method === 'rings' ? t('Series') : t('Stages')}
      </Title>
      {e.results.method === 'rings' ? (
        <SeriesEditor
          results={e.results}
          totals={totals?.parts as number[] | undefined}
          sheets={sheets}
          onChange={onChange}
        />
      ) : (
        <StagesEditor
          results={e.results}
          scores={totals?.parts as StageScore[] | undefined}
          majorOk={!type || majorAllowed(type, e.division)}
          onChange={onChange}
        />
      )}
      <Text fw={600} mt="sm" className="event-total">
        {totalLine(t, e, totals, type)}
      </Text>
    </>
  )
}

type Editing = { id: string; name: string; event: CompetitionEvent; isNew: boolean }

/** The event form: what, where and with what, then its series or stages and their totals. */
function EventForm({
  editing,
  setEditing,
  types,
  data,
  problem,
  onSave,
  onCancel,
}: {
  editing: Editing
  setEditing: (update: (e: Editing) => Editing) => void
  types: readonly EventType[]
  data: EventsData | undefined
  problem: Message | undefined
  onSave: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const disciplines = useDisciplines()
  const e = editing.event
  const type = typeOf(e, types)
  const patch = (p: Partial<CompetitionEvent>) =>
    setEditing((s) => ({ ...s, event: { ...s.event, ...p } }))
  const optional = <K extends keyof CompetitionEvent>(k: K, v: CompetitionEvent[K] | null) =>
    setEditing((s) => {
      const { [k]: _, ...rest } = s.event
      return {
        ...s,
        event: (v === null || v === '' ? rest : { ...rest, [k]: v }) as CompetitionEvent,
      }
    })
  const divisions = type ? divisionsOf(type) : []
  return (
    <section aria-labelledby="event-form" className="library-editor event-editor">
      <Title order={2} id="event-form" className="page-panel-title">
        {editing.isNew ? t('New event') : t('Edit event')}
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="sm" mt="sm">
        <TextInput
          label={t('Name')}
          description={t('Empty: the event type and the day.')}
          maxLength={200}
          value={editing.name}
          onChange={(ev) => {
            const name = ev.currentTarget.value
            setEditing((s) => ({ ...s, name }))
          }}
        />
        <TextInput
          type="date"
          label={t('Date')}
          required
          value={e.date}
          onChange={(ev) => patch({ date: ev.currentTarget.value })}
        />
        <Select
          label={t('Event type')}
          required
          allowDeselect={false}
          data={types.map((x) => ({ value: `catalogue:${x.id}`, label: x.name }))}
          value={e.eventType}
          onChange={(v) => {
            const next = types.find((x) => `catalogue:${x.id}` === v)
            if (next) setEditing((s) => ({ ...s, event: withEventType(s.event, next) }))
          }}
        />
        <Select
          label={t('Level')}
          required
          allowDeselect={false}
          data={type?.levels ?? [e.level]}
          value={e.level}
          onChange={(v) => v && patch({ level: v })}
        />
        {divisions.length > 0 && (
          <Select
            label={t('Division')}
            placeholder={t('None')}
            clearable
            data={divisions}
            value={e.division ?? null}
            onChange={(v) => optional('division', v)}
          />
        )}
        <TextInput
          label={t('Place')}
          maxLength={200}
          value={e.place ?? ''}
          onChange={(ev) => optional('place', ev.currentTarget.value)}
        />
        <Select
          label={t('Discipline')}
          placeholder={t('None')}
          searchable
          clearable
          data={disciplines.options}
          value={e.discipline ?? null}
          onChange={(v) => optional('discipline', v)}
          nothingFoundMessage={t('No discipline found')}
        />
        <Select
          label={t('Firearm')}
          placeholder={
            data?.firearms.length ? t('None') : t('No firearm saved in this browser yet')
          }
          clearable
          data={refOptions(data?.firearms)}
          value={e.firearm ?? null}
          onChange={(v) => optional('firearm', v)}
        />
        <Select
          label={t('Load')}
          placeholder={t('None')}
          searchable
          clearable
          data={refOptions(data?.loads)}
          value={e.load ?? null}
          onChange={(v) => optional('load', v)}
        />
        <NumberInput
          label={t('Rounds fired')}
          description={t('Empty: the shots of the series, where each lists them.')}
          min={0}
          max={100000}
          allowDecimal={false}
          allowNegative={false}
          value={e.rounds ?? ''}
          onChange={(v) => optional('rounds', typeof v === 'number' ? v : null)}
        />
        <Select
          label={t('Result')}
          allowDeselect={false}
          data={Object.entries(stateLabels).map(([value, label]) => ({ value, label: t(label) }))}
          value={e.state}
          onChange={(v) => v && patch({ state: v as CompetitionEvent['state'] })}
        />
        <Textarea
          className="wide"
          label={t('Notes')}
          autosize
          minRows={1}
          maxRows={4}
          maxLength={10000}
          value={e.notes ?? ''}
          onChange={(ev) => optional('notes', ev.currentTarget.value)}
        />
      </SimpleGrid>
      <ResultsEditor
        e={e}
        type={type}
        sheets={data?.sheets ?? []}
        onChange={(results) => patch({ results })}
      />
      {problem && <ErrorNote>{t('Not saved: {reason}', { reason: t(problem) })}</ErrorNote>}
      <Group gap="xs" mt="md">
        <Button onClick={onSave}>{t('Save event')}</Button>
        <Button variant="default" onClick={onCancel}>
          {t('Cancel')}
        </Button>
      </Group>
    </section>
  )
}

/** The printed event: its facts, each series or stage and the total, with the own-record line. */
function EventSheet({
  name,
  e,
  type,
  names,
}: {
  name: string
  e: CompetitionEvent
  type: EventType | undefined
  names: EventNames
}) {
  const { t } = useTranslation()
  const totals = eventTotals(e, type)
  const facts = [
    [t('Date'), dayText(e.date)],
    [t('Place'), e.place],
    [t('Event type'), names.type(e)],
    [t('Level'), e.level],
    [t('Division'), e.division],
    [t('Firearm'), names.firearm(e.firearm)],
    [t('Load'), names.load(e.load)],
    [t('Result'), t(stateLabels[e.state])],
  ].filter(([, v]) => v)
  return (
    <div className="print-only event-sheet">
      <p className="event-sheet-name">{name}</p>
      <p>{t(ownRecordLine)}</p>
      <dl>
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {e.results.method === 'rings' ? (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Series')}</Table.Th>
              <Table.Th>{t('Shots')}</Table.Th>
              <Table.Th className="num">{t('Total')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {e.results.series.map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: series by their order
              <Table.Tr key={i}>
                <Table.Td>{i + 1}</Table.Td>
                <Table.Td>{s.shots?.join(' ')}</Table.Td>
                <Table.Td className="num">
                  {scoreText(totals?.parts[i] as number | undefined)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Stage name')}</Table.Th>
              <Table.Th className="num">A/C/D/{t('Metal')}</Table.Th>
              <Table.Th className="num">{t('Penalties')}</Table.Th>
              <Table.Th className="num">{t('Time (s)')}</Table.Th>
              <Table.Th className="num">{t('Points')}</Table.Th>
              <Table.Th className="num">{t('Hit factor')}</Table.Th>
              <Table.Th className="num">{t('Stage points')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {e.results.stages.map((s, i) => {
              const score = totals?.parts[i] as StageScore | undefined
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: stages by their order
                <Table.Tr key={i}>
                  <Table.Td>{s.name}</Table.Td>
                  <Table.Td className="num">
                    {[s.hits.A, s.hits.C, s.hits.D, s.hits.metal ?? 0].join('/')}
                  </Table.Td>
                  <Table.Td className="num">
                    {[s.misses, s.noShoots, s.procedurals].join('/')}
                  </Table.Td>
                  <Table.Td className="num">{s.time}</Table.Td>
                  <Table.Td className="num">{score && scoreText(score.points)}</Table.Td>
                  <Table.Td className="num">{score && hitFactorText(score.hitFactor)}</Table.Td>
                  <Table.Td className="num">{s.stagePoints}</Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      )}
      <p>{totalLine(t, e, totals, type)}</p>
      {e.notes && <p>{e.notes}</p>}
    </div>
  )
}

/**
 * The one-confirm flow of the round count (#633) for a saved event: asks, and only a yes changes
 * the firearm. The line to show after it; empty when nothing was asked.
 */
async function offerRounds(id: string, e: CompetitionEvent, { t, tn }: Translator) {
  const firearmId = userIdOf(e.firearm)
  const rounds = eventRounds(e)
  if (!firearmId || !rounds) return ''
  const found = userRecord.safeParse(await storedRecord(firearmId))
  if (!found.success || found.data.kind !== 'firearm') return ''
  const name = found.data.name
  if (found.data.data.roundCount === undefined)
    return t('{name} has no round count; set one on the Firearms page to add the event to it.', {
      name,
    })
  const ref = `user:${id}`
  // the shooting log entries of the same match: their counted rounds are the event's (#919)
  const entries = (await storedRecords()).records
    .filter((r) => r.kind === 'shootingLogEntry' && r.data.event === ref)
    .map((r) => `user:${r.id}`)
  const due = eventRoundsDue(found.data.data, ref, rounds, entries)
  if (due < 1) return ''
  const ok = await confirmDialog({
    title: t('Add to the round count?'),
    message: tn(
      due,
      'Add {count} round of this event to the round count of {name}?',
      'Add {count} rounds of this event to the round count of {name}?',
      { name },
    ),
    confirmLabel: t('Add'),
  })
  if (!ok) return t('The round count of {name} is unchanged.', { name })
  const written = await updateRecord(firearmId, (raw) => {
    const stored = userRecord.safeParse(raw)
    return stored.success
      ? withEventRounds(stored.data, ref, rounds, due, new Date(), entries)
      : undefined
  })
  return written?.kind === 'firearm' && written.data.roundCount !== undefined
    ? t('Round count of {name}: {count}.', { name, count: written.data.roundCount })
    : t('The round count of {name} holds this event already.', { name })
}

/**
 * Stores the events of a user data file: the new ones, and after one question the ones that differ
 * from the browser's. The report line; a throw with the reason when the file is refused.
 */
async function importEvents(f: File, { t, tn }: Translator) {
  const parsed = parseUserDataFile(await f.text())
  if (!parsed.ok) throw new Error(reasonText(parsed.reason, t))
  const incoming = eventRecords(parsed.records)
  const stored = await storedRecords()
  const plan = planImport(incoming, stored.records, stored.invalid)
  await putRecords(plan.added)
  // only an event replaces an event: another kind with the id, or an invalid record, holds it
  const conflicts = plan.conflicts.filter((c) => c.stored.kind === 'event')
  const held = plan.blocked.length + plan.conflicts.length - conflicts.length
  const replace =
    conflicts.length > 0 &&
    (await confirmDialog({
      title: t('Replace events?'),
      message: tn(
        conflicts.length,
        '{count} event of the file differs from the one in this browser. Replace it?',
        '{count} events of the file differ from the ones in this browser. Replace them?',
      ),
      confirmLabel: t('Replace'),
    }))
  if (replace) await putRecords(conflicts.map((c) => c.incoming))
  const others = parsed.records.length - incoming.length
  return [
    t('{added} events added, {equal} already in this browser, {replaced} replaced.', {
      added: plan.added.length,
      equal: plan.equal.length,
      replaced: replace ? conflicts.length : 0,
    }),
    held > 0 &&
      tn(
        held,
        '{count} event not imported: a record of this browser has its id.',
        '{count} events not imported: records of this browser have their ids.',
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

/** The row's Delete; the row's link opens the event to edit. */
function RowActions({
  record,
  tabIndex,
  onDelete,
}: {
  record: EventRecord
  tabIndex?: number | undefined
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <ActionIcon
      className="row-action"
      tabIndex={tabIndex}
      size={controlSize.row.icon}
      variant="subtle"
      color="red"
      aria-label={t('Delete {name}', { name: record.name })}
      onClick={onDelete}
    >
      <Trash size={18} aria-hidden="true" />
    </ActionIcon>
  )
}

/** The table's columns: date, name, type, level, total and result. */
function eventColumns(
  types: readonly EventType[],
  names: EventNames,
  t: Translator['t'],
  actions: (r: EventRecord, tabIndex?: number) => ReactNode,
): DirectoryColumn<EventRecord>[] {
  const text = (key: string, label: Message, width: string, of: (r: EventRecord) => string) => ({
    key,
    label,
    width,
    value: (r: EventRecord) => of(r) || undefined,
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
    text('name', msg('Name'), '14rem', (r) => r.name),
    text('type', msg('Event type'), '10rem', (r) => names.type(r.data)),
    text('level', msg('Level'), '9rem', (r) => r.data.level),
    {
      key: 'total',
      label: msg('Total'),
      num: true,
      width: '6rem',
      value: (r) => eventTotals(r.data, typeOf(r.data, types))?.total,
      cell: (r) => totalText(r.data, typeOf(r.data, types)),
    },
    text('state', msg('Result'), '8rem', (r) => t(stateLabels[r.data.state])),
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

/** The list area: the read error, the loading state or the table of the events. */
function EventsBody({
  data,
  readError,
  onRetry,
  types,
  names,
  sort,
  onSort,
  onOpen,
  actions,
}: {
  data: EventsData | undefined
  readError: string
  onRetry: () => void
  types: readonly EventType[]
  names: EventNames
  sort: DirectorySort
  onSort: (sort: DirectorySort) => void
  onOpen: (r: EventRecord) => void
  actions: (r: EventRecord, tabIndex?: number) => ReactNode
}) {
  const { t, tn } = useTranslation()
  const all = data?.events ?? []
  return readError ? (
    <ErrorNote title={t('The records of this browser could not be read.')} onRetry={onRetry}>
      {readError}
    </ErrorNote>
  ) : !data ? (
    <Loading what="your data" />
  ) : (
    <DirectoryTable
      rows={all}
      columns={eventColumns(types, names, t, actions)}
      link="date"
      href={(r) => `/events?record=${encodeURIComponent(r.id)}`}
      onOpen={onOpen}
      facts={(r) =>
        [
          r.name,
          names.type(r.data),
          r.data.level,
          totalText(r.data, typeOf(r.data, types)),
          t(stateLabels[r.data.state]),
        ]
          .filter(Boolean)
          .join(' · ')
      }
      label={(r) => `${dayText(r.data.date)} ${r.name}`}
      caption={tn(
        all.length,
        '{count} competition event in this browser',
        '{count} competition events in this browser',
      )}
      noun="events"
      sort={sort}
      onSort={onSort}
      phoneAction={(r, tabIndex) => actions(r, tabIndex)}
      empty={
        <Text size="sm" c="dimmed">
          {t('No event yet. New event adds the first one.')}
        </Text>
      }
    />
  )
}

/** `?record=<id>` opens that event in the form once the events are read. */
function useEventLink(data: EventsData | undefined, open: (r: EventRecord) => void) {
  const done = useRef(false)
  useEffect(() => {
    if (!data || done.current) return
    done.current = true
    const id = new URLSearchParams(window.location.search).get('record')
    const r = id ? data.events.find((e) => e.id === id) : undefined
    if (r) open(r)
  }, [data, open])
}

/**
 * Competition events of this browser: the list with date, name, type, level and total; the event
 * form with its ring series or practical stages scored by the event type; print of the open event
 * (or the list), CSV and JSON export and JSON import. Saving offers the event's rounds to the
 * firearm's round count, one confirm, never on its own.
 */
export function CompetitionEvents({ types }: { types: EventType[] }) {
  const tr = useTranslation()
  const { t } = tr
  const { data, readError, refresh } = useEventsData()
  const [failure, setFailure] = useState('')
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState<Editing>()
  const [tried, setTried] = useState(false)
  const [list, setList] = useListState([])
  const file = useRef<HTMLInputElement>(null)
  const open = useCallback(
    (r: EventRecord) => setEditing({ id: r.id, name: r.name, event: r.data, isNew: false }),
    [],
  )
  useEventLink(data, open)
  const names = namesOf(data, types, t)
  const all = data?.events ?? []
  const type = editing && typeOf(editing.event, types)
  const problem = editing && eventProblem(editing.event, type)

  async function save() {
    if (!editing) return
    setTried(true)
    if (problem) return
    const event = cleanEvent(editing.event)
    const record = userRecord.parse({
      kind: 'event',
      id: editing.id,
      name: eventName(editing.name, event, type),
      saved: new Date().toISOString(),
      data: event,
    }) as EventRecord
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

  async function remove(r: EventRecord) {
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
    importEvents(f, tr).then(
      (line) => {
        setNote(line)
        refresh()
      },
      (e) => setFailure(t('Not imported: {reason}', { reason: errorText(e) })),
    )
  }

  const startNew = () => {
    const first = types[0]
    if (!first) return
    setTried(false)
    setEditing({ id: newId(), name: '', event: blankEvent(first), isNew: true })
  }
  // the CSV and JSON of the open event, else of every event
  const exported = editing ? all.filter((r) => r.id === editing.id) : all
  const exportText = (ext: 'csv' | 'json') => {
    const text = ext === 'csv' ? eventsCsv(exported, types, names) : eventsJson(exported)
    const type = ext === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
    download(new Blob([text], { type }), eventsFileName(ext))
  }
  const nothing = exported.length === 0 && t('No saved event to export.')
  const actions = (r: EventRecord, tabIndex?: number) => (
    <RowActions record={r} tabIndex={tabIndex} onDelete={() => remove(r)} />
  )

  return (
    <>
      <PageBar
        title={msg('Competition events')}
        translated
        status={
          data && (
            <BarCount widest={widestCount(tr, all.length, 'events')}>
              {countText(tr, all.length, all.length, 'events')}
            </BarCount>
          )
        }
        actions={
          <>
            <Button leftSection={<Plus aria-hidden="true" />} onClick={startNew}>
              {t('New event')}
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
            <PrintButton
              hint={editing ? t('Print the open event') : t('Print the list of events')}
            />
            <LinkButton href="/firearms/log">{t('Shooting log')}</LinkButton>
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
      <div className={`library competition-events${editing ? ' screen-only' : ''}`}>
        <Text size="sm" c="dimmed" className="log-own-record">
          {t(ownRecordLine)}
        </Text>
        {editing && (
          <EventForm
            key={editing.id}
            editing={editing}
            setEditing={(update) => setEditing((s) => (s ? update(s) : s))}
            types={types}
            data={data}
            problem={tried ? problem : undefined}
            onSave={() => void save()}
            onCancel={() => {
              setEditing(undefined)
              setTried(false)
            }}
          />
        )}
        <section aria-labelledby="event-list" className="directory">
          <Title order={2} id="event-list" className="visually-hidden">
            {t('Competition events')}
          </Title>
          {failure && <ErrorNote>{failure}</ErrorNote>}
          {note && (
            <Text size="sm" role="status" className="log-note">
              {note}
            </Text>
          )}
          <EventsBody
            data={data}
            readError={readError}
            onRetry={refresh}
            types={types}
            names={names}
            sort={list.sort}
            onSort={(sort) => setList({ sort })}
            onOpen={open}
            actions={actions}
          />
        </section>
      </div>
      {editing && (
        <EventSheet
          name={eventName(editing.name, editing.event, type)}
          e={editing.event}
          type={type}
          names={names}
        />
      )}
    </>
  )
}
