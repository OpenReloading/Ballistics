import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import type { Catalogue } from '../src/catalogue/types.ts'
import { inlineRunner } from '../src/compute/tasks.ts'
import { API_PREFIX } from '../src/version.ts'
import { bundle } from './fixtures.ts'
import { testCatalogue } from './setup.ts'

const reason = 'cannot read /app/packages/api/dist/catalogue/records.json: EACCES'

/** A catalogue whose record file cannot be read: the error carries a path, a code and a stack. */
const failingCatalogue = {
  get: () => {
    const error = Object.assign(new Error(reason), { code: 'EACCES' })
    error.stack = `${error.message}\n    at readFileSync (node:fs:441:20)`
    throw error
  },
} as unknown as Catalogue

/** An app on `catalogue` whose log lines are collected in `lines`. */
function withLog(catalogue: Catalogue) {
  const lines: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk))
      done()
    },
  })
  return { app: buildApp({ catalogue, logger: { level: 'info', stream } }), lines }
}

describe('error bodies', () => {
  it('answers 500 with a fixed message and the request id, and logs the error', async () => {
    const { app, lines } = withLog(failingCatalogue)
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
      for (const leak of ['alpha', 'EACCES', '/app/', 'records.json', 'readFileSync'])
        expect(res.body).not.toContain(leak)
      const logged = lines.map((l) => JSON.parse(l)).find((l) => l.err)
      expect(logged).toMatchObject({ level: 50, reqId: body.requestId })
      expect(logged.err.message).toContain(reason)
    } finally {
      await app.close()
    }
  })

  it('keeps the message of a 4xx, also through the error handler of a compute route', async () => {
    const app = buildApp({ catalogue: testCatalogue(bundle), compute: inlineRunner })
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
    }
  })

  it('refuses a query parameter a list does not declare, naming it, and a control character in q', async () => {
    const app = buildApp({ catalogue: testCatalogue(bundle), compute: inlineRunner })
    try {
      for (const list of [
        'cartridges',
        'bullets',
        'powders',
        'primers',
        'cases',
        'manufacturers',
        'federations',
        'disciplines',
        'target-mappings',
        'target-faces',
        'caliber-classes',
      ]) {
        const res = await app.inject({ url: `${API_PREFIX}/${list}?tabel=I` })
        expect([list, res.statusCode]).toEqual([list, 400])
        expect(res.json().message).toBe('querystring must NOT have additional properties: tabel')
      }
      for (const q of ['%01', 'a%01b', '%1F', '%7F', '%C2%9F']) {
        const res = await app.inject({ url: `${API_PREFIX}/cartridges?q=${q}` })
        expect([q, res.statusCode]).toEqual([q, 400])
      }
    } finally {
      await app.close()
    }
  })
})
