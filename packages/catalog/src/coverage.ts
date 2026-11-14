import { detailedFields, type Provenance } from '@rangefoundry/schema'
import { isObject } from './json-object.ts'

/** The kinds whose fields the schema sorts into basic and detailed; every field of a manufacturer is basic. */
export type FieldClassKind = 'bullet' | 'powder' | 'manufacturer'

/** Of the kinds without field classes, the fields that name a record rather than carry data, and need no source of their own. */
const identity = new Set([
  'id',
  'origin',
  'manufacturer',
  'productNumber',
  'headstamp',
  'name',
  'productLine',
  'caliber',
  'cartridge',
  'note',
  'nameOnly',
])

/** Quantity objects (`{ value, raw }`) and arrays count as one field. */
function leaves(value: unknown, path: string, out: string[]) {
  const isQuantity =
    typeof value === 'object' && value !== null && !Array.isArray(value) && 'value' in value
  if (typeof value !== 'object' || value === null || Array.isArray(value) || isQuantity) {
    out.push(path)
    return
  }
  for (const [key, child] of Object.entries(value))
    leaves(child, path ? `${path}.${key}` : key, out)
}

const missing = Symbol('missing')

/** The value at the dot path `path` of `record`, or `missing` where a key on the way is absent. */
function valueAt(record: unknown, path: string): unknown {
  let node: unknown = record
  for (const key of path.split('.')) {
    if (!isObject(node) || !(key in node)) return missing
    node = node[key]
  }
  return node
}

/** The fields of `record` that need a covering source: the detailed ones where its kind has field classes, else each one outside the identity set. */
function sourcedFields(record: object, kind: FieldClassKind | undefined): string[] {
  const paths: string[] = []
  if (kind === 'manufacturer') return paths
  if (kind) {
    for (const path of detailedFields(kind, record)) leaves(valueAt(record, path), path, paths)
    return paths
  }
  for (const [key, value] of Object.entries(record)) {
    if (!identity.has(key) && key !== 'provenance') leaves(value, key, paths)
  }
  return paths
}

const noSource = (path: string) => `field ${path} has no source`

type Sourced = { provenance: Provenance }

/** Each `fields` entry of a source names a field of the record. */
function missingFields(record: Sourced): string[] {
  return record.provenance.sources.flatMap((source) =>
    (source.fields ?? [])
      .filter((field) => valueAt(record, field) === missing)
      .map((field) => `source "${source.title}" names missing field ${field}`),
  )
}

/** Each field of `paths` is supported by a source; a source without `fields` supports them all. */
function uncoveredFields(paths: string[], sources: Provenance['sources']): string[] {
  if (sources.some((s) => !s.fields)) return []
  const covered = sources.flatMap((s) => s.fields ?? [])
  return paths
    .filter((path) => !covered.some((f) => path === f || path.startsWith(`${f}.`)))
    .map(noSource)
}

/**
 * Checks that every field that needs a source has one, and that every `fields` entry names a field
 * of the record. Of a bullet or powder (`kind`) only the detailed fields need a source and of a
 * manufacturer none; of the other kinds every field outside the identity set does. A record without
 * provenance passes when none of its fields needs a source.
 */
export function checkCoverage(
  record: { provenance?: Provenance | undefined },
  kind?: FieldClassKind,
): string[] {
  const paths = sourcedFields(record, kind)
  const { provenance } = record
  if (!provenance) return paths.map(noSource)
  return [
    ...missingFields({ ...record, provenance }),
    ...uncoveredFields(paths, provenance.sources),
  ]
}
