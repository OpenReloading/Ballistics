import type { Provenance } from '@openreloading/schema'

/** Fields that name a record rather than carry data, and need no source of their own. */
const identity = new Set([
  'id',
  'origin',
  'manufacturer',
  'productNumber',
  'name',
  'productLine',
  'caliber',
  'cartridge',
  'note',
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

function hasPath(record: Record<string, unknown>, path: string) {
  let node: unknown = record
  for (const key of path.split('.')) {
    if (typeof node !== 'object' || node === null || !(key in node)) return false
    node = (node as Record<string, unknown>)[key]
  }
  return true
}

/**
 * Checks that every data field is supported by a source and that every `fields` entry names a
 * field of the record.
 */
export function checkCoverage(record: { provenance: Provenance }) {
  const errors: string[] = []
  const { sources } = record.provenance
  for (const source of sources) {
    for (const field of source.fields ?? []) {
      if (!hasPath(record as Record<string, unknown>, field))
        errors.push(`source "${source.title}" names missing field ${field}`)
    }
  }
  if (sources.some((s) => !s.fields)) return errors

  const paths: string[] = []
  for (const [key, value] of Object.entries(record)) {
    if (!identity.has(key) && key !== 'provenance') leaves(value, key, paths)
  }
  const covered = sources.flatMap((s) => s.fields ?? [])
  for (const path of paths) {
    if (!covered.some((f) => path === f || path.startsWith(`${f}.`))) {
      errors.push(`field ${path} has no source`)
    }
  }
  return errors
}
