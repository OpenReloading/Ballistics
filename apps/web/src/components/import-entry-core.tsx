'use client'

import {
  Badge,
  Button,
  Checkbox,
  FileButton,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type FieldSpec,
  fieldSpecs,
  kindNames,
  type TableKind,
  tableKinds,
} from '../lib/import-entry/fields.ts'
import { inventedFiles } from '../lib/import-entry/fixtures.ts'
import type { ColumnMap } from '../lib/import-entry/map.ts'
import type { BuildView, CardView, Reply, Request } from '../lib/import-entry/protocol.ts'

export interface Entry {
  id: number
  name: string
  card?: CardView
  kind?: TableKind
  map?: ColumnMap[]
  build?: BuildView
  /** Source text of this file; empty takes the shared one. */
  source: string
  busy: boolean
  failure?: string
  /** Milliseconds the worker took to inspect and to build. */
  ms?: { inspect?: number; build?: number }
}

export interface Committed {
  written: number
  stored: number
}

const mappingsKey = 'import-entry-mappings'
type SavedMappings = Record<string, { kind: TableKind; byHeader: Record<string, ColumnMap> }>
const savedMappings = (): SavedMappings => {
  try {
    return JSON.parse(localStorage.getItem(mappingsKey) ?? '{}') as SavedMappings
  } catch {
    return {}
  }
}

const today = () => new Date().toISOString().slice(0, 10)

