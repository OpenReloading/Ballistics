import { detailedFields, isWebLink, makerSourceFields } from '@rangefoundry/schema'
import type { Bundle } from './records.ts'
import type { SourceIndex } from './sources.ts'

/** Dot paths of the bullet and powder fields a listed source may name, a path covering the fields below it, and whether it may stand in a load. */
export interface ListedSourceFields {
  readonly bullet: readonly string[]
  readonly powder: readonly string[]
  readonly load: boolean
}

/**
 * The source records that are not a maker's, by id, each with the fields it may name and whether it
 * may stand in a load: our thermochemistry solver, our map of the makers' construction wording, and
 * the invented data of the demo records. Every other source a bullet, powder or load cites counts
 * as a maker's, whatever its `origin` or `publisher` says; only a community list of the bullet
 * length is not asked for a terms URL. An id or a field added here changes the guard of the public
 * catalog, and its pull request is reviewed as one. The solver and the wording map have no source
 * record yet; the importer change that first cites one adds its record under the id listed here.
 * Until then a mismatched id fails closed.
 */
export const nonMakerSources: Readonly<Record<string, ListedSourceFields>> = {
  'openreloading-constant-volume-equilibrium-solver': {
    bullet: [],
    powder: ['thermochemistry'],
    load: false,
  },
  'mapping-of-the-maker-wording-tools-src-bullets': {
    bullet: [
      'construction.raw',
      'construction.structure',
      'construction.core',
      'construction.jacket.material',
      'construction.surface',
      'construction.gasCheck',
      'construction.drivingBands',
      'construction.unmapped',
    ],
    powder: [],
    load: false,
  },
  'synthetic-test-data': {
    bullet: [
      'manufacturer',
      'productNumber',
      'name',
      'country',
      'productLine',
      'caliber',
      'diameter',
      'mass',
      'length',
      'base',
      'ogive',
      'cannelure',
      'tip',
      'meplatDiameter',
      'noseLength',
      'baseToOgive',
      'bearingLength',
      'construction',
      'ballisticCoefficients',
      'recommendedTwist',
      'slowestTwist',
      'note',
      'nameOnly',
    ],
    powder: [
      'manufacturer',
      'name',
      'aliases',
      'country',
      'grainForm',
      'propellantBase',
      'bulkDensity',
      'composition',
      'thermochemistry',
      'interior',
      'temperatureSensitivity',
      'listedCartridges',
      'note',
    ],
    load: true,
  },
}

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

// own keys only, so an id such as `constructor` stays a maker's
const isMakerId = (id: string | undefined) =>
  id === undefined || !Object.hasOwn(nonMakerSources, id)

/** The sources of `record` that count as a maker's: an embedded one, or one whose id `ids` gives outside {@link nonMakerSources}. */
const makerSources = (record: Cited, ids: Ids) =>
  (record.provenance?.sources ?? []).filter((_, i) => isMakerId(ids?.[i]))

const overlaps = (path: string, field: string) =>
  path === field || path.startsWith(`${field}.`) || field.startsWith(`${path}.`)

/** True when `source` states the community origin and names only the bullet `length`: a basic field the public catalog holds without a source, so trusting the stated origin admits nothing it would refuse. */
const isCommunityLengthList = (kind: 'bullet' | 'powder', source: CitedSource) =>
  kind === 'bullet' &&
  source.origin === 'community' &&
  source.fields?.every((f) => f === 'length') === true

/** Why the maker source `source` may not stand in a bullet or powder record: an unpublished source, a missing field list or terms URL (none asked of a community list, {@link isCommunityLengthList}), a license, or a detailed field outside {@link makerSourceFields}. */
function makerSourceFindings(kind: 'bullet' | 'powder', record: Cited, source: CitedSource) {
  const name = `source "${source.title}" (not a listed non-maker source)`
  const findings: string[] = []
  // a source without an address is data a maker sent us, which has no rules yet
  if (source.url === undefined)
    findings.push(
      `source "${source.title}" is not a listed non-maker source and has no URL: it counts as data received directly from a maker, which is not yet supported`,
    )
  else {
    if (!source.fields) findings.push(`${name}: names no fields`)
    if ((!source.terms || !isWebLink(source.terms)) && !isCommunityLengthList(kind, source))
      findings.push(`${name}: needs a terms URL`)
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

/** A listed source names only fields of its {@link nonMakerSources} entry, and names them unless it is `synthetic-test-data`. */
function listedSourceFindings(kind: 'bullet' | 'powder', record: Cited, ids: Ids): string[] {
  return (record.provenance?.sources ?? []).flatMap((source, i) => {
    const id = ids?.[i]
    if (id === undefined || isMakerId(id)) return []
    if (!source.fields)
      return id === 'synthetic-test-data' ? [] : [`listed source "${id}" names no fields`]
    const allowed = nonMakerSources[id]?.[kind] ?? []
    return source.fields
      .filter((f) => !allowed.some((a) => f === a || f.startsWith(`${a}.`)))
      .map((f) => `listed source "${id}" names ${f}, which it may not supply`)
  })
}

/** Why the source `id` may not stand in a load or a published-load file: a maker's, or a listed source without standing for loads. */
const loadFindings = (id: string | undefined) => {
  if (id === undefined) return ["cites an embedded source, which counts as a maker's"]
  if (isMakerId(id)) return [`cites source "${id}", which counts as a maker's`]
  return nonMakerSources[id]?.load
    ? []
    : [`cites listed source "${id}", which supplies no load field`]
}

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
    return [
      ...listedSourceFindings(fieldKind, record, ids),
      ...makerSources(record, ids).flatMap((s) => makerSourceFindings(fieldKind, record, s)),
    ]
  }
  if (kind === 'loads')
    return (record.provenance?.sources ?? []).flatMap((_, i) => loadFindings(ids?.[i]))
  return mayHoldMakerData(record)
    ? ['cites a manufacturer-origin source or a fitted source without an origin']
    : []
}

/**
 * The records of `bundle` the public catalog may not hold, by kind, in the order of the bundle;
 * kinds without one are left out. `citations` gives the cited source ids of each record file. A
 * bullet or powder may cite a maker's published source for the fields of `makerSourceFields`
 * only, and a listed source for the fields of its {@link nonMakerSources} entry only, named unless
 * it is `synthetic-test-data`; a catalogue load or a published-load file (`publishedLoads`, by
 * `<cartridge>/<id>`) no maker source and only a listed source that may stand in a load, and a
 * record of another kind no manufacturer-origin source or fitted source without an origin.
 * Manufacturer records are identity records and may cite their maker.
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
    if (published) add('publishedLoads', published, ids.flatMap(loadFindings))
  }
  return out
}
