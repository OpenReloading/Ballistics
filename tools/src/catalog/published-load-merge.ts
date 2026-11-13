import { createHash } from 'node:crypto'
import {
  canonicalJson,
  compareKeys,
  type Provenance,
  type PublishedLoad,
  type PublishedLoads,
  parseRef,
} from '@rangefoundry/schema'

/** A load of an incoming file, which may come without an id: {@link mergePublishedLoads} sets it. */
export type IncomingLoad = Omit<PublishedLoad, 'id'> & { id?: string | undefined }

/** An incoming file of published loads, its loads in the order the table prints them, with the sources of its table. */
export type IncomingLoads = Omit<PublishedLoads, 'loads' | 'provenance'> & {
  loads: IncomingLoad[]
  provenance: Provenance
}

/** A figure's stored value, or its printed text where it has none (`Flush`). */
const figure = (f: { value?: number | undefined; raw: string } | undefined) =>
  f === undefined ? null : (f.value ?? f.raw)

/** Maker, cartridge, printed bullet text and mass, COAL (with its limit), printed powder, the set of charge kinds, barrel length and twist and the marks of each charge, a figure by its stored value (`55 gr` and `55 grs` are one key); edition, page, charge, velocity, pressure, primer and case are not in it, so a newer edition finds its older load. */
function naturalKey(file: Pick<PublishedLoads, 'maker' | 'cartridge'>, load: IncomingLoad) {
  const marks = load.charges.flatMap((c) =>
    [...(c.marks ?? []), ...(c.printedMarks ?? [])].map((m) => `${c.kind}:${m}`),
  )
  return JSON.stringify([
    file.maker,
    parseRef(file.cartridge)?.id ?? file.cartridge,
    load.bullet.printed,
    figure(load.bullet.mass),
    figure(load.coal),
    load.coal?.limit ?? null,
    load.powder.printed,
    load.charges.map((c) => c.kind).sort(compareKeys),
    figure(load.barrel?.length),
    figure(load.barrel?.twist),
    marks.sort(compareKeys),
  ])
}

/** The first 10 hex digits of the SHA-1 of its natural key (`apps/docs/docs/data/published-loads.md`, "Import and re-import"); `occurrence` counts loads of equal key as the table prints them, from 1 (the bare hash, then `<hash>-2`), so a load has the same id in every edition. */
export function loadId(
  file: Pick<PublishedLoads, 'maker' | 'cartridge'>,
  load: IncomingLoad,
  occurrence = 1,
) {
  const hash = createHash('sha1').update(naturalKey(file, load)).digest('hex').slice(0, 10)
  return occurrence === 1 ? hash : `${hash}-${occurrence}`
}

/** The loads of `file` with their ids set by {@link loadId}, in the order the table prints them. */
export function withLoadIds(file: IncomingLoads): PublishedLoads {
  const seen = new Map<string, number>()
  const loads = file.loads.map((l) => {
    const base = loadId(file, l)
    const occurrence = (seen.get(base) ?? 0) + 1
    seen.set(base, occurrence)
    const { id: _id, ...rest } = l
    return { id: loadId(file, l, occurrence), ...rest }
  })
  return { ...file, loads }
}

/** What a merge did, by load id. A changed load is written only where `accepted`. */
export type MergeReport = {
  created: string[]
  changed: { id: string; fields: string[]; accepted: boolean }[]
  unchanged: string[]
  /** Loads of the repository the incoming edition does not print; kept. */
  absent: string[]
}

/** The merged file and what the merge did. */
export type MergeResult = { file: PublishedLoads; report: MergeReport; written: boolean }

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** The dot paths at which `a` and `b` differ, leaves and missing keys. */
function differences(a: unknown, b: unknown, path: string): string[] {
  if (canonicalJson(a) === canonicalJson(b)) return []
  const both = (Array.isArray(a) && Array.isArray(b)) || (isObject(a) && isObject(b))
  if (!both) return [path]
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)])
  return [...keys]
    .sort(compareKeys)
    .flatMap((k) =>
      differences(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        path ? `${path}.${k}` : k,
      ),
    )
}