/** The state of one import: files, their cards, builds, the shared source and the commit. */
export function useImport() {
  const worker = useRef<Worker | undefined>(undefined)
  const waiting = useRef(new Map<number, (r: Reply) => void>())
  const nextId = useRef(1)
  const [files, setFiles] = useState<Entry[]>([])
  const [shared, setShared] = useState('')
  const [replace, setReplace] = useState(false)
  const [committed, setCommitted] = useState<Committed | undefined>()
  const filesRef = useRef(files)
  filesRef.current = files
  const sharedRef = useRef(shared)
  sharedRef.current = shared

  const call = useCallback((req: Request, transfer: Transferable[] = []) => {
    if (!worker.current) {
      const w = new Worker(new URL('../lib/import-entry/worker.ts', import.meta.url), {
        type: 'module',
      })
      w.onmessage = (e: MessageEvent<Reply>) => {
        waiting.current.get(e.data.id)?.(e.data)
        waiting.current.delete(e.data.id)
      }
      worker.current = w
    }
    const w = worker.current
    return new Promise<Reply>((resolve) => {
      waiting.current.set(req.id, resolve)
      w.postMessage(req, transfer)
    })
  }, [])

  useEffect(() => () => worker.current?.terminate(), [])

  const patch = useCallback(
    (id: number, p: Partial<Entry>) =>
      setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...p } : f))),
    [],
  )

  const build = useCallback(
    async (id: number, kind: TableKind, map?: ColumnMap[]) => {
      const entry = filesRef.current.find((f) => f.id === id)
      if (!entry) return
      patch(id, { busy: true, kind })
      const r = await call({
        type: 'build',
        id,
        kind,
        ...(map && { map }),
        source: entry.source || sharedRef.current,
        file: entry.name,
        day: today(),
      })
      if (r.type === 'built')
        setFiles((fs) =>
          fs.map((f) =>
            f.id === id
              ? {
                  ...f,
                  build: r.build,
                  map: r.build.map,
                  busy: false,
                  ms: { ...f.ms, build: r.ms },
                }
              : f,
          ),
        )
      else patch(id, { busy: false, failure: r.type === 'failed' ? r.message : 'unexpected reply' })
    },
    [call, patch],
  )

  const add = useCallback(
    async (list: { name: string; bytes: ArrayBuffer }[]) => {
      const added = list.map((f) => ({ id: nextId.current++, ...f }))
      setCommitted(undefined)
      setFiles((fs) => [
        ...fs,
        ...added.map((a): Entry => ({ id: a.id, name: a.name, source: '', busy: true })),
      ])
      await Promise.all(
        added.map(async (a) => {
          const r = await call({ type: 'inspect', id: a.id, name: a.name, bytes: a.bytes }, [
            a.bytes,
          ])
          if (r.type !== 'inspected')
            return patch(a.id, {
              busy: false,
              failure: r.type === 'failed' ? r.message : 'unexpected reply',
            })
          patch(a.id, {
            card: r.card,
            busy: false,
            ms: { inspect: r.ms },
            ...(r.card.kind && { kind: r.card.kind }),
            ...(r.card.map && { map: r.card.map }),
          })
          if (r.card.type === 'table' && r.card.kind) await build(a.id, r.card.kind, r.card.map)
        }),
      )
    },
    [build, call, patch],
  )

  const addFiles = useCallback(
    async (picked: File[]) =>
      add(
        await Promise.all(
          picked.map(async (f) => ({ name: f.name, bytes: await f.arrayBuffer() })),
        ),
      ),
    [add],
  )

  const addInvented = useCallback(
    (names: string[]) =>
      add(
        inventedFiles()
          .filter((f) => names.includes(f.name))
          .map((f) => ({ name: f.name, bytes: f.bytes.slice().buffer as ArrayBuffer })),
      ),
    [add],
  )

  const remove = useCallback(
    (id: number) => {
      void call({ type: 'drop', id })
      setFiles((fs) => fs.filter((f) => f.id !== id))
    },
    [call],
  )

  const setKind = useCallback((id: number, kind: TableKind) => build(id, kind), [build])

  const setColumn = useCallback(
    (id: number, column: number, p: Partial<ColumnMap>) => {
      const entry = filesRef.current.find((f) => f.id === id)
      if (!entry?.map || !entry.kind) return
      const map = entry.map.map((m, i) => (i === column ? { ...m, ...p } : m))
      return build(id, entry.kind, map)
    },
    [build],
  )

  const rebuildAll = useCallback(async () => {
    await Promise.all(
      filesRef.current
        .filter((f) => f.kind && f.card?.type === 'table')
        .map((f) => build(f.id, f.kind as TableKind, f.map)),
    )
  }, [build])

  const sourceOf = (e: Entry) => (e.source || shared).trim()
  const contributing = files.filter(
    (f) => f.card?.type === 'load' || (f.card?.type === 'table' && f.build),
  )
  const count = (e: Entry) =>
    e.card?.type === 'load'
      ? (e.card.records ?? 0)
      : e.build
        ? e.build.plan.added - e.build.plan.makersAdded + (replace ? e.build.plan.conflictCount : 0)
        : 0
  const total = contributing.reduce((s, e) => s + count(e), 0)
  const missingSource = contributing.some((e) => count(e) > 0 && sourceOf(e) === '')
  const busy = files.some((f) => f.busy)

  const commit = useCallback(async () => {
    let last: Committed = { written: 0, stored: 0 }
    let written = 0
    for (const e of filesRef.current) {
      if (e.card?.type !== 'load' && !(e.card?.type === 'table' && e.build)) continue
      const r = await call({ type: 'commit', id: e.id, replace })
      if (r.type === 'committed') {
        written += r.written
        last = { written, stored: r.stored }
      }
    }
    setCommitted(last)
    await rebuildAll()
  }, [call, rebuildAll, replace])

  return {
    files,
    shared,
    setShared,
    replace,
    setReplace,
    committed,
    add,
    addFiles,
    addInvented,
    remove,
    setKind,
    setColumn,
    patch,
    rebuildAll,
    build,
    sourceOf,
    total,
    missingSource,
    busy,
    count,
    contributing,
    commit,
  }
}

export type ImportState = ReturnType<typeof useImport>

const tierColor = { high: 'green', medium: 'yellow', low: 'orange' } as const

