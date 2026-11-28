import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  type Bundle,
  checkRecords,
  checkSources,
  type LocatedPublishedLoads,
  makerRows,
  type SourceIndex,
  sourceIndex,
} from '@rangefoundry/catalog'
import {
  bullet,
  caliberClass,
  cartridge,
  catalogueCase,
  catalogueCaseCapacity,
  catalogueLoad,
  catalogueSession,
  compareKeys,
  discipline,
  eventType,
  federation,
  firingSeries,
  type LoadTables,
  loadTable,
  manufacturer,
  type PublishedLoads,
  powder,
  primer,
  publishedLoads,
  rangeFirings,
  sourceRecord,
  targetFace,
  targetMapping,
} from '@rangefoundry/schema'
import { z } from 'zod'
import { readKind } from './read-kind.ts'

/** Parses one entry of `load-tables.json` into `tables`, or adds its issues to `found`. */
function readLoadTable(file: string, entry: unknown, tables: LoadTables, found: string[]) {
  const parsed = loadTable.safeParse(entry)
  if (parsed.success) tables[file] = parsed.data
  else
    for (const issue of parsed.error.issues)
      found.push(`load-tables.json: ${[file, ...issue.path].join('.')}: ${issue.message}`)
}

/** Listed in `load-tables.json` of a records folder (none without it); an entry that breaks `loadTable` is left out and adds its issues to `errors`, and without `errors` it throws. */
export function readLoadTables(dir: string, errors?: string[]): LoadTables {
  const path = join(dir, 'load-tables.json')
  if (!existsSync(path)) return {}
  let json: unknown
  try {
    json = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new Error(`${path}: invalid JSON: ${(e as Error).message}`)
  }
  const listed = z.record(z.string(), z.unknown()).safeParse(json)
  const found: string[] = errors ?? []
  const tables: LoadTables = {}
  if (!listed.success) found.push('load-tables.json: not an object of tables by row file')
  else
    for (const [file, entry] of Object.entries(listed.data))
      readLoadTable(file, entry, tables, found)
  if (!errors && found.length) throw new Error(found.join('\n'))
  return tables
}

/** The load tables of every root, none when no root has a `load-tables.json`; a file two roots list is an error, the first entry stays. */
function readRootsLoadTables(roots: readonly string[], errors: string[]): LoadTables | undefined {
  if (!roots.some((r) => existsSync(join(r, 'load-tables.json')))) return undefined
  const tables: LoadTables = {}
  for (const r of roots)
    for (const [file, table] of Object.entries(readLoadTables(r, errors))) {
      if (file in tables) errors.push(`load-tables.json: ${file} is listed by more than one root`)
      else tables[file] = table
    }
  return tables
}

/** Of every root's `loads/<cartridge id>/` folder, source references resolved; a missing `loads/` folder is no error, as the plain `Load` records in `loads/` itself are another kind. */
export function readPublishedLoads(
  roots: string[],
  sources: SourceIndex,
  errors: string[],
): LocatedPublishedLoads[] {
  const folders = new Set<string>()
  for (const root of roots) {
    const path = join(root, 'loads')
    if (!existsSync(path)) continue
    for (const entry of readdirSync(path, { withFileTypes: true }))
      if (entry.isDirectory()) folders.add(entry.name)
  }
  return [...folders]
    .sort(compareKeys)
    .flatMap((folder) =>
      readKind(roots, `loads/${folder}`, publishedLoads, { errors, sources, optional: true }).map(
        (file) => ({ folder, file }),
      ),
    )
}

/** What {@link readRecords} returns; valid data has no errors, and the published loads stay out of the bundle, as they are too many for it and the API serves them by cartridge. */
export type ReadRecordsResult = {
  bundle: Bundle
  publishedLoads: PublishedLoads[]
  errors: string[]
  /** Plausibility findings that do not fail validation: a published load stays as printed. */
  warnings: string[]
  /** By record file (`bullets/<id>.json`), the source record id of each provenance source, undefined for an embedded one. */
  citations: SourceIndex['citations']
}

/** The kind directories every full records root holds; `firings`, `range` and `event-types` may be missing. */
const kindDirectories = [
  'sources',
  'cartridges',
  'caliber-classes',
  'manufacturers',
  'powders',
  'primers',
  'bullets',
  'cases',
  'capacities',
  'loads',
  'chrono',
  'target-faces',
  'federations',
  'disciplines',
  'target-mappings',
] as const

