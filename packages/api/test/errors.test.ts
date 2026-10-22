import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { inlineRunner } from '../src/compute/tasks.ts'
import type { Db } from '../src/db/index.ts'
import { API_PREFIX } from '../src/version.ts'
import { closeTestDb, createTestDb } from './setup.ts'

const sql = 'select "id", "name" from "cartridges" where "cartridges"."id" = $1'

/** A database whose every query fails as the driver reports it: SQL, parameters, a code and a stack. */
const failingDb = {
  select: () => {
    const error = Object.assign(new Error(`Failed query: ${sql}\nparams: alpha`), {
      code: '42P01',
      detail: 'relation "cartridges" does not exist',
    })
    error.stack = `${error.message}\n    at query (/app/packages/api/dist/db/queries.js:12:3)`
    throw error
  },
} as unknown as Db

/** An app on `db` whose log lines are collected in `lines`. */
function withLog(db: Db) {
  const lines: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk))
      done()
    },
  })
  return { app: buildApp({ db, logger: { level: 'info', stream } }), lines }
}

describe('error bodies', () => {
  it('answers 500 with a fixed message and the request id, and logs the error', async () => {
    const { app, lines } = withLog(failingDb)
    try {
      const res = await app.inject({ url: `${API_PREFIX}/cartridges/alpha` })
      expect(res.statusCode).toBe(500)
      const body = res.json()
      expect(body).toEqual({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'internal server error',
        requestId: expect.any(String),
      })
      for (const leak of ['select', 'cartridges', 'alpha', '42P01', 'relation', '/app/', 'queries'])
        expect(res.body).not.toContain(leak)
      const logged = lines.map((l) => JSON.parse(l)).find((l) => l.err)
      expect(logged).toMatchObject({ level: 50, reqId: body.requestId })
      expect(logged.err.message).toContain(sql)
    } finally {
      await app.close()
    }
  })

  it('keeps the message of a 4xx, also through the error handler of a compute route', async () => {
    const db = await createTestDb()
    const app = buildApp({ db, compute: inlineRunner })
    try {
      const invalid = await app.inject({ url: `${API_PREFIX}/cartridges?limit=999` })
      expect(invalid.statusCode).toBe(400)
      expect(invalid.json()).toEqual({
        statusCode: 400,
        code: 'FST_ERR_VALIDATION',
        error: 'Bad Request',
        message: 'querystring/limit must be <= 200',
      })
      const unknown = await app.inject({
        url: `${API_PREFIX}/exterior/stability?bullet=nope&twist=0.254&muzzleVelocity=800`,
      })
      expect(unknown.statusCode).toBe(404)
      expect(unknown.json()).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'bullet nope not found',
      })
    } finally {
      await app.close()
      await closeTestDb(db)
    }
  })
})
