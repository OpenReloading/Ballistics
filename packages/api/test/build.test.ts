import { sql } from 'drizzle-orm'
import type pg from 'pg'
import { expect, it, vi } from 'vitest'
import { ddlStatements, ensureTables } from '../src/db/build.ts'
import { createDb } from '../src/db/index.ts'
import { seedBundle } from '../src/db/seed.ts'
import { bundle } from './fixtures.ts'
import { closeTestDb, createTestDb } from './setup.ts'

type TestDb = Awaited<ReturnType<typeof createTestDb>>

const count = async (db: TestDb, table: string) =>
  (
    (await db.execute(sql.raw(`select count(*)::int as n from ${table}`))) as unknown as {
      rows: { n: number }[]
    }
  ).rows[0]?.n

const exists = async (db: TestDb, name: string) =>
  (
    (await db.execute(sql`select to_regclass(${name})::text as name`)) as unknown as {
      rows: { name: string | null }[]
    }
  ).rows[0]?.name != null

it('builds a fresh database once and keeps it on the next start', async () => {
  const db = await createTestDb()
  try {
    expect(await count(db, 'cartridges')).toBe(0)
    expect(await seedBundle(db, bundle)).toBe(true)
    const seeded = await count(db, 'cartridges')
    expect(seeded).toBeGreaterThan(0)
    expect(await ensureTables(db)).toBe(false)
    expect(await seedBundle(db, bundle)).toBe(false)
    expect(await count(db, 'cartridges')).toBe(seeded)
  } finally {
    await closeTestDb(db)
  }
})

it('rebuilds the database when the schema changes, then reseeds', async () => {
  const db = await createTestDb()
  try {
    await seedBundle(db, bundle)
    const seeded = await count(db, 'cartridges')
    const changed = [...ddlStatements(), 'create table "extra" ("id" integer)']
    expect(await ensureTables(db, changed)).toBe(true)
    expect(await exists(db, 'extra')).toBe(true)
    expect(await count(db, 'cartridges')).toBe(0)
    expect(await seedBundle(db, bundle)).toBe(true)
    expect(await count(db, 'cartridges')).toBe(seeded)

    // a table the current DDL does not create stays
    expect(await ensureTables(db)).toBe(true)
    expect(await exists(db, 'extra')).toBe(true)
  } finally {
    await closeTestDb(db)
  }
})

it('rebuilds a database of an older build, keeping the tables it does not create', async () => {
  const db = await createTestDb()
  try {
    // a hash table without the schema hash, as an older volume has, next to tables of others
    await db.execute(sql`create schema drizzle`)
    await db.execute(sql`create table drizzle.journal (id integer)`)
    await db.execute(sql`create table public.other (id integer)`)
    await db.execute(sql`insert into public.other values (1)`)
    await db.execute(sql`alter table bundle_state drop column schema`)
    expect(await ensureTables(db)).toBe(true)
    expect(await exists(db, 'drizzle.journal')).toBe(true)
    expect(await count(db, 'public.other')).toBe(1)
    expect(await count(db, 'bundle_state')).toBe(1)
    expect(await seedBundle(db, bundle)).toBe(true)
    expect(await count(db, 'cartridges')).toBeGreaterThan(0)
  } finally {
    await closeTestDb(db)
  }
})

it('reseeds when the bundle changes, without rebuilding', async () => {
  const db = await createTestDb()
  try {
    await seedBundle(db, bundle)
    const seeded = await count(db, 'cartridges')
    const fewer = { ...bundle, cartridges: [], capacities: [] }
    expect(await ensureTables(db)).toBe(false)
    expect(await seedBundle(db, fewer)).toBe(true)
    expect(await count(db, 'cartridges')).toBe(0)
    expect(await seedBundle(db, bundle)).toBe(true)
    expect(await count(db, 'cartridges')).toBe(seeded)
  } finally {
    await closeTestDb(db)
  }
})

it('keeps enum columns to the values of the record schemas', async () => {
  const db = await createTestDb()
  try {
    const insert = (verification: string, method: string | null) =>
      db.execute(
        sql`insert into cartridges (id, name, aliases, cip_table, published, pressure_method, verification, provenance) values ('c', 'C', '{}', 'I', '2020-01-01', ${method}, ${verification}, '{}'::jsonb)`,
      )
    await expect(insert('other', null)).rejects.toThrow()
    await expect(insert('verified', 'other')).rejects.toThrow()
    await insert('verified', 'piezo')
  } finally {
    await closeTestDb(db)
  }
})

it('logs an idle client error of the server pool instead of throwing it', async () => {
  const pool = (createDb('postgres://u@127.0.0.1:1/x') as unknown as { $client: pg.Pool }).$client
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    expect(() => pool.emit('error', new Error('terminating connection'))).not.toThrow()
    expect(log).toHaveBeenCalledWith('idle database client error:', 'terminating connection')
    expect(pool.options.connectionTimeoutMillis).toBe(10_000)
  } finally {
    log.mockRestore()
    await pool.end()
  }
})
