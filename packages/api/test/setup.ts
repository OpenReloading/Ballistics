import { PGlite } from '@electric-sql/pglite'
import type { Bundle } from '@open-reloading/data'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { drizzle } from 'drizzle-orm/pglite'
import type { InjectOptions } from 'fastify'
import { beforeAll, expect } from 'vitest'
import { z } from 'zod'
import { buildApp } from '../src/app.ts'
import type { ComputeRunner } from '../src/compute/tasks.ts'
import { ensureTables } from '../src/db/build.ts'
import type { Db } from '../src/db/index.ts'
import { seedBundle } from '../src/db/seed.ts'
import { bundle } from './fixtures.ts'

/** An in-memory PostgreSQL (PGlite) with the tables built. */
export async function createTestDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite() })
  await ensureTables(db)
  return db
}

/** Closes a database from `createTestDb`. */
export async function closeTestDb(db: Db) {
  await (db as unknown as { $client: PGlite }).$client.close()
}

/**
 * An app on its own test database for the tests of a file or a describe block: built before them,
 * closed after them. `seed` is the bundle loaded (`false`: empty tables), `compute` as `buildApp`
 * takes it. `get` and `post` take the whole URL.
 */
export function withApi({
  seed = bundle,
  compute,
}: {
  seed?: Bundle | false
  compute?: ComputeRunner
} = {}) {
  const send = async (options: InjectOptions) => {
    const res = await api.app.inject(options)
    return { status: res.statusCode, body: res.json() }
  }
  const api = {
    db: undefined as unknown as Db,
    app: undefined as unknown as ReturnType<typeof buildApp>,
    get: (url: string) => send({ url }),
    post: (url: string, payload: unknown) =>
      send({ method: 'POST', url, payload: payload as object }),
  }
  beforeAll(async () => {
    api.db = await createTestDb()
    if (seed) await seedBundle(api.db, seed)
    api.app = buildApp({ db: api.db, compute })
    return async () => {
      await api.app.close()
      await closeTestDb(api.db)
    }
  })
  return api
}

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false })

/**
 * Checks a 200 body against the zod schema and against its JSON Schema of the contract document;
 * returns that JSON Schema and its validator.
 */
export function checkBody(schema: z.ZodType, body: unknown) {
  schema.parse(body)
  const json = z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' })
  const validate = ajv.compile(json)
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true)
  return { json, validate }
}

type Schema = Record<string, unknown>

/**
 * Paths of the JSON Schema properties without a non-empty description, at any depth of `schema`:
 * under `properties`, `items`, `additionalProperties`, `anyOf`, `oneOf`, `allOf` and `prefixItems`.
 */
export function undescribed(schema: unknown, path = ''): string[] {
  if (!schema || typeof schema !== 'object') return []
  const s = schema as Schema
  const own = Object.entries((s.properties ?? {}) as Record<string, Schema>).flatMap(
    ([key, value]) => {
      const at = `${path}.${key}`
      const missing =
        typeof value.description === 'string' && value.description.trim() !== '' ? [] : [at]
      return [...missing, ...undescribed(value, at)]
    },
  )
  const nested = ['items', 'additionalProperties'].flatMap((k) => undescribed(s[k], `${path}[]`))
  const lists = ['anyOf', 'oneOf', 'allOf', 'prefixItems'].flatMap((k) =>
    ((s[k] ?? []) as unknown[]).flatMap((x, i) => undescribed(x, `${path}<${k}${i}>`)),
  )
  return [...own, ...nested, ...lists]
}
