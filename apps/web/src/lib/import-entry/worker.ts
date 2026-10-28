/** The Import entry's worker: reads files, scores kinds, maps columns, builds and plans records, keeps the prototype's store. */
import { fieldSpecs, type TableKind } from './fields.ts'
import { idOfKey } from './ids.ts'
import { type Inspection, inspectFile } from './inspect.ts'
import { autoMap, type Built, buildRecords, type ColumnMap, type ImportedRecord } from './map.ts'
import { planBuilt } from './plan.ts'
import { type BuildView, type CardView, listed, type Reply, type Request } from './protocol.ts'
import type { Table } from './table.ts'

type Held = { inspection: Inspection; built?: Built; plan?: ReturnType<typeof planBuilt> }
const files = new Map<number, Held>()
/** The prototype's browser store. */
let store: ImportedRecord[] = []

const post = (r: Reply) => self.postMessage(r)

const samples = (t: Table) =>
  t.header.map((_, i) =>
    t.rows
      .slice(0, 200)
      .map((r) => r[i] ?? '')
      .filter((c) => c !== '')
      .slice(0, 3),
  )

function viewOf(i: Inspection): CardView {
  if (i.type === 'refused') return { type: 'refused', name: i.name, reason: i.reason }
  if (i.type === 'load')
    return {
      type: 'load',
      name: i.name,
      format: i.format,
      notes: i.notes,
      records: i.records.length,
    }
  return {
    type: 'table',
    name: i.name,
    origin: i.origin,
    ...(i.sheet && { sheet: i.sheet }),
    ...(i.otherSheets?.length && { otherSheets: i.otherSheets }),
    ...(i.delimiter && { delimiter: i.delimiter }),
    header: i.table.header,
    rowCount: i.table.rows.length,
    samples: samples(i.table),
    scores: i.scores,
    ...(i.kind && { kind: i.kind }),
    ...(i.tier && { tier: i.tier }),
    ...(i.refusal && { reason: i.refusal }),
    map: i.map,
  }
}

const specKeys: Record<string, string> = {
  L3: 'caseLength',
  L6: 'overallLength',
  G1: 'bulletDiameter',
  Pmax: 'maxPressure',
}

type Source = Record<string, unknown> & {
  values?: { symbol: string; value?: number }[]
  ballisticCoefficients?: { dragModel: string; value: number }[]
}

const quantityText = (v: unknown) =>
  v && typeof v === 'object' && 'value' in v
    ? String((v as { value: number }).value)
    : typeof v === 'string'
      ? v
      : undefined

/** The stored values of one record by field key, as text. */
function valuesOf(kind: TableKind, src: Source): Record<string, string> {
  const values: Record<string, string> = {}
  for (const f of fieldSpecs[kind]) {
    const v = quantityText(src[f.key])
    if (v !== undefined) values[f.key] = v
  }
  for (const v of src.values ?? []) {
    const key = specKeys[v.symbol]
    if (key && v.value !== undefined) values[key] = String(v.value)
  }
  for (const b of src.ballisticCoefficients ?? []) values[`bc${b.dragModel}`] = String(b.value)
  return values
}

function previewOf(kind: TableKind, built: Built): BuildView['preview'] {
  return built.entries.slice(0, 5).map(({ record }) => {
    const data = record.data as { overrides?: Source; draft?: Source }
    return { name: record.name, values: valuesOf(kind, data.overrides ?? data.draft ?? {}) }
  })
}

function buildViewOf(
  table: Table,
  kind: TableKind,
  map: ColumnMap[],
  built: Built,
  plan: ReturnType<typeof planBuilt>,
): BuildView {
  return {
    map,
    rows: table.rows.length,
    accepted: built.entries.length,
    warnings: built.warnings.length,
    rejected: built.rejected.length,
    rejectedList: built.rejected.slice(0, listed),
    warningList: built.warnings.slice(0, listed),
    preview: previewOf(kind, built),
    plan: {
      added: plan.added.length,
      equal: plan.equal.length,
      conflicts: plan.conflicts
        .slice(0, listed)
        .map((c) => ({ name: c.incoming.name, ...(c.row && { row: c.row }) })),
      conflictCount: plan.conflicts.length,
      repeated: plan.repeated,
      makersAdded: plan.added.filter((r) => r.kind === 'manufacturer').length,
    },
  }
}

type Message<T extends Request['type']> = Extract<Request, { type: T }>

async function inspect(m: Message<'inspect'>) {
  const t0 = performance.now()
  const inspection = await inspectFile(m.name, new Uint8Array(m.bytes), new Date().toISOString())
  files.set(m.id, { inspection })
  post({ type: 'inspected', id: m.id, card: viewOf(inspection), ms: performance.now() - t0 })
}

function build(m: Message<'build'>) {
  const held = files.get(m.id)
  if (held?.inspection.type !== 'table') throw new Error('no table to build')
  const t0 = performance.now()
  const { table } = held.inspection
  const ctx = { source: m.source, file: m.file, day: m.day, now: new Date().toISOString() }
  const map = m.map ?? autoMap(table, m.kind)
  const built = buildRecords(table, m.kind, map, ctx, idOfKey)
  const plan = planBuilt(built, store)
  held.built = built
  held.plan = plan
  post({
    type: 'built',
    id: m.id,
    build: buildViewOf(table, m.kind, map, built, plan),
    ms: performance.now() - t0,
  })
}

function commit(m: Message<'commit'>) {
  const held = files.get(m.id)
  let write: ImportedRecord[] = []
  if (held?.inspection.type === 'load') write = held.inspection.records as ImportedRecord[]
  else if (held?.plan)
    write = [...held.plan.added, ...(m.replace ? held.plan.conflicts.map((c) => c.incoming) : [])]
  const ids = new Set(write.map((r) => r.id))
  store = [...store.filter((r) => !ids.has(r.id)), ...write]
  post({ type: 'committed', id: m.id, written: write.length, stored: store.length })
}

self.onmessage = async (e: MessageEvent<Request>) => {
  const m = e.data
  try {
    if (m.type === 'drop') files.delete(m.id)
    else if (m.type === 'inspect') await inspect(m)
    else if (m.type === 'build') build(m)
    else commit(m)
  } catch (err) {
    post({ type: 'failed', id: m.id, message: err instanceof Error ? err.message : String(err) })
  }
}