/** The card's one-line verdict: what the file is and how sure. */
export function verdict(e: Entry): { text: string; color: string } {
  const c = e.card
  if (!c) return { text: 'Reading…', color: 'gray' }
  if (c.type === 'refused') return { text: 'Refused', color: 'red' }
  if (c.type === 'load') return { text: `Load file, read by ${c.format}`, color: 'blue' }
  if (!e.kind) return { text: 'Refused: no kind', color: 'red' }
  const tier = e.kind === c.kind ? c.tier : undefined
  return {
    text: tier
      ? `Table of ${kindNames[e.kind]} (${tier})`
      : `Table of ${kindNames[e.kind]} (chosen)`,
    color: tier ? tierColor[tier] : 'blue',
  }
}

export function FileVerdict({ e }: { e: Entry }) {
  const v = verdict(e)
  return (
    <Group gap="xs" wrap="wrap">
      <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
        {e.name}
      </Text>
      <Badge color={v.color} variant="light" data-testid="verdict">
        {v.text}
      </Badge>
    </Group>
  )
}

/** Kind buttons of a table card; the suggestion carries its tier in the verdict, not here. */
export function KindControl({ e, s }: { e: Entry; s: ImportState }) {
  if (e.card?.type !== 'table') return null
  return (
    <Stack gap={4}>
      <SegmentedControl
        size="xs"
        aria-label={`Kind of ${e.name}`}
        value={e.kind ?? ''}
        onChange={(v) => void s.setKind(e.id, v as TableKind)}
        data={tableKinds.map((k) => ({ value: k, label: kindNames[k] }))}
      />
      {e.card.reason && (
        <Text size="sm" c="red">
          {e.card.reason}
        </Text>
      )}
    </Stack>
  )
}

const fieldData = (kind: TableKind) => [
  { value: '', label: 'Not imported' },
  ...fieldSpecs[kind].map((f) => ({ value: f.key, label: f.label })),
]

function ColumnRow({
  e,
  s,
  i,
  spec,
}: {
  e: Entry
  s: ImportState
  i: number
  spec: FieldSpec | undefined
}) {
  const m = e.map?.[i]
  const header = e.card?.header?.[i] ?? ''
  const sample = (e.card?.samples?.[i] ?? []).join(' · ')
  if (!m || !e.kind) return null
  return (
    <Group
      gap="xs"
      align="flex-end"
      wrap="wrap"
      py={4}
      style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
    >
      <div style={{ flex: '1 1 10rem', minWidth: 0 }}>
        <Text fw={600} size="sm" style={{ overflowWrap: 'anywhere' }}>
          {header}
        </Text>
        <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
          {sample}
        </Text>
      </div>
      <Select
        size="xs"
        w="9rem"
        aria-label={`Field of column ${header}`}
        data={fieldData(e.kind)}
        value={m.field ?? ''}
        allowDeselect={false}
        onChange={(v) =>
          void s.setColumn(e.id, i, { field: v || undefined, unit: undefined, unitFrom: undefined })
        }
      />
      {spec?.units && (
        <>
          <Select
            size="xs"
            w="6rem"
            aria-label={`Unit of column ${header}`}
            data={spec.units.map((u) => ({ value: u.id, label: u.symbol }))}
            value={m.unit ?? spec.units[0]?.id ?? null}
            allowDeselect={false}
            onChange={(v) =>
              void s.setColumn(e.id, i, { unit: v ?? undefined, unitFrom: 'header' })
            }
          />
          <Select
            size="xs"
            w="5rem"
            aria-label={`Decimal mark of column ${header}`}
            data={[
              { value: '.', label: '1.5' },
              { value: ',', label: '1,5' },
            ]}
            value={m.decimal}
            allowDeselect={false}
            onChange={(v) => void s.setColumn(e.id, i, { decimal: v === ',' ? ',' : '.' })}
          />
          {m.unitFrom === 'values' && (
            <Text size="xs" c="dimmed">
              unit guessed from values
            </Text>
          )}
          {m.ambiguousDecimal && (
            <Text size="xs" c="dimmed">
              decimal mark guessed
            </Text>
          )}
        </>
      )}
    </Group>
  )
}

