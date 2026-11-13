import { detailedFields, isWebLink, makerSourceFields } from '@rangefoundry/schema'
import type { Bundle } from './records.ts'
import type { SourceIndex } from './sources.ts'

/**
 * Ids of the source records that are not a maker's: our thermochemistry solver, our map of the
 * makers' construction wording, and the invented data of the demo records. Every other source a
 * bullet, powder or load cites counts as a maker's, whatever its `origin` or `publisher` says. An id
 * added here changes the guard of the public catalog, and its pull request is reviewed as one.
 */
export const nonMakerSources: readonly string[] = [
  'openreloading-constant-volume-equilibrium-solver',
  'mapping-of-the-maker-wording-tools-src-bullets',
  'synthetic-test-data',
]

/** A record the public catalog may not hold, with what keeps it out. */
export interface MakerRow {
  id: string
  findings: string[]
}

/** A cited source as the gate reads it. */
interface CitedSource {
  title?: string | undefined
  kind?: string | undefined
  origin?: string | undefined
  url?: string | undefined
  fields?: string[] | undefined
  terms?: string | undefined
  license?: string | undefined
}

/** What a record carries that decides whether the public catalogue may hold it: its provenance, with the cited sources resolved. */
interface Cited {
  id: string
  provenance?: { kind?: string | undefined; sources?: CitedSource[] } | undefined
}

type Ids = readonly (string | undefined)[] | undefined

const isMakerId = (id: string | undefined) => id === undefined || !nonMakerSources.includes(id)

/** The sources of `record` that count as a maker's: an embedded one, or one whose id `ids` gives outside {@link nonMakerSources}. */
const makerSources = (record: Cited, ids: Ids) =>
  (record.provenance?.sources ?? []).filter((_, i) => isMakerId(ids?.[i]))

const overlaps = (path: string, field: string) =>
  path === field || path.startsWith(`${field}.`) || field.startsWith(`${path}.`)

/** Why the maker source `source` may not stand in a bullet or powder record: an unpublished source, a missing field list or terms URL, a license, or a detailed field outside {@link makerSourceFields}. */
function makerSourceFindings(kind: 'bullet' | 'powder', record: Cited, source: CitedSource) {
  const name = `maker source "${source.title}"`
  const findings: string[] = []
  // a source without an address is data a maker sent us, which has no rules yet
  if (source.url === undefined)
    findings.push(`${name}: data received directly from a maker is not yet supported`)
  else {
    if (!source.fields) findings.push(`${name}: names no fields`)
    if (!source.terms || !isWebLink(source.terms)) findings.push(`${name}: needs a terms URL`)
    if (source.license !== undefined) findings.push(`${name}: carries a license`)
  }
  const allowed = makerSourceFields[kind]
  for (const path of detailedFields(kind, record)) {
    const covered = !source.fields || source.fields.some((f) => overlaps(path, f))
    if (covered && !allowed.some((a) => path === a || path.startsWith(`${a}.`)))
      findings.push(`${name}: covers ${path}, which no maker source may supply`)
  }
  return findings
}

const loadFinding = (id: string | undefined) =>
  id === undefined
    ? "cites an embedded source, which counts as a maker's"
    : `cites source "${id}", which counts as a maker's`

/** True when `record` cites a manufacturer-origin source, or a fitted source that does not say whose data it was fitted to. */
const mayHoldMakerData = (record: Cited) =>
  (record.provenance?.sources ?? []).some(
    (s) =>
      s.origin === 'manufacturer' ||
      (s.origin === undefined && (s.kind ?? record.provenance?.kind) === 'fitted'),
  )

/** The findings of one record of `kind`, its file's source ids `ids`. */
function findingsOf(kind: string, record: Cited, ids: Ids): string[] {
  if (kind === 'bullets' || kind === 'powders') {
    const fieldKind = kind === 'bullets' ? 'bullet' : 'powder'
    return makerSources(record, ids).flatMap((s) => makerSourceFindings(fieldKind, record, s))
  }
  if (kind === 'loads')
    return (record.provenance?.sources ?? []).flatMap((_, i) =>
      isMakerId(ids?.[i]) ? [loadFinding(ids?.[i])] : [],
    )
  return mayHoldMakerData(record)
    ? ['cites a manufacturer-origin source or a fitted source without an origin']
    : []
}

/**
 * The records of `bundle` the public catalog may not hold, by kind, in the order of the bundle;
 * kinds without one are left out. `citations` gives the cited source ids of each record file. A
 * bullet or powder may cite a maker's published source for the fields of `makerSourceFields`
 * only, a catalogue load or a published-load file (`publishedLoads`, by `<cartridge>/<id>`) no
 * maker source, and a record of another kind no manufacturer-origin source or fitted source without
 * an origin. Manufacturer records are identity records and may cite their maker.
 */
export function makerRows(
  bundle: Bundle,
  citations: SourceIndex['citations'],
): Record<string, MakerRow[]> {
  const out: Record<string, MakerRow[]> = {}
  const add = (kind: string, id: string, findings: string[]) => {
    if (findings.length > 0) (out[kind] ??= []).push({ id, findings })
  }
  for (const [kind, records] of Object.entries(bundle)) {
    if (kind === 'manufacturers' || !Array.isArray(records)) continue
    for (const record of records as Cited[])
      add(kind, record.id, findingsOf(kind, record, citations.get(`${kind}/${record.id}.json`)))
  }
  for (const [file, ids] of citations) {
    const published = /^loads\/([^/]+\/[^/]+)\.json$/.exec(file)?.[1]
    if (published) add('publishedLoads', published, ids.filter(isMakerId).map(loadFinding))
  }
  return out
}
