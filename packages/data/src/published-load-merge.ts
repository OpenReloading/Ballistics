import { createHash } from 'node:crypto'
import {
  compareKeys,
  type PublishedLoad,
  type PublishedLoads,
  parseRef,
} from '@open-reloading/schema'

/** A load of an incoming file, which may come without an id: {@link mergePublishedLoads} sets it. */
export type IncomingLoad = Omit<PublishedLoad, 'id'> & { id?: string | undefined }

/** An incoming file of published loads, its loads in the order the table prints them. */
export type IncomingLoads = Omit<PublishedLoads, 'loads'> & { loads: IncomingLoad[] }

/** A figure's stored value, or its printed text where it has none (`Flush`). */
const figure = (f: { value?: number | undefined; raw: string } | undefined) =>
  f === undefined ? null : (f.value ?? f.raw)

/**
 * The natural key of a load: maker, cartridge, printed bullet text and mass, COAL (with its limit),
 * printed powder, the set of charge kinds, barrel length and twist, and the marks of each charge.
 * A figure counts by its stored value, so `55 gr` and `55 grs` are one key. Edition, page, charge,
 * velocity, pressure, primer and case are not part of it, so a newer edition finds its older load.
 */
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

/**
 * The id of a load in its file: the first 10 hex digits of the SHA-1 of its natural key (maker,
 * cartridge, printed bullet text and mass, COAL, printed powder, charge kinds, barrel, marks; see
 * the docs page Published loads). `occurrence` counts loads of equal key in the order the table
 * prints them, from 1: the first has the bare hash, the second `<hash>-2` and so on. The same
 * load gets the same id in every edition, whatever its page, charges, velocity or pressure.
 */
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

/** JSON with the keys of every object sorted, so equal values compare equal. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (isObject(v))
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort(compareKeys)
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(',')}}`
  return JSON.stringify(v)
}

/** The dot paths at which `a` and `b` differ, leaves and missing keys. */
function differences(a: unknown, b: unknown, path: string): string[] {
  if (canonical(a) === canonical(b)) return []
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

/** Adds incoming load `l` to `report` against the repository's `old`; true where `l` is written. */
function classify(
  old: PublishedLoad | undefined,
  l: PublishedLoad,
  accept: ReadonlySet<string> | 'all',
  report: MergeReport,
) {
  if (old === undefined) {
    report.created.push(l.id)
    return true
  }
  const fields = differences(content(old), content(l), '')
  if (fields.length === 0) {
    report.unchanged.push(l.id)
    return false
  }
  const accepted = accept === 'all' || accept.has(l.id)
  report.changed.push({ id: l.id, fields, accepted })
  return accepted
}

/**
 * Merges an incoming edition of a table into the file in the repository, by load id:
 * - a load the repository lacks is created;
 * - a load whose content (all but `id`, `source`, `page` and `url`) is equal stays as it is,
 *   citing the edition that printed it;
 * - a load with other content is listed with the changed field paths and is replaced only where
 *   its id is in `accept`, or `accept` is `'all'`;
 * - a load of the repository the incoming edition does not print is kept and listed as absent.
 *
 * A created or accepted load cites the incoming source, appended to `provenance.sources` where the
 * file does not have it yet (the sources compare as JSON). The incoming file's loads get their ids
 * from {@link withLoadIds}; any id they carry is replaced. The loads come out sorted by id. The
 * file's other fields stay those of the repository; with no file there, the incoming file is
 * the start. `written` is false when the merge leaves the repository file as it is.
 */
export function mergePublishedLoads(
  existing: PublishedLoads | undefined,
  incoming: IncomingLoads,
  accept: ReadonlySet<string> | 'all',
): MergeResult {
  const loads = withLoadIds(incoming).loads
  const base: PublishedLoads = existing ?? {
    ...incoming,
    loads: [],
    provenance: { ...incoming.provenance, sources: [] },
  }
  const sources = [...base.provenance.sources]
  const sourceIndex = (i: number) => {
    const s = incoming.provenance.sources[i]
    const at = sources.findIndex((t) => canonical(t) === canonical(s))
    if (at >= 0) return at
    sources.push(s as (typeof sources)[number])
    return sources.length - 1
  }
  const byId = new Map(base.loads.map((l) => [l.id, l]))
  const report: MergeReport = { created: [], changed: [], unchanged: [], absent: [] }
  const printed = new Set<string>()
  for (const l of loads) {
    printed.add(l.id)
    if (classify(byId.get(l.id), l, accept, report))
      byId.set(l.id, citing(l, sourceIndex(l.source ?? 0)))
  }
  for (const l of base.loads) if (!printed.has(l.id)) report.absent.push(l.id)
  for (const list of [report.created, report.unchanged, report.absent]) list.sort(compareKeys)
  report.changed.sort((a, b) => compareKeys(a.id, b.id))
  const written = report.created.length > 0 || report.changed.some((c) => c.accepted)
  const file: PublishedLoads = {
    ...base,
    loads: [...byId.values()].sort((a, b) => compareKeys(a.id, b.id)),
    provenance: { ...base.provenance, sources },
  }
  return { file: written ? file : (existing ?? file), report, written }
}