/** Column mapping of one table card, with the saved-mapping row. */
export function MappingBlock({ e, s }: { e: Entry; s: ImportState }) {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState<SavedMappings>({})
  useEffect(() => setSaved(savedMappings()), [])
  if (e.card?.type !== 'table' || !e.kind || !e.map) return null
  const header = e.card.header ?? []
  const kind = e.kind
  const mine = Object.entries(saved).filter(([, v]) => v.kind === kind)
  const save = () => {
    const next = {
      ...saved,
      [name]: {
        kind,
        byHeader: Object.fromEntries(
          header.map((h, i) => [h, e.map?.[i] ?? { decimal: '.' as const }]),
        ),
      },
    }
    try {
      localStorage.setItem(mappingsKey, JSON.stringify(next))
    } catch {}
    setSaved(next)
  }
  const use = (key: string | null) => {
    const m = key ? saved[key] : undefined
    if (m)
      void s.build(
        e.id,
        kind,
        header.map((h) => m.byHeader[h] ?? { decimal: '.' as const }),
      )
  }
  return (
    <Stack gap={4}>
      {e.map
        .map((m, i) => ({ m, column: i }))
        .map(({ m, column }) => (
          <ColumnRow
            key={`${e.id}-column-${column}`}
            e={e}
            s={s}
            i={column}
            spec={fieldSpecs[kind].find((f) => f.key === m.field)}
          />
        ))}
      <Group gap="xs" align="flex-end" wrap="wrap">
        <TextInput
          size="xs"
          label="Save mapping as"
          value={name}
          onChange={(ev) => setName(ev.currentTarget.value)}
          w="12rem"
        />
        <Button size="xs" variant="default" disabled={name.trim() === ''} onClick={save}>
          Save mapping
        </Button>
        {mine.length > 0 && (
          <Select
            size="xs"
            label="Saved mapping"
            placeholder="Use…"
            data={mine.map(([k]) => k)}
            value={null}
            onChange={use}
            w="12rem"
          />
        )}
      </Group>
    </Stack>
  )
}

const unitLabel = (f: FieldSpec) => (f.units?.[0] ? ` (${f.units[0].symbol})` : '')

