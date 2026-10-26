import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type RenameKind, type Renames, renameKind, renames } from '@open-reloading/schema'
import type { Bundle } from './records.ts'

/** The record ids of `bundle` per kind directory that has an id route. */
function currentIds(bundle: Bundle): Record<RenameKind, Set<string>> {
  const ids = (records: { id: string }[]) => new Set(records.map((r) => r.id))
  return {
    cartridges: ids(bundle.cartridges),
    manufacturers: ids(bundle.manufacturers),
    powders: ids(bundle.powders),
    bullets: ids(bundle.bullets),
    cases: ids(bundle.cases),
    'target-faces': ids(bundle.targetFaces),
    federations: ids(bundle.federations),
    disciplines: ids(bundle.disciplines),
    'target-mappings': ids(bundle.targetMappings),
    'caliber-classes': ids(bundle.caliberClasses),
  }
}

/**
 * The renames of the records roots, merged in order (none for a root without `renames.json`);
 * a file that is no JSON or breaks the schema is an error message in `errors`.
 */
export function readRenames(roots: readonly string[], errors: string[]): Renames {
  const merged: Renames = {}
  for (const root of roots) {
    const path = join(root, 'renames.json')
    if (!existsSync(path)) continue
    let json: unknown
    try {
      json = JSON.parse(readFileSync(path, 'utf8'))
    } catch (e) {
      errors.push(`renames.json: invalid JSON: ${(e as Error).message}`)
      continue
    }
    const parsed = renames.safeParse(json)
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        errors.push(`renames.json: ${issue.path.join('.')}: ${issue.message}`)
      continue
    }
    for (const kind of renameKind.options)
      if (parsed.data[kind]) merged[kind] = { ...merged[kind], ...parsed.data[kind] }
  }
  return merged
}

/** The id that replaces `id` of `kind` where it was renamed or removed, else `id`. */
export const resolveId = (map: Renames | undefined, kind: RenameKind, id: string) =>
  map?.[kind]?.[id] ?? id

/**
 * Every old id is no current record and every replacement is one, so a rename never chains and a
 * reference to an old id resolves in one step.
 */
export function checkRenames(bundle: Bundle, errors: string[]) {
  const ids = currentIds(bundle)
  for (const kind of renameKind.options) {
    for (const [old, now] of Object.entries(bundle.renames?.[kind] ?? {})) {
      const where = `renames.json: ${kind}.${old}`
      if (ids[kind].has(old)) errors.push(`${where}: "${old}" is still a record`)
      if (!ids[kind].has(now)) errors.push(`${where}: replacement "${now}" is no record`)
    }
  }
}
