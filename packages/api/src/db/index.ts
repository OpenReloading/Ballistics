import { drizzle } from 'drizzle-orm/node-postgres'
import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import pg from 'pg'

/** Any async PostgreSQL database: node-postgres in the server, PGlite in tests. */
export type Db = PgAsyncDatabase<PgQueryResultHKT>

/**
 * Opens a node-postgres database on the connection string `url`; connects on the first query, a
 * connection attempt fails after 10 s and the server cancels a statement after 10 s.
 */
export function createDb(url: string): Db {
  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
  })
  // an idle client's error (database restart, dropped connection) is logged; the pool replaces the client
  pool.on('error', (e) => console.error('idle database client error:', e.message))
  return drizzle({ client: pool })
}
