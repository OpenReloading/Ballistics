import pg from 'pg'
import { buildApp } from './app.ts'
import { loadBundle } from './bundle.ts'
import { ensureTables, waitForDb } from './db/build.ts'
import { createDb } from './db/index.ts'
import { seedBundle } from './db/seed.ts'
import { buildOpenApi } from './openapi.ts'

/** Advisory lock key held while building the tables and seeding. */
const startupLock = 47_110_815

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

const db = createDb(url)
await waitForDb(db)
const app = buildApp({ db, logger: true, openApi: await buildOpenApi() })
// One API process builds and seeds at a time; another waits on the lock (at most 10 minutes),
// then finds the database current. The lock is held by its own connection and released when that
// connection ends; losing it mid-way stops this process rather than let another one in.
const lock = new pg.Client({ connectionString: url })
const lost = (e: Error) => {
  app.log.error(e, 'lost the startup lock connection')
  process.exit(1)
}
lock.on('error', lost)
await lock.connect()
let built: boolean
let seeded: boolean
try {
  await lock.query("set lock_timeout = '10min'")
  const [{ locked }] = (
    await lock.query('select pg_try_advisory_lock($1) as locked', [startupLock])
  ).rows
  if (!locked) {
    app.log.info('another API process is building or seeding the database; waiting')
    await lock.query('select pg_advisory_lock($1)', [startupLock])
  }
  built = await ensureTables(db)
  seeded = await seedBundle(db, loadBundle())
} finally {
  // Done with the lock: an error while closing is only logged.
  lock.off('error', lost)
  lock.on('error', (e) => app.log.warn(e, 'closing the startup lock connection'))
  await lock.end().catch((e) => app.log.warn(e, 'closing the startup lock connection'))
}
if (built) app.log.info('tables built from the schema')
app.log.info(seeded ? 'database loaded from the data bundle' : 'database already current')
await app.listen({
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 3000),
})

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    await app.close()
    process.exit(0)
  })
}
