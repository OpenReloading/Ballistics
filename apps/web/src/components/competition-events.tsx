'use client'

import type { I18n, MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
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
import {
  type CompetitionEvent,
  type EventType,
  type UserRecord,
  userRecord,
} from '@rangefoundry/schema'
import type { EventTotals, StageScore } from '@rangefoundry/shot-groups'
import { Plus, Trash } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteRecord,
  putRecords,
  storedRecord,
  storedRecords,
  updateRecord,
} from '@/platform/user-store.ts'
import { useTranslation } from '../i18n/language.ts'
import { ungrouped } from '../i18n/lingui.ts'
import { plainNumber } from '../i18n/number.ts'
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
  'Your own record, not an official result. The organizer publishes the official one.',
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
  i18n: I18n,
): EventNames {
  const own = new Map(
    [...(data?.firearms ?? []), ...(data?.loads ?? [])].map((r) => [r.id, r.name]),
  )
  const named = (ref: string | undefined) =>
    ref === undefined
      ? ''
      : (own.get(userIdOf(ref) ?? '') ??
        i18n._({ id: 'events.notInBrowser', message: 'Not in this browser' }))
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
  const { i18n } = useLingui()
  const [text, setText] = useState(shots?.join(' ') ?? '')
  // the text of another series (a series above was removed): show this one's shots
  const typed = parseShots(text)
  if (typed && (typed.length ? typed.join(' ') : undefined) !== shots?.join(' '))
    setText(shots?.join(' ') ?? '')
  return (
    <TextInput
      label={label}
      description={i18n._({
        id: 'events.shotsHint',
        message: 'Ring values separated by spaces, such as 10 9 10.',
      })}
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
  const { i18n } = useLingui()
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
          // oxlint-disable-next-line react/no-array-index-key -- series have no id; their order is their name
          <fieldset key={i} className="event-part">
            <legend>
              {i18n._({ id: 'events.seriesNumber', message: 'Series {n}', values: { n } })}
            </legend>
            <Group gap="xs" align="end" wrap="wrap">
              <ShotsInput
                label={i18n._({ id: 'events.shots', message: 'Shots' })}
                shots={s.shots}
                onChange={(shots) => {
                  const { shots: _, total, ...rest } = s
                  set(i, { ...rest, ...(shots ? { shots } : { total: total ?? 0 }) })
                }}
              />
              {!s.shots?.length && (
                <NumberInput
                  label={i18n._({ id: 'events.seriesTotal', message: 'Series total' })}
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
                label={i18n._({ id: 'events.targetSheet', message: 'Target sheet' })}
                size={controlSize.row.input}
                placeholder={
                  sheets.length
                    ? i18n._({ id: 'events.none', message: 'None' })
                    : i18n._({ id: 'events.noTargetSheet', message: 'No target sheet saved yet' })
                }
                clearable
                data={refOptions(sheets)}
                value={s.targetSheet ?? null}
                onChange={(v) => {
                  const { targetSheet: _, ...rest } = s
                  set(i, v ? { ...rest, targetSheet: v } : rest)
                }}
              />
              <Text size="sm" className="event-part-total">
                {i18n._({
                  id: 'events.partTotal',
                  message: 'Total {total}',
                  values: { total: scoreText(totals?.[i]) || '–' },
                })}
              </Text>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={i18n._({
                  id: 'events.removeSeries',
                  message: 'Remove series {n}',
                  values: { n },
                })}
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
        {i18n._({ id: 'events.addSeries', message: 'Add series' })}
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
  const { i18n } = useLingui()
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
          // oxlint-disable-next-line react/no-array-index-key -- stages are edited in place by their order
          <fieldset key={i} className="event-part">
            <legend>{s.name}</legend>
            <SimpleGrid cols={{ base: 2, xs: 4, md: 6 }} spacing="xs" verticalSpacing="xs">
              <TextInput
                label={i18n._({ id: 'events.stageName', message: 'Stage name' })}
                size={controlSize.row.input}
                maxLength={200}
                value={s.name}
                onChange={(e) => patch({ name: e.currentTarget.value })}
              />
              <CountInput label="A" value={s.hits.A} onChange={hits('A')} />
              <CountInput label="C" value={s.hits.C} onChange={hits('C')} />
              <CountInput label="D" value={s.hits.D} onChange={hits('D')} />
              <CountInput
                label={i18n._({ id: 'events.metal', message: 'Metal' })}
                value={s.hits.metal}
                onChange={hits('metal')}
              />
              <CountInput
                label={i18n._({ id: 'events.misses', message: 'Misses' })}
                value={s.misses}
                onChange={(misses) => patch({ misses })}
              />
              <CountInput
                label={i18n._({ id: 'events.noShoots', message: 'No-shoots' })}
                value={s.noShoots}
                onChange={(noShoots) => patch({ noShoots })}
              />
              <CountInput
                label={i18n._({ id: 'events.procedurals', message: 'Procedurals' })}
                value={s.procedurals}
                onChange={(procedurals) => patch({ procedurals })}
              />
              <NumberInput
                label={i18n._({ id: 'events.time', message: 'Time (s)' })}
                size={controlSize.row.input}
                min={0.01}
                max={3600}
                decimalScale={2}
                allowNegative={false}
                value={s.time}
                onChange={(v) => patch({ time: typeof v === 'number' ? v : Number(v) || 0 })}
              />
              <Select
                label={i18n._({ id: 'events.powerFactor', message: 'Power factor' })}
                size={controlSize.row.input}
                allowDeselect={false}
                data={[
                  { value: 'minor', label: i18n._({ id: 'events.minor', message: 'Minor' }) },
                  {
                    value: 'major',
                    label: i18n._({ id: 'events.major', message: 'Major' }),
                    disabled: !majorOk,
                  },
                ]}
                value={s.powerFactor}
                onChange={(v) => v && patch({ powerFactor: v as Stage['powerFactor'] })}
              />
              <NumberInput
                label={i18n._({ id: 'events.stagePoints', message: 'Stage points' })}
                description={i18n._({
                  id: 'events.stagePointsHint',
                  message: 'From the official result, where published.',
                })}
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
                  ? i18n._({
                      id: 'events.stageScore',
                      message: '{points} points, hit factor {hf}',
                      values: {
                        points: scoreText(score.points),
                        hf: hitFactorText(score.hitFactor),
                      },
                    })
                  : '–'}
              </Text>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={i18n._({
                  id: 'events.removeStage',
                  message: 'Remove {name}',
                  values: { name: s.name },
                })}
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
              blankStage(
                i18n._({
                  id: 'events.stageNumber',
                  message: 'Stage {n}',
                  values: { n: results.stages.length + 1 },
                }),
              ),
            ],
          })
        }
      >
        {i18n._({ id: 'events.addStage', message: 'Add stage' })}
      </Button>
    </div>
  )
}