/** The first records as they are stored, in stored units. */
export function PreviewTable({ e }: { e: Entry }) {
  if (!e.build || !e.kind) return null
  const cols = fieldSpecs[e.kind].filter((f) => f.key !== 'name' && f.key !== 'maker')
  return (
    <div style={{ overflowX: 'auto' }}>
      <Table
        withTableBorder={false}
        verticalSpacing={2}
        fz="xs"
        aria-label={`First records of ${e.name}`}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            {cols.map((f) => (
              <Table.Th key={f.key}>
                {f.label}
                {unitLabel(f)}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {e.build.preview.map((p) => (
            <Table.Tr key={p.name}>
              <Table.Td>{p.name}</Table.Td>
              {cols.map((f) => (
                <Table.Td key={f.key}>
                  {p.values[f.key]
                    ? f.units
                      ? Number(Number(p.values[f.key]).toPrecision(6))
                      : p.values[f.key]
                    : ''}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  )
}

/** Counts of one file and its rejected rows (the first `shown`). */
export function FileReport({ e, shown = 8 }: { e: Entry; shown?: number }) {
  const c = e.card
  if (c?.type === 'refused')
    return (
      <Text size="sm" c="red">
        {c.reason}
      </Text>
    )
  if (c?.type === 'load') {
    return (
      <Text size="sm">
        {c.records} {c.records === 1 ? 'record' : 'records'}.
        {c.notes?.length ? ` ${c.notes.join(' ')}` : ''}
      </Text>
    )
  }
  const b = e.build
  if (!b) return null
  return (
    <Stack gap={4}>
      <Text size="sm" data-testid="counts">
        {b.rows} rows: {b.accepted} accepted, {b.warnings} with a warning, {b.rejected} rejected.
        New {b.plan.added - b.plan.makersAdded}, already here {b.plan.equal}, changed{' '}
        {b.plan.conflictCount}, repeated in file {b.plan.repeated}.
      </Text>
      <Text size="xs" c="dimmed" data-testid="timing">
        Read in {Math.round(e.ms?.inspect ?? 0)} ms
        {e.ms?.build === undefined ? '' : `, built in ${Math.round(e.ms.build)} ms`}.
      </Text>
      {b.rejectedList.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <Table fz="xs" verticalSpacing={2} aria-label={`Rejected rows of ${e.name}`}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Row</Table.Th>
                <Table.Th>Column</Table.Th>
                <Table.Th>Why</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {b.rejectedList.slice(0, shown).map((r) => (
                <Table.Tr key={`${r.row}-${r.column}`}>
                  <Table.Td>{r.row}</Table.Td>
                  <Table.Td>{r.column}</Table.Td>
                  <Table.Td>{r.reason}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {b.rejected > shown && (
            <Text size="xs" c="dimmed">
              and {b.rejected - shown} more rejected rows.
            </Text>
          )}
        </div>
      )}
      {b.warningList.length > 0 && (
        <Text size="xs" c="dimmed">
          First warning, row {b.warningList[0]?.row}: {b.warningList[0]?.reason}
        </Text>
      )}
    </Stack>
  )
}

/** The file picker and the invented files. */
export function Picker({ s }: { s: ImportState }) {
  const names = inventedFiles()
  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="wrap">
        <FileButton multiple onChange={(f) => void s.addFiles(f)} accept="">
          {(props) => <Button {...props}>Choose files</Button>}
        </FileButton>
        <Text size="xs" c="dimmed">
          Any file: CSV, workbook, JSON, load file.
        </Text>
      </Group>
      <Group gap={4} wrap="wrap" aria-label="Invented files">
        {names.map((f) => (
          <Button
            key={f.name}
            size="compact-xs"
            variant="default"
            title={f.note}
            onClick={() => void s.addInvented([f.name])}
          >
            {f.name}
          </Button>
        ))}
      </Group>
    </Stack>
  )
}

/** Totals, the conflict choice, the source and the Import button. */
export function Commit({ s }: { s: ImportState }) {
  const conflicts = s.contributing.reduce((n, e) => n + (e.build?.plan.conflictCount ?? 0), 0)
  return (
    <Stack gap="xs">
      {conflicts > 0 && (
        <Checkbox
          size="xs"
          checked={s.replace}
          onChange={(ev) => s.setReplace(ev.currentTarget.checked)}
          label={`Replace ${conflicts} stored records with the changed rows`}
        />
      )}
      <TextInput
        size="xs"
        label="Source"
        required
        placeholder="Where the data comes from"
        value={s.shared}
        onChange={(ev) => s.setShared(ev.currentTarget.value)}
      />
      <Group gap="xs">
        <Button
          disabled={s.total === 0 || s.missingSource || s.busy}
          onClick={() => void s.commit()}
        >
          Import {s.total} valid rows
        </Button>
        {s.committed && (
          <Text size="sm" role="status">
            Imported {s.committed.written} records. {s.committed.stored} in this browser.
          </Text>
        )}
      </Group>
    </Stack>
  )
}

export const Panel = ({ children }: { children: React.ReactNode }) => (
  <Paper withBorder p="sm">
    {children}
  </Paper>
)

/** The source of one file when it differs from the shared one. */
export function FileSource({ e, s }: { e: Entry; s: ImportState }) {
  return (
    <TextInput
      size="xs"
      label="Source of this file"
      placeholder={s.shared || 'Same as above'}
      value={e.source}
      onChange={(ev) => s.patch(e.id, { source: ev.currentTarget.value })}
    />
  )
}
