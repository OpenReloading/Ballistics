import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type SQL, sql } from 'drizzle-orm'
import type { Db } from './index.ts'
import { bundleState } from './schema.ts'

/**
 * `dist/schema.json` at the package root, from `src/db/` and from `dist/db/`: the DDL of
 * `schema.ts` that `drizzle-kit export --output json` writes at build time.
 */
const ddlFile = join(import.meta.dirname, '..', '..', 'dist', 'schema.json')

/** The DDL statements of this build. Throws `Error` when the export did not succeed. */
export function ddlStatements(): string[] {
  const ddl = JSON.parse(readFileSync(ddlFile, 'utf8')) as {
    status?: string
    statements?: string[]
  }
  if (ddl.status !== 'ok' || !ddl.statements) throw new Error(`${ddlFile}: export failed`)
  return ddl.statements
}

/** Rows of a raw query: node-postgres and PGlite both answer `{ rows }`. */
async function rows<T>(db: Db, query: SQL) {
  return ((await db.execute(query)) as unknown as { rows: T[] }).rows
}

/** The DDL hash in `bundle_state`; undefined for an empty database or one of an older build. */
async function storedHash(db: Db) {
  const [found] = await rows<{ name: string | null }>(
    db,
    sql`select to_regclass('public.bundle_state')::text as name`,
  )
  if (!found?.name) return
  // as JSON: a table of an older build may lack the column
  const [state] = await rows<{ schema: string | null }>(
    db,
    sql`select to_jsonb(b) ->> 'schema' as schema from bundle_state b`,
  )
  return state?.schema ?? undefined
}

/**
 * Builds the tables from the DDL of this build unless the database holds them already. On a
 * database built from other DDL, the tables `statements` create are dropped first; other tables
 * stay. The seed then loads every table from the data bundle. Returns true when the tables were
 * built.
 */
export async function ensureTables(db: Db, statements = ddlStatements()) {
  const schema = createHash('sha256').update(JSON.stringify(statements)).digest('hex')
  if ((await storedHash(db)) === schema) return false
  // the quoted, possibly schema-qualified name as the DDL writes it
  const tables = statements.flatMap(
    (s) => /^create table ((?:"[^"]+"\.)?"[^"]+")/i.exec(s)?.[1] ?? [],
  )
  await db.transaction(async (tx) => {
    for (const t of tables) await tx.execute(sql.raw(`drop table if exists ${t} cascade`))
    for (const s of statements) await tx.execute(sql.raw(s))
    await tx.insert(bundleState).values({ id: 1, schema })
  })
  return true
}

/** Waits until the database accepts queries, for container start order. */
export async function waitForDb(db: Db, attempts = 30, delayMs = 1000) {
  for (let i = 1; ; i++) {
    try {
      await db.execute(sql`select 1`)
      return
    } catch (e) {
      if (i >= attempts) throw e
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}