/** Whether `root` holds every kind directory of a records root, which {@link readRecords} needs of its first root without a base bundle. */
export const holdsEveryKind = (root: string) =>
  kindDirectories.every((dir) =>
    statSync(join(root, dir), { throwIfNoEntry: false })?.isDirectory(),
  )

/** Reads every kind directory of `roots`, in this order, the source records first, each kind after the records of `base`. */
function readBundle(
  roots: string[],
  errors: string[],
  base: Bundle | undefined,
): { bundle: Bundle; published: LocatedPublishedLoads[]; citations: SourceIndex['citations'] } {
  const sources = sourceIndex(
    readKind(roots, 'sources', sourceRecord, { errors, base: base && [] }),
  )
  const read = <T extends { id: string }>(
    dir: string,
    schema: z.ZodType<T>,
    records: readonly T[] | undefined,
    optional = false,
  ) => readKind(roots, dir, schema, { errors, sources, optional, base: base && (records ?? []) })
  const bundle = {
    cartridges: read('cartridges', cartridge, base?.cartridges),
    caliberClasses: read('caliber-classes', caliberClass, base?.caliberClasses),
    manufacturers: read('manufacturers', manufacturer, base?.manufacturers),
    powders: read('powders', powder, base?.powders),
    primers: read('primers', primer, base?.primers),
    bullets: read('bullets', bullet, base?.bullets),
    cases: read('cases', catalogueCase, base?.cases),
    capacities: read('capacities', catalogueCaseCapacity, base?.capacities),
    loads: read('loads', catalogueLoad, base?.loads),
    chronoSessions: read('chrono', catalogueSession, base?.chronoSessions),
    firings: read('firings', firingSeries, base?.firings, true),
    rangeFirings: read('range', rangeFirings, base?.rangeFirings, true),
    targetFaces: read('target-faces', targetFace, base?.targetFaces),
    federations: read('federations', federation, base?.federations),
    disciplines: read('disciplines', discipline, base?.disciplines),
    targetMappings: read('target-mappings', targetMapping, base?.targetMappings),
    eventTypes: read('event-types', eventType, base?.eventTypes, true),
  }
  const published = readPublishedLoads(roots, sources, errors)
  checkSources(sources, errors)
  return { bundle, published, citations: sources.citations }
}

/** Under `root`, or under several roots read as one set (the first holds every kind directory, the `load-tables.json` of every root lists tables); with `base`, a bundle such as `@rangefoundry/catalog/bundle.json`, the roots add their records to it and none needs every kind directory. */
export function readRecords(root: string | readonly string[], base?: Bundle): ReadRecordsResult {
  const roots = typeof root === 'string' ? [root] : [...root]
  if (roots.length === 0) throw new Error('readRecords needs at least one records root')
  const errors: string[] = []
  const { bundle, published, citations } = readBundle(roots, errors, base)
  const loadTables = readRootsLoadTables(roots, errors)
  const singleRoot = roots.length === 1 && !base
  const checked = checkRecords({ bundle, published, loadTables, singleRoot })
  return {
    bundle,
    publishedLoads: published.map((p) => p.file),
    errors: [...errors, ...checked.errors],
    warnings: checked.warnings,
    citations,
  }
}

/** The folder of a `makerRows` kind: the bundle key in kebab case, but for the three keys below. */
const folders: Record<string, string> = {
  publishedLoads: 'loads',
  chronoSessions: 'chrono',
  rangeFirings: 'range',
}
const folderOf = (kind: string) =>
  folders[kind] ?? kind.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/** {@link readRecords} with the maker-source rule of the public catalog (`makerRows`) as errors: what `data:validate` checks. Not part of `readRecords`, which also reads private records. */
export function validateRecords(root: string | readonly string[]): ReadRecordsResult {
  const result = readRecords(root)
  const refused = Object.entries(makerRows(result.bundle, result.citations)).flatMap(
    ([kind, rows]) =>
      rows.flatMap(({ id, findings }) => findings.map((f) => `${folderOf(kind)}/${id}.json: ${f}`)),
  )
  return { ...result, errors: [...result.errors, ...refused] }
}
