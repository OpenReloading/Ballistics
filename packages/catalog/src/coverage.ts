import type { Provenance } from '@rangefoundry/schema'
import { isObject } from './json-object.ts'

/** Fields that name a record rather than carry data, and need no source of their own. */
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

function hasPath(record: unknown, path: string) {
  let node: unknown = record
  for (const key of path.split('.')) {
    if (!isObject(node) || !(key in node)) return false
    node = node[key]
  }
  return true
}

type Sourced = { provenance: Provenance }

/** Each `fields` entry of a source names a field of the record. */
function missingFields(record: Sourced): string[] {
  return record.provenance.sources.flatMap((source) =>
    (source.fields ?? [])
      .filter((field) => !hasPath(record, field))
      .map((field) => `source "${source.title}" names missing field ${field}`),
  )
}

/** Every data field is supported by a source; a source without `fields` supports them all. */
function uncoveredFields(record: Sourced): string[] {
  const { sources } = record.provenance
  if (sources.some((s) => !s.fields)) return []
  const paths: string[] = []
  for (const [key, value] of Object.entries(record)) {
    if (!identity.has(key) && key !== 'provenance') leaves(value, key, paths)
  }
  const covered = sources.flatMap((s) => s.fields ?? [])
  return paths
    .filter((path) => !covered.some((f) => path === f || path.startsWith(`${f}.`)))
    .map((path) => `field ${path} has no source`)
}

/**
 * Checks that every data field is supported by a source and that every `fields` entry names a
 * field of the record.
 */
export function checkCoverage(record: { provenance: Provenance }): string[] {
  return [...missingFields(record), ...uncoveredFields(record)]
}
