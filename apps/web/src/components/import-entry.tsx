'use client'

import {
  Badge,
  Button,
  Checkbox,
  Code,
  Group,
  NativeSelect,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import {
  fieldSpecs,
  type TableColumnMap,
  type TableKind,
  tableKinds,
  tierFloors,
} from '@open-reloading/importers'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { fixedNumber } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { localDay } from '../lib/dates.ts'
import { errorText } from '../lib/error-text.ts'
import { pickFiles, tableFormats } from '../lib/file-access.ts'
import {
  type BuildView,
  type CardView,
  firstBuild,
  type ImportReply,
  type ImportRequest,
  importCount,
  readMappings,
  type SavedMappings,
  saveMapping,
} from '../lib/import-entry.ts'
import { loadFileFormats, loadFormatOf, readNote } from '../lib/load-file-formats.ts'
import { maxFileBytes } from '../lib/user-data.ts'
import { AppModal } from './app-modal.tsx'
import { focusBack } from './focus-back.ts'

/** One picked file on the page. */
export interface Entry {
  id: number
  name: string
  card?: CardView | undefined
  kind?: TableKind | undefined
  map?: TableColumnMap[] | undefined
  /** The saved mapping the card was built with. */
  mapping?: string | undefined
  build?: BuildView | undefined
  /** Source of this file; empty takes the shared one. */
  source: string
  /** The user changed the kind or a column, or opened the fold. */
  touched: boolean
  busy: boolean
  failure?: string | undefined
}

const kindLabels: Record<TableKind, Message> = {
  bullet: msg('bullets'),
  powder: msg('powders'),
  cartridge: msg('cartridges'),
}
const tierLabels = {
  high: msg('tier\u0004high'),
  medium: msg('tier\u0004medium'),
  low: msg('tier\u0004low'),
} as const

/** The verdict line of a card: what the file is read as and how sure. */
function verdict(e: Entry, t: Translator['t']): { text: string; color: string } {
  const c = e.card
  if (!c) return { text: t('Reading…'), color: 'gray' }
  if ('refusal' in c) return { text: t('Refused'), color: 'red' }
  if ('records' in c)
    return { text: t('Load file, read by {format}', { format: c.format }), color: 'teal' }
  if (!e.kind) return { text: t('Refused: no kind'), color: 'red' }
  const kind = t(kindLabels[e.kind])
  const tier = !e.touched && !e.mapping && e.kind === c.kind ? c.tier : undefined
  return tier
    ? { text: t('Table of {kind} ({tier})', { kind, tier: t(tierLabels[tier]) }), color: 'blue' }
    : { text: t('Table of {kind} (chosen)', { kind }), color: 'blue' }
}

/** Whether a card shows only its verdict, counts, Remove and the toggle: a high-tier suggestion nobody changed. */
export const folded = (e: Entry) =>
  !e.touched &&
  !e.mapping &&
  e.card !== undefined &&
  'header' in e.card &&
  e.card.tier === 'high' &&
  e.kind === e.card.kind

/** The refusal of a table no kind reaches, with the scores and the floor. */
function noKindText(c: Extract<CardView, { header: string[] }>, t: Translator['t']) {
  const scores = c.scores
    .map((s) => `${t(kindLabels[s.kind])} ${fixedNumber(s.score, 2)}`)
    .join(', ')
  return t(
    'No column matches a bullet, powder or cartridge field ({scores}; the floor is {floor}). Pick the kind by hand, or export a table with headers such as Name, Diameter, Weight.',
    { scores, floor: fixedNumber(tierFloors.low, 2) },
  )
}

const label = (text: string, t: Translator['t']) => translateMessage(text, t)

/** The Import entry's status line: how many files are read and the reason of each refused one. */
export function readStatus(files: Entry[], t: Translator['t']) {
  if (!files.length) return ''
  const read = files.filter((e) => e.card || e.failure)
  const refused = read.flatMap((e) => {
    const c = e.card
    const reason = e.failure
      ? label(e.failure, t)
      : c && 'refusal' in c
        ? label(c.refusal, t)
        : c && 'header' in c && !e.kind
          ? verdict(e, t).text
          : undefined
    return reason ? [t('{name}: {reason}', { name: e.name, reason })] : []
  })
  return [
    t('{read} of {count} files read.', { read: read.length, count: files.length }),
    ...refused,
  ].join(' ')
}

export interface CardActions {
  remove: (id: number) => void
  setKind: (id: number, kind: TableKind) => void
  setColumn: (id: number, column: number, change: Partial<TableColumnMap>) => void
  open: (id: number) => void
  setSource: (id: number, source: string) => void
  saveMapping: (id: number, name: string) => void
}

function ColumnRow({
  e,
  i,
  m,
  actions,
}: {
  e: Entry & { card: Extract<CardView, { header: string[] }>; kind: TableKind }
  i: number
  m: TableColumnMap
  actions: CardActions
}) {
  const { t } = useTranslation()
  const header = e.card.header[i] ?? ''
  const spec = fieldSpecs[e.kind].find((f) => f.key === m.field)
  return (
    <Group gap="xs" align="flex-end" wrap="wrap" className="import-column">
      <div className="import-column-head">
        <Text fw={600} size="sm">
          {header}
        </Text>
        <Text size="xs" c="dimmed">
          {(e.card.samples[i] ?? []).join(' · ')}
        </Text>
      </div>
      <NativeSelect
        size="xs"
        aria-label={t('Field of column {header}', { header })}
        data={[
          { value: '', label: t('Not imported') },
          ...fieldSpecs[e.kind].map((f) => ({ value: f.key, label: label(f.label, t) })),
        ]}
        value={m.field ?? ''}
        onChange={(ev) =>
          actions.setColumn(e.id, i, {
            field: ev.currentTarget.value || undefined,
            unit: undefined,
            unitFrom: undefined,
          })
        }
      />
      {spec?.units && (
        <>
          <NativeSelect
            size="xs"
            aria-label={t('Unit of column {header}', { header })}
            data={spec.units.map((u) => u.symbol)}
            value={m.unit ?? spec.units[0]?.symbol ?? ''}
            onChange={(ev) =>
              actions.setColumn(e.id, i, { unit: ev.currentTarget.value, unitFrom: undefined })
            }
          />
          <NativeSelect
            size="xs"
            aria-label={t('Decimal mark of column {header}', { header })}
            data={[
              { value: '.', label: '1.5' },
              { value: ',', label: '1,5' },
            ]}
            value={m.decimal}
            onChange={(ev) =>
              actions.setColumn(e.id, i, {
                decimal: ev.currentTarget.value === ',' ? ',' : '.',
                ambiguousDecimal: false,
              })
            }
          />
          {m.unitFrom === 'values' && (
            <Text size="xs" c="dimmed">
              {t('unit guessed from values')}
            </Text>
          )}
          {m.ambiguousDecimal && (
            <Text size="xs" c="dimmed">
              {t('decimal mark guessed')}
            </Text>
          )}
        </>
      )}
    </Group>
  )
}

function Report({ b }: { b: BuildView }) {
  const { t, tn } = useTranslation()
  const more = b.counts.rejected - b.rejected.length
  return (
    <Stack gap={4}>
      <Text size="sm" data-testid="import-counts">
        {t(
          '{accepted} accepted, {warned} with a warning, {rejected} rejected. New {added}, already here {equal}, changed {changed}, repeated in file {repeated}.',
          { ...b.counts, added: b.added, equal: b.equal, changed: b.changed, repeated: b.repeated },
        )}
      </Text>
      {b.blocked > 0 && (
        <Text size="sm" data-testid="import-blocked">
          {tn(
            b.blocked,
            '{count} record is left out because an invalid browser record has its id. Download it raw and delete it under Open, Invalid records, then import again.',
            '{count} records are left out because invalid browser records have their ids. Download them raw and delete them under Open, Invalid records, then import again.',
          )}
        </Text>
      )}
      {b.rejected.length > 0 && (
        <ul className="import-rejected">
          {b.rejected.map((r) => (
            <li key={`${r.row}-${r.column}`}>
              {t('Row {row}, {column}: {reason}', {
                row: r.row,
                column: r.column,
                reason: label(r.reason, t),
              })}
            </li>
          ))}
          {more > 0 && <li>{t('and {count} more rejected rows', { count: more })}</li>}
        </ul>
      )}
      {b.firstWarning && (
        <Text size="xs" c="dimmed">
          {t('First warning, row {row}: {reason}', {
            row: b.firstWarning.row,
            reason: label(b.firstWarning.reason, t),
          })}
        </Text>
      )}
    </Stack>
  )
}

/** What a load file holds, as "1 load, 1 cartridge"; a kind without its own words counts as records. */
function heldText(kinds: Extract<CardView, { records: number }>['kinds'], tn: Translator['tn']) {
  const words: Record<string, (n: number) => string> = {
    load: (n) => tn(n, '{count} load', '{count} loads'),
    cartridge: (n) => tn(n, '{count} cartridge', '{count} cartridges'),
    bullet: (n) => tn(n, '{count} bullet', '{count} bullets'),
    powder: (n) => tn(n, '{count} powder', '{count} powders'),
    session: (n) => tn(n, '{count} session', '{count} sessions'),
  }
  const order = Object.keys(words)
  return Object.entries(kinds)
    .sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
    .map(([k, n = 0]) => (words[k] ?? ((n) => tn(n, '{count} record', '{count} records')))(n))
    .join(', ')
}

/** A refused file's reason, with the load-file format that refused it, or a load file's records and what was not read. */
function ReadNote({ c }: { c: Exclude<CardView, { header: string[] }> }) {
  const { t, tn } = useTranslation()
  if ('refusal' in c)
    return (
      <>
        <Text size="sm" c="red" className="import-refusal">
          {c.format === undefined
            ? label(c.refusal, t)
            : t('{format}: {reason}', { format: c.format, reason: label(c.refusal, t) })}
        </Text>
        {c.detail && (
          <Text size="xs">
            <Code>{c.detail}</Code>
          </Text>
        )}
      </>
    )
  const { warnings, unmapped } = c
  const note = readNote({ ok: true, records: [], warnings, unmapped }, t)
  return <Text size="sm">{[heldText(c.kinds, tn), note].filter(Boolean).join('. ')}</Text>
}

/** One file card: the verdict, Remove, the kind and the mapping (folded on a high-tier card), the counts. */
export function FileCard({
  e,
  shared,
  actions,
}: {
  e: Entry
  shared: string
  actions: CardActions
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const v = verdict(e, t)
  const c = e.card
  const table = c && 'header' in c ? c : undefined
  const fold = folded(e)
  return (
    <Paper withBorder p="sm" component="section" aria-label={e.name}>
      <Stack gap="xs">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs" wrap="wrap">
            <Text
              component="h3"
              fw={600}
              className="import-file-name"
              id={`import-file-${e.id}`}
              tabIndex={-1}
            >
              {e.name}
            </Text>
            <Badge color={v.color} variant="light" data-testid="import-verdict">
              {v.text}
            </Badge>
          </Group>
          <Button
            size="compact-sm"
            variant="default"
            aria-label={t('Remove {name}', { name: e.name })}
            onClick={() => actions.remove(e.id)}
          >
            {t('Remove')}
          </Button>
        </Group>
        {e.failure && (
          <Text size="sm" c="red">
            {label(e.failure, t)}
          </Text>
        )}
        {c && !('header' in c) && <ReadNote c={c} />}
        {table && !e.kind && (
          <Text size="sm" c="red">
            {noKindText(table, t)}
          </Text>
        )}
        {table && e.mapping && (
          <Text size="sm">{t('Read with the saved mapping {name}.', { name: e.mapping })}</Text>
        )}
        {e.build && <Report b={e.build} />}
        {table && fold && (
          <Group>
            <Button
              size="compact-sm"
              variant="default"
              onClick={() => {
                actions.open(e.id)
                focusBack(`[data-kind-of="${e.id}"] input:checked`)
              }}
            >
              {t('Kind and columns')}
            </Button>
          </Group>
        )}
        {table && !fold && (
          <>
            <SegmentedControl
              size="xs"
              aria-label={t('Kind of {name}', { name: e.name })}
              data-kind-of={e.id}
              value={e.kind ?? ''}
              onChange={(k) => actions.setKind(e.id, k as TableKind)}
              data={tableKinds.map((k) => ({ value: k, label: t(kindLabels[k]) }))}
            />
            {e.kind &&
              e.map?.map((m, i) => (
                <ColumnRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: the columns of a card are fixed, the index is the column
                  key={`${e.id}-${i}`}
                  e={{ ...e, card: table, kind: e.kind as TableKind }}
                  i={i}
                  m={m}
                  actions={actions}
                />
              ))}
            {e.kind && e.map && (
              <Group gap="xs" align="flex-end" wrap="wrap">
                <TextInput
                  size="xs"
                  label={t('Save mapping as')}
                  value={name}
                  onChange={(ev) => setName(ev.currentTarget.value)}
                />
                <Button
                  size="xs"
                  variant="default"
                  disabled={name.trim() === ''}
                  onClick={() => actions.saveMapping(e.id, name.trim())}
                >
                  {t('Save mapping')}
                </Button>
              </Group>
            )}
            <TextInput
              size="xs"
              label={t('Source of this file')}
              placeholder={shared || t('Same as the source below')}
              maxLength={500}
              value={e.source}
              onChange={(ev) => actions.setSource(e.id, ev.currentTarget.value)}
            />
          </>
        )}
      </Stack>
    </Paper>
  )
}

/** The Import button's line: the conflict choice, the shared source and the count. */
export function ImportFoot({
  files,
  shared,
  replace,
  busy,
  done,
  onShared,
  onReplace,
  onImport,
}: {
  files: Entry[]
  shared: string
  replace: boolean
  busy: boolean
  done?: string | undefined
  onShared: (s: string) => void
  onReplace: (r: boolean) => void
  onImport: () => void
}) {
  const { t, tn } = useTranslation()
  const { total, missingSource } = importCount(files, shared, replace)
  const changed = files.reduce((n, f) => n + (f.build?.changed ?? 0), 0)
  return (
    <Stack gap="xs">
      {changed > 0 && (
        <Checkbox
          checked={replace}
          onChange={(ev) => onReplace(ev.currentTarget.checked)}
          label={tn(
            changed,
            'Replace {count} stored record with the changed row',
            'Replace {count} stored records with the changed rows',
          )}
        />
      )}
      <TextInput
        label={t('Source')}
        description={t('Where the data comes from, kept on each imported record.')}
        required
        maxLength={500}
        value={shared}
        onChange={(ev) => onShared(ev.currentTarget.value)}
      />
      <Text size="xs" c="dimmed" className="import-rights">
        {t('You are responsible for holding the rights to the data you import.')}
      </Text>
      <Group gap="sm">
        <Button disabled={total === 0 || missingSource || busy} onClick={onImport}>
          {tn(total, 'Import {count} valid row', 'Import {count} valid rows')}
        </Button>
        <Text size="sm" role="status">
          {done ?? ''}
        </Text>
      </Group>
    </Stack>
  )
}

/** What the page reports to: the data files of a later pick and the store hooks of the File menu. */
interface ImportEntryIo {
  /** Data files of a pick, for the File menu's own import. */
  importData: (files: File[]) => void
  onStored?: (() => void) | undefined
  noteStorage: () => void
}

/**
 * The Import entry: a page of file cards over the File menu's page, one card per table file, read
 * and built in a worker, with one report and one Import button at the foot. `files` are the
 * tables of the pick that opened it.
 */
export function ImportEntry({
  files: picked,
  io,
  onClose,
}: {
  files: File[]
  io: ImportEntryIo
  onClose: () => void
}) {
  const { t, tn } = useTranslation()
  const worker = useRef<Worker | undefined>(undefined)
  const nextId = useRef(1)
  const [files, setFiles] = useState<Entry[]>([])
  const filesRef = useRef(files)
  filesRef.current = files
  const saved = useRef<SavedMappings>({})
  const [shared, setShared] = useState('')
  const [replace, setReplace] = useState(false)
  const [done, setDone] = useState<string>()
  const [committing, setCommitting] = useState(false)
  const chooseButton = useRef<HTMLButtonElement>(null)
  const waiting = useRef(new Map<number, (r: ImportReply) => void>())

  const patch = useCallback(
    (id: number, p: Partial<Entry>) =>
      setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...p } : f))),
    [],
  )

  const call = useCallback((m: ImportRequest, transfer: Transferable[] = []) => {
    if (!worker.current) {
      const w = new Worker(new URL('../lib/import-entry.worker.ts', import.meta.url), {
        type: 'module',
      })
      w.onmessage = (ev: MessageEvent<ImportReply>) => {
        waiting.current.get(ev.data.id)?.(ev.data)
        waiting.current.delete(ev.data.id)
      }
      // a worker that failed to load or died answers nothing: fail what waits, start anew next call
      const fail = () => {
        w.terminate()
        if (worker.current === w) worker.current = undefined
        for (const [id, resolve] of waiting.current)
          resolve({ type: 'failed', id, message: msg('The import could not run in this browser.') })
        waiting.current.clear()
      }
      w.onerror = fail
      w.onmessageerror = fail
      worker.current = w
    }
    const w = worker.current
    return new Promise<ImportReply>((resolve) => {
      waiting.current.set(m.id, resolve)
      w.postMessage(m, transfer)
    })
  }, [])

  useEffect(() => () => worker.current?.terminate(), [])

  const build = useCallback(
    async (id: number, kind: TableKind, map: TableColumnMap[] | undefined) => {
      patch(id, { busy: true, kind })
      const r = await call({ type: 'build', id, kind, map })
      if (r.type === 'built') patch(id, { busy: false, build: r.build, map: r.build.map })
      else patch(id, { busy: false, failure: r.type === 'failed' ? r.message : undefined })
    },
    [call, patch],
  )

  const add = useCallback(
    async (list: File[]) => {
      setDone(undefined)
      const added = list.map((file) => ({ id: nextId.current++, file }))
      setFiles((fs) => [
        ...fs,
        ...added.map(
          (a): Entry => ({ id: a.id, name: a.file.name, source: '', touched: false, busy: true }),
        ),
      ])
      const buildFirst = async (id: number, card: CardView) => {
        try {
          const first = firstBuild(card, saved.current)
          patch(id, { card, busy: false, ...(first && { mapping: first.mapping }) })
          if (first) await build(id, first.kind, first.map)
        } catch (err) {
          patch(id, { card, busy: false, failure: errorText(err) })
        }
      }
      await Promise.all(
        added.map(async ({ id, file }) => {
          const bytes = await pickedBytes(file)
          if (!(bytes instanceof ArrayBuffer)) return patch(id, { busy: false, card: bytes })
          const r = await call({ type: 'read', id, bytes }, [bytes])
          if (r.type !== 'read')
            return patch(id, { busy: false, failure: r.type === 'failed' ? r.message : undefined })
          // a load file is planned on reading; its format is the source its records carry
          if (r.build && 'records' in r.card)
            return patch(id, { busy: false, card: r.card, build: r.build, source: r.card.format })
          await buildFirst(id, r.card)
        }),
      )
    },
    [build, call, patch],
  )

  // once per pick: a second run of the effect (React's development check) adds no second card
  const taken = useRef<File[]>(undefined)
  useEffect(() => {
    if (taken.current === picked) return
    taken.current = picked
    saved.current = readMappings()
    void add(picked)
  }, [add, picked])

  const actions: CardActions = {
    remove: (id) => {
      void call({ type: 'drop', id })
      // the Remove button is gone with its card: the next card, else the one before, else Choose files
      const fs = filesRef.current
      const at = fs.findIndex((f) => f.id === id)
      const next = fs[at + 1] ?? fs[at - 1]
      focusBack(next && `#import-file-${next.id}`, chooseButton.current)
      setFiles((fs) => fs.filter((f) => f.id !== id))
    },
    setKind: (id, kind) => {
      patch(id, { touched: true, mapping: undefined })
      void build(id, kind, undefined)
    },
    setColumn: (id, column, change) => {
      const e = filesRef.current.find((f) => f.id === id)
      if (!e?.map || !e.kind) return
      patch(id, { touched: true })
      void build(
        id,
        e.kind,
        e.map.map((m, i) => (i === column ? { ...m, ...change } : m)),
      )
    },
    open: (id) => patch(id, { touched: true }),
    setSource: (id, source) => patch(id, { source }),
    saveMapping: (id, name) => {
      const e = filesRef.current.find((f) => f.id === id)
      const { kind, map, card } = e ?? {}
      if (!kind || !map || !card || !('header' in card)) return
      saved.current = saveMapping(saved.current, name, { kind, header: card.header, map })
      setDone(t('Saved the mapping {name}.', { name }))
    },
  }

  async function choose() {
    try {
      const more = await pickFiles(true, undefined, [...loadFileFormats, ...tableFormats])
      const { data, tables } = await splitImport(more)
      if (data.length) io.importData(data.map((p) => p.file))
      if (tables.length) await add(tables.map((p) => p.file))
    } catch (err) {
      setDone(t('Import failed: {error}', { error: errorText(err) }))
    }
  }

  /** Writes one file's rows with its source; the count of rows written. */
  async function commitFile(e: Entry, day: string) {
    const n = e.build ? e.build.added + (replace ? e.build.changed : 0) : 0
    if (n === 0) return 0
    const source = (e.source.trim() || shared.trim()).slice(0, 500)
    const r = await call({
      type: 'commit',
      id: e.id,
      imported: { source, file: e.name.slice(0, 200), day },
      replace,
    })
    if (r.type === 'failed') throw new Error(r.message)
    if (r.type !== 'committed') return 0
    patch(e.id, { build: r.build })
    return r.written
  }

  async function commit() {
    setCommitting(true)
    let written = 0
    try {
      const day = localDay(new Date())
      for (const e of filesRef.current) written += await commitFile(e, day)
      setDone(tn(written, 'Imported {count} record.', 'Imported {count} records.'))
    } catch (err) {
      setDone(t('Import failed: {error}', { error: errorText(err) }))
    } finally {
      setCommitting(false)
      if (written > 0) {
        io.onStored?.()
        io.noteStorage()
      }
    }
  }

  return (
    <AppModal
      opened
      onClose={onClose}
      fullScreen
      title={t('Tables to read')}
      footer={
        <div className="import-foot">
          <ImportFoot
            files={files}
            shared={shared}
            replace={replace}
            busy={committing || files.some((f) => f.busy)}
            done={done}
            onShared={setShared}
            onReplace={setReplace}
            onImport={() => void commit()}
          />
        </div>
      }
    >
      <Stack gap="md" className="import-entry">
        <Group gap="xs" wrap="wrap">
          <Button ref={chooseButton} variant="default" onClick={() => void choose()}>
            {t('Choose files')}
          </Button>
          <Text size="sm" c="dimmed">
            {t(
              'CSV, text, workbook or JSON list of bullets, powders or cartridges. Read in this browser, not uploaded.',
            )}
          </Text>
        </Group>
        <p className="visually-hidden" role="status">
          {readStatus(files, t)}
        </p>
        {files.map((e) => (
          <FileCard key={e.id} e={e} shared={shared} actions={actions} />
        ))}
      </Stack>
    </AppModal>
  )
}