/** The content of a load that a re-import compares: all but its id and where it is printed. */
function content(l: PublishedLoad) {
  const { id: _id, source: _source, page: _page, url: _url, ...rest } = l
  return rest
}

/** `load` citing source `index`, `source` placed before `page` and left out for the first. */
function citing(load: PublishedLoad, index: number): PublishedLoad {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(load)) {
    if (k === 'source') continue
    if (k === 'page' && index > 0) out.source = index
    out[k] = v
  }
  return out as PublishedLoad
}

/** `l` with the catalogue links of the stored load `old` that it lacks: `bullet.record`, `powder.record`, and the primer's `records`, `size` and `magnum` where both print the same primer; curated in the repository, so a collector that does not set them keeps them. */
function withStoredLinks(old: PublishedLoad, l: PublishedLoad): PublishedLoad {
  const record = <T>(incoming: T | undefined, stored: T | undefined) =>
    (incoming ?? stored) === undefined ? {} : { record: incoming ?? stored }
  return {
    ...l,
    bullet: { ...l.bullet, ...record(l.bullet.record, old.bullet.record) },
    powder: { ...l.powder, ...record(l.powder.record, old.powder.record) },
    ...(l.primer !== undefined &&
      old.primer?.printed === l.primer.printed && { primer: { ...old.primer, ...l.primer } }),
  }
}

/** Adds incoming load `l` to `report` against the repository's `old`; returns the load to write, `l` with the links of `old` it lacks, or undefined where nothing is written. */
function classify(
  old: PublishedLoad | undefined,
  l: PublishedLoad,
  accept: ReadonlySet<string> | 'all',
  report: MergeReport,
) {
  if (old === undefined) {
    report.created.push(l.id)
    return l
  }
  const linked = withStoredLinks(old, l)
  const fields = differences(content(old), content(linked), '')
  if (fields.length === 0) {
    report.unchanged.push(l.id)
    return
  }
  const accepted = accept === 'all' || accept.has(l.id)
  report.changed.push({ id: l.id, fields, accepted })
  return accepted ? linked : undefined
}

/** By load id, as `apps/docs/docs/data/published-loads.md`, "Import and re-import" states: new loads created, equal ones kept, changed ones listed and replaced only when in `accept` (or `'all'`), stored links kept, absent ones kept and listed, ids from {@link withLoadIds}, sorted by id; `written` is false when the repository file is left as it is, `resolveSource` gives the form two source entries compare in. */
export function mergePublishedLoads(
  existing: PublishedLoads | undefined,
  incoming: IncomingLoads,
  accept: ReadonlySet<string> | 'all',
  resolveSource: (source: unknown) => unknown = (source) => source,
): MergeResult {
  const loads = withLoadIds(incoming).loads
  const base: PublishedLoads = existing ?? { ...incoming, loads: [] }
  const sources = [...(existing?.provenance?.sources ?? [])]
  const sourceIndex = (i: number) => {
    const s = incoming.provenance.sources[i]
    const key = canonicalJson(resolveSource(s))
    const at = sources.findIndex((t) => canonicalJson(resolveSource(t)) === key)
    if (at >= 0) return at
    sources.push(s as (typeof sources)[number])
    return sources.length - 1
  }
  const byId = new Map(base.loads.map((l) => [l.id, l]))
  const report: MergeReport = { created: [], changed: [], unchanged: [], absent: [] }
  const printed = new Set<string>()
  for (const l of loads) {
    printed.add(l.id)
    const toWrite = classify(byId.get(l.id), l, accept, report)
    if (toWrite) byId.set(l.id, citing(toWrite, sourceIndex(toWrite.source ?? 0)))
  }
  for (const l of base.loads) if (!printed.has(l.id)) report.absent.push(l.id)
  for (const list of [report.created, report.unchanged, report.absent]) list.sort(compareKeys)
  report.changed.sort((a, b) => compareKeys(a.id, b.id))
  const written = report.created.length > 0 || report.changed.some((c) => c.accepted)
  const file: PublishedLoads = {
    ...base,
    loads: [...byId.values()].sort((a, b) => compareKeys(a.id, b.id)),
    provenance: { ...(base.provenance ?? incoming.provenance), sources },
  }
  return { file: written ? file : (existing ?? file), report, written }
}