/** The line of an event's total, or why it has none. */
function totalLine(
  i18n: I18n,
  e: CompetitionEvent,
  totals: EventTotals | undefined,
  type: EventType | undefined,
): string {
  if (e.state === 'disqualified')
    return i18n._({ id: 'events.disqualifiedNoTotal', message: 'Disqualified: no total.' })
  if (totals?.total !== undefined)
    return i18n._({
      id: 'events.total',
      message: 'Event total: {total}',
      values: { total: scoreText(totals.total) },
    })
  // without its type (not in the catalogue) the event cannot be scored here
  if (!type)
    return i18n._({ id: 'events.total', message: 'Event total: {total}', values: { total: '–' } })
  const parts = e.results.method === 'rings' ? e.results.series : e.results.stages
  // no totals for results that exist: a value the scoring refuses, such as a stage time of 0
  if (!totals && parts.length)
    return i18n._({
      id: 'events.outOfRange',
      message: 'Check the event: a value is out of its range.',
    })
  return e.results.method === 'hit-factor'
    ? i18n._({
        id: 'events.totalFromResult',
        message: 'Event total: enter the stage points from the official result.',
      })
    : i18n._({ id: 'events.totalAddSeries', message: 'Event total: add a series.' })
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
  const { i18n } = useLingui()
  const totals = eventTotals(e, type)
  return (
    <>
      <Title order={3} size="h4" mt="md">
        {e.results.method === 'rings'
          ? i18n._({ id: 'events.seriesHeading', message: 'Series' })
          : i18n._({ id: 'events.stages', message: 'Stages' })}
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
        {totalLine(i18n, e, totals, type)}
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
  const { i18n } = useLingui()
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
        {editing.isNew
          ? i18n._({ id: 'events.new', message: 'New event' })
          : i18n._({ id: 'events.edit', message: 'Edit event' })}
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="sm" mt="sm">
        <TextInput
          label={i18n._({ id: 'events.name', message: 'Name' })}
          description={i18n._({
            id: 'events.nameHint',
            message: 'Empty: the event type and the day.',
          })}
          maxLength={200}
          value={editing.name}
          onChange={(ev) => {
            const name = ev.currentTarget.value
            setEditing((s) => ({ ...s, name }))
          }}
        />
        <TextInput
          type="date"
          label={i18n._({ id: 'events.date', message: 'Date' })}
          required
          value={e.date}
          onChange={(ev) => patch({ date: ev.currentTarget.value })}
        />
        <Select
          label={i18n._({ id: 'events.eventType', message: 'Event type' })}
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
          label={i18n._({ id: 'events.level', message: 'Level' })}
          required
          allowDeselect={false}
          data={type?.levels ?? [e.level]}
          value={e.level}
          onChange={(v) => v && patch({ level: v })}
        />
        {divisions.length > 0 && (
          <Select
            label={i18n._({ id: 'events.division', message: 'Division' })}
            placeholder={i18n._({ id: 'events.none', message: 'None' })}
            clearable
            data={divisions}
            value={e.division ?? null}
            onChange={(v) => optional('division', v)}
          />
        )}
        <TextInput
          label={i18n._({ id: 'events.place', message: 'Place' })}
          maxLength={200}
          value={e.place ?? ''}
          onChange={(ev) => optional('place', ev.currentTarget.value)}
        />
        <Select
          label={i18n._({ id: 'events.discipline', message: 'Discipline' })}
          placeholder={i18n._({ id: 'events.none', message: 'None' })}
          searchable
          clearable
          data={disciplines.options}
          value={e.discipline ?? null}
          onChange={(v) => optional('discipline', v)}
          nothingFoundMessage={i18n._({
            id: 'events.noDisciplineFound',
            message: 'No discipline found',
          })}
        />
        <Select
          label={i18n._({ id: 'events.firearm', message: 'Firearm' })}
          placeholder={
            data?.firearms.length
              ? i18n._({ id: 'events.none', message: 'None' })
              : i18n._({ id: 'events.noFirearm', message: 'No firearm saved in this browser yet' })
          }
          clearable
          data={refOptions(data?.firearms)}
          value={e.firearm ?? null}
          onChange={(v) => optional('firearm', v)}
        />
        <Select
          label={i18n._({ id: 'events.load', message: 'Load' })}
          placeholder={i18n._({ id: 'events.none', message: 'None' })}
          searchable
          clearable
          data={refOptions(data?.loads)}
          value={e.load ?? null}
          onChange={(v) => optional('load', v)}
        />
        <NumberInput
          label={i18n._({ id: 'events.roundsFired', message: 'Rounds fired' })}
          description={i18n._({
            id: 'events.roundsFiredHint',
            message: 'Empty: the shots of the series, where each lists them.',
          })}
          min={0}
          max={100000}
          allowDecimal={false}
          allowNegative={false}
          value={e.rounds ?? ''}
          onChange={(v) => optional('rounds', typeof v === 'number' ? v : null)}
        />
        <Select
          label={i18n._({ id: 'events.result', message: 'Result' })}
          allowDeselect={false}
          data={Object.entries(stateLabels).map(([value, label]) => ({ value, label: t(label) }))}
          value={e.state}
          onChange={(v) => v && patch({ state: v as CompetitionEvent['state'] })}
        />
        <Textarea
          className="wide"
          label={i18n._({ id: 'events.notes', message: 'Notes' })}
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
      {problem && (
        <ErrorNote>
          {i18n._({
            id: 'events.notSaved',
            message: 'Not saved: {reason}',
            values: { reason: t(problem) },
          })}
        </ErrorNote>
      )}
      <Group gap="xs" mt="md">
        <Button onClick={onSave}>
          {i18n._({ id: 'events.saveEvent', message: 'Save event' })}
        </Button>
        <Button variant="default" onClick={onCancel}>
          {i18n._({ id: 'events.cancel', message: 'Cancel' })}
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
  const { i18n } = useLingui()
  const totals = eventTotals(e, type)
  const facts = [
    [i18n._({ id: 'events.date', message: 'Date' }), dayText(e.date)],
    [i18n._({ id: 'events.place', message: 'Place' }), e.place],
    [i18n._({ id: 'events.eventType', message: 'Event type' }), names.type(e)],
    [i18n._({ id: 'events.level', message: 'Level' }), e.level],
    [i18n._({ id: 'events.division', message: 'Division' }), e.division],
    [i18n._({ id: 'events.firearm', message: 'Firearm' }), names.firearm(e.firearm)],
    [i18n._({ id: 'events.load', message: 'Load' }), names.load(e.load)],
    [i18n._({ id: 'events.result', message: 'Result' }), t(stateLabels[e.state])],
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
              <Table.Th>{i18n._({ id: 'events.seriesHeading', message: 'Series' })}</Table.Th>
              <Table.Th>{i18n._({ id: 'events.shots', message: 'Shots' })}</Table.Th>
              <Table.Th className="num">
                {i18n._({ id: 'events.totalHeading', message: 'Total' })}
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {e.results.series.map((s, i) => (
              // oxlint-disable-next-line react/no-array-index-key -- series by their order
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
              <Table.Th>{i18n._({ id: 'events.stageName', message: 'Stage name' })}</Table.Th>
              <Table.Th className="num">
                A/C/D/{i18n._({ id: 'events.metal', message: 'Metal' })}
              </Table.Th>
              <Table.Th className="num">
                {i18n._({ id: 'events.penalties', message: 'Penalties' })}
              </Table.Th>
              <Table.Th className="num">
                {i18n._({ id: 'events.time', message: 'Time (s)' })}
              </Table.Th>
              <Table.Th className="num">
                {i18n._({ id: 'events.points', message: 'Points' })}
              </Table.Th>
              <Table.Th className="num">
                {i18n._({ id: 'events.hitFactor', message: 'Hit factor' })}
              </Table.Th>
              <Table.Th className="num">
                {i18n._({ id: 'events.stagePoints', message: 'Stage points' })}
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {e.results.stages.map((s, i) => {
              const score = totals?.parts[i] as StageScore | undefined
              return (
                // oxlint-disable-next-line react/no-array-index-key -- stages by their order
                <Table.Tr key={i}>
                  <Table.Td>{s.name}</Table.Td>
                  <Table.Td className="num">
                    {[s.hits.A, s.hits.C, s.hits.D, s.hits.metal ?? 0].join('/')}
                  </Table.Td>
                  <Table.Td className="num">
                    {[s.misses, s.noShoots, s.procedurals].join('/')}
                  </Table.Td>
                  <Table.Td className="num">{plainNumber(s.time)}</Table.Td>
                  <Table.Td className="num">{score && scoreText(score.points)}</Table.Td>
                  <Table.Td className="num">{score && hitFactorText(score.hitFactor)}</Table.Td>
                  <Table.Td className="num">
                    {s.stagePoints !== undefined && plainNumber(s.stagePoints)}
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      )}
      <p>{totalLine(i18n, e, totals, type)}</p>
      {e.notes && <p>{e.notes}</p>}
    </div>
  )
}

/** One confirm (#633), and only a yes changes the firearm; the line to show after it, empty when nothing was asked. */
async function offerRounds(id: string, e: CompetitionEvent, i18n: I18n) {
  const firearmId = userIdOf(e.firearm)
  const rounds = eventRounds(e)
  if (!firearmId || !rounds) return ''
  const found = userRecord.safeParse(await storedRecord(firearmId))
  if (!found.success || found.data.kind !== 'firearm') return ''
  const name = found.data.name
  if (found.data.data.roundCount === undefined)
    return i18n._({
      id: 'events.noRoundCount',
      message: '{name} has no round count; set one on the Firearms page to add the event to it.',
      values: {
        name,
      },
    })
  const ref = `user:${id}`
  // the shooting log entries of the same match: their counted rounds are the event's (#919)
  const entries = (await storedRecords()).records
    .filter((r) => r.kind === 'shootingLogEntry' && r.data.event === ref)
    .map((r) => `user:${r.id}`)
  const due = eventRoundsDue(found.data.data, ref, rounds, entries)
  if (due < 1) return ''
  const ok = await confirmDialog({
    title: i18n._({ id: 'events.addRoundsTitle', message: 'Add to the round count?' }),
    message: i18n._(
      'events.addRounds',
      { count: due, name },
      {
        message:
          '{count, plural, one {Add # round of this event to the round count of {name}?} other {Add # rounds of this event to the round count of {name}?}}',
        formats: ungrouped,
      },
    ),
    confirmLabel: i18n._({ id: 'events.add', message: 'Add' }),
  })
  if (!ok)
    return i18n._({
      id: 'events.roundCountUnchanged',
      message: 'The round count of {name} is unchanged.',
      values: { name },
    })
  const written = await updateRecord(firearmId, (raw) => {
    const stored = userRecord.safeParse(raw)
    return stored.success
      ? withEventRounds(stored.data, ref, rounds, due, new Date(), entries)
      : undefined
  })
  return written?.kind === 'firearm' && written.data.roundCount !== undefined
    ? i18n._({
        id: 'events.roundCountOf',
        message: 'Round count of {name}: {count}.',
        values: { name, count: written.data.roundCount },
      })
    : i18n._({
        id: 'events.roundCountHeld',
        message: 'The round count of {name} holds this event already.',
        values: { name },
      })
}

/** The new events, and after one question those that differ from the browser's; the report line, a throw with the reason when the file is refused. */
async function importEvents(f: File, tr: Translator, i18n: I18n) {
  const parsed = parseUserDataFile(await f.text())
  if (!parsed.ok) throw new Error(reasonText(parsed.reason, tr))
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
      title: i18n._({ id: 'events.replaceEvents', message: 'Replace events?' }),
      message: i18n._(
        'events.replaceCount',
        { count: conflicts.length },
        {
          message:
            '{count, plural, one {# event of the file differs from the one in this browser. Replace it?} other {# events of the file differ from the ones in this browser. Replace them?}}',
          formats: ungrouped,
        },
      ),
      confirmLabel: i18n._({ id: 'events.replace', message: 'Replace' }),
    }))
  if (replace) await putRecords(conflicts.map((c) => c.incoming))
  const others = parsed.records.length - incoming.length
  return [
    i18n._({
      id: 'events.imported',
      message: '{added} events added, {equal} already in this browser, {replaced} replaced.',
      values: {
        added: plan.added.length,
        equal: plan.equal.length,
        replaced: replace ? conflicts.length : 0,
      },
    }),
    held > 0 &&
      i18n._(
        'events.heldCount',
        { count: held },
        {
          message:
            '{count, plural, one {# event not imported: a record of this browser has its id.} other {# events not imported: records of this browser have their ids.}}',
          formats: ungrouped,
        },
      ),
    others > 0 &&
      i18n._(
        'events.otherKinds',
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
  const { i18n } = useLingui()
  return (
    <ActionIcon
      className="row-action"
      tabIndex={tabIndex}
      size={controlSize.row.icon}
      variant="subtle"
      color="red"
      aria-label={i18n._({
        id: 'events.delete',
        message: 'Delete {name}',
        values: { name: record.name },
      })}
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
  const text = (
    key: string,
    label: MessageDescriptor,
    width: string,
    of: (r: EventRecord) => string,
  ) => ({
    key,
    label,
    width,
    value: (r: EventRecord) => of(r) || undefined,
    cell: of,
  })
  return [
    {
      key: 'date',
      label: /*i18n*/ { id: 'events.column.date', message: 'Date' },
      width: '9.5rem',
      value: (r) => r.data.date,
      cell: (r) => dayText(r.data.date),
    },
    text('name', /*i18n*/ { id: 'events.column.name', message: 'Name' }, '14rem', (r) => r.name),
    text('type', /*i18n*/ { id: 'events.column.type', message: 'Event type' }, '10rem', (r) =>
      names.type(r.data),
    ),
    text(
      'level',
      /*i18n*/ { id: 'events.column.level', message: 'Level' },
      '9rem',
      (r) => r.data.level,
    ),
    {
      key: 'total',
      label: /*i18n*/ { id: 'events.column.total', message: 'Total' },
      num: true,
      width: '6rem',
      value: (r) => eventTotals(r.data, typeOf(r.data, types))?.total,
      cell: (r) => totalText(r.data, typeOf(r.data, types)),
    },
    text('state', /*i18n*/ { id: 'events.column.state', message: 'Result' }, '8rem', (r) =>
      t(stateLabels[r.data.state]),
    ),
    {
      key: 'actions',
      label: /*i18n*/ { id: 'events.column.actions', message: 'Actions' },
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
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const all = data?.events ?? []
  return readError ? (
    <ErrorNote
      title={i18n._({
        id: 'events.readFailed',
        message: 'The records of this browser could not be read.',
      })}
      onRetry={onRetry}
    >
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
      caption={i18n._(
        'events.count',
        { count: all.length },
        {
          message:
            '{count, plural, one {# competition event in this browser} other {# competition events in this browser}}',
          formats: ungrouped,
        },
      )}
      noun="events"
      sort={sort}
      onSort={onSort}
      phoneAction={(r, tabIndex) => actions(r, tabIndex)}
      empty={
        <Text size="sm" c="dimmed">
          {i18n._({ id: 'events.noEventYet', message: 'No event yet.' })}
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

/** Saving offers the event's rounds to the firearm's round count, one confirm, never on its own. */
export function CompetitionEvents({ types }: { types: EventType[] }) {
  const tr = useTranslation()
  const { i18n } = useLingui()
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
  const names = namesOf(data, types, i18n)
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
      setFailure(
        i18n._({
          id: 'events.notSaved',
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

  async function remove(r: EventRecord) {
    setFailure('')
    try {
      await deleteRecord(r.id)
    } catch (e) {
      setFailure(
        i18n._({
          id: 'events.deleteOfFailed',
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
        id: 'events.deletedFromThisBrowser',
        message: 'Deleted {name} from this browser.',
        values: { name: r.name },
      }),
      () =>
        putRecords([r]).then(refresh, (e) =>
          setFailure(
            i18n._({
              id: 'events.undoOfFailed',
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
    importEvents(f, tr, i18n).then(
      (line) => {
        setNote(line)
        refresh()
      },
      (e) =>
        setFailure(
          i18n._({
            id: 'events.notImported',
            message: 'Not imported: {reason}',
            values: { reason: errorText(e) },
          }),
        ),
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
  const nothing =
    exported.length === 0 &&
    i18n._({ id: 'events.nothingToExport', message: 'No saved event to export.' })
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
            <BarCount widest={widestCount(i18n, all.length, 'events')}>
              {countText(i18n, all.length, all.length, 'events')}
            </BarCount>
          )
        }
        actions={
          <>
            <Button leftSection={<Plus aria-hidden="true" />} onClick={startNew}>
              {i18n._({ id: 'events.new', message: 'New event' })}
            </Button>
            <Button variant="default" onClick={() => file.current?.click()}>
              {i18n._({ id: 'events.importJson', message: 'Import JSON' })}
            </Button>
            <BarButton nothing={nothing} onClick={() => exportText('csv')}>
              {i18n._({ id: 'events.exportCsv', message: 'Export CSV' })}
            </BarButton>
            <BarButton nothing={nothing} onClick={() => exportText('json')}>
              {i18n._({ id: 'events.exportJson', message: 'Export JSON' })}
            </BarButton>
            <PrintButton
              hint={
                editing
                  ? i18n._({ id: 'events.printOpen', message: 'Print the open event' })
                  : i18n._({ id: 'events.printList', message: 'Print the list of events' })
              }
            />
            <LinkButton href="/firearms/log">
              {i18n._({ id: 'events.shootingLog', message: 'Shooting log' })}
            </LinkButton>
          </>
        }
      />
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        className="visually-hidden"
        tabIndex={-1}
        aria-label={i18n._({ id: 'events.importJson', message: 'Import JSON' })}
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
            {i18n._({ id: 'events.title', message: 'Competition events' })}
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