/** The bytes of a picked file, or its refusal card: a file over the size limit is not read. */
export async function pickedBytes(file: Blob): Promise<ArrayBuffer | { refusal: Message }> {
  if (file.size > maxFileBytes)
    return { refusal: msg('The file is larger than 40 MB. Split it and import the parts.') }
  try {
    return await file.arrayBuffer()
  } catch {
    return { refusal: msg('The file could not be read.') }
  }
}

/**
 * Picked files split by content: a file the OpenReloading data format detects goes to the data file
 * import, every other file (a file over the size limit unread) to the Import entry's cards.
 */
export async function splitImport<F extends { file: Blob }>(picked: F[]) {
  const data: F[] = []
  const tables: F[] = []
  for (const p of picked) {
    const format =
      p.file.size > maxFileBytes
        ? undefined
        : loadFormatOf(new Uint8Array(await p.file.arrayBuffer()))
    ;(format !== undefined && format === loadFileFormats[0] ? data : tables).push(p)
  }
  return { data, tables }
}

/** The Import entry's page and the table files it opens with. */
export interface TablesEntry {
  Entry: typeof ImportEntry
  files: File[]
}

/** Data files go to `importData`, every other file to the Import entry's cards. */
export async function routeImport(
  picked: { file: File }[],
  show: (entry: TablesEntry) => void,
  importData: (files: File[]) => Promise<void>,
) {
  const { data, tables } = await splitImport(picked)
  if (tables.length) show({ Entry: ImportEntry, files: tables.map((p) => p.file) })
  if (data.length) await importData(data.map((p) => p.file))
}
