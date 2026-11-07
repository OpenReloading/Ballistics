import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { z } from 'zod'
import { resolveRecord, type SourceIndex } from './sources.ts'

/**
 * Where reading adds its errors, the source records that resolve references, where given, and
 * whether the kind's directory may be missing from every root.
 */
type ReadContext = { errors: string[]; sources?: SourceIndex; optional?: boolean }

/** Parses the JSON file at `path`, or adds an `invalid JSON` error under `where`. */
function readJsonFile(
  path: string,
  where: string,
  errors: string[],
): { json: unknown } | undefined {
  try {
    return { json: JSON.parse(readFileSync(path, 'utf8')) }
  } catch (e) {
    errors.push(`${where}: invalid JSON: ${(e as Error).message}`)
  }
}

/** The id must equal the file name and be unique across roots; `owner` maps ids to directories. */
function checkRecordId(id: string, where: string, owner: Map<string, string>, errors: string[]) {
  if (id !== basename(where, '.json')) {
    errors.push(`${where}: id "${id}" does not match the file name`)
  }
  if (owner.has(id)) {
    errors.push(`${where}: id "${id}" is also in ${owner.get(id)}`)
  }
}

/**
 * Parses and validates one record file, its source references resolved from `sources` where given,
 * or adds its errors and returns undefined.
 */
function readRecordFile<T>(
  path: string,
  where: string,
  schema: z.ZodType<T>,
  { errors, sources }: ReadContext,
): T | undefined {
  const read = readJsonFile(path, where, errors)
  if (!read) return
  const json = sources ? resolveRecord(read.json, sources, where, errors) : read.json
  const parsed = schema.safeParse(json)
  if (parsed.success) return parsed.data
  for (const issue of parsed.error.issues) {
    errors.push(`${where}: ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  }
}

/** The records of directory `dir` of every root, validated against `schema`. */
export function readKind<T extends { id: string }>(
  roots: string[],
  dir: string,
  schema: z.ZodType<T>,
  context: ReadContext,
): T[] {
  const { errors, optional } = context
  // Every kind has a directory in the first root (an empty one holds a .gitkeep): a missing one is an
  // error, so a wrong or partial records root cannot pass as empty data. Further roots may lack it,
  // and so may every root for an `optional` kind.
  const records: T[] = []
  const owner = new Map<string, string>()
  roots.forEach((root, rootIndex) => {
    const path = join(root, dir)
    if (!existsSync(path)) {
      if (rootIndex === 0 && !optional) errors.push(`${dir}/: missing directory`)
      return
    }
    const files = readdirSync(path)
      .filter((f) => f.endsWith('.json'))
      .sort()
    for (const file of files) {
      const where = `${dir}/${file}`
      const record = readRecordFile(join(path, file), where, schema, context)
      if (!record) continue
      checkRecordId(record.id, where, owner, errors)
      owner.set(record.id, path)
      records.push(record)
    }
  })
  return records
}
